import * as THREE from 'three';
import { TILE_SIZE, type TerrainTile } from '../../core/map';
import type { Unit } from '../../core/types';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

export function groundPoint(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  camera: any
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const ok = raycaster.ray.intersectPlane(plane, hit);
  if (!ok) return null;
  return { x: hit.x, y: hit.z };
}

export function groundRectBounds(
  clientCoords: [number, number][],
  canvas: HTMLCanvasElement,
  camera: any
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const [cx, cy] of clientCoords) {
    const p = groundPoint(cx, cy, canvas, camera);
    if (!p) continue;
    any = true;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (!any) return null;
  return { minX, maxX, minY, maxY };
}

export function terrainHeightAt(wx: number, wz: number, terrain: TerrainTile[][]): number {
  const tx = Math.floor(wx / TILE_SIZE);
  const ty = Math.floor(wz / TILE_SIZE);
  if (ty < 0 || tx < 0 || ty >= terrain.length || !terrain[ty] || tx >= terrain[ty].length) return 0;
  switch (terrain[ty][tx].type) {
    case 'hill':
      return 8;
    case 'water':
      return -1.5;
    case 'forest':
      return 1.5;
    default:
      return 0.35;
  }
}

export function facingDestination(u: Unit): { x: number; z: number } | null {
  if (u.target) return { x: u.target.x, z: u.target.y };
  if (u.path?.length && u.pathIndex !== undefined && u.path[u.pathIndex]) {
    const p = u.path[u.pathIndex];
    return { x: p.x, z: p.y };
  }
  return null;
}

export function unitBoxDims(type: Unit['type']): { w: number; h: number; d: number } {
  switch (type) {
    case 'villager':
      return { w: 18, h: 12, d: 18 };
    case 'warrior':
      return { w: 26, h: 20, d: 24 };
    case 'archer':
      return { w: 20, h: 18, d: 18 };
    case 'spearman':
      return { w: 22, h: 22, d: 22 };
    case 'cavalry':
      return { w: 38, h: 16, d: 32 };
    default:
      return { w: 22, h: 14, d: 22 };
  }
}
