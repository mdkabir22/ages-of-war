import { getAgeTier, getUnitStatsForAge } from '../engine/types';
import type { Building, GameState, Position, Unit } from '../engine/types';

let decisionTick = 0;

function nearestPlayerTarget(state: GameState, from: Position): Position | undefined {
  const candidates: Position[] = [
    ...state.buildings.filter((b) => b.owner === 'player').map((b) => ({ x: b.position.x + 16, y: b.position.y + 16 })),
    ...state.units.filter((u) => u.owner === 'player').map((u) => ({ x: u.position.x + 16, y: u.position.y + 16 })),
  ];
  if (candidates.length === 0) return undefined;

  let best = candidates[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of candidates) {
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

function choosePlan(state: GameState): GameState['aiPlan'] {
  const playerArmy = state.units.filter((u) => u.owner === 'player' && u.type !== 'villager').length;
  const playerEconomy = state.buildings.filter((b) => b.owner === 'player' && (b.type === 'farm' || b.type === 'mine')).length;

  if (playerArmy >= 7) return 'turtle';
  if (playerEconomy >= 6) return 'rush';
  return 'boom';
}

function compositionForPlan(plan: GameState['aiPlan']): Unit['type'][] {
  if (plan === 'rush') return ['warrior', 'warrior', 'cavalry', 'warrior'];
  if (plan === 'turtle') return ['spearman', 'spearman', 'archer', 'warrior'];
  return ['warrior', 'archer', 'spearman'];
}

function canAfford(
  stock: GameState['enemyEconomy']['resources'],
  cost: Partial<GameState['enemyEconomy']['resources']>
): boolean {
  return (Object.keys(cost) as Array<keyof typeof stock>).every((k) => stock[k] >= (cost[k] ?? 0));
}

function spendResources(
  stock: GameState['enemyEconomy']['resources'],
  cost: Partial<GameState['enemyEconomy']['resources']>
): GameState['enemyEconomy']['resources'] {
  return {
    food: stock.food - (cost.food ?? 0),
    wood: stock.wood - (cost.wood ?? 0),
    stone: stock.stone - (cost.stone ?? 0),
    gold: stock.gold - (cost.gold ?? 0),
  };
}

function tickEnemyEconomy(state: GameState, dt: number): void {
  const aliveEnemyVillagers = state.units.filter(
    (u) => u.owner === 'enemy' && u.type === 'villager' && u.hp > 0
  ).length;
  state.enemyEconomy.villagers = Math.min(state.enemyEconomy.villagers, aliveEnemyVillagers);
  const hasEnemyLumberCamp = state.enemyEconomy.buildings.includes('lumber_camp');
  const hasEnemyMill = state.enemyEconomy.buildings.includes('mill');
  const woodDropOffMult = hasEnemyLumberCamp ? 1.5 : 1;
  const foodDropOffMult = hasEnemyMill ? 1.5 : 1;
  state.enemyEconomy.resources.wood += state.enemyEconomy.villagers * 2 * woodDropOffMult * dt;
  state.enemyEconomy.resources.food += state.enemyEconomy.villagers * 2.5 * foodDropOffMult * dt;
  state.enemyEconomy.resources.gold += state.enemyEconomy.villagers * 1.5 * dt;
  state.enemyEconomy.resources.stone += state.enemyEconomy.villagers * 1 * dt;
}

function enemyBuildDecision(state: GameState): void {
  const eco = state.enemyEconomy;
  const maxVillagers = 8;
  const houseCount = eco.buildings.filter((b) => b === 'house').length;
  const villagerTarget = Math.min(maxVillagers, 3 + houseCount);
  if (canAfford(eco.resources, { wood: 30 }) && houseCount < 5) {
    eco.resources = spendResources(eco.resources, { wood: 30 });
    eco.buildings.push('house');
    eco.villagers = Math.min(maxVillagers, eco.villagers + 1);
  }

  // Rebuild worker economy after villager losses.
  if (eco.villagers < villagerTarget && canAfford(eco.resources, { food: 35 })) {
    eco.resources = spendResources(eco.resources, { food: 35 });
    eco.villagers = Math.min(villagerTarget, eco.villagers + 1);
  }

  if (
    canAfford(eco.resources, { wood: 120, stone: 40 }) &&
    !eco.buildings.includes('barracks')
  ) {
    eco.resources = spendResources(eco.resources, { wood: 120, stone: 40 });
    eco.buildings.push('barracks');
  }

  const farmCount = eco.buildings.filter((b) => b === 'farm').length;
  if (canAfford(eco.resources, { wood: 60 }) && farmCount < 2) {
    eco.resources = spendResources(eco.resources, { wood: 60 });
    eco.buildings.push('farm');
  }

  if (!eco.buildings.includes('lumber_camp') && canAfford(eco.resources, { wood: 100 })) {
    eco.resources = spendResources(eco.resources, { wood: 100 });
    eco.buildings.push('lumber_camp');
  }

  if (!eco.buildings.includes('mill') && canAfford(eco.resources, { wood: 100 })) {
    eco.resources = spendResources(eco.resources, { wood: 100 });
    eco.buildings.push('mill');
  }
}

function getUnitCost(ageTier: number, unitType: Unit['type']) {
  if (unitType === 'warrior') return { food: 60 + ageTier * 10, gold: 20 + ageTier * 10 };
  if (unitType === 'archer') return { food: 70 + ageTier * 10, gold: 25 + ageTier * 10 };
  if (unitType === 'spearman') return { food: 65 + ageTier * 10, gold: 20 + ageTier * 10 };
  if (unitType === 'cavalry') return { food: 90 + ageTier * 12, gold: 40 + ageTier * 12 };
  return { food: 45 + ageTier * 5, gold: 0 };
}

function enemyTrainDecision(state: GameState, plan: GameState['aiPlan']): Unit[] {
  const newUnits: Unit[] = [];
  const ageTier = getAgeTier(state.currentAge);
  const comp = compositionForPlan(plan);
  for (const unitType of comp) {
    const cost = getUnitCost(ageTier, unitType);
    if (!canAfford(state.enemyEconomy.resources, cost)) continue;
    state.enemyEconomy.resources = spendResources(state.enemyEconomy.resources, cost);
    const stats = getUnitStatsForAge(state.currentAge, unitType);
    const spawnX = state.camera.x + window.innerWidth + 120 + Math.random() * 180;
    const lane = Math.floor(Math.random() * 3);
    const spawnY = 120 + lane * 120 + Math.random() * 24;
    const startPos = { x: spawnX, y: spawnY };
    const target = nearestPlayerTarget(state, startPos);
    newUnits.push({
      id: crypto.randomUUID(),
      type: unitType,
      position: startPos,
      target,
      owner: 'enemy',
      hp: stats.hp,
      maxHp: stats.hp,
      damage: stats.damage,
      speed: stats.speed,
      range: stats.range,
      attackSpeed: stats.attackSpeed,
      lastAttackTime: 0,
    });
  }
  return newUnits;
}

function syncEnemyVillagerUnits(state: GameState): void {
  const desired = state.enemyEconomy.villagers;
  const aliveVillagers = state.units.filter((u) => u.owner === 'enemy' && u.type === 'villager' && u.hp > 0);
  if (aliveVillagers.length < desired) {
    const needed = desired - aliveVillagers.length;
    const stats = getUnitStatsForAge(state.currentAge, 'villager');
    for (let i = 0; i < needed; i++) {
      state.units.push({
        id: crypto.randomUUID(),
        type: 'villager',
        position: {
          x: 980 + Math.random() * 120,
          y: 120 + Math.random() * 180,
        },
        target: {
          x: 900 + Math.random() * 150,
          y: 140 + Math.random() * 220,
        },
        owner: 'enemy',
        hp: stats.hp,
        maxHp: stats.hp,
        damage: stats.damage,
        speed: stats.speed,
        range: stats.range,
        attackSpeed: stats.attackSpeed,
        lastAttackTime: 0,
      });
    }
  } else if (aliveVillagers.length > desired) {
    const removeCount = aliveVillagers.length - desired;
    let removed = 0;
    state.units = state.units.filter((u) => {
      if (removed >= removeCount) return true;
      if (u.owner === 'enemy' && u.type === 'villager') {
        removed += 1;
        return false;
      }
      return true;
    });
  }
}

function syncEnemyBuildings(state: GameState): void {
  const expected = state.enemyEconomy.buildings.filter((b) => b !== 'townCenter');
  const already = new Set(
    state.buildings
      .filter((b) => b.owner === 'enemy')
      .map((b) => b.type)
  );
  for (const type of expected) {
    if (already.has(type)) continue;
    const posY = 140 + Math.random() * 240;
    const building: Building = {
      id: crypto.randomUUID(),
      type,
      owner: 'enemy',
      position: { x: 960 + Math.random() * 220, y: posY },
      hp: 140,
      maxHp: 140,
    };
    state.buildings.push(building);
  }
}

export function startEnemyAI(
  getState: () => GameState,
  setState: (updater: (state: GameState) => GameState) => void
): () => void {
  const intervalId = window.setInterval(() => {
    decisionTick += 1;
    setState((state) => {
      const aiPlan = choosePlan(state);
      syncEnemyVillagerUnits(state);
      tickEnemyEconomy(state, 10);
      enemyBuildDecision(state);
      syncEnemyBuildings(state);
      const newlyTrained = enemyTrainDecision(state, aiPlan);
      const nextUnits = [...state.units, ...newlyTrained];

      const nextWaves = state.wavesSurvived + 1;
      const survivalCompleted =
        state.missionStatus === 'active' &&
        state.mission.type === 'survival' &&
        nextWaves >= 10;
      const nextResources = survivalCompleted
        ? {
            food: state.resources.food + state.mission.rewards.food,
            wood: state.resources.wood + state.mission.rewards.wood,
            stone: state.resources.stone + state.mission.rewards.stone,
            gold: state.resources.gold + state.mission.rewards.gold,
          }
        : state.resources;

      return {
        ...state,
        aiPlan,
        units: nextUnits,
        buildings: [...state.buildings],
        enemyEconomy: {
          resources: { ...state.enemyEconomy.resources },
          villagers: state.enemyEconomy.villagers,
          buildings: [...state.enemyEconomy.buildings],
        },
        wavesSurvived: nextWaves,
        resources: nextResources,
        missionStatus: survivalCompleted ? 'success' : state.missionStatus,
      };
    });
  }, 10000);

  return () => {
    window.clearInterval(intervalId);
  };
}
