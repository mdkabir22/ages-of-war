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

export function setup3DInputHandlers(
  canvas: HTMLCanvasElement,
  pausedRef: MutableRefObject<boolean>,
  cameraRef: { current: any },
  options: { buildingVisualSize: number; tilePlace: number }
): {
  cleanup: () => void;
  getSelectionBox: () => SelectionBox | null;
  getTouchIndicator: () => TouchIndicator | null;
} {
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
    const store = useGameStore.getState();
    if (e.key === 'w' || e.key === 'W') store.moveCamera(0, -step);
    if (e.key === 's' || e.key === 'S') store.moveCamera(0, step);
    if (e.key === 'a' || e.key === 'A') store.moveCamera(-step, 0);
    if (e.key === 'd' || e.key === 'D') store.moveCamera(step, 0);
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
      useGameStore.getState().moveCamera(-dx, -dy);
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
    }
    state.setSelectedIds([]);
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
    const hitUnit = state.units.find((u) => {
      const cx = u.position.x + 16;
      const cy = u.position.y + 16;
      return Math.abs(worldX - cx) <= 14 && Math.abs(worldY - cy) <= 14;
    });
    if (hitUnit) {
      state.selectUnit(hitUnit.id);
      return true;
    }
    return false;
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (pausedRef.current) return;
    const t = e.touches[0];
    if (!t) return;
    isTouchPanning = true;
    touchMoved = false;
    touchLastX = t.clientX;
    touchLastY = t.clientY;
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
    }
    useGameStore.getState().moveCamera(-dx, -dy);
    e.preventDefault();
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (pausedRef.current) return;
    const t = e.changedTouches[0];
    isTouchPanning = false;
    if (!t || touchMoved) return;
    const world = groundPoint(t.clientX, t.clientY, canvas, cameraRef.current);
    if (!world) return;
    const state = useGameStore.getState();
    const handled = handleTapSelection(state, world.x, world.y);
    if (handled) return;
    const now = performance.now();
    const isDoubleTap =
      now - lastTapAtMs <= doubleTapWindowMs &&
      Math.hypot(t.clientX - lastTapX, t.clientY - lastTapY) <= doubleTapDistancePx;
    lastTapAtMs = now;
    lastTapX = t.clientX;
    lastTapY = t.clientY;
    state.commandMoveSelectedUnits(world.x, world.y);
    if (!isDoubleTap && !state.keepSelectionOnTap) {
      state.setSelectedIds([]);
    }
    touchIndicator = { x: t.clientX - canvas.getBoundingClientRect().left, y: t.clientY - canvas.getBoundingClientRect().top, expiresAt: performance.now() + 260 };
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
