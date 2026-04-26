import type { AgeConfig } from '../types/game';

// Warrior (melee slot) damage follows: 10 + (ageIndex * 5)
export const AGES: AgeConfig[] = [
  {
    name: 'STONE AGE',
    era: 'The Dawn of War',
    themeColor: '#D4763A',
    bgImage: '/assets/ui/battlefield-stone.jpg',
    castleImage: '/assets/stone/castle.png',
    goldBonus: 5,
    xpRequired: 0,
    units: [
      { name: 'Clubman', health: 80, damage: 10, speed: 60, range: 40, attackSpeed: 1.2, cost: 25, image: '/assets/stone/clubman.png', type: 'melee', description: 'Fast melee warrior with wooden club' },
      { name: 'Spear Thrower', health: 50, damage: 18, speed: 45, range: 150, attackSpeed: 0.8, cost: 40, image: '/assets/stone/spearthrower.png', type: 'ranged', description: 'Ranged hunter with stone spears' },
      { name: 'Mammoth', health: 250, damage: 28, speed: 25, range: 50, attackSpeed: 0.6, cost: 80, image: '/assets/stone/mammoth.png', type: 'tank', description: 'Massive beast with devastating charge' },
      { name: 'Catapult', health: 60, damage: 45, speed: 15, range: 250, attackSpeed: 0.3, cost: 120, image: '/assets/stone/catapult.png', type: 'siege', description: 'Long-range rock thrower vs buildings' },
    ],
  },
  {
    name: 'BRONZE AGE',
    era: 'Age of City States',
    themeColor: '#4A7FB5',
    bgImage: '/assets/ui/battlefield-medieval.jpg',
    castleImage: '/assets/medieval/castle.png',
    goldBonus: 10,
    xpRequired: 500,
    units: [
      { name: 'Knight', health: 150, damage: 15, speed: 50, range: 45, attackSpeed: 1.0, cost: 50, image: '/assets/medieval/knight.png', type: 'melee', description: 'Armored warrior with steel sword' },
      { name: 'Archer', health: 70, damage: 24, speed: 40, range: 180, attackSpeed: 1.4, cost: 60, image: '/assets/medieval/archer.png', type: 'ranged', description: 'Swift bowman with rapid fire' },
      { name: 'Battering Ram', health: 400, damage: 42, speed: 20, range: 55, attackSpeed: 0.5, cost: 120, image: '/assets/medieval/ram.png', type: 'tank', description: 'Heavy siege engine vs buildings' },
      { name: 'Ballista', health: 80, damage: 62, speed: 12, range: 280, attackSpeed: 0.25, cost: 150, image: '/assets/medieval/catapult.png', type: 'siege', description: 'Powerful bolt thrower' },
    ],
  },
  {
    name: 'IRON AGE',
    era: 'Age of Empires',
    themeColor: '#4A7A3F',
    bgImage: '/assets/ui/battlefield-stone.jpg',
    castleImage: '/assets/modern/castle.png',
    goldBonus: 15,
    xpRequired: 1200,
    units: [
      { name: 'Soldier', health: 200, damage: 20, speed: 55, range: 120, attackSpeed: 1.5, cost: 75, image: '/assets/modern/soldier.png', type: 'melee', description: 'Elite trooper with assault rifle' },
      { name: 'Sniper', health: 80, damage: 70, speed: 35, range: 250, attackSpeed: 0.6, cost: 100, image: '/assets/modern/sniper.png', type: 'ranged', description: 'Long-range precision elimination' },
      { name: 'Tank', health: 600, damage: 56, speed: 22, range: 140, attackSpeed: 0.7, cost: 180, image: '/assets/modern/tank.png', type: 'tank', description: 'Armored beast with cannon' },
      { name: 'Helicopter', health: 120, damage: 52, speed: 80, range: 200, attackSpeed: 1.0, cost: 200, image: '/assets/modern/helicopter.png', type: 'siege', description: 'Flying death from above' },
    ],
  },
  {
    name: 'MEDIEVAL AGE',
    era: 'Age of Castles',
    themeColor: '#9B59B6',
    bgImage: '/assets/ui/battlefield-crystal.jpg',
    castleImage: '/assets/crystal/castle.png',
    goldBonus: 20,
    xpRequired: 2200,
    units: [
      { name: 'Paladin', health: 280, damage: 25, speed: 48, range: 45, attackSpeed: 1.1, cost: 90, image: '/assets/crystal/warrior.png', type: 'melee', description: 'Holy knight with blessed blade' },
      { name: 'Crossbowman', health: 90, damage: 35, speed: 38, range: 200, attackSpeed: 1.2, cost: 70, image: '/assets/crystal/mage.png', type: 'ranged', description: 'Armor-piercing ranged unit' },
      { name: 'Catapult', health: 350, damage: 70, speed: 18, range: 300, attackSpeed: 0.4, cost: 160, image: '/assets/crystal/golem.png', type: 'siege', description: 'Castle-breaking siege weapon' },
      { name: 'Dragon', health: 500, damage: 55, speed: 65, range: 120, attackSpeed: 0.9, cost: 200, image: '/assets/crystal/drone.png', type: 'tank', description: 'Flying beast of destruction' },
    ],
  },
  {
    name: 'INDUSTRIAL AGE',
    era: 'Age of Factories',
    themeColor: '#6B7280',
    bgImage: '/assets/ui/battlefield-medieval.jpg',
    castleImage: '/assets/modern/castle.png',
    goldBonus: 25,
    xpRequired: 3600,
    units: [
      { name: 'Rifleman', health: 260, damage: 30, speed: 62, range: 130, attackSpeed: 1.5, cost: 110, image: '/assets/modern/soldier.png', type: 'melee', description: 'Industrial infantry with rapid rifles' },
      { name: 'Marksman', health: 110, damage: 92, speed: 36, range: 275, attackSpeed: 0.65, cost: 140, image: '/assets/modern/sniper.png', type: 'ranged', description: 'High precision long-range shooter' },
      { name: 'Steam Tank', health: 900, damage: 84, speed: 24, range: 150, attackSpeed: 0.72, cost: 240, image: '/assets/modern/tank.png', type: 'tank', description: 'Heavy armored assault platform' },
      { name: 'Artillery', health: 150, damage: 90, speed: 30, range: 295, attackSpeed: 0.4, cost: 260, image: '/assets/modern/helicopter.png', type: 'siege', description: 'Long-range city breaker battery' },
    ],
  },
  {
    name: 'MODERN AGE',
    era: 'Age of Tanks and Air',
    themeColor: '#9B59B6',
    bgImage: '/assets/ui/battlefield-crystal.jpg',
    castleImage: '/assets/crystal/castle.png',
    goldBonus: 30,
    xpRequired: 5200,
    units: [
      { name: 'Spec Ops', health: 340, damage: 35, speed: 74, range: 72, attackSpeed: 1.95, cost: 140, image: '/assets/crystal/warrior.png', type: 'melee', description: 'Elite tactical assault specialist' },
      { name: 'Rail Sniper', health: 160, damage: 110, speed: 44, range: 245, attackSpeed: 1.1, cost: 170, image: '/assets/crystal/mage.png', type: 'ranged', description: 'Electromagnetic long-range eliminator' },
      { name: 'Titan Mech', health: 1300, damage: 106, speed: 21, range: 75, attackSpeed: 0.6, cost: 320, image: '/assets/crystal/golem.png', type: 'tank', description: 'Modern battlefield domination mech' },
      { name: 'Drone Fleet', health: 220, damage: 68, speed: 108, range: 210, attackSpeed: 2.2, cost: 300, image: '/assets/crystal/drone.png', type: 'siege', description: 'High-speed autonomous siege swarm' },
    ],
  },
];

export const XP_THRESHOLDS = [0, 500, 1200, 2200, 3600, 5200];
export const GOLD_PER_SECOND = 10;
export const CASTLE_MAX_HEALTH = 2000;
export const AI_SPAWN_INTERVAL = 3000; // ms

export function getUnitDamage(ageIndex: number, unitType: string): number {
  const baseDamage = 10 + ageIndex * 5;
  const modifiers: Record<string, number> = {
    melee: 1.0,
    ranged: 0.8,
    tank: 1.5,
    siege: 2.0,
  };
  return Math.floor(baseDamage * (modifiers[unitType] || 1.0));
}
