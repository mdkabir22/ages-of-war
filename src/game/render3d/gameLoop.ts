import { useGameStore } from '../../core/state';
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from '../../core/map';
import { updateCameraRig } from './cameraRig';
import { spawnAgeUpFlash, spawnHitPuff, tickEffects, type EffectsState } from './effects3D';
import { draw3DTouchIndicator, render3DOverlay } from './overlay';
import type { PostProcessingState } from './postprocessing';
import { tickWorldFrame } from './worldTick';

/**
 * 3D-only pan offset. Independent of `state.camera` (which keeps 2D-renderer
 * semantics) so panning in 3D doesn't fight with the 2D top-left scroll
 * clamping. Mutated by inputHandlers via `panOffsetRef`.
 */
export interface PanOffsetRef {
  current: { x: number; y: number };
}

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

interface Start3DGameLoopOptions {
  layoutSize: () => void;
  pausedRef: { current: boolean };
  scene: any;
  renderer: any;
  camera: any;
  cameraRef: { current: any };
  cameraRigState: {
    camPosSmoothed: any;
    lookSmoothed: any;
    desiredCam: any;
    desiredLook: any;
    cameraSmoothedReady: boolean;
  };
  waterMesh: any | null;
  syncMeshes: () => void;
  effects: EffectsState;
  postFx: PostProcessingState | null;
  overlayCtx: CanvasRenderingContext2D | null;
  getSelectionBox: () => SelectionBox | null;
  getTouchIndicator: () => TouchIndicator | null;
  panOffsetRef: PanOffsetRef;
}

export function start3DGameLoop(options: Start3DGameLoopOptions): () => void {
  let animId = 0;
  let prevTime = performance.now();
  let prevAge: string | null = null;

  const loop = () => {
    try {
      options.layoutSize();
      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;
      if (!options.pausedRef.current) {
        tickWorldFrame(dt);
      }

      const renderState = useGameStore.getState();
      // Detect age advancement and trigger a celebratory flash effect.
      if (prevAge !== null && prevAge !== renderState.currentAge) {
        spawnAgeUpFlash(options.effects, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
      }
      prevAge = renderState.currentAge;
      const shake = renderState.cameraShake.offset;
      const w = options.renderer.domElement.width;
      const h = options.renderer.domElement.height;
      // Anchor the 3D camera on the player's town center (so the player
      // always sees their base on spawn), then apply the user pan offset
      // and any active screen-shake. Falls back to the map center if the
      // player has no town center (shouldn't happen at game start).
      const playerTC = renderState.buildings.find(
        (b) => b.owner === 'player' && b.type === 'townCenter'
      );
      const anchorX = playerTC ? playerTC.position.x + 32 : DEFAULT_MAP_WIDTH / 2;
      const anchorZ = playerTC ? playerTC.position.y + 32 : DEFAULT_MAP_HEIGHT / 2;
      // Clamp pan so the look-target stays inside the playable map bounds
      // (with a small margin so the camera can't fly off the world).
      const margin = 80;
      const minPanX = margin - anchorX;
      const maxPanX = DEFAULT_MAP_WIDTH - margin - anchorX;
      const minPanY = margin - anchorZ;
      const maxPanY = DEFAULT_MAP_HEIGHT - margin - anchorZ;
      const panOffset = options.panOffsetRef.current;
      panOffset.x = Math.max(minPanX, Math.min(panOffset.x, maxPanX));
      panOffset.y = Math.max(minPanY, Math.min(panOffset.y, maxPanY));
      const cx = anchorX + panOffset.x + shake.x;
      const cz = anchorZ + panOffset.y + shake.y;

      updateCameraRig(options.camera, options.cameraRigState, cx, cz, dt);
      options.cameraRef.current = options.camera;

      if (options.waterMesh) {
        options.waterMesh.position.y = -0.68 + Math.sin(now / 680) * 0.055;
      }

      options.syncMeshes();
      tickEffects(options.effects, now, (color, x, y, z) => {
        spawnHitPuff(options.effects, x, y, z, color);
      });
      // Render via the post-processing composer when available; otherwise
      // fall back to direct renderer (e.g. on devices where shaders failed).
      if (options.postFx && options.postFx.enabled) {
        options.postFx.render();
      } else {
        options.renderer.render(options.scene, options.camera);
      }

      if (options.overlayCtx) {
        // Approximate fog-cull viewport from the actual 3D look target.
        const fogCam2 = { x: cx - w / 2, y: cz - h / 2 };
        render3DOverlay(
          options.overlayCtx,
          options.camera,
          w,
          h,
          renderState.fog,
          fogCam2,
          options.getSelectionBox()
        );
        const touchIndicator = options.getTouchIndicator();
        if (touchIndicator) {
          const lifeMs = 260;
          const progress = 1 - Math.max(0, touchIndicator.expiresAt - performance.now()) / lifeMs;
          draw3DTouchIndicator(options.overlayCtx, touchIndicator.x, touchIndicator.y, progress);
        }
      }
    } catch (err) {
      console.error('[GameCanvas3D] loop error', err);
    }

    animId = requestAnimationFrame(loop);
  };

  loop();
  return () => cancelAnimationFrame(animId);
}
