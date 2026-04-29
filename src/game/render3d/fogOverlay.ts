import * as THREE from 'three';

const FOG_TILE_SIZE = 40;
const proj = new THREE.Vector3();

export function drawFogOverlay(
  ctx: CanvasRenderingContext2D,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  fog: { width: number; height: number; tiles: Uint8Array },
  cam2: { x: number; y: number },
  canvasW: number,
  canvasH: number
): void {
  const margin = 120;
  const minWX = cam2.x - margin;
  const maxWX = cam2.x + canvasW + margin;
  const minWZ = cam2.y - margin;
  const maxWZ = cam2.y + canvasH + margin;
  const { width: fw, height: fh, tiles } = fog;

  for (let j = 0; j < fh; j++) {
    for (let i = 0; i < fw; i++) {
      const t = tiles[j * fw + i];
      if (t === 2) continue;

      const wx0 = i * FOG_TILE_SIZE;
      const wz0 = j * FOG_TILE_SIZE;
      if (
        wx0 + FOG_TILE_SIZE < minWX ||
        wx0 > maxWX ||
        wz0 + FOG_TILE_SIZE < minWZ ||
        wz0 > maxWZ
      ) {
        continue;
      }

      const corners: [number, number][] = [
        [wx0, wz0],
        [wx0 + FOG_TILE_SIZE, wz0],
        [wx0 + FOG_TILE_SIZE, wz0 + FOG_TILE_SIZE],
        [wx0, wz0 + FOG_TILE_SIZE],
      ];
      let minSX = Infinity;
      let maxSX = -Infinity;
      let minSY = Infinity;
      let maxSY = -Infinity;
      for (const [wx, wz] of corners) {
        proj.set(wx, 0, wz);
        proj.project(camera);
        const sx = (proj.x * 0.5 + 0.5) * width;
        const sy = (-proj.y * 0.5 + 0.5) * height;
        minSX = Math.min(minSX, sx);
        maxSX = Math.max(maxSX, sx);
        minSY = Math.min(minSY, sy);
        maxSY = Math.max(maxSY, sy);
      }

      ctx.fillStyle = t === 1 ? 'rgba(10, 15, 30, 0.32)' : 'rgba(5, 10, 20, 0.62)';
      ctx.fillRect(minSX, minSY, Math.max(1, maxSX - minSX), Math.max(1, maxSY - minSY));
    }
  }
}
