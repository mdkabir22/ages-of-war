export type TechCategory = 'economy' | 'military' | 'defense' | 'age';

export interface TechNode {
  id: string;
  name: string;
  category: TechCategory;
  unlockAge: number;
  prerequisites: string[];
  description: string;
}

export const TECH_TREE: TechNode[] = [
  {
    id: 'stone-gathering',
    name: 'Stone Gathering',
    category: 'economy',
    unlockAge: 0,
    prerequisites: [],
    description: 'Increase stone gather rate by 15%.',
  },
  {
    id: 'bronze-smelting',
    name: 'Bronze Smelting',
    category: 'age',
    unlockAge: 1,
    prerequisites: ['stone-gathering'],
    description: 'Unlocks Bronze Age transition path.',
  },
  {
    id: 'iron-forging',
    name: 'Iron Forging',
    category: 'military',
    unlockAge: 2,
    prerequisites: ['bronze-smelting'],
    description: 'Melee units gain +10% attack.',
  },
  {
    id: 'castle-engineering',
    name: 'Castle Engineering',
    category: 'defense',
    unlockAge: 3,
    prerequisites: ['iron-forging'],
    description: 'Castle and towers gain +20% durability.',
  },
];

export function isTechUnlocked(unlocked: string[], node: TechNode): boolean {
  return unlocked.includes(node.id);
}

export function canUnlockTech(unlocked: string[], node: TechNode, currentAge: number): boolean {
  if (currentAge < node.unlockAge) return false;
  if (isTechUnlocked(unlocked, node)) return false;
  return node.prerequisites.every((id) => unlocked.includes(id));
}
