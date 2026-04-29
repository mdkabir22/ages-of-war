import type { GameState } from '../../types/game';
import { AGES } from '../ages';
import { planAIStrategy } from '../ai/strategyPlanner';

let aiLastBossWave = 0;

interface AIDirectorDeps {
  lanes: number[];
  getLaneControl: (state: GameState, canvasHeight: number) => number[];
  getMostContestedLane: (control: number[]) => number;
  spawnUnitInLane: (
    state: GameState,
    unitType: number,
    isPlayer: boolean,
    canvasHeight: number,
    laneIndex: number
  ) => GameState['units'][number] | null;
  upgradeAge: (state: GameState, isPlayer: boolean) => boolean;
}

function mode(arr: number[]): number {
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let maxVal = 0;

  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) {
      maxCount = counts[v];
      maxVal = v;
    }
  }

  return maxVal;
}

export function updateAIDirector(
  state: GameState,
  canvasHeight: number,
  deps: AIDirectorDeps
): void {
  const now = state.time;
  const director = state.aiDirector;
  const laneControl = deps.getLaneControl(state, canvasHeight);
  const weakestLane = laneControl.indexOf(Math.min(...laneControl));
  const contestedLane = deps.getMostContestedLane(laneControl);
  const playerCastleRatio = state.playerCastle.health / state.playerCastle.maxHealth;
  const aiCastleRatio = state.aiCastle.health / state.aiCastle.maxHealth;
  const playerMomentum = (state.kills / Math.max(1, state.time / 30)) + (playerCastleRatio - aiCastleRatio) * 2;
  const playerUnitCount = state.units.filter((u) => u.isPlayer && !u.isDead).length;
  const aiUnitCount = state.units.filter((u) => !u.isPlayer && !u.isDead).length;
  const plannerDecision = planAIStrategy({
    currentAge: state.aiAge,
    ownCastleHealthRatio: aiCastleRatio,
    enemyCastleHealthRatio: playerCastleRatio,
    ownArmySize: aiUnitCount,
    enemyArmySize: playerUnitCount,
    stockGold: state.aiGold,
  });
  const plannerLane = Math.max(0, Math.min(2, plannerDecision.priorityLane));
  director.plannerNotes = plannerDecision.notes;
  const compositionPressure = Math.max(-0.8, Math.min(1.2, (playerUnitCount - aiUnitCount) / 14));

  const liveOpsBias = director.liveOpsDifficultyBias;
  const skillSignal = Math.max(
    0,
    Math.min(1, 0.48 + playerMomentum * 0.14 + (playerCastleRatio - aiCastleRatio) * 0.2 + liveOpsBias * 0.12)
  );
  director.skillEstimate = director.skillEstimate * 0.86 + skillSignal * 0.14;
  director.pressureScore = Math.max(-1, Math.min(1.35, playerMomentum * 0.55 + compositionPressure));

  if (state.aiGold < 140) director.economyMode = 'starved';
  else if (state.aiGold > 340) director.economyMode = 'surplus';
  else director.economyMode = 'balanced';

  const behind = aiCastleRatio + 0.06 < playerCastleRatio;
  const canAllIn = state.aiGold > 380 - liveOpsBias * 60 && state.aiAge >= 1;
  if (plannerDecision.strategy === 'turtle') director.macroPlan = 'stabilize';
  else if (plannerDecision.strategy === 'boom') director.macroPlan = 'boom';
  else if (plannerDecision.strategy === 'rush') director.macroPlan = canAllIn ? 'allin' : 'siege';
  else if (behind && director.economyMode !== 'surplus') director.macroPlan = 'stabilize';
  else if (state.aiProfile === 'techrush' && director.skillEstimate < 0.58) director.macroPlan = 'boom';
  else if (canAllIn && director.skillEstimate > 0.63 && Math.random() > 0.45) director.macroPlan = 'allin';
  else director.macroPlan = 'siege';

  const varianceFactor = director.personalityVariance + (Math.random() - 0.5) * 0.08;
  director.reserveGold = director.macroPlan === 'stabilize'
    ? 190
    : director.economyMode === 'starved'
      ? 120
      : director.macroPlan === 'boom'
        ? 220
        : 95;

  director.microRetreatThreshold = state.aiProfile === 'defensive'
    ? 0.46
    : state.aiProfile === 'aggressive'
      ? 0.24
      : 0.34;
  if (director.macroPlan === 'stabilize') director.microRetreatThreshold += 0.05;
  if (director.macroPlan === 'allin') director.microRetreatThreshold -= 0.05;

  if (now >= director.nextMacroDecisionAt) {
    director.nextMacroDecisionAt = now + 6 + Math.random() * 5;
    director.visualTelegraph = director.macroPlan === 'stabilize'
      ? 'defensive'
      : director.macroPlan === 'boom'
        ? 'techrush'
        : state.aiProfile;
    director.visualTelegraphUntil = now + 5.5;
  }

  if (now >= director.nextAgeCheckAt && state.aiAge < AGES.length - 1) {
    const profileGreed = state.aiProfile === 'techrush' ? 0.2 : state.aiProfile === 'defensive' ? -0.12 : 0.05;
    const economyBonus = director.economyMode === 'surplus' ? 0.2 : director.economyMode === 'starved' ? -0.15 : 0;
    const riskPenalty = behind ? -0.08 : 0.06;
    const plannerAgeBias = plannerDecision.shouldAgeUp ? 0.22 : -0.06;
    const decisionScore =
      (now / 155) + economyBonus + riskPenalty + profileGreed + plannerAgeBias + (1 - director.skillEstimate) * 0.12 + liveOpsBias * 0.18;
    if (decisionScore > 0.92) {
      deps.upgradeAge(state, false);
      director.visualTelegraph = 'techrush';
      director.visualTelegraphUntil = now + 5;
    }
    director.nextAgeCheckAt = now + Math.max(12, 26 - state.aiAge * 3) * (0.9 + Math.random() * 0.35);
  }

  if (now >= director.nextSpawnAt) {
    const age = state.aiAge;
    const spendable = Math.max(0, state.aiGold - director.reserveGold);
    let budget = Math.min(420 + liveOpsBias * 120, spendable);
    if (director.macroPlan === 'allin') budget += 90;
    if (director.economyMode === 'surplus') budget += 75;
    if (director.macroPlan === 'stabilize') budget -= 30;

    if (director.economyMode === 'starved' && state.aiGold >= 110 && behind && Math.random() > 0.45) {
      const turret = deps.spawnUnitInLane(state, 1, false, canvasHeight, weakestLane);
      if (turret) {
        turret.speed *= 0.22;
        turret.range *= 1.45;
        turret.maxHealth *= 1.28;
        turret.health = turret.maxHealth;
        turret.damage *= 1.08;
        turret.x = Math.max(state.playerCastle.x + 250, state.aiCastle.x - 120);
        turret.aiStrategyTag = 'defensive';
        director.visualTelegraph = 'defensive';
        director.visualTelegraphUntil = now + 4.8;
        state.aiGold -= Math.max(0, AGES[age].units[1].cost * 0.35);
      }
    }

    while (budget > 0) {
      const playerUnits = state.units.filter((u) => u.isPlayer && !u.isDead);
      let unitType = Math.floor(Math.random() * AGES[age].units.length);

      if (state.aiProfile === 'aggressive' && Math.random() > 0.52) unitType = Math.random() > 0.46 ? 0 : 1;
      if (state.aiProfile === 'defensive' && Math.random() > 0.5) unitType = 2;
      if (state.aiProfile === 'techrush' && state.aiAge >= 2 && Math.random() > 0.52) unitType = 3;
      if (director.macroPlan === 'allin' && Math.random() > 0.5) unitType = 3;
      if (director.macroPlan === 'stabilize' && Math.random() > 0.42) unitType = 2;

      if (playerUnits.length > 0) {
        const playerTypes = playerUnits.map((u) => u.type);
        const mostCommon = mode(playerTypes);
        if (mostCommon === 0) unitType = Math.random() > 0.2 ? 1 : unitType;
        else if (mostCommon === 1) unitType = Math.random() > 0.2 ? 2 : unitType;
        else if (mostCommon === 2) unitType = Math.random() > 0.2 ? 0 : unitType;
      }

      const cost = AGES[age].units[unitType].cost;
      if (cost > state.aiGold || cost > budget) break;

      const laneBias = director.macroPlan === 'stabilize'
        ? weakestLane
        : director.macroPlan === 'allin'
          ? plannerLane
          : Math.random() > 0.58
            ? plannerLane
            : Math.floor(Math.random() * deps.lanes.length);
      const spawned = deps.spawnUnitInLane(state, unitType, false, canvasHeight, laneBias);
      if (!spawned) break;

      spawned.aiStrategyTag = now < director.visualTelegraphUntil ? director.visualTelegraph : state.aiProfile;
      if (director.macroPlan === 'allin') {
        spawned.damage *= 1.08;
        spawned.speed *= 1.04;
      }
      if (director.macroPlan === 'stabilize' && unitType === 2) {
        spawned.maxHealth *= 1.1;
        spawned.health = spawned.maxHealth;
      }

      budget -= cost;
      if (director.economyMode === 'starved' || Math.random() > 0.72 + 0.12 * varianceFactor) break;
    }

    const spawnTempoBase = director.macroPlan === 'allin'
      ? 0.8
      : director.macroPlan === 'stabilize'
        ? 1.35
        : director.economyMode === 'surplus'
          ? 0.95
          : 1.18;
    const adaptiveTempo = 1 + (director.skillEstimate - 0.5) * 0.32 - liveOpsBias * 0.18;
    const jitter = 0.72 + Math.random() * 0.65 * varianceFactor;
    director.nextSpawnAt = now + Math.max(0.55, spawnTempoBase * adaptiveTempo * jitter);
  }

  if (state.wave % 5 === 0 && state.wave > aiLastBossWave) {
    aiLastBossWave = state.wave;

    state.aiGold += 500 + state.wave * 50;
    const tank = deps.spawnUnitInLane(state, 2, false, canvasHeight, weakestLane);
    const siege = deps.spawnUnitInLane(state, 3, false, canvasHeight, contestedLane);

    if (tank) {
      tank.maxHealth *= 1.7;
      tank.health = tank.maxHealth;
      tank.damage *= 1.35;
      tank.speed *= 1.12;
      tank.aiStrategyTag = 'aggressive';
    }

    if (siege) {
      siege.maxHealth *= 1.4;
      siege.health = siege.maxHealth;
      siege.damage *= 1.45;
      siege.range *= 1.1;
      siege.aiStrategyTag = 'techrush';
    }
  }
}
