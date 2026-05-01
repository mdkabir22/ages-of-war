import type { GameState, GameUnit } from '../../types/game';
import { LANE_Y_RATIOS } from '../../core/map';
import { AGES, getUnitDamage } from '../ages';
import { BUILDING_DEFINITIONS } from '../entities/buildings';
import { assignVillagerToNode } from './gathering';
import { trainUnit } from './training';
import { allocParticle, emitRadialParticles } from './effects';

const LANES = [...LANE_Y_RATIOS];

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

export function spawnUnitRuntime(
  state: GameState,
  unitType: number,
  isPlayer: boolean,
  canvasHeight: number,
  generateUnitId: () => string
): GameUnit | null {
  const age = isPlayer ? state.playerAge : state.aiAge;
  const ageConfig = AGES[age];

  if (!ageConfig || unitType >= ageConfig.units.length) return null;

  const unitStats = ageConfig.units[unitType];
  if (!trainUnit(state, unitStats.cost, isPlayer)) return null;

  const laneIndex = Math.floor(Math.random() * LANES.length);
  const laneY = LANES[laneIndex] * canvasHeight;
  const yOffset = Math.max(70, Math.min(canvasHeight - 170, laneY + (Math.random() - 0.5) * 28));

  const unit: GameUnit = {
    id: generateUnitId(),
    type: unitType,
    age,
    x: isPlayer ? state.playerCastle.x + 60 : state.aiCastle.x - 60,
    y: yOffset,
    health: unitStats.health,
    maxHealth: unitStats.health,
    damage: getUnitDamage(age, unitStats.type),
    speed: unitStats.speed,
    range: unitStats.range,
    attackSpeed: unitStats.attackSpeed,
    lastAttackTime: 0,
    isPlayer,
    target: null,
    isAttacking: false,
    isDead: false,
    deathTime: 0,
    attackAnim: 0,
    aiStrategyTag: isPlayer ? undefined : state.aiDirector.visualTelegraph,
  };

  state.units.push(unit);
  if (isPlayer && unitType === 0) {
    const villager = {
      id: unit.id,
      position: { x: unit.x, y: unit.y },
      assignedNode: null as string | null,
      carriedResource: null as { type: 'food' | 'wood' | 'stone' | 'gold'; amount: number } | null,
      state: 'idle' as const,
      owner: 'player' as const,
    };
    const bestNode = state.resourceNodes.find((n) => n.resourceAmount > 0);
    if (bestNode) assignVillagerToNode(villager, bestNode);
    state.villagers.push(villager);
  }

  if (isPlayer) {
    state.currentPopulation = getPopulationUsed(state, true);
    state.populationCap = getPopulationCap(state, true);
    state.missions.spawnUnits += 1;
  }

  emitRadialParticles(state, unit.x, unit.y, 7, '#C9B8A8', 'dust', 18, 55, 0.35, 0.75, 2, 4.2);
  emitRadialParticles(state, unit.x, unit.y, 5, AGES[age].themeColor, 'spark', 30, 85, 0.2, 0.45, 1.4, 2.8);
  return unit;
}

export function canUpgradeAgeRuntime(state: GameState, isPlayer: boolean): boolean {
  const currentAge = isPlayer ? state.playerAge : state.aiAge;
  if (currentAge >= AGES.length - 1) return false;

  const nextAge = currentAge + 1;
  const xpRequired = AGES[nextAge].xpRequired;
  return isPlayer ? state.playerXP >= xpRequired : true;
}

export function upgradeAgeRuntime(state: GameState, isPlayer: boolean): boolean {
  if (!canUpgradeAgeRuntime(state, isPlayer)) return false;

  if (isPlayer) {
    state.playerAge = Math.min(state.playerAge + 1, AGES.length - 1);
    state.playerCastle.age = state.playerAge;
  } else {
    state.aiAge = Math.min(state.aiAge + 1, AGES.length - 1);
    state.aiCastle.age = state.aiAge;
  }

  state.ageUpAnim = 1;
  for (let i = 0; i < 30; i++) {
    state.particles.push(
      allocParticle(
        isPlayer ? state.playerCastle.x : state.aiCastle.x,
        200 + Math.random() * 200,
        (Math.random() - 0.5) * 150,
        -Math.random() * 200 - 50,
        2,
        isPlayer ? '#FFD700' : '#FF4444',
        4 + Math.random() * 6,
        'levelup'
      )
    );
  }

  return true;
}
