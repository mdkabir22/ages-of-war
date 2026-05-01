import { AGES } from '../ages';
import { LANE_Y_RATIOS } from '../../core/map';
import { remoteGameConfig } from '../../lib/remoteConfig';
import {
  allocProjectile,
  applyCameraShake,
  emitCastleImpactEffect,
  emitRadialParticles,
  emitUnitHitEffect,
  recycleProjectile,
} from './effects';
import type { Castle, GameState, GameUnit } from '../../types/game';

const LANES = [...LANE_Y_RATIOS];

export function getUnitType(unit: GameUnit): 'melee' | 'ranged' | 'tank' | 'siege' {
  return AGES[unit.age].units[unit.type].type;
}

export function getCounterMultiplier(
  attackerType: 'melee' | 'ranged' | 'tank' | 'siege',
  defenderType: 'melee' | 'ranged' | 'tank' | 'siege'
): number {
  if (attackerType === defenderType) return 1;
  if (attackerType === 'melee' && defenderType === 'tank') return 1.26;
  if (attackerType === 'melee' && defenderType === 'ranged') return 0.9;
  if (attackerType === 'ranged' && defenderType === 'melee') return 1.24;
  if (attackerType === 'ranged' && defenderType === 'siege') return 0.9;
  if (attackerType === 'tank' && defenderType === 'ranged') return 1.25;
  if (attackerType === 'tank' && defenderType === 'melee') return 0.92;
  if (attackerType === 'siege' && defenderType === 'tank') return 1.18;
  if (attackerType === 'siege' && defenderType === 'melee') return 1.08;
  if (attackerType === 'siege' && defenderType === 'ranged') return 0.88;
  return 1;
}

export function onUnitKilled(state: GameState, attackerIsPlayer: boolean, defeated: GameUnit): void {
  defeated.isDead = true;
  defeated.deathTime = state.time;

  if (attackerIsPlayer && !defeated.isPlayer) {
    state.playerXP += remoteGameConfig.getXpPerKill();
    state.battlePassXP += 12;
    state.kills++;
    state.missions.destroyEnemies += 1;
  }

  emitRadialParticles(
    state,
    defeated.x,
    defeated.y,
    12,
    AGES[defeated.age].themeColor,
    'explosion',
    45,
    140,
    0.6,
    1.2,
    2.8,
    5.8
  );
  emitRadialParticles(state, defeated.x, defeated.y + 8, 10, '#9C6B44', 'dust', 25, 90, 0.45, 0.95, 2.4, 5.5);
  applyCameraShake(state, 0.16);
}

export function getProjectileColor(age: number, unitType: number): string {
  const colors = [
    ['#8B4513', '#696969', '#8B4513', '#A0522D'],
    ['#C0C0C0', '#228B22', '#8B4513', '#A0522D'],
    ['#FFD700', '#32CD32', '#FF6347', '#87CEEB'],
    ['#00FFFF', '#FF00FF', '#9B59B6', '#00CED1'],
  ];
  return colors[age]?.[unitType] || '#FFFFFF';
}

export function findNearestEnemy(unit: GameUnit, state: GameState): GameUnit | null {
  let nearest: GameUnit | null = null;
  let nearestDist = Infinity;
  for (const other of state.units) {
    if (other.isPlayer === unit.isPlayer) continue;
    if (other.isDead) continue;
    const dx = other.x - unit.x;
    const dy = other.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = other;
    }
  }
  return nearest;
}

export function findPriorityEnemy(unit: GameUnit, state: GameState): GameUnit | null {
  let bestTarget: GameUnit | null = null;
  let bestScore = -Infinity;
  for (const other of state.units) {
    if (other.isPlayer === unit.isPlayer) continue;
    if (other.isDead) continue;
    const dx = other.x - unit.x;
    const dy = other.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const enemyType = getUnitType(other);
    let score = -dist;
    if (enemyType === 'siege') score += 140;
    else if (enemyType === 'ranged') score += 80;
    else if (enemyType === 'tank') score += 20;
    if (dist <= unit.range + 40) score += 35;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = other;
    }
  }
  return bestTarget;
}

export function findEnemyCastle(unit: GameUnit, state: GameState): Castle | null {
  const castle = unit.isPlayer ? state.aiCastle : state.playerCastle;
  if (castle.health <= 0) return null;
  return castle;
}

export function distanceToCastle(unit: GameUnit, castle: Castle): number {
  return Math.abs(unit.x - castle.x);
}

export function getLaneIndex(y: number, canvasHeight: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < LANES.length; i++) {
    const laneY = LANES[i] * canvasHeight;
    const d = Math.abs(y - laneY);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function getLaneControl(state: GameState, canvasHeight: number): number[] {
  const control = [0, 0, 0];
  for (const u of state.units) {
    if (u.isDead) continue;
    const lane = getLaneIndex(u.y, canvasHeight);
    const type = getUnitType(u);
    const weight = type === 'tank' ? 1.4 : type === 'siege' ? 1.2 : 1;
    control[lane] += u.isPlayer ? weight : -weight;
  }
  return control;
}

export function getMostContestedLane(control: number[]): number {
  let bestLane = 1;
  let smallestAbs = Infinity;
  for (let i = 0; i < control.length; i++) {
    const abs = Math.abs(control[i]);
    if (abs < smallestAbs) {
      smallestAbs = abs;
      bestLane = i;
    }
  }
  return bestLane;
}

export function getSuddenDeathMultiplier(time: number): number {
  if (time < 360) return 1;
  const overtime = time - 360;
  return 1 + Math.min(0.65, overtime / 180);
}

export function updateProjectiles(state: GameState, dt: number): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    const dx = proj.targetX - proj.x;
    const dy = proj.targetY - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 15) {
      let hit = false;
      for (const unit of state.units) {
        if (unit.isPlayer === proj.isPlayer) continue;
        if (unit.isDead) continue;
        const udx = unit.x - proj.x;
        const udy = unit.y - proj.y;
        const udist = Math.sqrt(udx * udx + udy * udy);

        if (udist < 50) {
          const defenderType = getUnitType(unit);
          const damage = proj.damage * getCounterMultiplier(proj.attackType, defenderType);
          unit.health -= damage;
          hit = true;

          emitRadialParticles(state, proj.x, proj.y, 9, proj.color, 'spark', 45, 145, 0.2, 0.55, 1.5, 3.2);
          emitRadialParticles(state, proj.x, proj.y + 6, 5, '#6D4C41', 'dust', 20, 70, 0.35, 0.8, 2.1, 4.6);
          applyCameraShake(state, damage > 80 ? 0.2 : 0.11);

          if (unit.health <= 0) {
            onUnitKilled(state, proj.isPlayer, unit);
          }
          break;
        }
      }

      if (!hit) {
        const castle = proj.isPlayer ? state.aiCastle : state.playerCastle;
        if (Math.abs(proj.x - castle.x) < 60) {
          castle.health -= proj.damage;
          applyCameraShake(state, Math.min(0.85, 0.2 + proj.damage / 230));
          hit = true;
          emitCastleImpactEffect(state, castle, proj.y, proj.damage);
        }
      }

      recycleProjectile(proj);
      state.projectiles.splice(i, 1);
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      proj.prevX = proj.x;
      proj.prevY = proj.y;
      proj.x += nx * proj.speed * dt;
      proj.y += ny * proj.speed * dt;
    }
  }
}

export function tryApplyEnemyRetreat(
  unit: GameUnit,
  state: GameState,
  dt: number,
  canvasWidth: number,
  canvasHeight: number,
  aiRetreatThreshold: number,
  aiStabilizeMode: boolean
): boolean {
  if (unit.isPlayer) return false;
  const hpRatio = unit.health / Math.max(1, unit.maxHealth);
  const shouldRetreat = hpRatio < aiRetreatThreshold && (aiStabilizeMode || unit.x < state.aiCastle.x - 150);
  if (!shouldRetreat) return false;
  unit.target = null;
  unit.isAttacking = false;
  const retreatSpeed = unit.speed * dt * (aiStabilizeMode ? 1.15 : 0.95);
  unit.x = Math.min(state.aiCastle.x - 85, unit.x + retreatSpeed);
  const defendLine = canvasHeight * LANES[1];
  unit.y += (defendLine - unit.y) * dt * 1.4;
  unit.x = Math.max(20, Math.min(canvasWidth - 20, unit.x));
  unit.y = Math.max(50, Math.min(canvasHeight - 150, unit.y));
  return true;
}

export function applyPlayerLaneFocus(unit: GameUnit, state: GameState, dt: number, laneFocusY: number | null): void {
  if (!unit.isPlayer || laneFocusY == null) return;
  unit.y += (laneFocusY - unit.y) * dt * (state.playerBattleStance === 'aggressive' ? 1.5 : 1.25);
}

export function applyDefaultAdvance(
  unit: GameUnit,
  state: GameState,
  dt: number,
  stanceMoveMult: number,
  canvasHeight: number
): void {
  if (unit.target) return;
  const dir = unit.isPlayer ? 1 : -1;
  const rallyMultiplier = unit.isPlayer && state.time < state.rallyUntil ? 1.2 : 1;
  const assistMoveBoost = unit.isPlayer && state.time < state.adaptiveAssistUntil ? 1.1 : 1;
  const stanceMoveBoost = unit.isPlayer ? stanceMoveMult : 1;
  unit.x += dir * unit.speed * dt * rallyMultiplier * assistMoveBoost * stanceMoveBoost;
  if (unit.isPlayer && state.playerBattleStance === 'defensive') {
    const holdLine = state.playerCastle.x + 270;
    if (unit.x > holdLine) unit.x -= unit.speed * dt * 0.45;
  }
  const centerY = canvasHeight / 2;
  const dy = centerY - unit.y;
  unit.y += dy * 0.5 * dt;
}

export type UnitTargetingPhaseResult = {
  skipIteration: boolean;
  targetIsCastle: boolean;
  enemyCastle: Castle | null;
};

export function runUnitTargetingPhase(
  unit: GameUnit,
  state: GameState,
  dt: number,
  canvasHeight: number,
  stanceRangeBonus: number,
  stanceMoveMult: number
): UnitTargetingPhaseResult {
  const enemyCastle = findEnemyCastle(unit, state);
  const nearestEnemy = findPriorityEnemy(unit, state) || findNearestEnemy(unit, state);

  let targetIsCastle = false;

  if (nearestEnemy) {
    const dx = nearestEnemy.x - unit.x;
    const dy = nearestEnemy.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const unitLane = getLaneIndex(unit.y, canvasHeight);
    const enemyLane = getLaneIndex(nearestEnemy.y, canvasHeight);
    const laneAligned = unitLane === enemyLane;
    const unitType = getUnitType(unit);
    const lowHealth = unit.health / unit.maxHealth < 0.35;
    const playerMoveBoost =
      (unit.isPlayer && state.time < state.rallyUntil ? 1.2 : 1) *
      (unit.isPlayer && state.time < state.adaptiveAssistUntil ? 1.1 : 1) *
      (unit.isPlayer ? stanceMoveMult : 1);
    const laneEngageRangeBonus = unit.isPlayer
      ? state.playerLaneFocus === 'auto'
        ? 0
        : laneAligned
          ? 18
          : -20
      : 0;

    if ((unitType === 'ranged' || unitType === 'siege') && lowHealth && dist < 90) {
      const nx = dx / Math.max(dist, 1);
      const ny = dy / Math.max(dist, 1);
      unit.x -= nx * unit.speed * dt * 1.25 * playerMoveBoost;
      unit.y -= ny * unit.speed * dt * 1.1 * playerMoveBoost;
      unit.target = null;
      unit.isAttacking = false;
      return { skipIteration: true, targetIsCastle: false, enemyCastle };
    }

    if (dist <= unit.range + (unit.isPlayer ? stanceRangeBonus : 0) + laneEngageRangeBonus) {
      unit.target = nearestEnemy;
    } else {
      unit.target = null;
      const nx = dx / dist;
      const ny = dy / dist;
      unit.x += nx * unit.speed * dt * playerMoveBoost;
      unit.y += ny * unit.speed * dt * playerMoveBoost;
      unit.y = Math.max(50, Math.min(canvasHeight - 150, unit.y));
    }
  } else if (enemyCastle) {
    const dist = distanceToCastle(unit, enemyCastle);

    if (dist <= unit.range + 30 + (unit.isPlayer ? stanceRangeBonus : 0)) {
      unit.target = null;
      targetIsCastle = true;
    } else {
      unit.target = null;
      const dir = unit.isPlayer ? 1 : -1;
      unit.x += dir * unit.speed * dt;
    }
  }

  return { skipIteration: false, targetIsCastle, enemyCastle };
}

export function resolveUnitCombatPhase(
  unit: GameUnit,
  state: GameState,
  dt: number,
  canvasHeight: number,
  targetIsCastle: boolean,
  enemyCastle: Castle | null,
  stanceDamageMult: number,
  stanceMoveMult: number
): void {
  if (unit.target && !unit.target.isDead) {
    const dx = unit.target.x - unit.x;
    const dy = unit.target.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= unit.range + 20) {
      unit.isAttacking = true;
      unit.attackAnim += dt * unit.attackSpeed * 10;

      const now = state.time;
      if (now - unit.lastAttackTime >= 1 / unit.attackSpeed) {
        unit.lastAttackTime = now;
        const rallyAttackBoost = unit.isPlayer && state.time < state.rallyUntil ? 1.18 : 1;
        const assistAttackBoost = unit.isPlayer && state.time < state.adaptiveAssistUntil ? 1.12 : 1;
        const stanceAttackBoost = unit.isPlayer ? stanceDamageMult : 1;
        const suddenDeath = getSuddenDeathMultiplier(state.time);

        if (unit.type === 1 || unit.type === 3) {
          state.projectiles.push(
            allocProjectile(
              unit.x,
              unit.y,
              unit.target.x,
              unit.target.y,
              400,
              unit.damage * rallyAttackBoost * assistAttackBoost * stanceAttackBoost * suddenDeath,
              getProjectileColor(unit.age, unit.type),
              unit.isPlayer,
              getUnitType(unit)
            )
          );
        } else {
          const laneAligned = unit.target
            ? getLaneIndex(unit.y, canvasHeight) === getLaneIndex(unit.target.y, canvasHeight)
            : true;
          const laneDamageMult = unit.isPlayer
            ? state.playerLaneFocus === 'auto'
              ? 1
              : laneAligned
                ? 1.05
                : 0.94
            : 1;
          const damage =
            unit.damage *
            rallyAttackBoost *
            assistAttackBoost *
            stanceAttackBoost *
            laneDamageMult *
            suddenDeath *
            getCounterMultiplier(getUnitType(unit), getUnitType(unit.target));
          unit.target.health -= damage;

          const counter = getCounterMultiplier(getUnitType(unit), getUnitType(unit.target));
          const isCrit = counter > 1 || damage >= unit.target.maxHealth * 0.28;
          const isHeavy = damage >= unit.target.maxHealth * 0.18;
          emitUnitHitEffect(state, unit.target, isHeavy || isCrit);
          emitRadialParticles(
            state,
            (unit.x + unit.target.x) / 2,
            (unit.y + unit.target.y) / 2,
            isCrit ? 8 : 5,
            '#E8E0D8',
            'dust',
            20,
            65,
            0.22,
            0.5,
            1.2,
            2.4
          );
          applyCameraShake(
            state,
            isCrit
              ? Math.min(0.42, 0.18 + damage / 200)
              : isHeavy
                ? Math.min(0.3, 0.14 + damage / 260)
                : damage > 90
                  ? 0.22
                  : 0.12
          );

          if (unit.target.health <= 0) {
            onUnitKilled(state, unit.isPlayer, unit.target);
          }
        }
      }
    } else {
      const dx2 = unit.target.x - unit.x;
      const dy2 = unit.target.y - unit.y;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (dist2 > 0) {
        unit.x += (dx2 / dist2) * unit.speed * dt;
        unit.y += (dy2 / dist2) * unit.speed * dt;
      }
      unit.isAttacking = false;
    }
  } else if (targetIsCastle && enemyCastle) {
    unit.isAttacking = true;
    unit.attackAnim += dt * unit.attackSpeed * 10;

    const now = state.time;
    if (now - unit.lastAttackTime >= 1 / unit.attackSpeed) {
      unit.lastAttackTime = now;
      const rallyAttackBoost = unit.isPlayer && state.time < state.rallyUntil ? 1.18 : 1;
      const assistAttackBoost = unit.isPlayer && state.time < state.adaptiveAssistUntil ? 1.12 : 1;
      const stanceAttackBoost = unit.isPlayer ? stanceDamageMult : 1;
      const suddenDeath = getSuddenDeathMultiplier(state.time);

      if (unit.type === 1 || unit.type === 3) {
        const castleDamage =
          (getUnitType(unit) === 'siege' ? unit.damage * 1.8 : unit.damage) *
          rallyAttackBoost *
          assistAttackBoost *
          stanceAttackBoost *
          suddenDeath;
        state.projectiles.push(
          allocProjectile(
            unit.x,
            unit.y,
            enemyCastle.x,
            unit.y,
            400,
            castleDamage,
            getProjectileColor(unit.age, unit.type),
            unit.isPlayer,
            getUnitType(unit)
          )
        );
      } else {
        const castleDamage =
          (getUnitType(unit) === 'siege' ? unit.damage * 1.8 : unit.damage) *
          rallyAttackBoost *
          assistAttackBoost *
          stanceAttackBoost *
          suddenDeath;
        enemyCastle.health -= castleDamage;
        applyCameraShake(state, Math.min(0.75, 0.16 + castleDamage / 220));
        emitCastleImpactEffect(state, enemyCastle, unit.y, castleDamage);
      }
    }
  } else {
    unit.isAttacking = false;
    applyDefaultAdvance(unit, state, dt, stanceMoveMult, canvasHeight);
  }
}
