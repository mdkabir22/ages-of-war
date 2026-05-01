import { describe, expect, it } from 'vitest';
import { LANE_Y_RATIOS } from '../../core/map';
import { createInitialState } from '../engine';
import { deriveCombatRuntimeContext } from './combatContextRuntime';

describe('combat context runtime', () => {
  it('derives defensive stance and lane-focus modifiers', () => {
    const state = createInitialState(1000, 600, 'assault');
    state.playerBattleStance = 'defensive';
    state.playerLaneFocus = 'right';
    state.aiDirector.macroPlan = 'stabilize';
    state.aiDirector.microRetreatThreshold = 0.37;

    const lanes = [...LANE_Y_RATIOS];
    const context = deriveCombatRuntimeContext(state, 600, lanes);

    expect(context.aiRetreatThreshold).toBe(0.37);
    expect(context.aiStabilizeMode).toBe(true);
    expect(context.stanceMoveMult).toBe(0.9);
    expect(context.stanceDamageMult).toBe(0.94);
    expect(context.stanceRangeBonus).toBe(14);
    expect(context.laneFocusY).toBeCloseTo(432);
  });

  it('returns neutral modifiers for balanced auto-focus state', () => {
    const state = createInitialState(1000, 600, 'assault');
    state.playerBattleStance = 'balanced';
    state.playerLaneFocus = 'auto';
    state.aiDirector.macroPlan = 'boom';
    state.aiDirector.microRetreatThreshold = 0.22;

    const context = deriveCombatRuntimeContext(state, 600, [...LANE_Y_RATIOS]);

    expect(context.aiRetreatThreshold).toBe(0.22);
    expect(context.aiStabilizeMode).toBe(false);
    expect(context.stanceMoveMult).toBe(1);
    expect(context.stanceDamageMult).toBe(1);
    expect(context.stanceRangeBonus).toBe(0);
    expect(context.laneFocusY).toBeNull();
  });
});
