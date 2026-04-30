import type { GameState } from '../../types/game';

export interface CombatRuntimeContext {
  aiRetreatThreshold: number;
  aiStabilizeMode: boolean;
  stanceMoveMult: number;
  stanceDamageMult: number;
  stanceRangeBonus: number;
  laneFocusY: number | null;
}

export function deriveCombatRuntimeContext(
  state: GameState,
  canvasHeight: number,
  lanes: number[]
): CombatRuntimeContext {
  const aiRetreatThreshold = state.aiDirector.microRetreatThreshold;
  const aiStabilizeMode = state.aiDirector.macroPlan === 'stabilize';
  const stanceMoveMult = state.playerBattleStance === 'aggressive' ? 1.1 : state.playerBattleStance === 'defensive' ? 0.9 : 1;
  const stanceDamageMult = state.playerBattleStance === 'aggressive' ? 1.1 : state.playerBattleStance === 'defensive' ? 0.94 : 1;
  const stanceRangeBonus = state.playerBattleStance === 'defensive' ? 14 : state.playerBattleStance === 'aggressive' ? -3 : 0;
  const laneFocusIndex = state.playerLaneFocus === 'left' ? 0 : state.playerLaneFocus === 'center' ? 1 : state.playerLaneFocus === 'right' ? 2 : -1;
  const laneFocusY = laneFocusIndex >= 0 ? lanes[laneFocusIndex] * canvasHeight : null;

  return {
    aiRetreatThreshold,
    aiStabilizeMode,
    stanceMoveMult,
    stanceDamageMult,
    stanceRangeBonus,
    laneFocusY,
  };
}
