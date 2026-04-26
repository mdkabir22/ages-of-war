import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, TERRAIN_COLORS } from '../engine/map';
import { useGameStore } from '../engine/state';

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { units, buildings, camera, moveCamera, fog, terrain } = useGameStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = MINIMAP_WIDTH / DEFAULT_MAP_WIDTH;
    const scaleY = MINIMAP_HEIGHT / DEFAULT_MAP_HEIGHT;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    if (terrain.length > 0 && terrain[0].length > 0) {
      const tileW = MINIMAP_WIDTH / terrain[0].length;
      const tileH = MINIMAP_HEIGHT / terrain.length;
      for (const row of terrain) {
        for (const tile of row) {
          ctx.fillStyle = TERRAIN_COLORS[tile.type][0];
          ctx.fillRect(tile.x * tileW, tile.y * tileH, tileW, tileH);
        }
      }
    }

    // Buildings: grey squares
    buildings.forEach((b) => {
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(b.position.x * scaleX, b.position.y * scaleY, 4, 4);
    });

    // Units: red enemy, blue/gold player
    units.forEach((u) => {
      if (u.owner === 'enemy') {
        const tx = Math.floor((u.position.x + 16) / 40);
        const ty = Math.floor((u.position.y + 16) / 40);
        if (tx < 0 || ty < 0 || tx >= fog.width || ty >= fog.height) return;
        if (fog.tiles[ty * fog.width + tx] !== 2) return;
      }
      if (u.owner === 'enemy') {
        ctx.fillStyle = '#ff0000';
      } else {
        ctx.fillStyle = u.type === 'villager' ? '#FFD700' : '#60a5fa';
      }
      ctx.fillRect(u.position.x * scaleX, u.position.y * scaleY, 2, 2);
    });

    // Camera viewport rectangle
    const viewWorldW = window.innerWidth;
    const viewWorldH = window.innerHeight;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      camera.x * scaleX,
      camera.y * scaleY,
      viewWorldW * scaleX,
      viewWorldH * scaleY
    );
  }, [units, buildings, camera, fog, terrain]);

  const handleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const scaleX = MINIMAP_WIDTH / DEFAULT_MAP_WIDTH;
    const scaleY = MINIMAP_HEIGHT / DEFAULT_MAP_HEIGHT;
    const worldX = localX / scaleX - window.innerWidth / 2;
    const worldY = localY / scaleY - window.innerHeight / 2;

    moveCamera(worldX - camera.x, worldY - camera.y);
  };

  return (
    <div className="fixed bottom-4 left-4 z-20 pointer-events-auto bg-black/70 border border-white/30 rounded p-2">
      <canvas
        ref={canvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onClick={handleClick}
        className="block cursor-pointer"
      />
    </div>
  );
}
