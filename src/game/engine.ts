import type { GameState, GameUnit, Castle, GameMode, AIProfile, BuildingType, BattleStance, LaneFocus, ResourceStock } from '../types/game';
import { AGES, CASTLE_MAX_HEALTH, GOLD_PER_SECOND, getUnitDamage } from './ages';
import { getGoldRatePerSecond } from './monetization';
import { remoteGameConfig } from '../lib/remoteConfig';
import { DEFAULT_RESOURCE_STATE, canAfford, spendResources, tickResources } from './systems/resources';
import { BUILDING_DEFINITIONS } from './entities/buildings';
import { assignVillagerToNode, drainDeliveredResources, tickGathering } from './systems/gathering';
import { TECH_TREE, canUnlockTech } from './systems/techTree';
import { planAIStrategy } from './ai/strategyPlanner';
import { applyCampaignPack } from './modes/campaignPacks';

let unitIdCounter = 0;
let buildingIdCounter = 0;
const LANES = [0.28, 0.5, 0.72];
let aiLastBossWave = 0;
const PARTICLE_POOL_LIMIT = 600;
const PROJECTILE_POOL_LIMIT = 220;
const FLOATING_TEXT_POOL_LIMIT = 120;
const particlePool: GameState['particles'] = [];
const projectilePool: GameState['projectiles'] = [];
const floatingTextPool: GameState['floatingTexts'] = [];
const BUILDING_MIN_DISTANCE = 56;
const BUILDING_LIMITS: Partial<Record<BuildingType, number>> = {
  town_center: 1,
  barracks: 4,
  farm: 8,
  house: 10,
  lumber_camp: 4,
  mill: 4,
  mine: 5,
  temple: 2,
  blacksmith: 2,
};

function getPopulationCap(state: GameState, isPlayer: boolean): number {
  const buildings = isPlayer ? state.playerBuildings : state.aiBuildings;
  let bonus = 0;
  for (const b of buildings) {
    bonus += BUILDING_DEFINITIONS[b.type].populationBonus ?? 0;
  }
  return 10 + bonus;
}

function getPopulationUsed(state: GameState, isPlayer: boolean): number {
  return state.units.filter((u) => u.isPlayer === isPlayer && !u.isDead).length;
}

export function canTrainUnit(
  state: GameState,
  unitCost: Partial<ResourceStock>,
  isPlayer = true
): boolean {
  const cap = getPopulationCap(state, isPlayer);
  const used = getPopulationUsed(state, isPlayer);
  if (isPlayer && used >= cap) return false;
  const stock = isPlayer ? state.playerResources : state.aiResources;
  return canAfford(stock, unitCost);
}

export function trainUnit(state: GameState, goldCost: number, isPlayer = true): boolean {
  const cost: Partial<ResourceStock> = { gold: goldCost };
  if (!canTrainUnit(state, cost, isPlayer)) return false;

  const updated = spendResources(isPlayer ? state.playerResources : state.aiResources, cost);
  if (isPlayer) {
    state.playerResources = updated;
    state.playerGold = updated.gold;
    state.currentPopulation += 1;
  } else {
    state.aiResources = updated;
    state.aiGold = updated.gold;
  }
  return true;
}

function allocParticle(
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  color: string,
  size: number,
  type: 'blood' | 'explosion' | 'spark' | 'levelup' | 'coin' | 'dust'
): GameState['particles'][number] {
  const p = particlePool.pop();
  if (p) {
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.color = color;
    p.size = size;
    p.type = type;
    return p;
  }
  return { x, y, vx, vy, life, maxLife: life, color, size, type };
}

function recycleParticle(p: GameState['particles'][number]): void {
  if (particlePool.length < PARTICLE_POOL_LIMIT) particlePool.push(p);
}

function allocProjectile(
  x: number,
  y: number,
  targetX: number,
  targetY: number,
  speed: number,
  damage: number,
  color: string,
  isPlayer: boolean,
  attackType: 'melee' | 'ranged' | 'tank' | 'siege'
): GameState['projectiles'][number] {
  const proj = projectilePool.pop();
  if (proj) {
    proj.x = x;
    proj.y = y;
    proj.prevX = x;
    proj.prevY = y;
    proj.targetX = targetX;
    proj.targetY = targetY;
    proj.speed = speed;
    proj.damage = damage;
    proj.color = color;
    proj.isPlayer = isPlayer;
    proj.attackType = attackType;
    return proj;
  }
  return { x, y, prevX: x, prevY: y, targetX, targetY, speed, damage, color, isPlayer, attackType };
}

function recycleProjectile(proj: GameState['projectiles'][number]): void {
  if (projectilePool.length < PROJECTILE_POOL_LIMIT) projectilePool.push(proj);
}

function allocFloatingText(
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
  life: number
): GameState['floatingTexts'][number] {
  const ft = floatingTextPool.pop();
  if (ft) {
    ft.text = text;
    ft.x = x;
    ft.y = y;
    ft.color = color;
    ft.size = size;
    ft.life = life;
    ft.maxLife = life;
    return ft;
  }
  return { text, x, y, color, size, life, maxLife: life };
}

function recycleFloatingText(ft: GameState['floatingTexts'][number]): void {
  if (floatingTextPool.length < FLOATING_TEXT_POOL_LIMIT) floatingTextPool.push(ft);
}
function generateUnitId(): string {
  return `unit_${++unitIdCounter}_${Math.random().toString(36).substr(2, 5)}`;
}

function generateBuildingId(): string {
  return `building_${++buildingIdCounter}_${Math.random().toString(36).substr(2, 5)}`;
}

function countPlayerBuildings(state: GameState, isPlayer: boolean, type: BuildingType): number {
  const list = isPlayer ? state.playerBuildings : state.aiBuildings;
  return list.filter((b) => b.type === type).length;
}

function hasBuildingSpace(state: GameState, isPlayer: boolean, x: number, y: number): boolean {
  const list = isPlayer ? state.playerBuildings : state.aiBuildings;
  for (const b of list) {
    const dx = b.x - x;
    const dy = b.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < BUILDING_MIN_DISTANCE) return false;
  }
  return true;
}

function getBuildingAdjustedResourceState(
  stock: GameState['playerResources'],
  buildings: GameState['playerBuildings']
): typeof DEFAULT_RESOURCE_STATE {
  const next = {
    ...DEFAULT_RESOURCE_STATE,
    stock: { ...stock },
    upkeepPerSecond: { ...DEFAULT_RESOURCE_STATE.upkeepPerSecond },
  };

  let blacksmithCount = 0;

  for (const b of buildings) {
    if (b.type === 'blacksmith') blacksmithCount += 1;
  }
  next.upkeepPerSecond.food = Math.max(0, (next.upkeepPerSecond.food ?? 0) - blacksmithCount * 0.04);

  return next;
}

function buildObjectivesForMode(mode: GameMode): GameState['objectives'] {
  if (mode === 'campaign') {
    return [
      { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
      { id: 'advance_age', label: 'Reach next age milestone', completed: false, progress: 0, target: 1 },
    ];
  }
  if (mode === 'endless') {
    return [
      { id: 'survive_duration', label: 'Survive for 10 minutes', completed: false, progress: 0, target: 600 },
      { id: 'destroy_enemies', label: 'Eliminate 60 attackers', completed: false, progress: 0, target: 60 },
    ];
  }
  if (mode === 'defense') {
    return [
      { id: 'survive_timer', label: 'Survive until match timer ends', completed: false, progress: 0, target: 1 },
      { id: 'fortress_alive', label: 'Keep fortress above zero health', completed: false, progress: 0, target: 1 },
    ];
  }
  if (mode === 'raid') {
    return [
      { id: 'destroy_enemy_castle', label: 'Destroy enemy castle before timer', completed: false, progress: 0, target: 1 },
      { id: 'damage_castle', label: 'Deal at least 60% castle damage', completed: false, progress: 0, target: 60 },
    ];
  }
  return [
    { id: 'destroy_enemy_castle', label: 'Destroy enemy castle', completed: false, progress: 0, target: 1 },
    { id: 'advance_age', label: 'Reach next age milestone', completed: false, progress: 0, target: 1 },
  ];
}

function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function missionSeed(state: GameState): number {
  return ((state.campaignSeed >>> 0) ^ ((state.campaignMissionIndex * 2654435761) >>> 0)) >>> 0;
}

function clampMissionModifiers(modifiers: GameState['missionModifiers']): GameState['missionModifiers'] {
  return {
    playerGoldRateMult: Math.max(0.82, Math.min(1.35, modifiers.playerGoldRateMult)),
    aiGoldRateMult: Math.max(0.82, Math.min(1.45, modifiers.aiGoldRateMult)),
    playerCastleHealthMult: Math.max(0.78, Math.min(1.45, modifiers.playerCastleHealthMult)),
    aiCastleHealthMult: Math.max(0.85, Math.min(1.5, modifiers.aiCastleHealthMult)),
    objectiveRewardMult: Math.max(0.9, Math.min(2.25, modifiers.objectiveRewardMult)),
  };
}

function buildCampaignEvent(
  roll: number
): {
  title: string;
  effect: string;
  apply: (modifiers: GameState['missionModifiers']) => GameState['missionModifiers'];
} {
  if (roll < 0.25) {
    return {
      title: 'Supply Surge',
      effect: 'Your logistics improve income and objective value.',
      apply: (modifiers) => ({
        ...modifiers,
        playerGoldRateMult: modifiers.playerGoldRateMult + 0.08,
        objectiveRewardMult: modifiers.objectiveRewardMult + 0.06,
      }),
    };
  }
  if (roll < 0.5) {
    return {
      title: 'Fortified Front',
      effect: 'Both fortresses receive extra plating before battle.',
      apply: (modifiers) => ({
        ...modifiers,
        playerCastleHealthMult: modifiers.playerCastleHealthMult + 0.1,
        aiCastleHealthMult: modifiers.aiCastleHealthMult + 0.08,
      }),
    };
  }
  if (roll < 0.75) {
    return {
      title: 'Enemy Sabotage',
      effect: 'Supply disruption weakens your economy but boosts rewards.',
      apply: (modifiers) => ({
        ...modifiers,
        playerGoldRateMult: modifiers.playerGoldRateMult - 0.07,
        aiGoldRateMult: modifiers.aiGoldRateMult + 0.08,
        objectiveRewardMult: modifiers.objectiveRewardMult + 0.12,
      }),
    };
  }
  return {
    title: 'Fog Skirmish',
    effect: 'Chaotic visibility slows both economies and favors tactical play.',
    apply: (modifiers) => ({
      ...modifiers,
      playerGoldRateMult: modifiers.playerGoldRateMult - 0.02,
      aiGoldRateMult: modifiers.aiGoldRateMult - 0.04,
      objectiveRewardMult: modifiers.objectiveRewardMult + 0.09,
    }),
  };
}

export function applyCampaignMissionConfig(state: GameState): void {
  const rng = createSeededRng(missionSeed(state));
  const missionTier = Math.max(1, Math.min(8, state.campaignMissionIndex));
  const pressureRoll = rng();
  const economyRoll = rng();
  const rewardRoll = rng();

  const modifiers = {
    playerGoldRateMult: Math.max(0.9, 1.02 + economyRoll * 0.1 - missionTier * 0.008),
    aiGoldRateMult: Math.min(1.3, 0.98 + pressureRoll * 0.12 + missionTier * 0.012),
    playerCastleHealthMult: Math.max(0.88, 1.05 - pressureRoll * 0.16 - missionTier * 0.01),
    aiCastleHealthMult: Math.min(1.35, 1 + pressureRoll * 0.12 + missionTier * 0.016),
    objectiveRewardMult: Math.min(1.8, 1.02 + missionTier * 0.06 + rewardRoll * 0.18),
  };

  let descriptor = `Mission ${state.campaignMissionIndex}: Frontline Engagement`;
  if (pressureRoll > 0.66) descriptor = `Mission ${state.campaignMissionIndex}: Iron Fortress`;
  else if (economyRoll > 0.66) descriptor = `Mission ${state.campaignMissionIndex}: Supply Race`;
  else if (rewardRoll > 0.66) descriptor = `Mission ${state.campaignMissionIndex}: High Stakes Push`;

  const base = buildObjectivesForMode(state.mode);
  const missionObjectives = base.map((objective) => {
    if (objective.id === 'advance_age') {
      const targetAge = Math.min(3, 1 + Math.floor((missionTier + rng() * 2) / 3));
      return {
        ...objective,
        label: `Reach Age ${targetAge + 1} milestone`,
        target: targetAge,
      };
    }
    if (objective.id === 'damage_castle') {
      const targetDamage = Math.min(90, 55 + missionTier * 2 + Math.floor(rng() * 12));
      return {
        ...objective,
        label: `Deal at least ${targetDamage}% castle damage`,
        target: targetDamage,
      };
    }
    return objective;
  });

  if (state.mode === 'defense' && missionTier >= 2) {
    missionObjectives.push({
      id: 'destroy_enemies',
      label: `Eliminate ${12 + missionTier * 2} attackers`,
      completed: false,
      progress: 0,
      target: 12 + missionTier * 2,
    });
  }

  const packResult = applyCampaignPack(
    state.campaignMissionIndex,
    state.mode,
    descriptor,
    modifiers,
    missionObjectives
  );
  const campaignEvent = buildCampaignEvent(rng());
  const eventAdjustedModifiers = clampMissionModifiers(campaignEvent.apply(packResult.modifiers));

  state.missionDescriptor = `${packResult.descriptor} [${packResult.rotationLabel}] - ${packResult.objectiveHint}`;
  state.campaignPackId = packResult.packId;
  state.campaignPackTitle = packResult.packTitle;
  state.nextCampaignPackTitle = packResult.nextPackTitle;
  state.campaignPackHint = packResult.objectiveHint;
  state.campaignEventTitle = campaignEvent.title;
  state.campaignEventEffect = campaignEvent.effect;
  state.missionModifiers = eventAdjustedModifiers;
  state.objectives = packResult.objectives;
  state.claimedObjectiveRewards = [];
  state.objectiveNotice = '';
  state.objectiveNoticeUntil = 0;
  state.matchRewardSummary = {
    objectiveGold: 0,
    objectiveGems: 0,
    objectiveBattlePassXP: 0,
  };
  state.playerCastle.maxHealth = Math.round(CASTLE_MAX_HEALTH * eventAdjustedModifiers.playerCastleHealthMult);
  state.playerCastle.health = state.playerCastle.maxHealth;
  state.aiCastle.maxHealth = Math.round(CASTLE_MAX_HEALTH * eventAdjustedModifiers.aiCastleHealthMult);
  state.aiCastle.health = state.aiCastle.maxHealth;
  state.raidInitialCastleHealth = state.aiCastle.maxHealth;
}

export function createInitialState(canvasWidth: number, _canvasHeight: number, mode: GameMode = 'assault'): GameState {
  unitIdCounter = 0;
  buildingIdCounter = 0;
  aiLastBossWave = 0;
  const modeTimeLimit = mode === 'defense' ? 180 : mode === 'raid' ? 150 : 0;
  const roll = Math.random();
  const aiProfile: AIProfile = mode === 'raid'
    ? (roll > 0.55 ? 'aggressive' : 'techrush')
    : mode === 'campaign'
      ? (roll > 0.52 ? 'defensive' : 'techrush')
    : mode === 'endless'
      ? (roll > 0.5 ? 'aggressive' : 'techrush')
    : mode === 'defense'
      ? (roll > 0.5 ? 'defensive' : 'aggressive')
      : (roll > 0.66 ? 'aggressive' : roll > 0.33 ? 'defensive' : 'techrush');
  const initialState: GameState = {
    mode,
    aiProfile,
    modeTimeLimit,
    raidInitialCastleHealth: CASTLE_MAX_HEALTH,
    surgeWarningUntil: 0,
    screen: 'playing',
    playerGold: 100,
    playerGems: 250,
    playerXP: 0,
    playerAge: 0,
    aiGold: 100,
    aiAge: 0,
    aiDirector: {
      skillEstimate: 0.5,
      pressureScore: 0,
      economyMode: 'balanced',
      macroPlan: aiProfile === 'defensive' ? 'stabilize' : aiProfile === 'techrush' ? 'boom' : 'siege',
      personalityVariance: 0.9 + Math.random() * 0.25,
      microRetreatThreshold: aiProfile === 'defensive' ? 0.42 : aiProfile === 'aggressive' ? 0.22 : 0.3,
      reserveGold: 120,
      nextSpawnAt: 1.6,
      nextMacroDecisionAt: 7,
      nextAgeCheckAt: 24,
      visualTelegraphUntil: 0,
      visualTelegraph: aiProfile,
      liveOpsDifficultyBias: 0,
      plannerNotes: 'Maintain parity while scaling.',
    },
    premiumPass: false,
    adFree: false,
    goldMineLevel: 0,
    speedBoostUntil: 0,
    purchasedOffers: [],
    missions: {
      spawnUnits: 0,
      destroyEnemies: 0,
    },
    claimedMissionRewards: {
      spawnUnits: false,
      destroyEnemies: false,
    },
    dailyChallenge: {
      targetKills: 20,
      targetSpawns: 25,
      rewardGems: 120,
      claimed: false,
      dayKey: '',
    },
    weeklyChallenge: {
      targetKills: 180,
      rewardGems: 700,
      claimed: false,
      weekKey: '',
    },
    onboardingSteps: {
      spawnedUnit: false,
      usedTactic: false,
      claimedReward: false,
    },
    rewardChestProgress: 0,
    unclaimedChests: 0,
    winStreak: 0,
    lossStreak: 0,
    tutorialStep: 0,
    tutorialDismissed: false,
    adaptiveAssistUntil: 0,
    adaptiveAssistCooldownUntil: 0,
    adaptiveAssistActivations: 0,
    onboardingBonusClaimed: false,
    lastMatchGrade: 'C',
    lastMatchBonusGold: 0,
    lastMatchBonusGems: 0,
    lastMatchTip: 'Build your first army and push lanes together.',
    seasonalTokens: 0,
    seasonXP: 0,
    battlePassXP: 0,
    lifetimeSpendUsd: 0,
    lastDailyRewardAt: 0,
    matchesPlayed: 0,
    playerCastle: {
      x: 80,
      health: CASTLE_MAX_HEALTH,
      maxHealth: CASTLE_MAX_HEALTH,
      age: 0,
      isPlayer: true,
    },
    aiCastle: {
      x: canvasWidth - 80,
      health: CASTLE_MAX_HEALTH,
      maxHealth: CASTLE_MAX_HEALTH,
      age: 0,
      isPlayer: false,
    },
    playerResources: {
      ...DEFAULT_RESOURCE_STATE.stock,
      gold: 100,
    },
    aiResources: {
      ...DEFAULT_RESOURCE_STATE.stock,
      gold: 100,
    },
    populationCap: 10,
    currentPopulation: 0,
    unlockedTechs: [],
    claimedObjectiveRewards: [],
    campaignMissionIndex: 1,
    campaignSeed: Math.floor(Math.random() * 100000),
    campaignProgressAwarded: false,
    campaignPackId: 'frontier',
    campaignPackTitle: 'Frontier Trials',
    nextCampaignPackTitle: 'Warpath Escalation',
    campaignPackHint: 'Build momentum and secure your first victories.',
    campaignEventTitle: 'Supply Surge',
    campaignEventEffect: 'Your logistics improve income and objective value.',
    missionDescriptor: 'Mission 1: Frontline Engagement',
    missionModifiers: {
      playerGoldRateMult: 1,
      aiGoldRateMult: 1,
      playerCastleHealthMult: 1,
      aiCastleHealthMult: 1,
      objectiveRewardMult: 1,
    },
    matchRewardSummary: {
      objectiveGold: 0,
      objectiveGems: 0,
      objectiveBattlePassXP: 0,
    },
    objectiveNotice: '',
    objectiveNoticeUntil: 0,
    objectives: buildObjectivesForMode(mode),
    playerBuildings: [
      {
        id: generateBuildingId(),
        type: 'town_center',
        level: 1,
        health: BUILDING_DEFINITIONS.town_center.maxHealth,
        maxHealth: BUILDING_DEFINITIONS.town_center.maxHealth,
        x: 120,
        y: 100,
        isPlayer: true,
        constructedAt: 0,
      },
    ],
    aiBuildings: [
      {
        id: generateBuildingId(),
        type: 'town_center',
        level: 1,
        health: BUILDING_DEFINITIONS.town_center.maxHealth,
        maxHealth: BUILDING_DEFINITIONS.town_center.maxHealth,
        x: canvasWidth - 120,
        y: 100,
        isPlayer: false,
        constructedAt: 0,
      },
    ],
    resourceNodes: [
      { id: 'node_tree_1', type: 'tree', position: { x: 200, y: 240 }, resourceAmount: 2000, gatherRate: 2.2 },
      { id: 'node_tree_2', type: 'tree', position: { x: 260, y: 300 }, resourceAmount: 2000, gatherRate: 2.2 },
      { id: 'node_berry_1', type: 'berry_bush', position: { x: 230, y: 180 }, resourceAmount: 1600, gatherRate: 1.9 },
      { id: 'node_gold_1', type: 'gold_mine', position: { x: 360, y: 260 }, resourceAmount: 1800, gatherRate: 1.5 },
      { id: 'node_stone_1', type: 'stone_mine', position: { x: 400, y: 320 }, resourceAmount: 1800, gatherRate: 1.4 },
    ],
    villagers: [],
    units: [],
    particles: [],
    projectiles: [],
    floatingTexts: [],
    wave: 1,
    kills: 0,
    isVictory: false,
    ageUpAnim: 0,
    shakeScreen: 0,
    playerBattleStance: 'balanced',
    playerLaneFocus: 'auto',
    rallyUntil: 0,
    rallyCooldownUntil: 0,
    fortifyCooldownUntil: 0,
    time: 0,
  };
  applyCampaignMissionConfig(initialState);
  return initialState;
}

export function spawnUnit(state: GameState, unitType: number, isPlayer: boolean, canvasHeight: number): GameUnit | null {
  const age = isPlayer ? state.playerAge : state.aiAge;
  const ageConfig = AGES[age];
  
  if (!ageConfig || unitType >= ageConfig.units.length) return null;
  
  const unitStats = ageConfig.units[unitType];
  if (!trainUnit(state, unitStats.cost, isPlayer)) return null;
  
  const laneIndex = Math.floor(Math.random() * LANES.length);
  const laneY = LANES[laneIndex] * canvasHeight;
  const yOffset = Math.max(70, Math.min(canvasHeight - 170, laneY + (Math.random() - 0.5) * 28));
  
  const unit: GameUnit = {
    id: generateUnitId(),
    type: unitType,
    age: age,
    x: isPlayer ? state.playerCastle.x + 60 : state.aiCastle.x - 60,
    y: yOffset,
    health: unitStats.health,
    maxHealth: unitStats.health,
    damage: getUnitDamage(age, unitStats.type),
    speed: unitStats.speed,
    range: unitStats.range,
    attackSpeed: unitStats.attackSpeed,
    lastAttackTime: 0,
    isPlayer: isPlayer,
    target: null,
    isAttacking: false,
    isDead: false,
    deathTime: 0,
    attackAnim: 0,
    aiStrategyTag: isPlayer ? undefined : state.aiDirector.visualTelegraph,
  };
  
  state.units.push(unit);
  if (isPlayer && unitType === 0) {
    const villager = {
      id: unit.id,
      position: { x: unit.x, y: unit.y },
      assignedNode: null as string | null,
      carriedResource: null as { type: 'food' | 'wood' | 'stone' | 'gold'; amount: number } | null,
      state: 'idle' as const,
      owner: 'player' as const,
    };
    const bestNode = state.resourceNodes.find((n) => n.resourceAmount > 0);
    if (bestNode) {
      assignVillagerToNode(villager, bestNode);
    }
    state.villagers.push(villager);
  }
  if (isPlayer) {
    state.currentPopulation = getPopulationUsed(state, true);
    state.populationCap = getPopulationCap(state, true);
  }
  emitRadialParticles(state, unit.x, unit.y, 7, '#C9B8A8', 'dust', 18, 55, 0.35, 0.75, 2, 4.2);
  emitRadialParticles(state, unit.x, unit.y, 5, AGES[age].themeColor, 'spark', 30, 85, 0.2, 0.45, 1.4, 2.8);
  if (isPlayer) {
    state.missions.spawnUnits += 1;
  }
  return unit;
}

export function addFloatingText(
  state: GameState,
  text: string,
  x: number,
  y: number,
  color = '#FFD76A',
  size = 18,
  life = 1.2
): void {
  state.floatingTexts.push(allocFloatingText(text, x, y, color, size, life));
}

export function canUpgradeAge(state: GameState, isPlayer: boolean): boolean {
  const currentAge = isPlayer ? state.playerAge : state.aiAge;
  if (currentAge >= AGES.length - 1) return false;
  
  const nextAge = currentAge + 1;
  const xpRequired = AGES[nextAge].xpRequired;
  
  return isPlayer ? state.playerXP >= xpRequired : true;
}

export function upgradeAge(state: GameState, isPlayer: boolean): boolean {
  if (!canUpgradeAge(state, isPlayer)) return false;
  
  if (isPlayer) {
    state.playerAge = Math.min(state.playerAge + 1, AGES.length - 1);
    state.playerCastle.age = state.playerAge;
  } else {
    state.aiAge = Math.min(state.aiAge + 1, AGES.length - 1);
    state.aiCastle.age = state.aiAge;
  }
  
  state.ageUpAnim = 1;
  
  // Add level up particles
  for (let i = 0; i < 30; i++) {
    state.particles.push(
      allocParticle(
        isPlayer ? state.playerCastle.x : state.aiCastle.x,
        200 + Math.random() * 200,
        (Math.random() - 0.5) * 150,
        -Math.random() * 200 - 50,
        2,
        isPlayer ? '#FFD700' : '#FF4444',
        4 + Math.random() * 6,
        'levelup'
      )
    );
  }
  
  return true;
}

function findNearestEnemy(unit: GameUnit, state: GameState): GameUnit | null {
  let nearest: GameUnit | null = null;
  let nearestDist = Infinity;
  
  for (const other of state.units) {
    if (other.isPlayer === unit.isPlayer) continue;
    if (other.isDead) continue;
    
    const dx = other.x - unit.x;
    const dy = other.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = other;
    }
  }
  
  return nearest;
}

function findPriorityEnemy(unit: GameUnit, state: GameState): GameUnit | null {
  let bestTarget: GameUnit | null = null;
  let bestScore = -Infinity;

  for (const other of state.units) {
    if (other.isPlayer === unit.isPlayer) continue;
    if (other.isDead) continue;

    const dx = other.x - unit.x;
    const dy = other.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const enemyType = getUnitType(other);

    // Favor high-value targets (siege/ranged), but still account for distance.
    let score = -dist;
    if (enemyType === 'siege') score += 140;
    else if (enemyType === 'ranged') score += 80;
    else if (enemyType === 'tank') score += 20;

    if (dist <= unit.range + 40) score += 35;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = other;
    }
  }

  return bestTarget;
}

function findEnemyCastle(unit: GameUnit, state: GameState): Castle | null {
  const castle = unit.isPlayer ? state.aiCastle : state.playerCastle;
  if (castle.health <= 0) return null;
  return castle;
}

function distanceToCastle(unit: GameUnit, castle: Castle): number {
  return Math.abs(unit.x - castle.x);
}

function getUnitType(unit: GameUnit): 'melee' | 'ranged' | 'tank' | 'siege' {
  return AGES[unit.age].units[unit.type].type;
}

function getCounterMultiplier(
  attackerType: 'melee' | 'ranged' | 'tank' | 'siege',
  defenderType: 'melee' | 'ranged' | 'tank' | 'siege'
): number {
  if (attackerType === defenderType) return 1;
  if (attackerType === 'melee' && defenderType === 'tank') return 1.26;
  if (attackerType === 'melee' && defenderType === 'ranged') return 0.9;
  if (attackerType === 'ranged' && defenderType === 'melee') return 1.24;
  if (attackerType === 'ranged' && defenderType === 'siege') return 0.9;
  if (attackerType === 'tank' && defenderType === 'ranged') return 1.25;
  if (attackerType === 'tank' && defenderType === 'melee') return 0.92;
  if (attackerType === 'siege' && defenderType === 'tank') return 1.18;
  if (attackerType === 'siege' && defenderType === 'melee') return 1.08;
  if (attackerType === 'siege' && defenderType === 'ranged') return 0.88;
  return 1;
}

function getSuddenDeathMultiplier(time: number): number {
  if (time < 360) return 1;
  const overtime = time - 360;
  return 1 + Math.min(0.65, overtime / 180);
}

function getLaneIndex(y: number, canvasHeight: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < LANES.length; i++) {
    const laneY = LANES[i] * canvasHeight;
    const d = Math.abs(y - laneY);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function getLaneControl(state: GameState, canvasHeight: number): number[] {
  const control = [0, 0, 0];
  for (const u of state.units) {
    if (u.isDead) continue;
    const lane = getLaneIndex(u.y, canvasHeight);
    const type = getUnitType(u);
    const weight = type === 'tank' ? 1.4 : type === 'siege' ? 1.2 : 1;
    control[lane] += u.isPlayer ? weight : -weight;
  }
  return control;
}

function getMostContestedLane(control: number[]): number {
  let bestLane = 1;
  let smallestAbs = Infinity;
  for (let i = 0; i < control.length; i++) {
    const abs = Math.abs(control[i]);
    if (abs < smallestAbs) {
      smallestAbs = abs;
      bestLane = i;
    }
  }
  return bestLane;
}

function spawnUnitInLane(
  state: GameState,
  unitType: number,
  isPlayer: boolean,
  canvasHeight: number,
  laneIndex: number
): GameUnit | null {
  const unit = spawnUnit(state, unitType, isPlayer, canvasHeight);
  if (!unit) return null;
  const lane = LANES[Math.max(0, Math.min(LANES.length - 1, laneIndex))];
  const laneY = lane * canvasHeight;
  unit.y = Math.max(70, Math.min(canvasHeight - 170, laneY + (Math.random() - 0.5) * 16));
  return unit;
}

function applyCameraShake(state: GameState, intensity: number): void {
  state.shakeScreen = Math.max(state.shakeScreen, Math.min(1, intensity));
}

function emitRadialParticles(
  state: GameState,
  x: number,
  y: number,
  count: number,
  color: string,
  type: 'blood' | 'explosion' | 'spark' | 'dust',
  speedMin: number,
  speedMax: number,
  lifeMin: number,
  lifeMax: number,
  sizeMin: number,
  sizeMax: number
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const life = lifeMin + Math.random() * (lifeMax - lifeMin);
    state.particles.push(
      allocParticle(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 12,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - Math.random() * 50,
        life,
        color,
        sizeMin + Math.random() * (sizeMax - sizeMin),
        type
      )
    );
  }
}

function emitUnitHitEffect(state: GameState, target: GameUnit, heavy = false): void {
  const burst = heavy ? 10 : 6;
  emitRadialParticles(state, target.x, target.y, burst, '#FF5A5A', 'blood', 35, 95, 0.28, 0.56, 1.8, 3.4);
  emitRadialParticles(state, target.x, target.y, Math.ceil(burst * 0.75), '#FFD2A0', 'spark', 45, 130, 0.18, 0.4, 1.2, 2.4);
}

function emitCastleImpactEffect(state: GameState, castle: Castle, y: number, damage: number): void {
  const dustCount = Math.max(8, Math.min(24, Math.floor(damage / 14)));
  const sparkCount = Math.max(4, Math.min(16, Math.floor(damage / 22)));
  const debrisCount = Math.max(2, Math.min(10, Math.floor(damage / 35)));
  emitRadialParticles(state, castle.x, y, dustCount, '#B48A64', 'dust', 25, 90, 0.4, 0.95, 2.8, 6);
  emitRadialParticles(state, castle.x, y, sparkCount, '#FF9A52', 'spark', 35, 115, 0.25, 0.6, 1.8, 3.6);
  emitRadialParticles(state, castle.x, y + 6, debrisCount, '#4A3A32', 'explosion', 40, 125, 0.5, 1.05, 3.2, 6.5);
}

function onUnitKilled(state: GameState, attackerIsPlayer: boolean, defeated: GameUnit): void {
  defeated.isDead = true;
  defeated.deathTime = state.time;

  if (attackerIsPlayer && !defeated.isPlayer) {
    state.playerXP += remoteGameConfig.getXpPerKill();
    state.battlePassXP += 12;
    state.kills++;
    state.missions.destroyEnemies += 1;
  }

  emitRadialParticles(
    state,
    defeated.x,
    defeated.y,
    12,
    AGES[defeated.age].themeColor,
    'explosion',
    45,
    140,
    0.6,
    1.2,
    2.8,
    5.8
  );
  emitRadialParticles(state, defeated.x, defeated.y + 8, 10, '#9C6B44', 'dust', 25, 90, 0.45, 0.95, 2.4, 5.5);
  applyCameraShake(state, 0.16);
}

export function updateGame(state: GameState, dt: number, canvasWidth: number, canvasHeight: number): void {
  state.time += dt;
  const playerResTick = tickResources(
    getBuildingAdjustedResourceState(
      { ...state.playerResources, gold: state.playerGold },
      state.playerBuildings
    ),
    dt
  );
  const aiResTick = tickResources(
    getBuildingAdjustedResourceState(
      { ...state.aiResources, gold: state.aiGold },
      state.aiBuildings
    ),
    dt
  );
  state.playerResources = playerResTick.stock;
  state.aiResources = aiResTick.stock;
  state.playerGold = state.playerResources.gold;
  state.aiGold = state.aiResources.gold;

  // AoE-style worker loop: villagers gather from world nodes then deliver to stock.
  tickGathering(state.villagers, state.resourceNodes, state.playerBuildings, dt);
  const delivered = drainDeliveredResources(state.villagers);
  for (const key of Object.keys(delivered) as Array<'food' | 'wood' | 'stone' | 'gold'>) {
    state.playerResources[key] += delivered[key] ?? 0;
  }
  state.playerGold = state.playerResources.gold;

  const waveSec = Math.max(20, remoteGameConfig.getBossWaveIntervalSec());
  state.wave = Math.max(1, Math.floor(state.time / waveSec) + 1);
  if (state.wave % 5 === 4 && state.time % waveSec > waveSec - 9) {
    state.surgeWarningUntil = state.time + 2.5;
  }
  
  // Gold generation
  const goldRate = getGoldRatePerSecond(state, AGES[state.playerAge].goldBonus, state.time) * state.missionModifiers.playerGoldRateMult;
  const playerCastleRatio = state.playerCastle.health / state.playerCastle.maxHealth;
  const aiCastleRatio = state.aiCastle.health / state.aiCastle.maxHealth;
  const playerRubberBand = playerCastleRatio < aiCastleRatio ? 1 + (aiCastleRatio - playerCastleRatio) * 0.5 : 1;
  state.playerGold += goldRate * dt * playerRubberBand;
  
  const aiGoldRate = (GOLD_PER_SECOND + AGES[state.aiAge].goldBonus) * state.missionModifiers.aiGoldRateMult;
  const aiRubberBand = aiCastleRatio < playerCastleRatio ? 1 + (playerCastleRatio - aiCastleRatio) * 0.35 : 1;
  state.aiGold += aiGoldRate * dt * aiRubberBand;

  // Adaptive assist for struggling players: gentle comeback mechanic.
  if (
    (state.lossStreak >= 2 || playerCastleRatio < 0.4) &&
    state.time > 60 &&
    state.time >= state.adaptiveAssistCooldownUntil
  ) {
    state.adaptiveAssistUntil = state.time + 18;
    state.adaptiveAssistCooldownUntil = state.time + 120;
    state.adaptiveAssistActivations += 1;
    state.playerGold += 180;
    state.playerCastle.health = Math.min(state.playerCastle.maxHealth, state.playerCastle.health + state.playerCastle.maxHealth * 0.08);
  }
  
  // Age up anim decay
  if (state.ageUpAnim > 0) {
    state.ageUpAnim -= dt * 0.5;
    if (state.ageUpAnim < 0) state.ageUpAnim = 0;
  }
  
  // Screen shake decay
  if (state.shakeScreen > 0) {
    state.shakeScreen -= dt * 3.9;
    if (state.shakeScreen < 0) state.shakeScreen = 0;
  }
  
  const aiRetreatThreshold = state.aiDirector.microRetreatThreshold;
  const aiStabilizeMode = state.aiDirector.macroPlan === 'stabilize';
  const stanceMoveMult = state.playerBattleStance === 'aggressive' ? 1.1 : state.playerBattleStance === 'defensive' ? 0.9 : 1;
  const stanceDamageMult = state.playerBattleStance === 'aggressive' ? 1.1 : state.playerBattleStance === 'defensive' ? 0.94 : 1;
  const stanceRangeBonus = state.playerBattleStance === 'defensive' ? 14 : state.playerBattleStance === 'aggressive' ? -3 : 0;
  const laneFocusIndex = state.playerLaneFocus === 'left' ? 0 : state.playerLaneFocus === 'center' ? 1 : state.playerLaneFocus === 'right' ? 2 : -1;
  const laneFocusY = laneFocusIndex >= 0 ? LANES[laneFocusIndex] * canvasHeight : null;

  // Update units
  for (const unit of state.units) {
    if (unit.isDead) continue;

    // Micro layer: low-health AI units can pull back to regroup.
    if (!unit.isPlayer) {
      const hpRatio = unit.health / Math.max(1, unit.maxHealth);
      const shouldRetreat = hpRatio < aiRetreatThreshold && (aiStabilizeMode || unit.x < state.aiCastle.x - 150);
      if (shouldRetreat) {
        unit.target = null;
        unit.isAttacking = false;
        const retreatSpeed = unit.speed * dt * (aiStabilizeMode ? 1.15 : 0.95);
        unit.x = Math.min(state.aiCastle.x - 85, unit.x + retreatSpeed);
        const defendLine = canvasHeight * LANES[1];
        unit.y += (defendLine - unit.y) * dt * 1.4;
        unit.x = Math.max(20, Math.min(canvasWidth - 20, unit.x));
        unit.y = Math.max(50, Math.min(canvasHeight - 150, unit.y));
        continue;
      }
    }
    
    if (unit.isPlayer && laneFocusY != null) {
      unit.y += (laneFocusY - unit.y) * dt * (state.playerBattleStance === 'aggressive' ? 1.5 : 1.25);
    }

    // Find target
    const enemyCastle = findEnemyCastle(unit, state);
    const nearestEnemy = findPriorityEnemy(unit, state) || findNearestEnemy(unit, state);
    
    let targetIsCastle = false;
    
    // Prioritize: enemy units first, then castle
    if (nearestEnemy) {
      const dx = nearestEnemy.x - unit.x;
      const dy = nearestEnemy.y - unit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const unitLane = getLaneIndex(unit.y, canvasHeight);
      const enemyLane = getLaneIndex(nearestEnemy.y, canvasHeight);
      const laneAligned = unitLane === enemyLane;
      const unitType = getUnitType(unit);
      const lowHealth = unit.health / unit.maxHealth < 0.35;
      const playerMoveBoost = (unit.isPlayer && state.time < state.rallyUntil ? 1.2 : 1) *
        (unit.isPlayer && state.time < state.adaptiveAssistUntil ? 1.1 : 1) *
        (unit.isPlayer ? stanceMoveMult : 1);
      const laneEngageRangeBonus = unit.isPlayer
        ? state.playerLaneFocus === 'auto'
          ? 0
          : laneAligned
            ? 18
            : -20
        : 0;

      // Ranged low-health units kite backward instead of face-tanking.
      if ((unitType === 'ranged' || unitType === 'siege') && lowHealth && dist < 90) {
        const nx = dx / Math.max(dist, 1);
        const ny = dy / Math.max(dist, 1);
        unit.x -= nx * unit.speed * dt * 1.25 * playerMoveBoost;
        unit.y -= ny * unit.speed * dt * 1.1 * playerMoveBoost;
        unit.target = null;
        unit.isAttacking = false;
        continue;
      }
      
      if (dist <= unit.range + (unit.isPlayer ? stanceRangeBonus : 0) + laneEngageRangeBonus) {
        // Attack enemy unit
        unit.target = nearestEnemy;
      } else {
        // Move toward enemy unit
        unit.target = null;
        const nx = dx / dist;
        const ny = dy / dist;
        unit.x += nx * unit.speed * dt * playerMoveBoost;
        unit.y += ny * unit.speed * dt * playerMoveBoost;
        
        // Keep in bounds
        unit.y = Math.max(50, Math.min(canvasHeight - 150, unit.y));
      }
    } else if (enemyCastle) {
      const dist = distanceToCastle(unit, enemyCastle);
      
      if (dist <= unit.range + 30 + (unit.isPlayer ? stanceRangeBonus : 0)) {
        // Attack castle
        unit.target = null;
        targetIsCastle = true;
      } else {
        // Move toward castle
        unit.target = null;
        const dir = unit.isPlayer ? 1 : -1;
        unit.x += dir * unit.speed * dt;
      }
    }
    
    // Attack logic
    if (unit.target && !unit.target.isDead) {
      const dx = unit.target.x - unit.x;
      const dy = unit.target.y - unit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= unit.range + 20) {
        // Face target
        unit.isAttacking = true;
        unit.attackAnim += dt * unit.attackSpeed * 10;
        
        const now = state.time;
        if (now - unit.lastAttackTime >= 1 / unit.attackSpeed) {
          unit.lastAttackTime = now;
          const rallyAttackBoost = unit.isPlayer && state.time < state.rallyUntil ? 1.18 : 1;
          const assistAttackBoost = unit.isPlayer && state.time < state.adaptiveAssistUntil ? 1.12 : 1;
          const stanceAttackBoost = unit.isPlayer ? stanceDamageMult : 1;
          const suddenDeath = getSuddenDeathMultiplier(state.time);
          
          if (unit.type === 1 || unit.type === 3) { // ranged or siege = projectile
            state.projectiles.push(
              allocProjectile(
                unit.x,
                unit.y,
                unit.target.x,
                unit.target.y,
                400,
                unit.damage * rallyAttackBoost * assistAttackBoost * stanceAttackBoost * suddenDeath,
                getProjectileColor(unit.age, unit.type),
                unit.isPlayer,
                getUnitType(unit)
              )
            );
          } else {
            // Melee damage
            const laneDamageMult = unit.isPlayer
              ? (state.playerLaneFocus === 'auto' ? 1 : laneAligned ? 1.05 : 0.94)
              : 1;
            const damage = unit.damage * rallyAttackBoost * assistAttackBoost * stanceAttackBoost * laneDamageMult * suddenDeath * getCounterMultiplier(getUnitType(unit), getUnitType(unit.target));
            unit.target.health -= damage;
            
            const counter = getCounterMultiplier(getUnitType(unit), getUnitType(unit.target));
            const isCrit = counter > 1 || damage >= unit.target.maxHealth * 0.28;
            const isHeavy = damage >= unit.target.maxHealth * 0.18;
            emitUnitHitEffect(state, unit.target, isHeavy || isCrit);
            emitRadialParticles(state, (unit.x + unit.target.x) / 2, (unit.y + unit.target.y) / 2, isCrit ? 8 : 5, '#E8E0D8', 'dust', 20, 65, 0.22, 0.5, 1.2, 2.4);
            applyCameraShake(
              state,
              isCrit ? Math.min(0.42, 0.18 + damage / 200) : isHeavy ? Math.min(0.3, 0.14 + damage / 260) : damage > 90 ? 0.22 : 0.12
            );
            
            if (unit.target.health <= 0) {
              onUnitKilled(state, unit.isPlayer, unit.target);
            }
          }
        }
      } else {
        // Move toward target
        const dx2 = unit.target.x - unit.x;
        const dy2 = unit.target.y - unit.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (dist2 > 0) {
          unit.x += (dx2 / dist2) * unit.speed * dt;
          unit.y += (dy2 / dist2) * unit.speed * dt;
        }
        unit.isAttacking = false;
      }
    } else if (targetIsCastle && enemyCastle) {
      unit.isAttacking = true;
      unit.attackAnim += dt * unit.attackSpeed * 10;
      
      const now = state.time;
      if (now - unit.lastAttackTime >= 1 / unit.attackSpeed) {
        unit.lastAttackTime = now;
        const rallyAttackBoost = unit.isPlayer && state.time < state.rallyUntil ? 1.18 : 1;
        const assistAttackBoost = unit.isPlayer && state.time < state.adaptiveAssistUntil ? 1.12 : 1;
        const stanceAttackBoost = unit.isPlayer ? stanceDamageMult : 1;
        const suddenDeath = getSuddenDeathMultiplier(state.time);
        
        if (unit.type === 1 || unit.type === 3) {
          const castleDamage = (getUnitType(unit) === 'siege' ? unit.damage * 1.8 : unit.damage) * rallyAttackBoost * assistAttackBoost * stanceAttackBoost * suddenDeath;
          state.projectiles.push(
            allocProjectile(
              unit.x,
              unit.y,
              enemyCastle.x,
              unit.y,
              400,
              castleDamage,
              getProjectileColor(unit.age, unit.type),
              unit.isPlayer,
              getUnitType(unit)
            )
          );
        } else {
          const castleDamage = (getUnitType(unit) === 'siege' ? unit.damage * 1.8 : unit.damage) * rallyAttackBoost * assistAttackBoost * stanceAttackBoost * suddenDeath;
          enemyCastle.health -= castleDamage;
          applyCameraShake(state, Math.min(0.75, 0.16 + castleDamage / 220));
          emitCastleImpactEffect(state, enemyCastle, unit.y, castleDamage);
        }
      }
    } else {
      unit.isAttacking = false;
      
      // Default movement toward enemy side
      if (!unit.target) {
        const dir = unit.isPlayer ? 1 : -1;
        const rallyMultiplier = unit.isPlayer && state.time < state.rallyUntil ? 1.2 : 1;
        const assistMoveBoost = unit.isPlayer && state.time < state.adaptiveAssistUntil ? 1.1 : 1;
        const stanceMoveBoost = unit.isPlayer ? stanceMoveMult : 1;
        unit.x += dir * unit.speed * dt * rallyMultiplier * assistMoveBoost * stanceMoveBoost;
        if (unit.isPlayer && state.playerBattleStance === 'defensive') {
          const holdLine = state.playerCastle.x + 270;
          if (unit.x > holdLine) unit.x -= unit.speed * dt * 0.45;
        }
        
        // Slight y movement for formation
        const centerY = canvasHeight / 2;
        const dy = centerY - unit.y;
        unit.y += dy * 0.5 * dt;
      }
    }
    
    // Keep unit in bounds
    unit.x = Math.max(20, Math.min(canvasWidth - 20, unit.x));
    unit.y = Math.max(50, Math.min(canvasHeight - 150, unit.y));
  }
  
  // Update projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    const dx = proj.targetX - proj.x;
    const dy = proj.targetY - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 15) {
      // Hit target - find enemy at this position
      let hit = false;
      for (const unit of state.units) {
        if (unit.isPlayer === proj.isPlayer) continue;
        if (unit.isDead) continue;
        const udx = unit.x - proj.x;
        const udy = unit.y - proj.y;
        const udist = Math.sqrt(udx * udx + udy * udy);
        
        if (udist < 50) {
          const defenderType = getUnitType(unit);
          const damage = proj.damage * getCounterMultiplier(proj.attackType, defenderType);
          unit.health -= damage;
          hit = true;
          
          emitRadialParticles(state, proj.x, proj.y, 9, proj.color, 'spark', 45, 145, 0.2, 0.55, 1.5, 3.2);
          emitRadialParticles(state, proj.x, proj.y + 6, 5, '#6D4C41', 'dust', 20, 70, 0.35, 0.8, 2.1, 4.6);
          applyCameraShake(state, damage > 80 ? 0.2 : 0.11);
          
          if (unit.health <= 0) {
            onUnitKilled(state, proj.isPlayer, unit);
          }
          break;
        }
      }
      
      // Check castle hit
      if (!hit) {
        const castle = proj.isPlayer ? state.aiCastle : state.playerCastle;
        if (Math.abs(proj.x - castle.x) < 60) {
          castle.health -= proj.damage;
          applyCameraShake(state, Math.min(0.85, 0.2 + proj.damage / 230));
          hit = true;
          emitCastleImpactEffect(state, castle, proj.y, proj.damage);
        }
      }
      
      recycleProjectile(proj);
      state.projectiles.splice(i, 1);
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      proj.prevX = proj.x;
      proj.prevY = proj.y;
      proj.x += nx * proj.speed * dt;
      proj.y += ny * proj.speed * dt;
    }
  }
  
  // Update particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.type === 'dust' ? 35 : 100) * dt; // gravity
    if (p.type === 'dust') {
      p.vx *= 0.985;
    }
    p.life -= dt;
    
    if (p.life <= 0) {
      recycleParticle(p);
      state.particles.splice(i, 1);
    }
  }

  // Update floating combat/economy texts
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y -= 32 * dt;
    ft.life -= dt;
    if (ft.life <= 0) {
      recycleFloatingText(ft);
      state.floatingTexts.splice(i, 1);
    }
  }
  
  // Remove dead units after delay
  state.units = state.units.filter(u => {
    if (u.isDead && state.time - u.deathTime > 3) return false;
    return true;
  });
  const aliveVillagers = new Set(
    state.units.filter((u) => !u.isDead).map((u) => u.id)
  );
  state.villagers = state.villagers.filter((v) => aliveVillagers.has(v.id));
  state.currentPopulation = getPopulationUsed(state, true);
  state.populationCap = getPopulationCap(state, true);
  
  // Check win/lose
  if (state.aiCastle.health <= 0) {
    state.aiCastle.health = 0;
    state.screen = 'gameover';
    state.isVictory = true;
    state.battlePassXP += 150;
  }
  
  if (state.playerCastle.health <= 0) {
    state.playerCastle.health = 0;
    state.screen = 'gameover';
    state.isVictory = false;
  }

  // Mode win/lose conditions
  if (state.screen !== 'gameover' && state.mode === 'defense' && state.modeTimeLimit > 0) {
    if (state.time >= state.modeTimeLimit && state.playerCastle.health > 0) {
      state.screen = 'gameover';
      state.isVictory = true;
      state.battlePassXP += 180;
    }
  }

  if (state.screen !== 'gameover' && state.mode === 'raid' && state.modeTimeLimit > 0) {
    if (state.time >= state.modeTimeLimit && state.aiCastle.health > 0) {
      state.screen = 'gameover';
      state.isVictory = false;
    }
  }

  if (state.mode === 'endless') {
    const endlessWave = Math.max(1, Math.floor(state.time / 18) + 1);
    state.wave = Math.max(state.wave, endlessWave);
    if (state.time > 120) {
      state.aiGold += dt * (22 + Math.min(65, state.time / 7));
    }
  }

  if (state.mode === 'campaign' && state.time > 90) {
    state.aiGold += dt * (8 + Math.min(24, state.campaignMissionIndex * 2.2));
  }
  
  // Cap castle health
  state.playerCastle.health = Math.min(state.playerCastle.health, state.playerCastle.maxHealth);
  state.aiCastle.health = Math.min(state.aiCastle.health, state.aiCastle.maxHealth);
  state.playerResources.gold = state.playerGold;
  state.aiResources.gold = state.aiGold;

  for (const objective of state.objectives) {
    if (objective.id === 'destroy_enemy_castle') {
      objective.progress = state.aiCastle.health <= 0 ? 1 : 0;
      objective.completed = objective.progress >= objective.target;
    } else if (objective.id === 'advance_age') {
      objective.progress = state.playerAge;
      objective.completed = objective.progress >= objective.target;
    } else if (objective.id === 'survive_timer') {
      objective.progress = state.screen === 'gameover' && state.isVictory ? 1 : 0;
      objective.completed = objective.progress >= objective.target;
    } else if (objective.id === 'fortress_alive') {
      objective.progress = state.playerCastle.health > 0 ? 1 : 0;
      objective.completed = state.screen === 'gameover' && state.isVictory && objective.progress >= objective.target;
    } else if (objective.id === 'damage_castle') {
      const dealt = Math.max(0, Math.round(((state.raidInitialCastleHealth - state.aiCastle.health) / state.raidInitialCastleHealth) * 100));
      objective.progress = dealt;
      objective.completed = dealt >= objective.target;
    } else if (objective.id === 'survive_duration') {
      objective.progress = Math.floor(state.time);
      objective.completed = objective.progress >= objective.target;
    } else if (objective.id === 'build_economy') {
      const econStructures = state.playerBuildings.filter((b) => b.type === 'farm' || b.type === 'mine').length;
      objective.progress = econStructures;
      objective.completed = objective.progress >= objective.target;
    } else if (objective.id === 'destroy_enemies') {
      objective.progress = state.missions.destroyEnemies;
      objective.completed = objective.progress >= objective.target;
    }
  }

  for (const objective of state.objectives) {
    if (!objective.completed) continue;
    if (state.claimedObjectiveRewards.includes(objective.id)) continue;

    let gems = 0;
    let gold = 0;
    let passXp = 0;
    if (objective.id === 'destroy_enemy_castle') {
      gems = 35;
      gold = 260;
      passXp = 70;
    } else if (objective.id === 'advance_age') {
      gems = 20;
      gold = 180;
      passXp = 55;
    } else if (objective.id === 'survive_timer') {
      gems = 28;
      gold = 220;
      passXp = 65;
    } else if (objective.id === 'fortress_alive') {
      gems = 18;
      gold = 140;
      passXp = 45;
    } else if (objective.id === 'damage_castle') {
      gems = 22;
      gold = 170;
      passXp = 50;
    } else if (objective.id === 'destroy_enemies') {
      gems = 24;
      gold = 190;
      passXp = 58;
    } else if (objective.id === 'survive_duration') {
      gems = 48;
      gold = 420;
      passXp = 110;
    } else if (objective.id === 'build_economy') {
      gems = 30;
      gold = 260;
      passXp = 64;
    }

    const mult = state.missionModifiers.objectiveRewardMult;
    const frontierBonus = state.campaignPackId === 'frontier' ? 1.08 : 1;
    const warpathGoldBias = state.campaignPackId === 'warpath' ? 1.12 : 1;
    const cataclysmPassBias = state.campaignPackId === 'cataclysm' ? 1.22 : 1;
    const cataclysmGemsBias = state.campaignPackId === 'cataclysm' ? 1.08 : 1;
    const scaledGems = Math.round(gems * mult);
    const scaledGold = Math.round(gold * mult);
    const scaledPassXp = Math.round(passXp * mult);
    const packAdjustedGems = Math.round(scaledGems * frontierBonus * cataclysmGemsBias);
    const packAdjustedGold = Math.round(scaledGold * frontierBonus * warpathGoldBias);
    const packAdjustedPassXp = Math.round(scaledPassXp * frontierBonus * cataclysmPassBias);
    state.playerGems += packAdjustedGems;
    state.playerGold += packAdjustedGold;
    state.battlePassXP += packAdjustedPassXp;
    state.matchRewardSummary.objectiveGems += packAdjustedGems;
    state.matchRewardSummary.objectiveGold += packAdjustedGold;
    state.matchRewardSummary.objectiveBattlePassXP += packAdjustedPassXp;
    state.objectiveNotice = `Objective Complete: ${objective.label} (+${packAdjustedGems} Gems, +${packAdjustedGold} Gold)`;

    state.objectiveNoticeUntil = state.time + 6;
    state.claimedObjectiveRewards.push(objective.id);
  }

  if (state.screen === 'gameover' && state.isVictory && !state.campaignProgressAwarded) {
    state.campaignMissionIndex += 1;
    state.campaignSeed = (state.campaignSeed * 1664525 + 1013904223) % 4294967296;
    state.campaignProgressAwarded = true;
  }
}

export function canBuildStructure(state: GameState, type: BuildingType, isPlayer: boolean): boolean {
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return false;
  const age = isPlayer ? state.playerAge : state.aiAge;
  if (age < def.unlockAge) return false;
  const limit = BUILDING_LIMITS[type];
  if (limit != null && countPlayerBuildings(state, isPlayer, type) >= limit) return false;
  const stock = isPlayer ? state.playerResources : state.aiResources;
  return canAfford(stock, def.cost);
}

export function buildStructure(state: GameState, type: BuildingType, isPlayer: boolean): boolean {
  if (!canBuildStructure(state, type, isPlayer)) return false;
  const def = BUILDING_DEFINITIONS[type];
  const spent = spendResources(isPlayer ? state.playerResources : state.aiResources, def.cost);
  if (isPlayer) {
    state.playerResources = spent;
    state.playerGold = spent.gold;
  } else {
    state.aiResources = spent;
    state.aiGold = spent.gold;
  }

  const baseX = isPlayer ? 150 + Math.random() * 150 : state.aiCastle.x - 140 - Math.random() * 150;
  const baseY = 105 + Math.random() * 100;
  if (!hasBuildingSpace(state, isPlayer, baseX, baseY)) {
    return false;
  }

  const building = {
    id: generateBuildingId(),
    type,
    level: 1,
    health: def.maxHealth,
    maxHealth: def.maxHealth,
    x: baseX,
    y: baseY,
    isPlayer,
    constructedAt: state.time,
  };
  if (isPlayer) state.playerBuildings.push(building);
  else state.aiBuildings.push(building);
  return true;
}

export function unlockNextTech(state: GameState): string | null {
  const next = TECH_TREE.find((node) => canUnlockTech(state.unlockedTechs, node, state.playerAge));
  if (!next) return null;
  state.unlockedTechs.push(next.id);
  return next.name;
}

export function canActivateRally(state: GameState): boolean {
  return state.time >= state.rallyCooldownUntil;
}

export function setPlayerBattleStance(state: GameState, stance: BattleStance): void {
  state.playerBattleStance = stance;
}

export function setPlayerLaneFocus(state: GameState, focus: LaneFocus): void {
  state.playerLaneFocus = focus;
}

export function activateRally(state: GameState): boolean {
  if (!canActivateRally(state)) return false;
  state.rallyUntil = state.time + 10;
  state.rallyCooldownUntil = state.time + 45;
  return true;
}

export function canActivateFortify(state: GameState): boolean {
  return state.time >= state.fortifyCooldownUntil;
}

export function activateFortify(state: GameState): boolean {
  if (!canActivateFortify(state)) return false;
  state.fortifyCooldownUntil = state.time + 55;
  const heal = state.playerCastle.maxHealth * 0.12;
  state.playerCastle.health = Math.min(state.playerCastle.maxHealth, state.playerCastle.health + heal);
  state.playerGold += 120;
  return true;
}

function getProjectileColor(age: number, unitType: number): string {
  const colors = [
    ['#8B4513', '#696969', '#8B4513', '#A0522D'],
    ['#C0C0C0', '#228B22', '#8B4513', '#A0522D'],
    ['#FFD700', '#32CD32', '#FF6347', '#87CEEB'],
    ['#00FFFF', '#FF00FF', '#9B59B6', '#00CED1'],
  ];
  return colors[age]?.[unitType] || '#FFFFFF';
}

export function updateAI(state: GameState, _dt: number, canvasHeight: number): void {
  const now = state.time;
  const director = state.aiDirector;
  const laneControl = getLaneControl(state, canvasHeight);
  const weakestLane = laneControl.indexOf(Math.min(...laneControl));
  const contestedLane = getMostContestedLane(laneControl);
  const playerCastleRatio = state.playerCastle.health / state.playerCastle.maxHealth;
  const aiCastleRatio = state.aiCastle.health / state.aiCastle.maxHealth;
  const playerMomentum = (state.kills / Math.max(1, state.time / 30)) + (playerCastleRatio - aiCastleRatio) * 2;
  const playerUnitCount = state.units.filter((u) => u.isPlayer && !u.isDead).length;
  const aiUnitCount = state.units.filter((u) => !u.isPlayer && !u.isDead).length;
  const plannerDecision = planAIStrategy({
    currentAge: state.aiAge,
    ownCastleHealthRatio: aiCastleRatio,
    enemyCastleHealthRatio: playerCastleRatio,
    ownArmySize: aiUnitCount,
    enemyArmySize: playerUnitCount,
    stockGold: state.aiGold,
  });
  const plannerLane = Math.max(0, Math.min(2, plannerDecision.priorityLane));
  director.plannerNotes = plannerDecision.notes;
  const compositionPressure = Math.max(-0.8, Math.min(1.2, (playerUnitCount - aiUnitCount) / 14));

  // Adaptive layer: AI estimates player skill and adjusts pressure knobs.
  const liveOpsBias = director.liveOpsDifficultyBias;
  const skillSignal = Math.max(
    0,
    Math.min(1, 0.48 + playerMomentum * 0.14 + (playerCastleRatio - aiCastleRatio) * 0.2 + liveOpsBias * 0.12)
  );
  director.skillEstimate = director.skillEstimate * 0.86 + skillSignal * 0.14;
  director.pressureScore = Math.max(-1, Math.min(1.35, playerMomentum * 0.55 + compositionPressure));

  // Macro layer: economy mode and strategic stance from resource state.
  if (state.aiGold < 140) director.economyMode = 'starved';
  else if (state.aiGold > 340) director.economyMode = 'surplus';
  else director.economyMode = 'balanced';

  const behind = aiCastleRatio + 0.06 < playerCastleRatio;
  const canAllIn = state.aiGold > 380 - liveOpsBias * 60 && state.aiAge >= 1;
  if (plannerDecision.strategy === 'turtle') director.macroPlan = 'stabilize';
  else if (plannerDecision.strategy === 'boom') director.macroPlan = 'boom';
  else if (plannerDecision.strategy === 'rush') director.macroPlan = canAllIn ? 'allin' : 'siege';
  else if (behind && director.economyMode !== 'surplus') director.macroPlan = 'stabilize';
  else if (state.aiProfile === 'techrush' && director.skillEstimate < 0.58) director.macroPlan = 'boom';
  else if (canAllIn && director.skillEstimate > 0.63 && Math.random() > 0.45) director.macroPlan = 'allin';
  else director.macroPlan = 'siege';

  const varianceFactor = director.personalityVariance + (Math.random() - 0.5) * 0.08;
  director.reserveGold = director.macroPlan === 'stabilize'
    ? 190
    : director.economyMode === 'starved'
      ? 120
      : director.macroPlan === 'boom'
        ? 220
        : 95;

  director.microRetreatThreshold = state.aiProfile === 'defensive'
    ? 0.46
    : state.aiProfile === 'aggressive'
      ? 0.24
      : 0.34;
  if (director.macroPlan === 'stabilize') director.microRetreatThreshold += 0.05;
  if (director.macroPlan === 'allin') director.microRetreatThreshold -= 0.05;

  if (now >= director.nextMacroDecisionAt) {
    director.nextMacroDecisionAt = now + 6 + Math.random() * 5;
    director.visualTelegraph = director.macroPlan === 'stabilize'
      ? 'defensive'
      : director.macroPlan === 'boom'
        ? 'techrush'
        : state.aiProfile;
    director.visualTelegraphUntil = now + 5.5;
  }

  // Age-up decisions tied to macro/economy instead of fixed interval.
  if (now >= director.nextAgeCheckAt && state.aiAge < AGES.length - 1) {
    const profileGreed = state.aiProfile === 'techrush' ? 0.2 : state.aiProfile === 'defensive' ? -0.12 : 0.05;
    const economyBonus = director.economyMode === 'surplus' ? 0.2 : director.economyMode === 'starved' ? -0.15 : 0;
    const riskPenalty = behind ? -0.08 : 0.06;
    const plannerAgeBias = plannerDecision.shouldAgeUp ? 0.22 : -0.06;
    const decisionScore =
      (now / 155) + economyBonus + riskPenalty + profileGreed + plannerAgeBias + (1 - director.skillEstimate) * 0.12 + liveOpsBias * 0.18;
    if (decisionScore > 0.92) {
      upgradeAge(state, false);
      director.visualTelegraph = 'techrush';
      director.visualTelegraphUntil = now + 5;
    }
    director.nextAgeCheckAt = now + Math.max(12, 26 - state.aiAge * 3) * (0.9 + Math.random() * 0.35);
  }

  // Resource-based spawning cadence; no fixed interval loops.
  if (now >= director.nextSpawnAt) {
    const age = state.aiAge;
    const spendable = Math.max(0, state.aiGold - director.reserveGold);
    let budget = Math.min(420 + liveOpsBias * 120, spendable);
    if (director.macroPlan === 'allin') budget += 90;
    if (director.economyMode === 'surplus') budget += 75;
    if (director.macroPlan === 'stabilize') budget -= 30;

    // "Defensive turret build" equivalent in low-gold states:
    // a fortified, low-mobility defender spawned near castle.
    if (director.economyMode === 'starved' && state.aiGold >= 110 && behind && Math.random() > 0.45) {
      const turret = spawnUnitInLane(state, 1, false, canvasHeight, weakestLane);
      if (turret) {
        turret.speed *= 0.22;
        turret.range *= 1.45;
        turret.maxHealth *= 1.28;
        turret.health = turret.maxHealth;
        turret.damage *= 1.08;
        turret.x = Math.max(state.playerCastle.x + 250, state.aiCastle.x - 120);
        turret.aiStrategyTag = 'defensive';
        director.visualTelegraph = 'defensive';
        director.visualTelegraphUntil = now + 4.8;
        state.aiGold -= Math.max(0, AGES[age].units[1].cost * 0.35);
      }
    }

    while (budget > 0) {
      const playerUnits = state.units.filter((u) => u.isPlayer && !u.isDead);
      let unitType = Math.floor(Math.random() * AGES[age].units.length);

      // Personality bias + macro bias with controlled randomness.
      if (state.aiProfile === 'aggressive' && Math.random() > 0.52) unitType = Math.random() > 0.46 ? 0 : 1;
      if (state.aiProfile === 'defensive' && Math.random() > 0.5) unitType = 2;
      if (state.aiProfile === 'techrush' && state.aiAge >= 2 && Math.random() > 0.52) unitType = 3;
      if (director.macroPlan === 'allin' && Math.random() > 0.5) unitType = 3;
      if (director.macroPlan === 'stabilize' && Math.random() > 0.42) unitType = 2;

      if (playerUnits.length > 0) {
        const playerTypes = playerUnits.map((u) => u.type);
        const mostCommon = mode(playerTypes);
        if (mostCommon === 0) unitType = Math.random() > 0.2 ? 1 : unitType;
        else if (mostCommon === 1) unitType = Math.random() > 0.2 ? 2 : unitType;
        else if (mostCommon === 2) unitType = Math.random() > 0.2 ? 0 : unitType;
      }

      const cost = AGES[age].units[unitType].cost;
      if (cost > state.aiGold || cost > budget) break;

      const laneBias = director.macroPlan === 'stabilize'
        ? weakestLane
        : director.macroPlan === 'allin'
          ? plannerLane
          : Math.random() > 0.58
            ? plannerLane
            : Math.floor(Math.random() * LANES.length);
      const spawned = spawnUnitInLane(state, unitType, false, canvasHeight, laneBias);
      if (!spawned) break;

      spawned.aiStrategyTag = now < director.visualTelegraphUntil ? director.visualTelegraph : state.aiProfile;
      if (director.macroPlan === 'allin') {
        spawned.damage *= 1.08;
        spawned.speed *= 1.04;
      }
      if (director.macroPlan === 'stabilize' && unitType === 2) {
        spawned.maxHealth *= 1.1;
        spawned.health = spawned.maxHealth;
      }

      budget -= cost;
      if (director.economyMode === 'starved' || Math.random() > 0.72 + 0.12 * varianceFactor) break;
    }

    const spawnTempoBase = director.macroPlan === 'allin'
      ? 0.8
      : director.macroPlan === 'stabilize'
        ? 1.35
        : director.economyMode === 'surplus'
          ? 0.95
          : 1.18;
    const adaptiveTempo = 1 + (director.skillEstimate - 0.5) * 0.32 - liveOpsBias * 0.18;
    const jitter = 0.72 + Math.random() * 0.65 * varianceFactor;
    director.nextSpawnAt = now + Math.max(0.55, spawnTempoBase * adaptiveTempo * jitter);
  }

  // Boss wave spike every 5th wave for cinematic pressure.
  if (state.wave % 5 === 0 && state.wave > aiLastBossWave) {
    aiLastBossWave = state.wave;

    state.aiGold += 500 + state.wave * 50;
    const tank = spawnUnitInLane(state, 2, false, canvasHeight, weakestLane);
    const siege = spawnUnitInLane(state, 3, false, canvasHeight, contestedLane);

    if (tank) {
      tank.maxHealth *= 1.7;
      tank.health = tank.maxHealth;
      tank.damage *= 1.35;
      tank.speed *= 1.12;
      tank.aiStrategyTag = 'aggressive';
    }

    if (siege) {
      siege.maxHealth *= 1.4;
      siege.health = siege.maxHealth;
      siege.damage *= 1.45;
      siege.range *= 1.1;
      siege.aiStrategyTag = 'techrush';
    }
  }
}

function mode(arr: number[]): number {
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let maxVal = 0;
  
  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) {
      maxCount = counts[v];
      maxVal = v;
    }
  }
  
  return maxVal;
}
