import { describe, expect, it } from 'vitest';
import type { GameUnit } from '../../types/game';
import { createInitialState } from '../engine';
import { getCounterMultiplier, getSuddenDeathMultiplier, runUnitTargetingPhase, tryApplyEnemyRetreat } from './combatRuntime';

function makeUnit(overrides: Partial<GameUnit>): GameUnit {
  return {
    id: 'unit_test',
    type: 0,
    age: 0,
    x: 120,
    y: 200,
    health: 100,
    maxHealth: 100,
    damage: 10,
    speed: 100,
    range: 40,
    attackSpeed: 1,
    lastAttackTime: 0,
    isPlayer: true,
    target: null,
    isAttacking: false,
    isDead: false,
    deathTime: 0,
    attackAnim: 0,
    ...overrides,
  };
}

describe('combat runtime', () => {
  it('applies known counter multipliers', () => {
    expect(getCounterMultiplier('melee', 'tank')).toBe(1.26);
    expect(getCounterMultiplier('ranged', 'melee')).toBe(1.24);
    expect(getCounterMultiplier('tank', 'ranged')).toBe(1.25);
    expect(getCounterMultiplier('siege', 'ranged')).toBe(0.88);
    expect(getCounterMultiplier('melee', 'melee')).toBe(1);
  });

  it('scales sudden death multiplier only after overtime', () => {
    expect(getSuddenDeathMultiplier(359)).toBe(1);
    expect(getSuddenDeathMultiplier(450)).toBeGreaterThan(1);
    expect(getSuddenDeathMultiplier(2000)).toBeLessThanOrEqual(1.65);
  });

  it('retreats low-health AI units and clears attack state', () => {
    const state = createInitialState(1000, 600, 'assault');
    const aiUnit = makeUnit({
      id: 'ai_retreat',
      isPlayer: false,
      x: 700,
      y: 260,
      health: 20,
      maxHealth: 100,
      target: makeUnit({ id: 'dummy_target', isPlayer: true }),
      isAttacking: true,
    });

    const didRetreat = tryApplyEnemyRetreat(aiUnit, state, 1, 1000, 600, 0.4, true);
    expect(didRetreat).toBe(true);
    expect(aiUnit.target).toBeNull();
    expect(aiUnit.isAttacking).toBe(false);
    expect(aiUnit.x).toBeGreaterThan(700);
  });

  it('kites low-health ranged units when enemy is too close', () => {
    const state = createInitialState(1000, 600, 'assault');
    const rangedUnit = makeUnit({
      id: 'player_ranged',
      type: 1,
      isPlayer: true,
      x: 200,
      y: 220,
      health: 20,
      maxHealth: 100,
      speed: 120,
      range: 140,
    });
    const enemy = makeUnit({
      id: 'enemy_front',
      isPlayer: false,
      x: 250,
      y: 220,
    });
    state.units = [rangedUnit, enemy];

    const beforeX = rangedUnit.x;
    const result = runUnitTargetingPhase(rangedUnit, state, 1, 600, 0, 1);

    expect(result.skipIteration).toBe(true);
    expect(rangedUnit.target).toBeNull();
    expect(rangedUnit.isAttacking).toBe(false);
    expect(rangedUnit.x).toBeLessThan(beforeX);
  });
});
