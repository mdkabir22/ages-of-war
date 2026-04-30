import type { AIProfile, GameMode, GameState } from '../../types/game';
import { CASTLE_MAX_HEALTH } from '../ages';
import { BUILDING_DEFINITIONS } from '../entities/buildings';
import { applyCampaignMissionConfig, buildObjectivesForMode } from './campaignConfig';
import { DEFAULT_RESOURCE_STATE } from './resources';

export function createInitialStateRuntime(
  canvasWidth: number,
  mode: GameMode,
  generateBuildingId: () => string
): GameState {
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
