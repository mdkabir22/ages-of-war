import { describe, expect, it } from 'vitest';
import { createInitialState } from '../engine';
import { updateObjectivesAndCampaignProgress } from './objectivesRuntime';

describe('objectives runtime', () => {
  it('completes and claims destroy_enemies objective reward once', () => {
    const state = createInitialState(1000, 600, 'campaign');
    state.objectives = [
      {
        id: 'destroy_enemies',
        label: 'Eliminate 5 attackers',
        completed: false,
        progress: 0,
        target: 5,
      },
    ];
    state.missions.destroyEnemies = 7;

    const goldBefore = state.playerGold;
    const gemsBefore = state.playerGems;
    updateObjectivesAndCampaignProgress(state);

    expect(state.objectives[0].completed).toBe(true);
    expect(state.claimedObjectiveRewards).toContain('destroy_enemies');
    expect(state.playerGold).toBeGreaterThan(goldBefore);
    expect(state.playerGems).toBeGreaterThan(gemsBefore);

    const goldAfterFirstClaim = state.playerGold;
    updateObjectivesAndCampaignProgress(state);
    expect(state.playerGold).toBe(goldAfterFirstClaim);
    expect(state.claimedObjectiveRewards.filter((id) => id === 'destroy_enemies')).toHaveLength(1);
  });

  it('awards campaign progression once after victory gameover', () => {
    const state = createInitialState(1000, 600, 'campaign');
    const startMission = state.campaignMissionIndex;
    state.screen = 'gameover';
    state.isVictory = true;
    state.campaignProgressAwarded = false;

    updateObjectivesAndCampaignProgress(state);
    expect(state.campaignMissionIndex).toBe(startMission + 1);
    expect(state.campaignProgressAwarded).toBe(true);

    updateObjectivesAndCampaignProgress(state);
    expect(state.campaignMissionIndex).toBe(startMission + 1);
  });
});
