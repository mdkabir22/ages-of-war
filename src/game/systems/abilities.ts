import type { GameState } from '../../types/game';

export function canActivateRally(state: GameState): boolean {
  return state.time >= state.rallyCooldownUntil;
}

export function activateRally(state: GameState): boolean {
  if (!canActivateRally(state)) return false;
  state.rallyUntil = state.time + 10;
  state.rallyCooldownUntil = state.time + 45;
  return true;
}

export function canActivateFortify(state: GameState): boolean {
  return state.time >= state.fortifyCooldownUntil;
}

export function activateFortify(state: GameState): boolean {
  if (!canActivateFortify(state)) return false;
  state.fortifyCooldownUntil = state.time + 55;
  const heal = state.playerCastle.maxHealth * 0.12;
  state.playerCastle.health = Math.min(state.playerCastle.maxHealth, state.playerCastle.health + heal);
  state.playerGold += 120;
  return true;
}
