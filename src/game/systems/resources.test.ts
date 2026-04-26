import { describe, expect, it } from 'vitest';
import { DEFAULT_RESOURCE_STATE, canAfford, spendResources, tickResources } from './resources';

describe('resources system', () => {
  it('ticks resources with gather and upkeep', () => {
    const next = tickResources(DEFAULT_RESOURCE_STATE, 1);
    expect(next.stock.food).toBeGreaterThan(DEFAULT_RESOURCE_STATE.stock.food);
    expect(next.stock.gold).toBeGreaterThan(DEFAULT_RESOURCE_STATE.stock.gold);
  });

  it('checks affordability and spends correctly', () => {
    const stock = { food: 50, wood: 40, stone: 30, gold: 20 };
    const cost = { wood: 20, gold: 10 };
    expect(canAfford(stock, cost)).toBe(true);

    const updated = spendResources(stock, cost);
    expect(updated.wood).toBe(20);
    expect(updated.gold).toBe(10);
  });
});
