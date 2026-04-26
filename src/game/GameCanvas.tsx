import { useRef, useEffect } from 'react';
import { useGameStore } from '../engine/state';
import { startEnemyAI } from './EnemyAI';
import { TERRAIN_COLORS, TILE_SIZE } from '../engine/map';
import { audio } from '../audio/manager';
import { deriveAnimationState, setAnimation, updateAnimation, type AnimatedUnit } from './systems/animation';

const FOG_TILE_SIZE = 40;

interface GameCanvasProps {
  paused?: boolean;
}

export function GameCanvas({ paused = false }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    void audio.preload();
    const unitAnimations = new Map<string, AnimatedUnit>();

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      const step = 24;
      const store = useGameStore.getState();
      if (e.key === 'w' || e.key === 'W') store.moveCamera(0, -step);
      if (e.key === 's' || e.key === 'S') store.moveCamera(0, step);
      if (e.key === 'a' || e.key === 'A') store.moveCamera(-step, 0);
      if (e.key === 'd' || e.key === 'D') store.moveCamera(step, 0);
    };
    window.addEventListener('keydown', handleKeyDown);

    let isPanning = false;
    let panLastX = 0;
    let panLastY = 0;
    let isSelecting = false;
    let selectionStartX = 0;
    let selectionStartY = 0;
    let selectionCurrentX = 0;
    let selectionCurrentY = 0;
    let selectionMoved = false;

    const toWorldPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const state = useGameStore.getState();
      return {
        x: clientX - rect.left + state.camera.x,
        y: clientY - rect.top + state.camera.y,
      };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (pausedRef.current) return;
      if (e.button === 0) {
        isSelecting = true;
        selectionMoved = false;
        const rect = canvas.getBoundingClientRect();
        selectionStartX = e.clientX - rect.left;
        selectionStartY = e.clientY - rect.top;
        selectionCurrentX = selectionStartX;
        selectionCurrentY = selectionStartY;
        return;
      }
      if (e.button === 1) {
        isPanning = true;
        panLastX = e.clientX;
        panLastY = e.clientY;
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (pausedRef.current) return;
      if (isPanning) {
        const dx = e.clientX - panLastX;
        const dy = e.clientY - panLastY;
        panLastX = e.clientX;
        panLastY = e.clientY;
        useGameStore.getState().moveCamera(-dx, -dy);
      }
      if (isSelecting) {
        const rect = canvas.getBoundingClientRect();
        selectionCurrentX = e.clientX - rect.left;
        selectionCurrentY = e.clientY - rect.top;
        if (
          Math.abs(selectionCurrentX - selectionStartX) > 4 ||
          Math.abs(selectionCurrentY - selectionStartY) > 4
        ) {
          selectionMoved = true;
        }
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (pausedRef.current) return;
      if (e.button === 1) {
        isPanning = false;
      }
      if (e.button !== 0 || !isSelecting) return;
      isSelecting = false;

      if (selectionMoved) {
        const startWorld = toWorldPos(
          selectionStartX + canvas.getBoundingClientRect().left,
          selectionStartY + canvas.getBoundingClientRect().top
        );
        const endWorld = toWorldPos(
          selectionCurrentX + canvas.getBoundingClientRect().left,
          selectionCurrentY + canvas.getBoundingClientRect().top
        );
        const minX = Math.min(startWorld.x, endWorld.x);
        const maxX = Math.max(startWorld.x, endWorld.x);
        const minY = Math.min(startWorld.y, endWorld.y);
        const maxY = Math.max(startWorld.y, endWorld.y);

        const state = useGameStore.getState();
        const selectedUnitIds = state.units
          .filter((u) => {
            const ux = u.position.x + 16;
            const uy = u.position.y + 16;
            return ux >= minX && ux <= maxX && uy >= minY && uy <= maxY;
          })
          .map((u) => u.id);
        state.setSelectedIds(selectedUnitIds);
        return;
      }

      const world = toWorldPos(e.clientX, e.clientY);
      const state = useGameStore.getState();
      const hitBuilding = state.buildings.find(
        (b) =>
          world.x >= b.position.x &&
          world.x <= b.position.x + 32 &&
          world.y >= b.position.y &&
          world.y <= b.position.y + 32
      );
      if (hitBuilding) {
        state.selectUnit(hitBuilding.id);
        return;
      }
      const hitUnit = state.units.find((u) => {
        const cx = u.position.x + 16;
        const cy = u.position.y + 16;
        return Math.abs(world.x - cx) <= 12 && Math.abs(world.y - cy) <= 12;
      });
      if (hitUnit) {
        state.selectUnit(hitUnit.id);
        return;
      }

      const gridX = Math.floor(world.x / 40) * 40;
      const gridY = Math.floor(world.y / 40) * 40;
      const buildType = e.altKey ? 'mine' : e.shiftKey ? 'house' : 'farm';
      state.placeBuilding(gridX, gridY, buildType);
      state.setSelectedIds([]);
    };
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (pausedRef.current) return;
      const world = toWorldPos(e.clientX, e.clientY);
      const state = useGameStore.getState();
      const selectedBuildingId = state.selectedIds.find((id) =>
        state.buildings.some((b) => b.id === id && b.owner === 'player')
      );
      if (selectedBuildingId) {
        state.setRallyPoint(selectedBuildingId, { x: world.x, y: world.y });
        return;
      }
      state.commandMoveSelectedUnits(world.x, world.y);
    };
    canvas.addEventListener('contextmenu', handleContextMenu);

    const economyId = window.setInterval(() => {
      const state = useGameStore.getState();
      state.tickEconomy();
      state.tickMissionTime(1);
    }, 1000);
    const stopEnemyAI = startEnemyAI(
      () => useGameStore.getState(),
      (updater) => useGameStore.setState((prev) => updater(prev))
    );

    let animId: number;
    let prevTime = performance.now();
    const loop = () => {
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
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-camera.x + shake.x, -camera.y + shake.y);

      // Terrain (viewport culled)
      const terrain = renderState.terrain;
      const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE));
      const endCol = terrain[0] ? Math.min(terrain[0].length, startCol + Math.ceil(canvas.width / TILE_SIZE) + 2) : 0;
      const startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE));
      const endRow = Math.min(terrain.length, startRow + Math.ceil(canvas.height / TILE_SIZE) + 2);
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
            ctx.fillStyle = '#1a3d16';
            ctx.beginPath();
            ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (tile.type === 'hill') {
            ctx.fillStyle = 'rgba(0,0,0,0.10)';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE / 4);
          }

          ctx.strokeStyle = 'rgba(0,0,0,0.05)';
          ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
      }

      // Buildings
      renderState.buildings.forEach((b) => {
        ctx.fillStyle = b.owner === 'player' ? '#8B0000' : '#71797E';
        ctx.fillRect(b.position.x, b.position.y, 32, 32);
        const hpPct = Math.max(0, Math.min(1, b.hp / Math.max(1, b.maxHp)));
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(b.position.x, b.position.y - 8, 32, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(b.position.x, b.position.y - 8, 32 * hpPct, 4);
      });

      // Units
      renderState.units.forEach((u) => {
        if (u.owner === 'enemy') {
          const tx = Math.floor((u.position.x + 16) / FOG_TILE_SIZE);
          const ty = Math.floor((u.position.y + 16) / FOG_TILE_SIZE);
          const { width, height, tiles } = renderState.fog;
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) return;
          if (tiles[ty * width + tx] !== 2) return;
        }
        let anim = unitAnimations.get(u.id);
        if (!anim) {
          anim = { currentAnim: 'idle', frameIndex: 0, frameTimer: 0, facingRight: true };
          unitAnimations.set(u.id, anim);
        }
        const desiredState = deriveAnimationState(u);
        setAnimation(anim, desiredState);
        updateAnimation(anim, dt);
        if (u.target) {
          anim.facingRight = u.target.x >= u.position.x;
        }

        ctx.save();
        ctx.translate(u.position.x + 16, u.position.y + 16);
        if (!anim.facingRight) ctx.scale(-1, 1);
        const bobY = anim.currentAnim === 'walk' ? Math.sin(anim.frameIndex * Math.PI) * 2 : 0;
        const lungeX = anim.currentAnim === 'attack' ? (anim.frameIndex === 1 ? 6 : 0) : 0;
        ctx.translate(lungeX, bobY);
        ctx.fillStyle = u.owner === 'player' ? '#FFD700' : '#C2410C';
        ctx.fillRect(-8, -8, 16, 16);
        if (anim.currentAnim === 'attack' && anim.frameIndex === 1) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 18, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
        }
        ctx.restore();
        const hpPct = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(u.position.x + 6, u.position.y - 6, 20, 3);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(u.position.x + 6, u.position.y - 6, 20 * hpPct, 3);
      });
      const activeIds = new Set(renderState.units.map((u) => u.id));
      for (const key of unitAnimations.keys()) {
        if (!activeIds.has(key)) unitAnimations.delete(key);
      }

      // Fog overlay
      for (let ty = 0; ty < renderState.fog.height; ty++) {
        for (let tx = 0; tx < renderState.fog.width; tx++) {
          const tile = renderState.fog.tiles[ty * renderState.fog.width + tx];
          if (tile === 2) continue;
          ctx.fillStyle = tile === 1 ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.92)';
          ctx.fillRect(tx * FOG_TILE_SIZE, ty * FOG_TILE_SIZE, FOG_TILE_SIZE, FOG_TILE_SIZE);
        }
      }
      ctx.restore();

      if (isSelecting) {
        const left = Math.min(selectionStartX, selectionCurrentX);
        const top = Math.min(selectionStartY, selectionCurrentY);
        const width = Math.abs(selectionCurrentX - selectionStartX);
        const height = Math.abs(selectionCurrentY - selectionStartY);
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(left, top, width, height);
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', resize);
      window.clearInterval(economyId);
      stopEnemyAI();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
