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

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const layoutCanvasSize = () => {
      const vv = window.visualViewport;
      // Use visualViewport if available (handles mobile address bar)
      const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
      const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const resize = () => layoutCanvasSize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
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
      const buildType = e.altKey ? 'mine' : e.shiftKey ? 'house' : null;
      if (buildType) {
        state.placeBuilding(gridX, gridY, buildType);
      }
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

        // BUILDINGS — Detailed Architecture
        renderState.buildings.forEach((b) => {
          const size = 42;
          const isSelected = renderState.selectedIds.includes(b.id);
          const cx = b.position.x + size / 2;

          // Selection glow
          if (isSelected) {
            ctx.save();
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 3;
            ctx.strokeRect(b.position.x - 4, b.position.y - 4, size + 8, size + 8);
            ctx.restore();
          }

          // Building base shadow
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(cx, b.position.y + size + 3, size * 0.6, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();

          // Building-specific art
          if (b.type === 'townCenter') {
            // Castle-like base
            ctx.fillStyle = b.owner === 'player' ? '#475569' : '#7f1d1d';
            ctx.fillRect(b.position.x + 4, b.position.y + 12, size - 8, size - 12);
            // Towers
            ctx.fillStyle = b.owner === 'player' ? '#334155' : '#991b1b';
            ctx.fillRect(b.position.x, b.position.y, 10, 20);
            ctx.fillRect(b.position.x + size - 10, b.position.y, 10, 20);
            // Flag
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, b.position.y);
            ctx.lineTo(cx, b.position.y - 14);
            ctx.stroke();
            ctx.fillStyle = b.owner === 'player' ? '#3b82f6' : '#ef4444';
            ctx.beginPath();
            ctx.moveTo(cx, b.position.y - 14);
            ctx.lineTo(cx + 10, b.position.y - 10);
            ctx.lineTo(cx, b.position.y - 6);
            ctx.fill();
          } else if (b.type === 'house') {
            // Hut shape
            ctx.fillStyle = '#d4a373';
            ctx.fillRect(b.position.x + 6, b.position.y + 16, size - 12, size - 16);
            // Roof
            ctx.fillStyle = b.owner === 'player' ? '#3b82f6' : '#ef4444';
            ctx.beginPath();
            ctx.moveTo(b.position.x, b.position.y + 16);
            ctx.lineTo(cx, b.position.y);
            ctx.lineTo(b.position.x + size, b.position.y + 16);
            ctx.closePath();
            ctx.fill();
            // Door
            ctx.fillStyle = '#5c4033';
            ctx.fillRect(cx - 5, b.position.y + 26, 10, 16);
          } else if (b.type === 'farm') {
            // Field with crops
            ctx.fillStyle = '#65a30d';
            ctx.fillRect(b.position.x + 2, b.position.y + 18, size - 4, size - 18);
            // Crops rows
            ctx.fillStyle = '#84cc16';
            for (let i = 0; i < 3; i++) {
              ctx.fillRect(b.position.x + 6, b.position.y + 22 + i * 7, size - 12, 3);
            }
            // Scarecrow / post
            ctx.fillStyle = '#92400e';
            ctx.fillRect(cx - 1, b.position.y + 6, 2, 14);
            ctx.fillStyle = '#fcd34d';
            ctx.beginPath();
            ctx.arc(cx, b.position.y + 6, 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (b.type === 'mine') {
            // Cave/rock entrance
            ctx.fillStyle = '#57534e';
            ctx.fillRect(b.position.x + 2, b.position.y + 10, size - 4, size - 10);
            ctx.fillStyle = '#1c1917';
            ctx.beginPath();
            ctx.arc(cx, b.position.y + 28, 12, 0, Math.PI, false);
            ctx.fill();
            // Gold sparkle
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(cx - 6, b.position.y + 20, 2, 0, Math.PI * 2);
            ctx.arc(cx + 8, b.position.y + 24, 1.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (b.type === 'lumber_camp') {
            // Logs stacked
            ctx.fillStyle = '#92400e';
            ctx.fillRect(b.position.x + 4, b.position.y + 20, size - 8, 6);
            ctx.fillRect(b.position.x + 8, b.position.y + 14, size - 16, 6);
            ctx.fillRect(b.position.x + 6, b.position.y + 26, size - 12, 6);
            // Saw
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(cx - 1, b.position.y + 8, 2, 12);
            ctx.beginPath();
            ctx.moveTo(cx - 6, b.position.y + 8);
            ctx.lineTo(cx + 6, b.position.y + 8);
            ctx.lineTo(cx, b.position.y + 4);
            ctx.fill();
          } else if (b.type === 'mill') {
            // Building
            ctx.fillStyle = '#e7e5e4';
            ctx.fillRect(b.position.x + 10, b.position.y + 18, size - 20, size - 18);
            // Windmill blades
            ctx.save();
            ctx.translate(cx, b.position.y + 14);
            ctx.rotate(performance.now() * 0.002);
            ctx.fillStyle = '#fcd34d';
            for (let i = 0; i < 4; i++) {
              ctx.rotate(Math.PI / 2);
              ctx.fillRect(-2, -12, 4, 12);
            }
            ctx.restore();
            ctx.fillStyle = '#78716c';
            ctx.beginPath();
            ctx.arc(cx, b.position.y + 14, 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (b.type === 'barracks') {
            // Tent/barracks
            ctx.fillStyle = '#7c2d12';
            ctx.beginPath();
            ctx.moveTo(b.position.x, b.position.y + size);
            ctx.lineTo(cx, b.position.y + 4);
            ctx.lineTo(b.position.x + size, b.position.y + size);
            ctx.closePath();
            ctx.fill();
            // Banner
            ctx.fillStyle = b.owner === 'player' ? '#3b82f6' : '#ef4444';
            ctx.fillRect(cx - 3, b.position.y + 12, 6, 14);
          } else {
            // Fallback
            ctx.fillStyle = b.owner === 'player' ? '#1e40af' : '#991b1b';
            ctx.fillRect(b.position.x, b.position.y, size, size);
          }

          // Owner border
          ctx.lineWidth = 2;
          ctx.strokeStyle = b.owner === 'player' ? '#60a5fa' : '#f87171';
          ctx.strokeRect(b.position.x, b.position.y, size, size);

          // HP Bar (styled)
          const hpPct = Math.max(0, Math.min(1, b.hp / Math.max(1, b.maxHp)));
          const barW = size;
          const barH = 5;
          const barY = b.position.y - 10;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(b.position.x, barY, barW, barH);
          ctx.fillStyle = hpPct > 0.6 ? '#22c55e' : hpPct > 0.3 ? '#eab308' : '#ef4444';
          ctx.fillRect(b.position.x + 1, barY + 1, (barW - 2) * hpPct, barH - 2);

          ctx.restore();
        });

        // UNITS — Real Character Art
        renderState.units.forEach((u) => {
          // Fog check for enemies
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
          if (u.target) anim.facingRight = u.target.x >= u.position.x;

          const isSelected = renderState.selectedIds.includes(u.id);
          const cx = u.position.x + 16;
          const cy = u.position.y + 16;
          const facing = anim.facingRight ? 1 : -1;

          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.ellipse(cx, cy + 14, 14, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Selection ring
          if (isSelected) {
            ctx.save();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(cx, cy, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }

          ctx.save();
          ctx.translate(cx, cy);

          // Animation offsets
          const walkBob = anim.currentAnim === 'walk' ? Math.sin(anim.frameIndex * Math.PI) * 2.5 : 0;
          const attackLunge = anim.currentAnim === 'attack' && anim.frameIndex === 1 ? 4 * facing : 0;
          const gatherSwing = anim.currentAnim === 'gather' ? Math.sin(performance.now() * 0.008) * 0.3 : 0;

          ctx.translate(attackLunge, walkBob);

          // Team colors
          const teamPrimary = u.owner === 'player' ? '#2563eb' : '#dc2626';
          const teamLight = u.owner === 'player' ? '#60a5fa' : '#f87171';
          const teamDark = u.owner === 'player' ? '#1e3a8a' : '#991b1b';

          if (u.type === 'villager') {
            // === VILLAGER ===
            // Body (tunic)
            ctx.fillStyle = '#d4a373';
            ctx.fillRect(-7, -4, 14, 14);
            ctx.strokeStyle = teamPrimary;
            ctx.lineWidth = 2;
            ctx.strokeRect(-7, -4, 14, 14);
            // Belt
            ctx.fillStyle = teamPrimary;
            ctx.fillRect(-7, 4, 14, 3);
            // Head
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(0, -10, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#7c2d12';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Hair
            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.arc(0, -12, 7, Math.PI, 0);
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(-2 * facing, -10, 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Tool (axe)
            ctx.save();
            ctx.translate(10 * facing, 2);
            ctx.rotate(gatherSwing + (facing === -1 ? Math.PI : 0));
            ctx.fillStyle = '#92400e';
            ctx.fillRect(-1, -8, 2, 14);
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.moveTo(-1, -8);
            ctx.lineTo(6, -10);
            ctx.lineTo(5, -4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else if (u.type === 'warrior') {
            // === WARRIOR ===
            // Body (armor)
            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.moveTo(-9, -6);
            ctx.lineTo(9, -6);
            ctx.lineTo(7, 12);
            ctx.lineTo(-7, 12);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = teamLight;
            ctx.lineWidth = 2;
            ctx.stroke();
            // Chest plate
            ctx.fillStyle = teamPrimary;
            ctx.fillRect(-4, -2, 8, 8);
            // Head (helmet)
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(0, -12, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Helmet crest
            ctx.fillStyle = teamPrimary;
            ctx.fillRect(-2, -22, 4, 6);
            // Eyes (visor slit)
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-4 * facing, -13, 5 * facing, 2);
            // Shield
            ctx.fillStyle = teamDark;
            ctx.beginPath();
            ctx.moveTo(-12 * facing, 0);
            ctx.lineTo(-6 * facing, -6);
            ctx.lineTo(-6 * facing, 10);
            ctx.lineTo(-12 * facing, 6);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Sword
            ctx.save();
            ctx.translate(10 * facing, 0);
            ctx.rotate(anim.currentAnim === 'attack' && anim.frameIndex === 1 ? -0.8 * facing : -0.2 * facing);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(-1, -14, 2, 18);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(-3, 2, 6, 2);
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(0, -16, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (u.type === 'archer') {
            // === ARCHER ===
            // Body (leather)
            ctx.fillStyle = '#65a30d';
            ctx.fillRect(-6, -4, 12, 14);
            ctx.strokeStyle = teamPrimary;
            ctx.lineWidth = 2;
            ctx.strokeRect(-6, -4, 12, 14);
            // Hood
            ctx.fillStyle = '#3f6212';
            ctx.beginPath();
            ctx.arc(0, -10, 8, 0, Math.PI * 2);
            ctx.fill();
            // Face
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(0, -9, 5, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(2 * facing, -9, 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Bow
            ctx.save();
            ctx.translate(-8 * facing, 0);
            ctx.strokeStyle = '#92400e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 12, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
            // Bowstring
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(anim.currentAnim === 'attack' ? 8 * facing : 0, 0);
            ctx.lineTo(0, 12);
            ctx.stroke();
            ctx.restore();
            // Quiver
            ctx.fillStyle = '#92400e';
            ctx.fillRect(6 * facing, -8, 4, 12);
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(8 * facing, -10, 1.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (u.type === 'spearman') {
            // === SPEARMAN ===
            // Body
            ctx.fillStyle = '#78716c';
            ctx.fillRect(-7, -4, 14, 14);
            ctx.strokeStyle = teamPrimary;
            ctx.lineWidth = 2;
            ctx.strokeRect(-7, -4, 14, 14);
            // Head
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(0, -10, 7, 0, Math.PI * 2);
            ctx.fill();
            // Helmet
            ctx.fillStyle = '#57534e';
            ctx.beginPath();
            ctx.arc(0, -11, 7, Math.PI, 0);
            ctx.fill();
            // Plume
            ctx.fillStyle = teamPrimary;
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(-3, -14);
            ctx.lineTo(3, -14);
            ctx.closePath();
            ctx.fill();
            // Spear (long)
            ctx.save();
            ctx.translate(10 * facing, -4);
            ctx.rotate(anim.currentAnim === 'attack' && anim.frameIndex === 1 ? -0.5 * facing : -0.1 * facing);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(-1, -22, 2, 32);
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.moveTo(-3, -22);
            ctx.lineTo(3, -22);
            ctx.lineTo(0, -30);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            // Shield (round)
            ctx.fillStyle = teamDark;
            ctx.beginPath();
            ctx.arc(-10 * facing, 4, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else if (u.type === 'cavalry') {
            // === CAVALRY (Horse + Rider) ===
            // Horse body
            ctx.fillStyle = '#57534e';
            ctx.fillRect(-14, 0, 28, 12);
            // Horse head
            ctx.beginPath();
            ctx.moveTo(14 * facing, 2);
            ctx.lineTo(22 * facing, -4);
            ctx.lineTo(22 * facing, 6);
            ctx.lineTo(14 * facing, 8);
            ctx.closePath();
            ctx.fill();
            // Horse legs
            ctx.fillStyle = '#44403c';
            ctx.fillRect(-10, 10, 4, 8);
            ctx.fillRect(-2, 10, 4, 8);
            ctx.fillRect(6, 10, 4, 8);
            ctx.fillRect(12, 10, 4, 8);
            // Rider body
            ctx.fillStyle = teamPrimary;
            ctx.fillRect(-6, -12, 12, 12);
            // Rider head
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(0, -18, 6, 0, Math.PI * 2);
            ctx.fill();
            // Helmet
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(0, -19, 6, Math.PI, 0);
            ctx.fill();
            // Sword
            ctx.save();
            ctx.translate(8 * facing, -6);
            ctx.rotate(-0.3 * facing);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(-1, -10, 2, 14);
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(0, -12, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.restore();

          // HP Bar above unit
          const hpPct = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
          const barW = 32;
          const barH = 4;
          const barX = cx - barW / 2;
          const barY = u.position.y - 14;

          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
          ctx.fillStyle = hpPct > 0.6 ? '#22c55e' : hpPct > 0.3 ? '#eab308' : '#ef4444';
          ctx.fillRect(barX, barY, barW * hpPct, barH);

          // Attack flash
          if (anim.currentAnim === 'attack' && anim.frameIndex === 1) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
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
            ctx.fillStyle = tile === 1 ? 'rgba(10, 15, 30, 0.30)' : 'rgba(5, 10, 20, 0.65)';
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
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.clearInterval(economyId);
      stopEnemyAI();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 h-full w-full touch-none"
      style={{ imageRendering: 'auto' }}
    />
  );
}
