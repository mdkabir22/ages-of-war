import type { GameState } from '../../types/game';
import { deriveCombatRuntimeContext } from './combatContextRuntime';
import { updateProjectiles } from './combatRuntime';
import { runEconomyTick } from './economyRuntime';
import { updateFloatingTexts, updateParticles } from './effects';
import { updateObjectivesAndCampaignProgress } from './objectivesRuntime';
import { runPostTickMaintenance } from './postTick';
import { runRuntimeTick } from './runtimeTick';
import { runUnitUpdateRuntime } from './unitUpdateRuntime';

export function runGameUpdateRuntime(
  state: GameState,
  dt: number,
  canvasWidth: number,
  canvasHeight: number,
  lanes: number[]
): void {
  state.time += dt;
  runEconomyTick(state, dt);

  runRuntimeTick(state, dt);
  const context = deriveCombatRuntimeContext(state, canvasHeight, lanes);
  runUnitUpdateRuntime(state, dt, canvasWidth, canvasHeight, context);

  updateProjectiles(state, dt);
  updateParticles(state, dt);
  updateFloatingTexts(state, dt);

  runPostTickMaintenance(state, dt);
  updateObjectivesAndCampaignProgress(state);
}
