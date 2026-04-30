import { describe, expect, it } from 'vitest';
import { createInitialState } from '../engine';
import { runEconomyTick } from './economyRuntime';

describe('economy runtime', () => {
  it('keeps gold fields synchronized with resource stock after tick', () => {
    const state = createInitialState(1000, 600, 'assault');
    state.playerGold = 123;
    state.playerResources.gold = 10;
    state.aiGold = 456;
    state.aiResources.gold = 20;

    runEconomyTick(state, 1);

    expect(state.playerGold).toBe(state.playerResources.gold);
    expect(state.aiGold).toBe(state.aiResources.gold);
  });

  it('applies delivered villager resources to player stock', () => {
    const state = createInitialState(1000, 600, 'assault');
    state.villagers.push({
      id: 'v1',
      position: { x: 120, y: 100 },
      assignedNode: null,
      carriedResource: { type: 'wood', amount: 25 },
      state: 'returning',
      owner: 'player',
    });
    state.playerResources.wood = 0;

    runEconomyTick(state, 0.1);

    expect(state.playerResources.wood).toBeGreaterThanOrEqual(25);
  });
});
