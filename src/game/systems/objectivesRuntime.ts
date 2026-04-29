import type { GameState } from '../../types/game';

export function updateObjectivesAndCampaignProgress(state: GameState): void {
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
