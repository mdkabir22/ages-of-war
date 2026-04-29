import type { GameState } from '../../types/game';
import { AGES, GOLD_PER_SECOND } from '../ages';
import { getGoldRatePerSecond } from '../monetization';
import { remoteGameConfig } from '../../lib/remoteConfig';

export function runRuntimeTick(state: GameState, dt: number): void {
  const waveSec = Math.max(20, remoteGameConfig.getBossWaveIntervalSec());
  state.wave = Math.max(1, Math.floor(state.time / waveSec) + 1);
  if (state.wave % 5 === 4 && state.time % waveSec > waveSec - 9) {
    state.surgeWarningUntil = state.time + 2.5;
  }

  const goldRate = getGoldRatePerSecond(state, AGES[state.playerAge].goldBonus, state.time) * state.missionModifiers.playerGoldRateMult;
  const playerCastleRatio = state.playerCastle.health / state.playerCastle.maxHealth;
  const aiCastleRatio = state.aiCastle.health / state.aiCastle.maxHealth;
  const playerRubberBand = playerCastleRatio < aiCastleRatio ? 1 + (aiCastleRatio - playerCastleRatio) * 0.5 : 1;
  state.playerGold += goldRate * dt * playerRubberBand;

  const aiGoldRate = (GOLD_PER_SECOND + AGES[state.aiAge].goldBonus) * state.missionModifiers.aiGoldRateMult;
  const aiRubberBand = aiCastleRatio < playerCastleRatio ? 1 + (playerCastleRatio - aiCastleRatio) * 0.35 : 1;
  state.aiGold += aiGoldRate * dt * aiRubberBand;

  if ((state.lossStreak >= 2 || playerCastleRatio < 0.4) && state.time > 60 && state.time >= state.adaptiveAssistCooldownUntil) {
    state.adaptiveAssistUntil = state.time + 18;
    state.adaptiveAssistCooldownUntil = state.time + 120;
    state.adaptiveAssistActivations += 1;
    state.playerGold += 180;
    state.playerCastle.health = Math.min(state.playerCastle.maxHealth, state.playerCastle.health + state.playerCastle.maxHealth * 0.08);
  }

  if (state.ageUpAnim > 0) {
    state.ageUpAnim -= dt * 0.5;
    if (state.ageUpAnim < 0) state.ageUpAnim = 0;
  }
  if (state.shakeScreen > 0) {
    state.shakeScreen -= dt * 3.9;
    if (state.shakeScreen < 0) state.shakeScreen = 0;
  }
}
