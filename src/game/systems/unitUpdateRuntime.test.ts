import { describe, expect, it } from 'vitest';
import type { GameUnit } from '../../types/game';
import { createInitialState } from '../engine';
import { deriveCombatRuntimeContext } from './combatContextRuntime';
import { runUnitUpdateRuntime } from './unitUpdateRuntime';

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

describe('unit update runtime', () => {
  it('keeps active unit positions inside gameplay bounds', () => {
    const state = createInitialState(1000, 600, 'assault');
    const player = makeUnit({ id: 'player', x: 995, y: 10, isPlayer: true });
    const enemy = makeUnit({ id: 'enemy', x: 50, y: 580, isPlayer: false });
    state.units = [player, enemy];

    const context = deriveCombatRuntimeContext(state, 600, [0.28, 0.5, 0.72]);
    runUnitUpdateRuntime(state, 0.1, 1000, 600, context);

    expect(player.x).toBeLessThanOrEqual(980);
    expect(player.y).toBeGreaterThanOrEqual(50);
    expect(enemy.x).toBeGreaterThanOrEqual(20);
    expect(enemy.y).toBeLessThanOrEqual(450);
  });

  it('ignores dead units and preserves their coordinates', () => {
    const state = createInitialState(1000, 600, 'assault');
    const dead = makeUnit({ id: 'dead', isDead: true, x: 4, y: 4 });
    state.units = [dead];

    const context = deriveCombatRuntimeContext(state, 600, [0.28, 0.5, 0.72]);
    runUnitUpdateRuntime(state, 0.16, 1000, 600, context);

    expect(dead.x).toBe(4);
    expect(dead.y).toBe(4);
  });
});
