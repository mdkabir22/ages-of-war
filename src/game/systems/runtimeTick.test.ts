import { describe, expect, it } from 'vitest';
import { createInitialState } from '../engine';
import { runRuntimeTick } from './runtimeTick';

describe('runtime tick', () => {
  it('increases player and AI gold during runtime tick', () => {
    const state = createInitialState(1000, 600, 'assault');
    const playerBefore = state.playerGold;
    const aiBefore = state.aiGold;

    runRuntimeTick(state, 1);

    expect(state.playerGold).toBeGreaterThan(playerBefore);
    expect(state.aiGold).toBeGreaterThan(aiBefore);
  });

  it('activates adaptive assist under struggling conditions', () => {
    const state = createInitialState(1000, 600, 'assault');
    state.time = 70;
    state.lossStreak = 2;
    state.adaptiveAssistCooldownUntil = 0;
    state.playerCastle.health = state.playerCastle.maxHealth * 0.35;
    const goldBefore = state.playerGold;

    runRuntimeTick(state, 0.5);

    expect(state.adaptiveAssistActivations).toBe(1);
    expect(state.adaptiveAssistUntil).toBeGreaterThan(state.time);
    expect(state.playerGold).toBeGreaterThan(goldBefore);
  });

  it('decays age-up animation and screen shake over time', () => {
    const state = createInitialState(1000, 600, 'assault');
    state.ageUpAnim = 1;
    state.shakeScreen = 1;

    runRuntimeTick(state, 1);

    expect(state.ageUpAnim).toBeLessThan(1);
    expect(state.shakeScreen).toBeLessThan(1);
    expect(state.ageUpAnim).toBeGreaterThanOrEqual(0);
    expect(state.shakeScreen).toBeGreaterThanOrEqual(0);
  });
});
