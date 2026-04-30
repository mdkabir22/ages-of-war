import type { MutableRefObject } from 'react';
import { useGameStore } from '../../core/state';
import type { AnimatedUnit } from '../systems/animation';
import { drawBuildingsLayer } from './buildingsLayer';
import { drawFogLayer, drawSelectionBox, drawTerrainLayer, drawTouchIndicator } from './canvasLayers';
import { drawUnitsLayer } from './unitsLayer';

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface TouchIndicator {
  x: number;
  y: number;
  expiresAt: number;
}

export function startGameCanvasLoop(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  pausedRef: MutableRefObject<boolean>,
  unitAnimations: Map<string, AnimatedUnit>,
  getSelectionBox: () => SelectionBox | null,
  getTouchIndicator: () => TouchIndicator | null,
  layoutCanvasSize: () => void
): () => void {
  let animId = 0;
  let prevTime = performance.now();

  const loop = () => {
    try {
      layoutCanvasSize();
      const state = useGameStore.getState();
      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;
      if (!pausedRef.current) {
        state.tickProductionQueues(dt);
        state.tickUnitMovement(dt);
        state.tickCombat();
        state.tickCameraShake(dt);
        state.tickFogOfWar();
      }
      const renderState = useGameStore.getState();
      const camera = renderState.camera;
      const shake = renderState.cameraShake.offset;
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-camera.x + shake.x, -camera.y + shake.y);

      drawTerrainLayer(ctx, renderState.terrain, camera, { width: canvas.width, height: canvas.height });
      drawBuildingsLayer(ctx, renderState.buildings, renderState.selectedIds);
      drawUnitsLayer(ctx, renderState, unitAnimations, dt);
      drawFogLayer(ctx, renderState.fog);
      ctx.restore();

      const selectionBox = getSelectionBox();
      if (selectionBox) {
        drawSelectionBox(
          ctx,
          selectionBox.startX,
          selectionBox.startY,
          selectionBox.currentX,
          selectionBox.currentY
        );
      }
      const touchIndicator = getTouchIndicator();
      if (touchIndicator) {
        const lifeMs = 260;
        const progress = 1 - Math.max(0, touchIndicator.expiresAt - performance.now()) / lifeMs;
        drawTouchIndicator(ctx, touchIndicator.x, touchIndicator.y, progress);
      }
    } catch (err) {
      console.error('[GameCanvas] render loop error', err);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fecaca';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const msg = err instanceof Error ? err.message : String(err);
      ctx.fillText('Render error (mobile):', 12, 16);
      ctx.fillText(msg.slice(0, 200), 12, 40);
    }

    animId = requestAnimationFrame(loop);
  };

  loop();

  return () => cancelAnimationFrame(animId);
}
