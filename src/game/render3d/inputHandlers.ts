import type { MutableRefObject } from 'react';
import { useGameStore } from '../../core/state';
import { groundPoint, groundRectBounds } from './spatial';

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

interface PanOffsetRef {
  current: { x: number; y: number };
}

export function setup3DInputHandlers(
  canvas: HTMLCanvasElement,
  pausedRef: MutableRefObject<boolean>,
  cameraRef: { current: any },
  options: { buildingVisualSize: number; tilePlace: number },
  panOffsetRef: PanOffsetRef
): {
  cleanup: () => void;
  getSelectionBox: () => SelectionBox | null;
  getTouchIndicator: () => TouchIndicator | null;
} {
  // 3D pan moves the camera-anchor offset directly. Sensitivity is scaled
  // by the user's pan-sensitivity preference so existing settings still apply.
  const panBy = (dx: number, dy: number): void => {
    const pan = useGameStore.getState().cameraPanSensitivity ?? 1;
    panOffsetRef.current.x += dx * pan;
    panOffsetRef.current.y += dy * pan;
  };
  let isPanning = false;
  let panLastX = 0;
  let panLastY = 0;
  let isSelecting = false;
  let selectionStartX = 0;
  let selectionStartY = 0;
  let selectionCurrentX = 0;
  let selectionCurrentY = 0;
  let selectionMoved = false;
  let isTouchPanning = false;
  let touchLastX = 0;
  let touchLastY = 0;
  let touchMoved = false;
  const touchMoveThreshold = 8;
  let lastTapAtMs = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  const doubleTapWindowMs = 280;
  const doubleTapDistancePx = 28;
  let touchIndicator: TouchIndicator | null = null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (pausedRef.current) return;
    const step = 24;
    if (e.key === 'w' || e.key === 'W') panBy(0, -step);
    if (e.key === 's' || e.key === 'S') panBy(0, step);
    if (e.key === 'a' || e.key === 'A') panBy(-step, 0);
    if (e.key === 'd' || e.key === 'D') panBy(step, 0);
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (pausedRef.current) return;
    const rect = canvas.getBoundingClientRect();
    if (e.button === 0) {
      isSelecting = true;
      selectionMoved = false;
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
    const rect = canvas.getBoundingClientRect();
    if (isPanning) {
      const dx = e.clientX - panLastX;
      const dy = e.clientY - panLastY;
      panLastX = e.clientX;
      panLastY = e.clientY;
      panBy(-dx, -dy);
    }
    if (isSelecting) {
      selectionCurrentX = e.clientX - rect.left;
      selectionCurrentY = e.clientY - rect.top;
      if (Math.abs(selectionCurrentX - selectionStartX) > 4 || Math.abs(selectionCurrentY - selectionStartY) > 4) {
        selectionMoved = true;
      }
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (pausedRef.current) return;
    if (e.button === 1) isPanning = false;
    if (e.button !== 0 || !isSelecting) return;
    isSelecting = false;

    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;

    if (selectionMoved) {
      const corners: [number, number][] = [
        [rect.left + selectionStartX, rect.top + selectionStartY],
        [rect.left + selectionCurrentX, rect.top + selectionStartY],
        [rect.left + selectionCurrentX, rect.top + selectionCurrentY],
        [rect.left + selectionStartX, rect.top + selectionCurrentY],
      ];
      const bounds = groundRectBounds(corners, canvas, cam);
      if (bounds) {
        const state = useGameStore.getState();
        const selectedUnitIds = state.units
          .filter((u) => {
            const ux = u.position.x + 16;
            const uy = u.position.y + 16;
            return ux >= bounds.minX && ux <= bounds.maxX && uy >= bounds.minY && uy <= bounds.maxY;
          })
          .map((u) => u.id);
        state.setSelectedIds(selectedUnitIds);
      }
      return;
    }

    const world = groundPoint(e.clientX, e.clientY, canvas, cam);
    if (!world) return;

    const state = useGameStore.getState();
    const handled = handleTapSelection(state, world.x, world.y);
    if (handled) return;

    const gridX = Math.floor(world.x / options.tilePlace) * options.tilePlace;
    const gridY = Math.floor(world.y / options.tilePlace) * options.tilePlace;
    const buildType = e.altKey ? 'mine' : e.shiftKey ? 'house' : null;
    if (buildType) {
      state.placeBuilding(gridX, gridY, buildType);
      return;
    }
    // Left-click on empty ground with selected player units => issue a
    // move order and KEEP selection (mirrors right-click for touch parity).
    const hasOwnedSelection = state.selectedIds.some((id) =>
      state.units.some((u) => u.id === id && u.owner === 'player')
    );
    if (hasOwnedSelection) {
      state.commandMoveSelectedUnits(world.x, world.y);
    } else {
      state.setSelectedIds([]);
    }
  };

  const handleTapSelection = (state: ReturnType<typeof useGameStore.getState>, worldX: number, worldY: number): boolean => {
    const hitBuilding = state.buildings.find(
      (b) =>
        worldX >= b.position.x &&
        worldX <= b.position.x + options.buildingVisualSize &&
        worldY >= b.position.y &&
        worldY <= b.position.y + options.buildingVisualSize
    );
    if (hitBuilding) {
      state.selectUnit(hitBuilding.id);
      return true;
    }
    // Larger tap target on units: they look small on phones with the wide
    // cinematic camera, so a generous radius makes single-finger selection
    // reliable. Player units take priority over enemies when they overlap.
    const TAP_RADIUS = 26;
    const candidates = state.units.filter((u) => {
      const cx = u.position.x + 16;
      const cy = u.position.y + 16;
      return Math.abs(worldX - cx) <= TAP_RADIUS && Math.abs(worldY - cy) <= TAP_RADIUS;
    });
    if (candidates.length === 0) return false;
    const ownedFirst = candidates.find((u) => u.owner === 'player') ?? candidates[0];
    state.selectUnit(ownedFirst.id);
    return true;
  };

  // Long-press timer & state. A held tap (no significant movement, ~520ms)
  // acts as the "deselect everything" gesture on mobile, since tap-to-move
  // now keeps selection sticky for chained orders.
  const longPressMs = 520;
  let longPressTimer: number | null = null;
  let longPressFired = false;
  const clearLongPress = () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (pausedRef.current) return;
    const t = e.touches[0];
    if (!t) return;
    isTouchPanning = true;
    touchMoved = false;
    touchLastX = t.clientX;
    touchLastY = t.clientY;
    longPressFired = false;
    clearLongPress();
    longPressTimer = window.setTimeout(() => {
      // Fire long-press only if the finger hasn't drifted (i.e. wasn't a pan).
      if (touchMoved) return;
      longPressFired = true;
      useGameStore.getState().setSelectedIds([]);
      touchIndicator = {
        x: touchLastX - canvas.getBoundingClientRect().left,
        y: touchLastY - canvas.getBoundingClientRect().top,
        expiresAt: performance.now() + 320,
      };
    }, longPressMs);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (pausedRef.current || !isTouchPanning) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - touchLastX;
    const dy = t.clientY - touchLastY;
    touchLastX = t.clientX;
    touchLastY = t.clientY;
    if (Math.abs(dx) > touchMoveThreshold || Math.abs(dy) > touchMoveThreshold) {
      touchMoved = true;
      clearLongPress();
    }
    panBy(-dx, -dy);
    e.preventDefault();
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (pausedRef.current) return;
    const t = e.changedTouches[0];
    isTouchPanning = false;
    clearLongPress();
    if (!t || touchMoved || longPressFired) return;
    const world = groundPoint(t.clientX, t.clientY, canvas, cameraRef.current);
    if (!world) return;
    const state = useGameStore.getState();
    // Tap on a unit/building => select (replaces previous selection).
    const handled = handleTapSelection(state, world.x, world.y);
    if (handled) {
      lastTapAtMs = performance.now();
      lastTapX = t.clientX;
      lastTapY = t.clientY;
      return;
    }
    const now = performance.now();
    const isDoubleTap =
      now - lastTapAtMs <= doubleTapWindowMs &&
      Math.hypot(t.clientX - lastTapX, t.clientY - lastTapY) <= doubleTapDistancePx;
    lastTapAtMs = now;
    lastTapX = t.clientX;
    lastTapY = t.clientY;
    // Tap on empty ground:
    //   - With selected player units => issue a move order and KEEP selection
    //     so the player can chain follow-up orders without re-tapping the unit.
    //   - With nothing usefully selected => no-op (avoids accidental deselect).
    //   - Double-tap empty ground always deselects (explicit clear gesture).
    const hasOwnedSelection = state.selectedIds.some((id) =>
      state.units.some((u) => u.id === id && u.owner === 'player')
    );
    if (hasOwnedSelection) {
      state.commandMoveSelectedUnits(world.x, world.y);
    }
    if (isDoubleTap) {
      state.setSelectedIds([]);
    }
    touchIndicator = {
      x: t.clientX - canvas.getBoundingClientRect().left,
      y: t.clientY - canvas.getBoundingClientRect().top,
      expiresAt: performance.now() + 260,
    };
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (pausedRef.current) return;
    const world = groundPoint(e.clientX, e.clientY, canvas, cameraRef.current);
    if (!world) return;
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

  window.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('contextmenu', handleContextMenu);
  canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

  return {
    cleanup: () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    },
    getSelectionBox: () =>
      isSelecting
        ? {
            startX: selectionStartX,
            startY: selectionStartY,
            currentX: selectionCurrentX,
            currentY: selectionCurrentY,
          }
        : null,
    getTouchIndicator: () => {
      if (!touchIndicator) return null;
      if (performance.now() > touchIndicator.expiresAt) {
        touchIndicator = null;
        return null;
      }
      return touchIndicator;
    },
  };
}
