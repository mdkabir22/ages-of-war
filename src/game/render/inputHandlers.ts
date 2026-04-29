import type { MutableRefObject } from 'react';
import { useGameStore } from '../../core/state';

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function setupCanvasInputHandlers(
  canvas: HTMLCanvasElement,
  pausedRef: MutableRefObject<boolean>
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
      if (Math.abs(selectionCurrentX - selectionStartX) > 4 || Math.abs(selectionCurrentY - selectionStartY) > 4) {
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
      const rect = canvas.getBoundingClientRect();
      const startWorld = toWorldPos(selectionStartX + rect.left, selectionStartY + rect.top);
      const endWorld = toWorldPos(selectionCurrentX + rect.left, selectionCurrentY + rect.top);
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

  canvas.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('contextmenu', handleContextMenu);

  return {
    cleanup: () => {
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
