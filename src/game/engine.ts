import type { GameState, GameUnit, GameMode, AIProfile, BuildingType, BattleStance, LaneFocus } from '../types/game';
import { CASTLE_MAX_HEALTH } from './ages';
import {
  activateFortify as activateFortifySystem,
  activateRally as activateRallySystem,
  canActivateFortify as canActivateFortifySystem,
  canActivateRally as canActivateRallySystem,
} from './systems/abilities';
import { updateAIDirector } from './systems/aiDirector';
import { DEFAULT_RESOURCE_STATE } from './systems/resources';
import { BUILDING_DEFINITIONS } from './entities/buildings';
import {
  buildStructure as buildStructureSystem,
  canBuildStructure as canBuildStructureSystem,
} from './systems/construction';
import { canTrainUnit, trainUnit } from './systems/training';
import { TECH_TREE, canUnlockTech } from './systems/techTree';
import { applyCampaignMissionConfig, buildObjectivesForMode } from './systems/campaignConfig';
import {
  getLaneControl,
  getMostContestedLane,
  resolveUnitCombatPhase,
  runUnitTargetingPhase,
  tryApplyEnemyRetreat,
  updateProjectiles,
  applyPlayerLaneFocus,
} from './systems/combatRuntime';
import { runPostTickMaintenance } from './systems/postTick';
import { updateObjectivesAndCampaignProgress } from './systems/objectivesRuntime';
import { runRuntimeTick } from './systems/runtimeTick';
import { runEconomyTick } from './systems/economyRuntime';
import { addFloatingText, updateFloatingTexts, updateParticles } from './systems/effects';
import { canUpgradeAgeRuntime, spawnUnitRuntime, upgradeAgeRuntime } from './systems/unitLifecycle';

export { canTrainUnit, trainUnit };
export { addFloatingText };

let unitIdCounter = 0;
let buildingIdCounter = 0;
const LANES = [0.28, 0.5, 0.72];
function generateUnitId(): string {
  return `unit_${++unitIdCounter}_${Math.random().toString(36).substr(2, 5)}`;
}

function generateBuildingId(): string {
  return `building_${++buildingIdCounter}_${Math.random().toString(36).substr(2, 5)}`;
}

export { applyCampaignMissionConfig };

export function createInitialState(canvasWidth: number, _canvasHeight: number, mode: GameMode = 'assault'): GameState {
  unitIdCounter = 0;
  buildingIdCounter = 0;
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
  return spawnUnitRuntime(state, unitType, isPlayer, canvasHeight, generateUnitId);
}


export function canUpgradeAge(state: GameState, isPlayer: boolean): boolean {
  return canUpgradeAgeRuntime(state, isPlayer);
}

export function upgradeAge(state: GameState, isPlayer: boolean): boolean {
  return upgradeAgeRuntime(state, isPlayer);
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



export function updateGame(state: GameState, dt: number, canvasWidth: number, canvasHeight: number): void {
  state.time += dt;
  runEconomyTick(state, dt);

  runRuntimeTick(state, dt);
  
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

    if (tryApplyEnemyRetreat(unit, state, dt, canvasWidth, canvasHeight, aiRetreatThreshold, aiStabilizeMode)) {
      continue;
    }
    applyPlayerLaneFocus(unit, state, dt, laneFocusY);

    const targeting = runUnitTargetingPhase(unit, state, dt, canvasHeight, stanceRangeBonus, stanceMoveMult);
    if (targeting.skipIteration) continue;

    resolveUnitCombatPhase(
      unit,
      state,
      dt,
      canvasHeight,
      targeting.targetIsCastle,
      targeting.enemyCastle,
      stanceDamageMult,
      stanceMoveMult
    );
    
    // Keep unit in bounds
    unit.x = Math.max(20, Math.min(canvasWidth - 20, unit.x));
    unit.y = Math.max(50, Math.min(canvasHeight - 150, unit.y));
  }
  
  updateProjectiles(state, dt);
  
  updateParticles(state, dt);
  updateFloatingTexts(state, dt);
  
  runPostTickMaintenance(state, dt);

  updateObjectivesAndCampaignProgress(state);
}

export function canBuildStructure(state: GameState, type: BuildingType, isPlayer: boolean): boolean {
  return canBuildStructureSystem(state, type, isPlayer);
}

export function buildStructure(state: GameState, type: BuildingType, isPlayer: boolean): boolean {
  return buildStructureSystem(state, type, isPlayer, generateBuildingId);
}

export function unlockNextTech(state: GameState): string | null {
  const next = TECH_TREE.find((node) => canUnlockTech(state.unlockedTechs, node, state.playerAge));
  if (!next) return null;
  state.unlockedTechs.push(next.id);
  return next.name;
}

export function canActivateRally(state: GameState): boolean {
  return canActivateRallySystem(state);
}

export function setPlayerBattleStance(state: GameState, stance: BattleStance): void {
  state.playerBattleStance = stance;
}

export function setPlayerLaneFocus(state: GameState, focus: LaneFocus): void {
  state.playerLaneFocus = focus;
}

export function activateRally(state: GameState): boolean {
  return activateRallySystem(state);
}

export function canActivateFortify(state: GameState): boolean {
  return canActivateFortifySystem(state);
}

export function activateFortify(state: GameState): boolean {
  return activateFortifySystem(state);
}

export function updateAI(state: GameState, _dt: number, canvasHeight: number): void {
  updateAIDirector(state, canvasHeight, {
    lanes: LANES,
    getLaneControl,
    getMostContestedLane,
    spawnUnitInLane,
    upgradeAge,
  });
}
