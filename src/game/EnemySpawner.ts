import { getUnitStatsForAge } from '../core/types';
import type { GameState, Position, Unit } from '../core/types';

let wave = 0;

function nearestPlayerTarget(state: GameState, from: Position): Position | undefined {
  const candidates: Position[] = [
    ...state.buildings.filter((b) => b.owner === 'player').map((b) => ({ x: b.position.x, y: b.position.y })),
    ...state.units.filter((u) => u.owner === 'player').map((u) => ({ x: u.position.x, y: u.position.y })),
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

export function startEnemySpawner(
  _getState: () => GameState,
  setState: (updater: (state: GameState) => GameState) => void
): () => void {
  const intervalId = window.setInterval(() => {
    wave += 1;
    const enemyCount = 3 + wave * 2;
    setState((state) => {
      const nextUnits = [...state.units];
      for (let i = 0; i < enemyCount; i++) {
        const spawnX = state.camera.x + window.innerWidth + 120 + Math.random() * 180;
        const lane = Math.floor(Math.random() * 3);
        const spawnY = 120 + lane * 120 + Math.random() * 24;
        const startPos = { x: spawnX, y: spawnY };
        const target = nearestPlayerTarget(state, startPos);
        const stats = getUnitStatsForAge(state.currentAge, 'warrior');
        const enemy: Unit = {
          id: crypto.randomUUID(),
          type: 'warrior',
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
        };
        nextUnits.push(enemy);
      }
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
        units: nextUnits,
        wavesSurvived: nextWaves,
        resources: nextResources,
        missionStatus: survivalCompleted ? 'success' : state.missionStatus,
      };
    });
  }, 15000);

  return () => {
    window.clearInterval(intervalId);
  };
}
