export type ResourceType = 'food' | 'wood' | 'stone' | 'gold';

export type ResourceStock = Record<ResourceType, number>;

export interface ResourceState {
  stock: ResourceStock;
  caps: ResourceStock;
  upkeepPerSecond: Partial<ResourceStock>;
}

export const DEFAULT_RESOURCE_STATE: ResourceState = {
  stock: { food: 200, wood: 200, stone: 100, gold: 100 },
  caps: { food: 2000, wood: 2000, stone: 2000, gold: 2000 },
  upkeepPerSecond: { food: 0.5 },
};

export function tickResources(state: ResourceState, dt: number): ResourceState {
  const next: ResourceState = {
    stock: { ...state.stock },
    caps: { ...state.caps },
    upkeepPerSecond: { ...state.upkeepPerSecond },
  };

  (Object.keys(next.stock) as ResourceType[]).forEach((key) => {
    const upkeep = (next.upkeepPerSecond[key] ?? 0) * dt;
    next.stock[key] = Math.max(0, Math.min(next.caps[key], next.stock[key] - upkeep));
  });

  return next;
}

export function canAfford(stock: ResourceStock, cost: Partial<ResourceStock>): boolean {
  return (Object.keys(cost) as ResourceType[]).every((key) => (stock[key] ?? 0) >= (cost[key] ?? 0));
}

export function spendResources(stock: ResourceStock, cost: Partial<ResourceStock>): ResourceStock {
  const next = { ...stock };
  (Object.keys(cost) as ResourceType[]).forEach((key) => {
    next[key] = Math.max(0, (next[key] ?? 0) - (cost[key] ?? 0));
  });
  return next;
}
