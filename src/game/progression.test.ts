import { describe, expect, it } from 'vitest';
import { createInitialState } from '../core/engine';
import { applyLiveOpsConfig, applyMatchOutcome, DEFAULT_LIVE_OPS_CONFIG } from './progression';

describe('progression match outcome', () => {
  it('applies victory rewards and updates streak fields', () => {
    applyLiveOpsConfig(DEFAULT_LIVE_OPS_CONFIG);
    const state = createInitialState(1000, 600, 'campaign');
    state.isVictory = true;
    state.kills = 18;
    state.wave = 7;
    state.playerAge = 2;
    state.winStreak = 2;
    state.lossStreak = 1;

    const beforeGold = state.playerGold;
    const beforeGems = state.playerGems;

    applyMatchOutcome(state);

    expect(state.matchesPlayed).toBe(1);
    expect(state.winStreak).toBe(3);
    expect(state.lossStreak).toBe(0);
    expect(state.playerGold).toBeGreaterThan(beforeGold);
    expect(state.playerGems).toBeGreaterThan(beforeGems);
    expect(state.lastMatchBonusGold).toBeGreaterThan(0);
    expect(state.lastMatchBonusGems).toBeGreaterThan(0);
    expect(state.lastMatchGrade).toMatch(/S|A|B|C/);
  });

  it('applies defeat fallback rewards and loss streak progression', () => {
    applyLiveOpsConfig(DEFAULT_LIVE_OPS_CONFIG);
    const state = createInitialState(1000, 600, 'assault');
    state.isVictory = false;
    state.kills = 4;
    state.wave = 3;
    state.missions.spawnUnits = 8;
    state.winStreak = 4;
    state.lossStreak = 0;

    const beforeGold = state.playerGold;
    applyMatchOutcome(state);

    expect(state.matchesPlayed).toBe(1);
    expect(state.winStreak).toBe(0);
    expect(state.lossStreak).toBe(1);
    expect(state.playerGold).toBeGreaterThan(beforeGold);
    expect(state.lastMatchTip).toContain('Spend more gold early');
  });

  it('grants higher seasonal tokens in endless than assault', () => {
    applyLiveOpsConfig(DEFAULT_LIVE_OPS_CONFIG);
    const assault = createInitialState(1000, 600, 'assault');
    const endless = createInitialState(1000, 600, 'endless');

    for (const state of [assault, endless]) {
      state.isVictory = true;
      state.kills = 14;
      state.wave = 6;
      state.playerAge = 2;
    }

    applyMatchOutcome(assault);
    applyMatchOutcome(endless);

    expect(endless.seasonalTokens).toBeGreaterThan(assault.seasonalTokens);
    expect(endless.seasonXP).toBeGreaterThan(assault.seasonXP);
  });
});
