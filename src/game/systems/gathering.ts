import type { ResourceType } from './resources';
import type { BuildingInstance } from '../../types/game';
import { BUILDING_DEFINITIONS } from '../entities/buildings';

export type ResourceNodeType = 'tree' | 'gold_mine' | 'stone_mine' | 'berry_bush';

export interface ResourceNode {
  id: string;
  type: ResourceNodeType;
  position: { x: number; y: number };
  resourceAmount: number;
  gatherRate: number;
}

export interface Villager {
  id: string;
  position: { x: number; y: number };
  assignedNode: string | null;
  carriedResource: { type: ResourceType; amount: number } | null;
  state: 'idle' | 'moving_to_node' | 'gathering' | 'returning_to_dropoff';
  owner: 'player' | 'enemy';
}

const MOVE_SPEED = 58;
const CARRY_CAPACITY = 12;

export function assignVillagerToNode(villager: Villager, node: ResourceNode): void {
  villager.assignedNode = node.id;
  villager.state = 'moving_to_node';
}

export function tickGathering(
  villagers: Villager[],
  nodes: ResourceNode[],
  buildings: BuildingInstance[],
  dt: number
): void {
  for (const villager of villagers) {
    if (!villager.assignedNode) continue;
    const node = nodes.find((n) => n.id === villager.assignedNode);
    if (!node || node.resourceAmount <= 0) {
      villager.state = 'idle';
      villager.assignedNode = null;
      continue;
    }

    if (villager.state === 'moving_to_node') {
      moveTowards(villager.position, node.position, dt);
      if (distance(villager.position, node.position) < 5) {
        villager.state = 'gathering';
      }
      continue;
    }

    if (villager.state === 'gathering') {
      const gatherAmount = getEffectiveGatherRate(node.type, node.position, buildings, villager.owner, node.gatherRate) * dt;
      const actualGather = Math.min(gatherAmount, node.resourceAmount);
      node.resourceAmount -= actualGather;
      villager.carriedResource = {
        type: nodeToResourceType(node.type),
        amount: (villager.carriedResource?.amount || 0) + actualGather,
      };
      if ((villager.carriedResource?.amount ?? 0) >= CARRY_CAPACITY) {
        villager.state = 'returning_to_dropoff';
      }
      if (node.resourceAmount <= 0) {
        villager.state = 'returning_to_dropoff';
      }
      continue;
    }

    if (villager.state === 'returning_to_dropoff') {
      const dropOff = findDropOffPoint(villager, node, buildings);
      if (!dropOff) {
        villager.state = 'idle';
        villager.assignedNode = null;
        continue;
      }
      moveTowards(villager.position, dropOff, dt);
      if (distance(villager.position, dropOff) < 6) {
        villager.state = 'moving_to_node';
      }
    }
  }
}

export function getEffectiveGatherRate(
  nodeType: ResourceNodeType,
  nodePosition: { x: number; y: number },
  buildings: BuildingInstance[],
  owner: 'player' | 'enemy',
  baseRate: number
): number {
  const dropOffType = nodeType === 'tree' ? 'lumber_camp' : nodeType === 'berry_bush' ? 'mill' : null;
  if (!dropOffType) return baseRate;

  const isPlayer = owner === 'player';
  const config = BUILDING_DEFINITIONS[dropOffType];
  const radius = config.gatherRadius;
  const multiplier = config.gatherMultiplier ?? 1.5;
  if (radius === undefined) return baseRate;

  const hasNearbyDropOff = buildings.some(
    (b) =>
      b.isPlayer === isPlayer &&
      b.type === dropOffType &&
      b.health > 0 &&
      distance({ x: b.x, y: b.y }, nodePosition) < radius
  );

  return hasNearbyDropOff ? baseRate * multiplier : baseRate;
}

export function drainDeliveredResources(villagers: Villager[]): Partial<Record<ResourceType, number>> {
  const gained: Partial<Record<ResourceType, number>> = {};
  for (const villager of villagers) {
    if (villager.state !== 'moving_to_node') continue;
    if (!villager.carriedResource || villager.carriedResource.amount <= 0) continue;
    const { type, amount } = villager.carriedResource;
    gained[type] = (gained[type] ?? 0) + amount;
    villager.carriedResource = null;
  }
  return gained;
}

function nodeToResourceType(nodeType: ResourceNodeType): ResourceType {
  switch (nodeType) {
    case 'tree':
      return 'wood';
    case 'gold_mine':
      return 'gold';
    case 'stone_mine':
      return 'stone';
    case 'berry_bush':
      return 'food';
  }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function moveTowards(pos: { x: number; y: number }, target: { x: number; y: number }, dt: number): void {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return;
  const step = Math.min(dist, MOVE_SPEED * dt);
  pos.x += (dx / dist) * step;
  pos.y += (dy / dist) * step;
}

function findDropOffPoint(
  villager: Villager,
  node: ResourceNode,
  buildings: BuildingInstance[]
): { x: number; y: number } | null {
  const isPlayer = villager.owner === 'player';
  const ownerBuildings = buildings.filter((b) => b.isPlayer === isPlayer && b.health > 0);
  const preferredType = node.type === 'tree' ? 'lumber_camp' : node.type === 'berry_bush' ? 'mill' : null;

  if (preferredType) {
    const preferred = ownerBuildings
      .filter((b) => b.type === preferredType)
      .sort((a, b) => distance({ x: a.x, y: a.y }, villager.position) - distance({ x: b.x, y: b.y }, villager.position))[0];
    if (preferred) return { x: preferred.x, y: preferred.y };
  }

  const tc = ownerBuildings
    .filter((b) => b.type === 'town_center')
    .sort((a, b) => distance({ x: a.x, y: a.y }, villager.position) - distance({ x: b.x, y: b.y }, villager.position))[0];
  if (tc) return { x: tc.x, y: tc.y };

  return null;
}
