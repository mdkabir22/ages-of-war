import { describe, expect, it } from 'vitest';
import { createInitialState } from '../engine';
import { runPostTickMaintenance } from './postTick';

describe('post tick maintenance', () => {
  it('removes dead units after death delay and syncs villagers', () => {
    const state = createInitialState(1000, 600, 'assault');
    state.time = 10;
    state.units.push({
      id: 'dead_unit',
      type: 0,
      age: 0,
      x: 100,
      y: 100,
      health: 0,
      maxHealth: 100,
      damage: 10,
      speed: 80,
      range: 40,
      attackSpeed: 1,
      lastAttackTime: 0,
      isPlayer: true,
      target: null,
      isAttacking: false,
      isDead: true,
      deathTime: 5,
      attackAnim: 0,
    });
    state.villagers.push({
      id: 'dead_unit',
      position: { x: 100, y: 100 },
      assignedNode: null,
      carriedResource: null,
      state: 'idle',
      owner: 'player',
    });

    runPostTickMaintenance(state, 0.1);

    expect(state.units.find((u) => u.id === 'dead_unit')).toBeUndefined();
    expect(state.villagers.find((v) => v.id === 'dead_unit')).toBeUndefined();
  });

  it('sets gameover victory when AI castle is destroyed', () => {
    const state = createInitialState(1000, 600, 'assault');
    state.aiCastle.health = -10;

    runPostTickMaintenance(state, 0.1);

    expect(state.aiCastle.health).toBe(0);
    expect(state.screen).toBe('gameover');
    expect(state.isVictory).toBe(true);
  });

  it('wins defense mode when timer ends and castle survives', () => {
    const state = createInitialState(1000, 600, 'defense');
    state.modeTimeLimit = 100;
    state.time = 101;
    state.playerCastle.health = state.playerCastle.maxHealth;

    runPostTickMaintenance(state, 0.1);

    expect(state.screen).toBe('gameover');
    expect(state.isVictory).toBe(true);
  });
});
