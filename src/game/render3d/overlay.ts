import * as THREE from 'three';
import { drawFogOverlay } from './fogOverlay';

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function render3DOverlay(
  overlayCtx: CanvasRenderingContext2D,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  fog: { width: number; height: number; tiles: Uint8Array },
  cam2: { x: number; y: number },
  selectionBox: SelectionBox | null
): void {
  overlayCtx.clearRect(0, 0, width, height);
  drawFogOverlay(overlayCtx, camera, width, height, fog, cam2, width, height);
  if (!selectionBox) return;

  const left = Math.min(selectionBox.startX, selectionBox.currentX);
  const top = Math.min(selectionBox.startY, selectionBox.currentY);
  const rw = Math.abs(selectionBox.currentX - selectionBox.startX);
  const rh = Math.abs(selectionBox.currentY - selectionBox.startY);
  overlayCtx.save();
  overlayCtx.setLineDash([6, 4]);
  overlayCtx.strokeStyle = 'rgba(245, 158, 11, 0.95)';
  overlayCtx.lineWidth = 1.5;
  overlayCtx.strokeRect(left, top, rw, rh);
  overlayCtx.restore();
}
