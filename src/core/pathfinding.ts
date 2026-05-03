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

/**
 * Hard cap on explored nodes. With the current 60x40 map this is ~2x the
 * total cell count, plenty for any real path while preventing pathological
 * cases (fully blocked targets, race conditions during fog updates) from
 * stalling the main thread.
 */
const PATHFIND_NODE_LIMIT = 6000;

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

  // Use a binary min-heap keyed on `f` instead of resorting an array every
  // pop — O(log n) per op instead of O(n log n) — and keep a `bestG` map
  // so we don't enqueue strictly-worse paths to the same cell.
  const open: PathNode[] = [];
  const bestG = new Map<string, number>();
  const closed = new Set<string>();

  const heapPush = (node: PathNode): void => {
    open.push(node);
    let i = open.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (open[parent].f <= open[i].f) break;
      [open[parent], open[i]] = [open[i], open[parent]];
      i = parent;
    }
  };
  const heapPop = (): PathNode | undefined => {
    if (open.length === 0) return undefined;
    const top = open[0];
    const last = open.pop()!;
    if (open.length > 0) {
      open[0] = last;
      let i = 0;
      const n = open.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < n && open[l].f < open[smallest].f) smallest = l;
        if (r < n && open[r].f < open[smallest].f) smallest = r;
        if (smallest === i) break;
        [open[smallest], open[i]] = [open[i], open[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  const startKey = `${startTile.x},${startTile.y}`;
  bestG.set(startKey, 0);
  heapPush({
    x: startTile.x,
    y: startTile.y,
    g: 0,
    h: heuristic(startTile, endTile),
    f: heuristic(startTile, endTile),
  });

  let explored = 0;
  while (open.length > 0) {
    const current = heapPop()!;
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

    if (++explored > PATHFIND_NODE_LIMIT) return null;

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
      const prev = bestG.get(nKey);
      if (prev !== undefined && g >= prev) continue;
      bestG.set(nKey, g);
      const h = heuristic(n, endTile);
      heapPush({ x: n.x, y: n.y, g, h, f: g + h, parent: current });
    }
  }

  return null;
}
