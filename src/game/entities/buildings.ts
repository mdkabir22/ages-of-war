import type { ResourceStock } from '../systems/resources';
import type { ResourceType } from '../systems/resources';

export type BuildingType =
  | 'town_center'
  | 'barracks'
  | 'farm'
  | 'house'
  | 'lumber_camp'
  | 'mill'
  | 'mine'
  | 'temple'
  | 'blacksmith';

export interface BuildingDefinition {
  id: BuildingType;
  name: string;
  buildTimeSec: number;
  maxHealth: number;
  cost: Partial<ResourceStock>;
  unlockAge: number;
  populationBonus?: number;
  dropOffResource?: ResourceType;
  gatherRadius?: number;
  gatherMultiplier?: number;
  queue?: {
    produces: string[];
    queueLimit: number;
  };
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  town_center: {
    id: 'town_center',
    name: 'Town Center',
    buildTimeSec: 0,
    maxHealth: 2400,
    cost: {},
    unlockAge: 0,
    queue: { produces: ['villager'], queueLimit: 5 },
  },
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    buildTimeSec: 24,
    maxHealth: 1500,
    cost: { wood: 120, stone: 40 },
    unlockAge: 0,
    queue: { produces: ['warrior', 'archer'], queueLimit: 6 },
  },
  farm: {
    id: 'farm',
    name: 'Farm',
    buildTimeSec: 20,
    maxHealth: 600,
    cost: { wood: 60 },
    unlockAge: 0,
  },
  house: {
    id: 'house',
    name: 'House',
    buildTimeSec: 8,
    maxHealth: 500,
    cost: { wood: 30 },
    unlockAge: 0,
    populationBonus: 5,
  },
  lumber_camp: {
    id: 'lumber_camp',
    name: 'Lumber Camp',
    buildTimeSec: 15,
    maxHealth: 800,
    cost: { wood: 100 },
    unlockAge: 0,
    dropOffResource: 'wood',
    gatherRadius: 250,
    gatherMultiplier: 1.5,
  },
  mill: {
    id: 'mill',
    name: 'Mill',
    buildTimeSec: 15,
    maxHealth: 800,
    cost: { wood: 100 },
    unlockAge: 0,
    dropOffResource: 'food',
    gatherRadius: 250,
    gatherMultiplier: 1.5,
  },
  mine: {
    id: 'mine',
    name: 'Mine',
    buildTimeSec: 25,
    maxHealth: 1000,
    cost: { wood: 80, stone: 20 },
    unlockAge: 1,
  },
  temple: {
    id: 'temple',
    name: 'Temple',
    buildTimeSec: 30,
    maxHealth: 1200,
    cost: { wood: 150, stone: 100, gold: 80 },
    unlockAge: 2,
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Blacksmith',
    buildTimeSec: 28,
    maxHealth: 1300,
    cost: { wood: 140, stone: 110, gold: 40 },
    unlockAge: 1,
  },
};
