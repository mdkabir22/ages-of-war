import type { GameState } from '../types/game';
import { remoteGameConfig } from '../lib/remoteConfig';
import localforage from 'localforage';

const STORAGE_KEY = 'ages_of_war_profile_v1';
const INDEXEDDB_PROFILE_KEY = 'ages_of_war_profile_indexeddb_v1';
const DAILY_REWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface LiveOpsConfig {
  retentionDailyChallengeTargetScale: number;
  retentionWeeklyChallengeTargetScale: number;
  retentionGemRewardScale: number;
  retentionGoldRewardScale: number;
  chestRewardScale: number;
  aiDifficultyBias: number;
}

export const DEFAULT_LIVE_OPS_CONFIG: LiveOpsConfig = {
  retentionDailyChallengeTargetScale: 1,
  retentionWeeklyChallengeTargetScale: 1,
  retentionGemRewardScale: 1,
  retentionGoldRewardScale: 1,
  chestRewardScale: 1,
  aiDifficultyBias: 0,
};

let liveOpsConfig: LiveOpsConfig = { ...DEFAULT_LIVE_OPS_CONFIG };
let profileHydrationPromise: Promise<void> | null = null;

export function applyLiveOpsConfig(config: Partial<LiveOpsConfig>): LiveOpsConfig {
  const next = {
    ...DEFAULT_LIVE_OPS_CONFIG,
    ...liveOpsConfig,
    ...config,
  };
  liveOpsConfig = {
    retentionDailyChallengeTargetScale: Math.max(0.7, Math.min(1.5, next.retentionDailyChallengeTargetScale)),
    retentionWeeklyChallengeTargetScale: Math.max(0.7, Math.min(1.5, next.retentionWeeklyChallengeTargetScale)),
    retentionGemRewardScale: Math.max(0.6, Math.min(2, next.retentionGemRewardScale)),
    retentionGoldRewardScale: Math.max(0.6, Math.min(2, next.retentionGoldRewardScale)),
    chestRewardScale: Math.max(0.7, Math.min(2, next.chestRewardScale)),
    aiDifficultyBias: Math.max(-1, Math.min(1, next.aiDifficultyBias)),
  };
  return liveOpsConfig;
}

export function getLiveOpsConfig(): LiveOpsConfig {
  return liveOpsConfig;
}

function scaledInt(value: number, scale: number): number {
  return Math.max(1, Math.floor(value * scale));
}

export interface PlayerProfile {
  gems: number;
  premiumPass: boolean;
  adFree: boolean;
  goldMineLevel: number;
  purchasedOffers: string[];
  missions: {
    spawnUnits: number;
    destroyEnemies: number;
  };
  claimedMissionRewards: {
    spawnUnits: boolean;
    destroyEnemies: boolean;
  };
  dailyChallenge: {
    targetKills: number;
    targetSpawns: number;
    rewardGems: number;
    claimed: boolean;
    dayKey: string;
  };
  weeklyChallenge: {
    targetKills: number;
    rewardGems: number;
    claimed: boolean;
    weekKey: string;
  };
  onboardingSteps: {
    spawnedUnit: boolean;
    usedTactic: boolean;
    claimedReward: boolean;
  };
  rewardChestProgress: number;
  unclaimedChests: number;
  winStreak: number;
  lossStreak: number;
  tutorialStep: number;
  tutorialDismissed: boolean;
  adaptiveAssistUntil: number;
  adaptiveAssistCooldownUntil: number;
  adaptiveAssistActivations: number;
  onboardingBonusClaimed: boolean;
  lastMatchGrade: 'S' | 'A' | 'B' | 'C';
  lastMatchBonusGold: number;
  lastMatchBonusGems: number;
  lastMatchTip: string;
  seasonalTokens: number;
  seasonXP: number;
  battlePassXP: number;
  lifetimeSpendUsd: number;
  lastDailyRewardAt: number;
  matchesPlayed: number;
  unlockedTechs: string[];
  campaignMissionIndex: number;
  campaignSeed: number;
}

export const DEFAULT_PROFILE: PlayerProfile = {
  gems: 250,
  premiumPass: false,
  adFree: false,
  goldMineLevel: 0,
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
  unlockedTechs: [],
  campaignMissionIndex: 1,
  campaignSeed: 12345,
};

function normalizeProfile(parsed: Partial<PlayerProfile>): PlayerProfile {
  return {
    ...DEFAULT_PROFILE,
    ...parsed,
    missions: {
      ...DEFAULT_PROFILE.missions,
      ...(parsed.missions || {}),
    },
    claimedMissionRewards: {
      ...DEFAULT_PROFILE.claimedMissionRewards,
      ...(parsed.claimedMissionRewards || {}),
    },
    dailyChallenge: {
      ...DEFAULT_PROFILE.dailyChallenge,
      ...(parsed.dailyChallenge || {}),
    },
    weeklyChallenge: {
      ...DEFAULT_PROFILE.weeklyChallenge,
      ...(parsed.weeklyChallenge || {}),
    },
    onboardingSteps: {
      ...DEFAULT_PROFILE.onboardingSteps,
      ...(parsed.onboardingSteps || {}),
    },
    purchasedOffers: parsed.purchasedOffers || [],
    unlockedTechs: parsed.unlockedTechs || [],
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return normalizeProfile(parsed);
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Loads profile from IndexedDB (localforage) and hydrates localStorage cache
 * so existing sync calls keep working.
 */
export async function hydrateProfileFromIndexedDb(): Promise<void> {
  try {
    const fromDb = await localforage.getItem<PlayerProfile>(INDEXEDDB_PROFILE_KEY);
    if (!fromDb) return;
    const normalized = normalizeProfile(fromDb);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.warn('IndexedDB profile hydration failed:', error);
  }
}

export function ensureProfileHydrated(): Promise<void> {
  if (!profileHydrationPromise) {
    profileHydrationPromise = hydrateProfileFromIndexedDb();
  }
  return profileHydrationPromise;
}

export function applyProfileToState(state: GameState, profile: PlayerProfile): void {
  state.playerGems = profile.gems;
  state.premiumPass = profile.premiumPass;
  state.adFree = profile.adFree;
  state.goldMineLevel = profile.goldMineLevel;
  state.purchasedOffers = profile.purchasedOffers;
  state.missions = profile.missions;
  state.claimedMissionRewards = profile.claimedMissionRewards;
  state.dailyChallenge = profile.dailyChallenge;
  state.weeklyChallenge = profile.weeklyChallenge;
  state.onboardingSteps = profile.onboardingSteps;
  state.rewardChestProgress = profile.rewardChestProgress;
  state.unclaimedChests = profile.unclaimedChests;
  state.winStreak = profile.winStreak;
  state.lossStreak = profile.lossStreak;
  state.tutorialStep = profile.tutorialStep;
  state.tutorialDismissed = profile.tutorialDismissed;
  state.adaptiveAssistUntil = profile.adaptiveAssistUntil;
  state.adaptiveAssistCooldownUntil = profile.adaptiveAssistCooldownUntil;
  state.adaptiveAssistActivations = profile.adaptiveAssistActivations;
  state.onboardingBonusClaimed = profile.onboardingBonusClaimed;
  state.lastMatchGrade = profile.lastMatchGrade;
  state.lastMatchBonusGold = profile.lastMatchBonusGold;
  state.lastMatchBonusGems = profile.lastMatchBonusGems;
  state.lastMatchTip = profile.lastMatchTip;
  state.seasonalTokens = profile.seasonalTokens;
  state.seasonXP = profile.seasonXP;
  state.battlePassXP = profile.battlePassXP;
  state.lifetimeSpendUsd = profile.lifetimeSpendUsd;
  state.lastDailyRewardAt = profile.lastDailyRewardAt;
  state.matchesPlayed = profile.matchesPlayed;
  state.unlockedTechs = profile.unlockedTechs;
  state.campaignMissionIndex = profile.campaignMissionIndex;
  state.campaignSeed = profile.campaignSeed;
}

export function profileFromState(state: GameState): PlayerProfile {
  return {
    gems: state.playerGems,
    premiumPass: state.premiumPass,
    adFree: state.adFree,
    goldMineLevel: state.goldMineLevel,
    purchasedOffers: state.purchasedOffers,
    missions: state.missions,
    claimedMissionRewards: state.claimedMissionRewards,
    dailyChallenge: state.dailyChallenge,
    weeklyChallenge: state.weeklyChallenge,
    onboardingSteps: state.onboardingSteps,
    rewardChestProgress: state.rewardChestProgress,
    unclaimedChests: state.unclaimedChests,
    winStreak: state.winStreak,
    lossStreak: state.lossStreak,
    tutorialStep: state.tutorialStep,
    tutorialDismissed: state.tutorialDismissed,
    adaptiveAssistUntil: state.adaptiveAssistUntil,
    adaptiveAssistCooldownUntil: state.adaptiveAssistCooldownUntil,
    adaptiveAssistActivations: state.adaptiveAssistActivations,
    onboardingBonusClaimed: state.onboardingBonusClaimed,
    lastMatchGrade: state.lastMatchGrade,
    lastMatchBonusGold: state.lastMatchBonusGold,
    lastMatchBonusGems: state.lastMatchBonusGems,
    lastMatchTip: state.lastMatchTip,
    seasonalTokens: state.seasonalTokens,
    seasonXP: state.seasonXP,
    battlePassXP: state.battlePassXP,
    lifetimeSpendUsd: state.lifetimeSpendUsd,
    lastDailyRewardAt: state.lastDailyRewardAt,
    matchesPlayed: state.matchesPlayed,
    unlockedTechs: state.unlockedTechs,
    campaignMissionIndex: state.campaignMissionIndex,
    campaignSeed: state.campaignSeed,
  };
}

export function saveProfile(state: GameState): void {
  const profile = profileFromState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  void localforage.setItem(INDEXEDDB_PROFILE_KEY, profile).catch((error) => {
    console.warn('IndexedDB profile save failed:', error);
  });
}

export function canClaimDailyReward(state: GameState, nowMs = Date.now()): boolean {
  return nowMs - state.lastDailyRewardAt >= DAILY_REWARD_COOLDOWN_MS;
}

export function claimDailyReward(state: GameState, nowMs = Date.now()): boolean {
  if (!canClaimDailyReward(state, nowMs)) return false;
  state.lastDailyRewardAt = nowMs;
  const gemBonus = Math.max(0, Math.floor(remoteGameConfig.getGemDailyRewardBonus()));
  state.playerGems += scaledInt(100, liveOpsConfig.retentionGemRewardScale) + gemBonus;
  state.playerGold += scaledInt(300, liveOpsConfig.retentionGoldRewardScale);
  return true;
}

export function getBattlePassTier(xp: number): number {
  return Math.floor(xp / 200) + 1;
}

export function getBattlePassProgressPercent(xp: number): number {
  return (xp % 200) / 2;
}

export function canClaimSpawnMission(state: GameState): boolean {
  return state.missions.spawnUnits >= 40 && !state.claimedMissionRewards.spawnUnits;
}

export function canClaimKillMission(state: GameState): boolean {
  return state.missions.destroyEnemies >= 30 && !state.claimedMissionRewards.destroyEnemies;
}

export function claimSpawnMissionReward(state: GameState): boolean {
  if (!canClaimSpawnMission(state)) return false;
  state.claimedMissionRewards.spawnUnits = true;
  state.playerGems += scaledInt(90, liveOpsConfig.retentionGemRewardScale);
  state.playerGold += scaledInt(400, liveOpsConfig.retentionGoldRewardScale);
  state.battlePassXP += 80;
  return true;
}

export function claimKillMissionReward(state: GameState): boolean {
  if (!canClaimKillMission(state)) return false;
  state.claimedMissionRewards.destroyEnemies = true;
  state.playerGems += scaledInt(120, liveOpsConfig.retentionGemRewardScale);
  state.playerGold += scaledInt(500, liveOpsConfig.retentionGoldRewardScale);
  state.battlePassXP += 100;
  return true;
}

function getDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function getWeekKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const diff = (now.getTime() - start) / (24 * 60 * 60 * 1000);
  const week = Math.ceil((diff + new Date(start).getUTCDay() + 1) / 7);
  return `${year}-W${week}`;
}

export function refreshChallenges(state: GameState, now = new Date()): void {
  const dayKey = getDayKey(now);
  if (state.dailyChallenge.dayKey !== dayKey) {
    const targetScale = liveOpsConfig.retentionDailyChallengeTargetScale;
    state.dailyChallenge = {
      targetKills: scaledInt(18 + (now.getUTCDate() % 7) * 2, targetScale),
      targetSpawns: scaledInt(20 + (now.getUTCDate() % 5) * 3, targetScale),
      rewardGems: scaledInt(110 + (now.getUTCDate() % 4) * 15, liveOpsConfig.retentionGemRewardScale),
      claimed: false,
      dayKey,
    };
  }

  const weekKey = getWeekKey(now);
  if (state.weeklyChallenge.weekKey !== weekKey) {
    const targetScale = liveOpsConfig.retentionWeeklyChallengeTargetScale;
    state.weeklyChallenge = {
      targetKills: scaledInt(160 + (now.getUTCDate() % 4) * 20, targetScale),
      rewardGems: scaledInt(650 + (now.getUTCDate() % 3) * 80, liveOpsConfig.retentionGemRewardScale),
      claimed: false,
      weekKey,
    };
  }
}

export function canClaimDailyChallenge(state: GameState): boolean {
  return (
    !state.dailyChallenge.claimed &&
    state.kills >= state.dailyChallenge.targetKills &&
    state.missions.spawnUnits >= state.dailyChallenge.targetSpawns
  );
}

export function claimDailyChallenge(state: GameState): boolean {
  if (!canClaimDailyChallenge(state)) return false;
  state.dailyChallenge.claimed = true;
  state.playerGems += scaledInt(state.dailyChallenge.rewardGems, liveOpsConfig.retentionGemRewardScale);
  state.battlePassXP += 90;
  return true;
}

export function canClaimWeeklyChallenge(state: GameState): boolean {
  return !state.weeklyChallenge.claimed && state.missions.destroyEnemies >= state.weeklyChallenge.targetKills;
}

export function claimWeeklyChallenge(state: GameState): boolean {
  if (!canClaimWeeklyChallenge(state)) return false;
  state.weeklyChallenge.claimed = true;
  state.playerGems += scaledInt(state.weeklyChallenge.rewardGems, liveOpsConfig.retentionGemRewardScale);
  state.playerGold += scaledInt(1500, liveOpsConfig.retentionGoldRewardScale);
  state.battlePassXP += 220;
  return true;
}

export function registerOnboardingAction(state: GameState, action: 'spawnedUnit' | 'usedTactic' | 'claimedReward'): void {
  state.onboardingSteps[action] = true;
  if (state.tutorialDismissed) return;

  if (state.onboardingSteps.spawnedUnit && state.onboardingSteps.usedTactic && state.onboardingSteps.claimedReward) {
    state.tutorialStep = 3;
  } else if (state.onboardingSteps.spawnedUnit && state.onboardingSteps.usedTactic) {
    state.tutorialStep = 2;
  } else if (state.onboardingSteps.spawnedUnit) {
    state.tutorialStep = 1;
  } else {
    state.tutorialStep = 0;
  }

  if (
    !state.onboardingBonusClaimed &&
    state.onboardingSteps.spawnedUnit &&
    state.onboardingSteps.usedTactic &&
    state.onboardingSteps.claimedReward
  ) {
    state.onboardingBonusClaimed = true;
    state.playerGems += 180;
    state.playerGold += 900;
    state.battlePassXP += 120;
  }
}

export function applyMatchOutcome(state: GameState): void {
  state.matchesPlayed += 1;
  const modeMultiplier = state.mode === 'campaign' ? 1.12 : state.mode === 'defense' ? 1.08 : state.mode === 'raid' ? 1.15 : state.mode === 'endless' ? 1.22 : 1;
  const tierMultiplier = 1 + Math.min(0.75, state.playerAge * 0.12 + Math.floor(state.wave / 5) * 0.08);
  // Soft economy dampener: reduces reward inflation for high-stock accounts.
  const wealthScore = state.playerGold + state.playerGems * 40;
  const economyDampener = wealthScore > 120000 ? 0.72 : wealthScore > 70000 ? 0.84 : wealthScore > 35000 ? 0.93 : 1;
  let baseGoldGain = 0;
  let baseGemGain = 0;

  if (state.isVictory) {
    state.winStreak += 1;
    state.lossStreak = 0;
    state.rewardChestProgress += (55 + Math.min(25, state.wave * 2)) * tierMultiplier;
    baseGemGain = Math.floor((25 + Math.min(40, state.wave * 2)) * tierMultiplier * modeMultiplier * economyDampener);
    baseGoldGain = Math.floor((180 + state.kills * 6) * tierMultiplier * modeMultiplier * economyDampener);
    baseGemGain = scaledInt(baseGemGain, liveOpsConfig.retentionGemRewardScale);
    baseGoldGain = scaledInt(baseGoldGain, liveOpsConfig.retentionGoldRewardScale);
    state.playerGems += baseGemGain;
    state.playerGold += baseGoldGain;
  } else {
    state.lossStreak += 1;
    state.winStreak = 0;
    const fallbackMultiplier = Math.max(0.9, tierMultiplier * 0.8);
    state.rewardChestProgress += (24 + Math.min(20, state.wave)) * fallbackMultiplier;
    baseGoldGain = Math.floor((90 + state.kills * 4) * fallbackMultiplier * modeMultiplier * economyDampener);
    baseGoldGain = scaledInt(baseGoldGain, liveOpsConfig.retentionGoldRewardScale);
    state.playerGold += baseGoldGain;
  }

  const gradeScore =
    (state.isVictory ? 55 : 20) +
    Math.min(25, state.kills * 2.2) +
    Math.min(20, state.wave * 1.8) +
    Math.min(8, state.winStreak * 2);
  const grade: 'S' | 'A' | 'B' | 'C' =
    gradeScore >= 88 ? 'S' : gradeScore >= 72 ? 'A' : gradeScore >= 52 ? 'B' : 'C';
  const gradeGoldBonus = scaledInt(
    Math.floor((grade === 'S' ? 300 : grade === 'A' ? 180 : grade === 'B' ? 90 : 35) * economyDampener),
    liveOpsConfig.retentionGoldRewardScale
  );
  const gradeGemBonus = scaledInt(
    Math.floor((grade === 'S' ? 70 : grade === 'A' ? 35 : grade === 'B' ? 15 : 5) * economyDampener),
    liveOpsConfig.retentionGemRewardScale
  );

  state.lastMatchGrade = grade;
  state.lastMatchBonusGold = baseGoldGain + gradeGoldBonus;
  state.lastMatchBonusGems = baseGemGain + gradeGemBonus;
  state.playerGold += gradeGoldBonus;
  state.playerGems += gradeGemBonus;
  const tokenGain = (grade === 'S' ? 16 : grade === 'A' ? 11 : grade === 'B' ? 7 : 4) + (state.mode === 'raid' ? 2 : state.mode === 'defense' ? 1 : state.mode === 'endless' ? 3 : state.mode === 'campaign' ? 2 : 0);
  state.seasonalTokens += tokenGain;
  state.seasonXP += Math.floor((state.isVictory ? 120 + state.wave * 8 : 55 + state.wave * 4) * modeMultiplier);

  if (!state.isVictory && state.missions.spawnUnits < 15) {
    state.lastMatchTip = 'Spend more gold early: spawn frontline units to avoid early lane collapse.';
  } else if (!state.isVictory && state.kills < 12) {
    state.lastMatchTip = 'Use Rally before major fights and focus enemy ranged/siege first.';
  } else if (state.isVictory && state.wave >= 10) {
    state.lastMatchTip = 'Great tempo. Convert this into faster Age-Up timing for even stronger snowball.';
  } else if (state.missions.destroyEnemies > 80) {
    state.lastMatchTip = 'Excellent combat control. Add more siege in late waves to finish castles faster.';
  } else {
    state.lastMatchTip = 'Balance economy and tactics: alternate unit spawns with cooldown abilities.';
  }

  while (state.rewardChestProgress >= 100) {
    state.rewardChestProgress -= 100;
    state.unclaimedChests += 1;
  }
}

export function canOpenRewardChest(state: GameState): boolean {
  return state.unclaimedChests > 0;
}

export function openRewardChest(state: GameState): boolean {
  if (!canOpenRewardChest(state)) return false;
  state.unclaimedChests -= 1;

  const gems = scaledInt(70 + Math.floor(Math.random() * 70), liveOpsConfig.chestRewardScale * liveOpsConfig.retentionGemRewardScale);
  const gold = scaledInt(350 + Math.floor(Math.random() * 500), liveOpsConfig.chestRewardScale * liveOpsConfig.retentionGoldRewardScale);
  state.playerGems += gems;
  state.playerGold += gold;
  state.battlePassXP += 45;
  return true;
}

export function dismissTutorial(state: GameState): void {
  state.tutorialDismissed = true;
  state.tutorialStep = 3;
}
