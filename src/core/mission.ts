import type { Resource } from './types';

export type MissionType = 'survival' | 'conquest' | 'economy' | 'escort';

export interface Objective {
  id: string;
  label: string;
  target: number;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  type: MissionType;
  objectives: Objective[];
  rewards: Record<Resource, number>;
}

export function buildMission(type: MissionType): Mission {
  if (type === 'conquest') {
    return {
      id: 'mission-conquest',
      name: 'Conquest',
      description: 'Destroy the enemy Town Center.',
      type,
      objectives: [{ id: 'destroy-enemy-tc', label: 'Enemy Town Center destroyed', target: 1 }],
      rewards: { food: 90, wood: 90, stone: 70, gold: 140 },
    };
  }

  if (type === 'economy') {
    return {
      id: 'mission-economy',
      name: 'Economic Boom',
      description: 'Collect 1000 gold within 5 minutes.',
      type,
      objectives: [{ id: 'collect-gold', label: 'Gold collected', target: 1000 }],
      rewards: { food: 80, wood: 100, stone: 90, gold: 170 },
    };
  }

  if (type === 'escort') {
    return {
      id: 'mission-escort',
      name: 'Escort Duty',
      description: 'Escort a critical unit safely to extraction.',
      type,
      objectives: [{ id: 'escort-unit', label: 'Escort progress', target: 1 }],
      rewards: { food: 70, wood: 70, stone: 70, gold: 100 },
    };
  }

  return {
    id: 'mission-survival',
    name: 'Hold The Line',
    description: 'Survive 10 enemy waves.',
    type: 'survival',
    objectives: [{ id: 'survive-waves', label: 'Waves survived', target: 10 }],
    rewards: { food: 110, wood: 110, stone: 110, gold: 150 },
  };
}
