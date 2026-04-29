import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../core/state';
import { groundPoint, groundRectBounds } from './spatial';

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function setup3DInputHandlers(
  canvas: HTMLCanvasElement,
  pausedRef: MutableRefObject<boolean>,
  cameraRef: { current: THREE.PerspectiveCamera },
  options: { buildingVisualSize: number; tilePlace: number }
): {
  cleanup: () => void;
  getSelectionBox: () => SelectionBox | null;
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
    const hitBuilding = state.buildings.find(
      (b) =>
        world.x >= b.position.x &&
        world.x <= b.position.x + options.buildingVisualSize &&
        world.y >= b.position.y &&
        world.y <= b.position.y + options.buildingVisualSize
    );
    if (hitBuilding) {
      state.selectUnit(hitBuilding.id);
      return;
    }
    const hitUnit = state.units.find((u) => {
      const cx = u.position.x + 16;
      const cy = u.position.y + 16;
      return Math.abs(world.x - cx) <= 14 && Math.abs(world.y - cy) <= 14;
    });
    if (hitUnit) {
      state.selectUnit(hitUnit.id);
      return;
    }

    const gridX = Math.floor(world.x / options.tilePlace) * options.tilePlace;
    const gridY = Math.floor(world.y / options.tilePlace) * options.tilePlace;
    const buildType = e.altKey ? 'mine' : e.shiftKey ? 'house' : null;
    if (buildType) {
      state.placeBuilding(gridX, gridY, buildType);
    }
    state.setSelectedIds([]);
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

  return {
    cleanup: () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
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
  };
}
