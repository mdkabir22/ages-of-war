import type { BuildingType, GameState } from '../../types/game';
import { BUILDING_DEFINITIONS } from '../entities/buildings';
import { canAfford, spendResources } from './resources';
import { canBuildMoreStructures } from './training';

const BUILDING_MIN_DISTANCE = 56;

function hasBuildingSpace(state: GameState, isPlayer: boolean, x: number, y: number): boolean {
  const list = isPlayer ? state.playerBuildings : state.aiBuildings;
  for (const b of list) {
    const dx = b.x - x;
    const dy = b.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < BUILDING_MIN_DISTANCE) return false;
  }
  return true;
}

export function canBuildStructure(state: GameState, type: BuildingType, isPlayer: boolean): boolean {
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return false;
  const age = isPlayer ? state.playerAge : state.aiAge;
  if (age < def.unlockAge) return false;
  if (!canBuildMoreStructures(state, isPlayer, type)) return false;
  const stock = isPlayer ? state.playerResources : state.aiResources;
  return canAfford(stock, def.cost);
}

export function buildStructure(
  state: GameState,
  type: BuildingType,
  isPlayer: boolean,
  generateBuildingId: () => string
): boolean {
  if (!canBuildStructure(state, type, isPlayer)) return false;
  const def = BUILDING_DEFINITIONS[type];
  const spent = spendResources(isPlayer ? state.playerResources : state.aiResources, def.cost);
  if (isPlayer) {
    state.playerResources = spent;
    state.playerGold = spent.gold;
  } else {
    state.aiResources = spent;
    state.aiGold = spent.gold;
  }

  const baseX = isPlayer ? 150 + Math.random() * 150 : state.aiCastle.x - 140 - Math.random() * 150;
  const baseY = 105 + Math.random() * 100;
  if (!hasBuildingSpace(state, isPlayer, baseX, baseY)) {
    return false;
  }

  const building = {
    id: generateBuildingId(),
    type,
    level: 1,
    health: def.maxHealth,
    maxHealth: def.maxHealth,
    x: baseX,
    y: baseY,
    isPlayer,
    constructedAt: state.time,
  };
  if (isPlayer) state.playerBuildings.push(building);
  else state.aiBuildings.push(building);
  return true;
}
