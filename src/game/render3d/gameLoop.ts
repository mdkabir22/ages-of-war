import { useGameStore } from '../../core/state';
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from '../../core/map';
import { updateCameraRig } from './cameraRig';
import { draw3DTouchIndicator, render3DOverlay } from './overlay';
import { tickWorldFrame } from './worldTick';

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
  overlayCtx: CanvasRenderingContext2D | null;
  getSelectionBox: () => SelectionBox | null;
  getTouchIndicator: () => TouchIndicator | null;
}

export function start3DGameLoop(options: Start3DGameLoopOptions): () => void {
  let animId = 0;
  let prevTime = performance.now();

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
      const cam2 = renderState.camera;
      const shake = renderState.cameraShake.offset;
      const w = options.renderer.domElement.width;
      const h = options.renderer.domElement.height;
      // Anchor the 3D camera around the WORLD center (in world units),
      // not around screen-pixel center. cam2 is treated as a pan offset.
      const cx = DEFAULT_MAP_WIDTH / 2 + cam2.x + shake.x;
      const cz = DEFAULT_MAP_HEIGHT / 2 + cam2.y + shake.y;

      updateCameraRig(options.camera, options.cameraRigState, cx, cz, dt);
      options.cameraRef.current = options.camera;

      if (options.waterMesh) {
        options.waterMesh.position.y = -0.68 + Math.sin(now / 680) * 0.055;
      }

      options.syncMeshes();
      options.renderer.render(options.scene, options.camera);

      if (options.overlayCtx) {
        render3DOverlay(
          options.overlayCtx,
          options.camera,
          w,
          h,
          renderState.fog,
          renderState.camera,
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
