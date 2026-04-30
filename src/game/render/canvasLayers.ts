import { TERRAIN_COLORS, TILE_SIZE, type TerrainTile } from '../../core/map';

const FOG_TILE_SIZE = 40;

export function drawTerrainLayer(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainTile[][],
  camera: { x: number; y: number },
  viewport: { width: number; height: number }
): void {
  const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE));
  const endCol = terrain[0] ? Math.min(terrain[0].length, startCol + Math.ceil(viewport.width / TILE_SIZE) + 2) : 0;
  const startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE));
  const endRow = Math.min(terrain.length, startRow + Math.ceil(viewport.height / TILE_SIZE) + 2);
  for (let ty = startRow; ty < endRow; ty++) {
    for (let tx = startCol; tx < endCol; tx++) {
      const tile = terrain[ty]?.[tx];
      if (!tile) continue;
      const screenX = tile.x * TILE_SIZE;
      const screenY = tile.y * TILE_SIZE;
      const colors = TERRAIN_COLORS[tile.type];
      ctx.fillStyle = colors[tile.variant] ?? colors[0];
      ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

      if (tile.type === 'forest') {
        ctx.fillStyle = 'rgba(22, 101, 52, 0.55)';
        ctx.beginPath();
        ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2 - 3, TILE_SIZE / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,53,15,0.75)';
        ctx.fillRect(screenX + TILE_SIZE / 2 - 2, screenY + TILE_SIZE / 2 + 8, 4, 8);
        ctx.fillStyle = '#dcfce7';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('W', screenX + TILE_SIZE / 2, screenY + 9);
      } else if (tile.type === 'hill') {
        ctx.fillStyle = 'rgba(120, 113, 108, 0.35)';
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE / 4);
        ctx.fillStyle = 'rgba(231,229,228,0.6)';
        ctx.beginPath();
        ctx.moveTo(screenX + TILE_SIZE / 2, screenY + 8);
        ctx.lineTo(screenX + 10, screenY + TILE_SIZE - 8);
        ctx.lineTo(screenX + TILE_SIZE - 10, screenY + TILE_SIZE - 8);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#fafaf9';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', screenX + TILE_SIZE / 2, screenY + 9);
      } else if (tile.type === 'water') {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX + 6, screenY + TILE_SIZE / 2 - 3);
        ctx.quadraticCurveTo(screenX + 12, screenY + TILE_SIZE / 2 - 8, screenX + 18, screenY + TILE_SIZE / 2 - 3);
        ctx.quadraticCurveTo(screenX + 24, screenY + TILE_SIZE / 2 + 2, screenX + 30, screenY + TILE_SIZE / 2 - 3);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
    }
  }
}

export function drawFogLayer(
  ctx: CanvasRenderingContext2D,
  fog: { width: number; height: number; tiles: Uint8Array }
): void {
  for (let ty = 0; ty < fog.height; ty++) {
    for (let tx = 0; tx < fog.width; tx++) {
      const tile = fog.tiles[ty * fog.width + tx];
      if (tile === 2) continue;
      ctx.fillStyle = tile === 1 ? 'rgba(10, 15, 30, 0.30)' : 'rgba(5, 10, 20, 0.65)';
      ctx.fillRect(tx * FOG_TILE_SIZE, ty * FOG_TILE_SIZE, FOG_TILE_SIZE, FOG_TILE_SIZE);
    }
  }
}

export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): void {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left, top, width, height);
  ctx.restore();
}

export function drawTouchIndicator(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number): void {
  const t = Math.max(0, Math.min(1, progress));
  const radius = 10 + t * 18;
  const alpha = 0.55 * (1 - t);
  ctx.save();
  ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
