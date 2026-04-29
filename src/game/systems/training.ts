import type { GameState, BuildingType, ResourceStock } from '../../types/game';
import { canAfford, spendResources } from './resources';
import { BUILDING_DEFINITIONS } from '../entities/buildings';

const BUILDING_LIMITS: Partial<Record<BuildingType, number>> = {
  town_center: 1,
  barracks: 4,
  farm: 8,
  house: 10,
  lumber_camp: 4,
  mill: 4,
  mine: 5,
  temple: 2,
  blacksmith: 2,
};

function getPopulationCap(state: GameState, isPlayer: boolean): number {
  const buildings = isPlayer ? state.playerBuildings : state.aiBuildings;
  let bonus = 0;
  for (const b of buildings) {
    bonus += BUILDING_DEFINITIONS[b.type].populationBonus ?? 0;
  }
  return 10 + bonus;
}

function getPopulationUsed(state: GameState, isPlayer: boolean): number {
  return state.units.filter((u) => u.isPlayer === isPlayer && !u.isDead).length;
}

export function canTrainUnit(
  state: GameState,
  unitCost: Partial<ResourceStock>,
  isPlayer = true
): boolean {
  const cap = getPopulationCap(state, isPlayer);
  const used = getPopulationUsed(state, isPlayer);
  if (isPlayer && used >= cap) return false;
  const stock = isPlayer ? state.playerResources : state.aiResources;
  return canAfford(stock, unitCost);
}

export function trainUnit(state: GameState, goldCost: number, isPlayer = true): boolean {
  const cost: Partial<ResourceStock> = { gold: goldCost };
  if (!canTrainUnit(state, cost, isPlayer)) return false;

  const updated = spendResources(isPlayer ? state.playerResources : state.aiResources, cost);
  if (isPlayer) {
    state.playerResources = updated;
    state.playerGold = updated.gold;
    state.currentPopulation += 1;
  } else {
    state.aiResources = updated;
    state.aiGold = updated.gold;
  }
  return true;
}

export function countPlayerBuildings(state: GameState, isPlayer: boolean, type: BuildingType): number {
  const list = isPlayer ? state.playerBuildings : state.aiBuildings;
  return list.reduce((acc, b) => (b.type === type ? acc + 1 : acc), 0);
}

export function canBuildMoreStructures(state: GameState, isPlayer: boolean, type: BuildingType): boolean {
  const limit = BUILDING_LIMITS[type];
  if (!limit) return true;
  return countPlayerBuildings(state, isPlayer, type) < limit;
}
