import { useGameStore } from '../../core/state';

export function tickWorldFrame(dt: number): void {
  const store = useGameStore.getState();
  store.tickProductionQueues(dt);
  store.tickUnitMovement(dt);
  store.tickCombat();
  store.tickCameraShake(dt);
  store.tickFogOfWar();
}
