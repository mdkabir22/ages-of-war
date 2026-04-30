import type { GameState } from '../../types/game';
import type { CombatRuntimeContext } from './combatContextRuntime';
import {
  applyPlayerLaneFocus,
  resolveUnitCombatPhase,
  runUnitTargetingPhase,
  tryApplyEnemyRetreat,
} from './combatRuntime';

export function runUnitUpdateRuntime(
  state: GameState,
  dt: number,
  canvasWidth: number,
  canvasHeight: number,
  context: CombatRuntimeContext
): void {
  for (const unit of state.units) {
    if (unit.isDead) continue;

    if (tryApplyEnemyRetreat(unit, state, dt, canvasWidth, canvasHeight, context.aiRetreatThreshold, context.aiStabilizeMode)) {
      continue;
    }
    applyPlayerLaneFocus(unit, state, dt, context.laneFocusY);

    const targeting = runUnitTargetingPhase(unit, state, dt, canvasHeight, context.stanceRangeBonus, context.stanceMoveMult);
    if (targeting.skipIteration) continue;

    resolveUnitCombatPhase(
      unit,
      state,
      dt,
      canvasHeight,
      targeting.targetIsCastle,
      targeting.enemyCastle,
      context.stanceDamageMult,
      context.stanceMoveMult
    );

    unit.x = Math.max(20, Math.min(canvasWidth - 20, unit.x));
    unit.y = Math.max(50, Math.min(canvasHeight - 150, unit.y));
  }
}
