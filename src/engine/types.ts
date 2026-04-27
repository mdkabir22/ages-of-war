import type { Mission } from './mission';
import type { TerrainTile } from './map';

export type Resource = 'food' | 'wood' | 'stone' | 'gold';
export type Age = 'stone' | 'bronze' | 'iron' | 'medieval' | 'industrial' | 'modern';
export type UnitType = 'villager' | 'warrior' | 'archer' | 'spearman' | 'cavalry';
export const AGE_ORDER: Age[] = ['stone', 'bronze', 'iron', 'medieval', 'industrial', 'modern'];

export interface Position {
  x: number;
  y: number;
}

export interface CameraShakeState {
  intensity: number;
  duration: number;
  timer: number;
  offset: Position;
}

export interface Unit {
  id: string;
  type: UnitType;
  position: Position;
  target?: Position;
  path?: Position[];
  pathIndex?: number;
  owner: 'player' | 'enemy';
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  range: number;
  attackSpeed: number;
  lastAttackTime: number;
}

export interface Building {
  id: string;
  type: 'townCenter' | 'barracks' | 'farm' | 'house' | 'mine' | 'lumber_camp' | 'mill';
  position: Position;
  owner: 'player' | 'enemy';
  hp: number;
  maxHp: number;
}

export interface FogGrid {
  width: number;
  height: number;
  tiles: Uint8Array; // 0 = unexplored, 1 = explored hidden, 2 = visible
}

export interface ProductionQueueItem {
  type: Unit['type'];
  progress: number;
  totalTime: number;
}

export interface ProductionQueue {
  buildingId: string;
  queue: ProductionQueueItem[];
  rallyPoint: Position | null;
}

export interface EnemyEconomy {
  resources: Record<Resource, number>;
  villagers: number;
  buildings: Building['type'][];
}

export interface BuildingCost {
  food: number;
  wood: number;
  stone: number;
  gold: number;
}

export const BUILDING_COSTS: Record<Building['type'], BuildingCost> = {
  townCenter: { food: 0, wood: 0, stone: 0, gold: 0 },
  farm: { food: 0, wood: 55, stone: 0, gold: 0 },
  barracks: { food: 0, wood: 120, stone: 70, gold: 0 },
  house: { food: 0, wood: 25, stone: 0, gold: 0 },
  lumber_camp: { food: 0, wood: 100, stone: 0, gold: 0 },
  mill: { food: 0, wood: 100, stone: 0, gold: 0 },
  mine: { food: 0, wood: 80, stone: 50, gold: 0 },
};

export const BUILDING_MAX_HP: Record<Building['type'], number> = {
  townCenter: 460,
  farm: 120,
  barracks: 220,
  house: 90,
  lumber_camp: 170,
  mill: 170,
  mine: 180,
};

export function getBuildingMaxHp(type: Building['type']): number {
  return BUILDING_MAX_HP[type];
}

export interface AgeData {
  name: string;
  cost: Record<Resource, number>;
  unlocks: Building['type'][];
}

export interface UnitStats {
  hp: number;
  damage: number;
  speed: number;
  range: number;
  attackSpeed: number;
}

export const AGES: Record<Age, AgeData> = {
  stone: {
    name: 'Stone Age',
    cost: { food: 0, wood: 0, stone: 0, gold: 0 },
    unlocks: ['townCenter', 'farm', 'house', 'lumber_camp', 'mill'],
  },
  bronze: {
    name: 'Bronze Age',
    cost: { food: 200, wood: 200, stone: 100, gold: 0 },
    unlocks: ['townCenter', 'farm', 'house', 'barracks', 'mine', 'lumber_camp', 'mill'],
  },
  iron: {
    name: 'Iron Age',
    cost: { food: 500, wood: 400, stone: 300, gold: 100 },
    unlocks: ['townCenter', 'farm', 'house', 'barracks', 'mine', 'lumber_camp', 'mill'],
  },
  medieval: {
    name: 'Medieval Age',
    cost: { food: 1000, wood: 800, stone: 600, gold: 400 },
    unlocks: ['townCenter', 'farm', 'house', 'barracks', 'mine', 'lumber_camp', 'mill'],
  },
  industrial: {
    name: 'Industrial Age',
    cost: { food: 1300, wood: 1000, stone: 750, gold: 600 },
    unlocks: ['townCenter', 'farm', 'house', 'barracks', 'mine', 'lumber_camp', 'mill'],
  },
  modern: {
    name: 'Modern Age',
    cost: { food: 1600, wood: 1200, stone: 900, gold: 800 },
    unlocks: ['townCenter', 'farm', 'house', 'barracks', 'mine', 'lumber_camp', 'mill'],
  },
};

export const UNIT_STATS_BY_AGE: Record<Age, Record<UnitType, UnitStats>> = {
  stone: {
    villager: { hp: 50, damage: 6, speed: 4.5, range: 24, attackSpeed: 0.8 },
    warrior: { hp: 100, damage: 12, speed: 5, range: 34, attackSpeed: 1 },
    archer: { hp: 70, damage: 10, speed: 5.2, range: 90, attackSpeed: 0.9 },
    spearman: { hp: 95, damage: 11, speed: 4.7, range: 36, attackSpeed: 0.95 },
    cavalry: { hp: 120, damage: 14, speed: 6.3, range: 34, attackSpeed: 1.1 },
  },
  bronze: {
    villager: { hp: 60, damage: 7, speed: 4.7, range: 24, attackSpeed: 0.85 },
    warrior: { hp: 120, damage: 15, speed: 5.2, range: 34, attackSpeed: 1.05 },
    archer: { hp: 80, damage: 13, speed: 5.3, range: 94, attackSpeed: 1 },
    spearman: { hp: 115, damage: 14, speed: 4.9, range: 36, attackSpeed: 1 },
    cavalry: { hp: 145, damage: 18, speed: 6.5, range: 34, attackSpeed: 1.15 },
  },
  iron: {
    villager: { hp: 70, damage: 8, speed: 4.8, range: 24, attackSpeed: 0.9 },
    warrior: { hp: 140, damage: 18, speed: 5.3, range: 36, attackSpeed: 1.1 },
    archer: { hp: 90, damage: 16, speed: 5.4, range: 98, attackSpeed: 1.05 },
    spearman: { hp: 130, damage: 16, speed: 5, range: 38, attackSpeed: 1.05 },
    cavalry: { hp: 165, damage: 21, speed: 6.6, range: 36, attackSpeed: 1.2 },
  },
  medieval: {
    villager: { hp: 80, damage: 9, speed: 5, range: 24, attackSpeed: 1 },
    warrior: { hp: 165, damage: 22, speed: 5.5, range: 38, attackSpeed: 1.15 },
    archer: { hp: 110, damage: 20, speed: 5.6, range: 104, attackSpeed: 1.1 },
    spearman: { hp: 150, damage: 20, speed: 5.2, range: 40, attackSpeed: 1.1 },
    cavalry: { hp: 190, damage: 25, speed: 6.9, range: 38, attackSpeed: 1.25 },
  },
  industrial: {
    villager: { hp: 88, damage: 10, speed: 5.1, range: 24, attackSpeed: 1.02 },
    warrior: { hp: 182, damage: 26, speed: 5.65, range: 39, attackSpeed: 1.175 },
    archer: { hp: 120, damage: 22, speed: 5.7, range: 107, attackSpeed: 1.125 },
    spearman: { hp: 160, damage: 22, speed: 5.3, range: 41, attackSpeed: 1.125 },
    cavalry: { hp: 205, damage: 28, speed: 7.05, range: 39, attackSpeed: 1.275 },
  },
  modern: {
    villager: { hp: 95, damage: 10, speed: 5.2, range: 24, attackSpeed: 1.05 },
    warrior: { hp: 200, damage: 30, speed: 5.8, range: 40, attackSpeed: 1.2 },
    archer: { hp: 130, damage: 24, speed: 5.8, range: 110, attackSpeed: 1.15 },
    spearman: { hp: 170, damage: 24, speed: 5.4, range: 42, attackSpeed: 1.15 },
    cavalry: { hp: 220, damage: 30, speed: 7.2, range: 40, attackSpeed: 1.3 },
  },
};

export function getAgeTier(age: Age): number {
  return AGE_ORDER.indexOf(age);
}

export function getUnitStatsForAge(age: Age, type: UnitType): UnitStats {
  const stats = UNIT_STATS_BY_AGE[age][type];
  if (type === 'warrior') {
    return {
      ...stats,
      damage: 10 + getAgeTier(age) * 5,
    };
  }
  return stats;
}

export function getDamageMultiplier(attacker: UnitType, defender: UnitType): number {
  if (attacker === 'warrior' && defender === 'spearman') return 1.5;
  if (attacker === 'warrior' && defender === 'archer') return 0.5;
  if (attacker === 'archer' && defender === 'warrior') return 1.5;
  if (attacker === 'archer' && defender === 'cavalry') return 0.5;
  if (attacker === 'spearman' && defender === 'cavalry') return 1.5;
  if (attacker === 'spearman' && defender === 'warrior') return 0.5;
  if (attacker === 'cavalry' && defender === 'archer') return 1.5;
  if (attacker === 'cavalry' && defender === 'spearman') return 0.5;
  if (attacker === 'villager') return 0.35;
  if (defender === 'villager') return 1.25;
  return 1;
}

export interface GameState {
  currentAge: Age;
  resources: Record<Resource, number>;
  units: Unit[];
  buildings: Building[];
  productionQueues: ProductionQueue[];
  selectedIds: string[];
  camera: Position;
  cameraShake: CameraShakeState;
  terrain: TerrainTile[][];
  fog: FogGrid;
  mission: Mission;
  missionStatus: 'active' | 'success' | 'failed';
  missionElapsedSec: number;
  wavesSurvived: number;
  aiPlan: 'rush' | 'boom' | 'turtle';
  enemyEconomy: EnemyEconomy;
}
