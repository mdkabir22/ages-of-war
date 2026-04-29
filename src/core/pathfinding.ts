import type { Position } from './types';
import type { TerrainTile } from './map';
import { TERRAIN_EFFECTS, TILE_SIZE } from './map';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent?: PathNode;
}

function toTile(pos: Position): { x: number; y: number } {
  return {
    x: Math.floor(pos.x / TILE_SIZE),
    y: Math.floor(pos.y / TILE_SIZE),
  };
}

function toWorldCenter(tileX: number, tileY: number): Position {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function findPath(start: Position, end: Position, terrain: TerrainTile[][]): Position[] | null {
  if (terrain.length === 0 || terrain[0].length === 0) return null;
  const startTile = toTile(start);
  const endTile = toTile(end);
  if (
    endTile.x < 0 ||
    endTile.y < 0 ||
    endTile.y >= terrain.length ||
    endTile.x >= terrain[0].length ||
    TERRAIN_EFFECTS[terrain[endTile.y][endTile.x].type].impassable
  ) {
    return null;
  }

  const heuristic = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  const open: PathNode[] = [
    {
      x: startTile.x,
      y: startTile.y,
      g: 0,
      h: heuristic(startTile, endTile),
      f: heuristic(startTile, endTile),
    },
  ];
  const closed = new Set<string>();

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = `${current.x},${current.y}`;
    if (closed.has(key)) continue;
    closed.add(key);

    if (current.x === endTile.x && current.y === endTile.y) {
      const path: Position[] = [];
      let node: PathNode | undefined = current;
      while (node) {
        path.unshift(toWorldCenter(node.x, node.y));
        node = node.parent;
      }
      return path;
    }

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.y >= terrain.length || n.x >= terrain[0].length) continue;
      const tile = terrain[n.y][n.x];
      const effect = TERRAIN_EFFECTS[tile.type];
      if (effect.impassable) continue;
      const nKey = `${n.x},${n.y}`;
      if (closed.has(nKey)) continue;
      const moveCost = effect.moveSpeedMultiplier > 0 ? 1 / effect.moveSpeedMultiplier : 4;
      const g = current.g + moveCost;
      const h = heuristic(n, endTile);
      open.push({ x: n.x, y: n.y, g, h, f: g + h, parent: current });
    }
  }

  return null;
}
