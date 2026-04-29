import { BUILDING_DEFINITIONS } from '../entities/buildings';
import type { GameState } from '../../types/game';

function getPopulationCap(state: GameState): number {
  let bonus = 0;
  for (const b of state.playerBuildings) {
    bonus += BUILDING_DEFINITIONS[b.type].populationBonus ?? 0;
  }
  return 10 + bonus;
}

function getPopulationUsed(state: GameState): number {
  return state.units.filter((u) => u.isPlayer && !u.isDead).length;
}

export function runPostTickMaintenance(state: GameState, dt: number): void {
  state.units = state.units.filter((u) => !(u.isDead && state.time - u.deathTime > 3));
  const aliveVillagers = new Set(state.units.filter((u) => !u.isDead).map((u) => u.id));
  state.villagers = state.villagers.filter((v) => aliveVillagers.has(v.id));
  state.currentPopulation = getPopulationUsed(state);
  state.populationCap = getPopulationCap(state);

  if (state.aiCastle.health <= 0) {
    state.aiCastle.health = 0;
    state.screen = 'gameover';
    state.isVictory = true;
    state.battlePassXP += 150;
  }
  if (state.playerCastle.health <= 0) {
    state.playerCastle.health = 0;
    state.screen = 'gameover';
    state.isVictory = false;
  }

  if (state.screen !== 'gameover' && state.mode === 'defense' && state.modeTimeLimit > 0) {
    if (state.time >= state.modeTimeLimit && state.playerCastle.health > 0) {
      state.screen = 'gameover';
      state.isVictory = true;
      state.battlePassXP += 180;
    }
  }
  if (state.screen !== 'gameover' && state.mode === 'raid' && state.modeTimeLimit > 0) {
    if (state.time >= state.modeTimeLimit && state.aiCastle.health > 0) {
      state.screen = 'gameover';
      state.isVictory = false;
    }
  }

  if (state.mode === 'endless') {
    const endlessWave = Math.max(1, Math.floor(state.time / 18) + 1);
    state.wave = Math.max(state.wave, endlessWave);
    if (state.time > 120) {
      state.aiGold += dt * (22 + Math.min(65, state.time / 7));
    }
  }
  if (state.mode === 'campaign' && state.time > 90) {
    state.aiGold += dt * (8 + Math.min(24, state.campaignMissionIndex * 2.2));
  }

  state.playerCastle.health = Math.min(state.playerCastle.health, state.playerCastle.maxHealth);
  state.aiCastle.health = Math.min(state.aiCastle.health, state.aiCastle.maxHealth);
  state.playerResources.gold = state.playerGold;
  state.aiResources.gold = state.aiGold;
}
