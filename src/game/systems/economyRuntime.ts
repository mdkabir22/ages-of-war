import { DEFAULT_RESOURCE_STATE, tickResources } from './resources';
import { drainDeliveredResources, tickGathering } from './gathering';
import type { GameState } from '../../types/game';

function getBuildingAdjustedResourceState(
  stock: GameState['playerResources'],
  buildings: GameState['playerBuildings']
): typeof DEFAULT_RESOURCE_STATE {
  const next = {
    ...DEFAULT_RESOURCE_STATE,
    stock: { ...stock },
    upkeepPerSecond: { ...DEFAULT_RESOURCE_STATE.upkeepPerSecond },
  };
  let blacksmithCount = 0;
  for (const b of buildings) {
    if (b.type === 'blacksmith') blacksmithCount += 1;
  }
  next.upkeepPerSecond.food = Math.max(0, (next.upkeepPerSecond.food ?? 0) - blacksmithCount * 0.04);
  return next;
}

export function runEconomyTick(state: GameState, dt: number): void {
  const playerResTick = tickResources(
    getBuildingAdjustedResourceState(
      { ...state.playerResources, gold: state.playerGold },
      state.playerBuildings
    ),
    dt
  );
  const aiResTick = tickResources(
    getBuildingAdjustedResourceState(
      { ...state.aiResources, gold: state.aiGold },
      state.aiBuildings
    ),
    dt
  );
  state.playerResources = playerResTick.stock;
  state.aiResources = aiResTick.stock;
  state.playerGold = state.playerResources.gold;
  state.aiGold = state.aiResources.gold;

  tickGathering(state.villagers, state.resourceNodes, state.playerBuildings, dt);
  const delivered = drainDeliveredResources(state.villagers);
  for (const key of Object.keys(delivered) as Array<'food' | 'wood' | 'stone' | 'gold'>) {
    state.playerResources[key] += delivered[key] ?? 0;
  }
  state.playerGold = state.playerResources.gold;
}
