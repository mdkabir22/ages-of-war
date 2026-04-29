import { CASTLE_MAX_HEALTH } from '../ages';
import { applyCampaignPack } from '../modes/campaignPacks';
import type { GameMode, GameState } from '../../types/game';

export function buildObjectivesForMode(mode: GameMode): GameState['objectives'] {
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
