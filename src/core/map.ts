export type TerrainType = 'grass' | 'forest' | 'hill' | 'water';

export interface TerrainTile {
  x: number;
  y: number;
  type: TerrainType;
  variant: number;
}

export type ResourceNodeTerrainType = 'tree' | 'gold_mine' | 'stone_mine' | 'berry_bush';

export interface TerrainEffect {
  moveSpeedMultiplier: number;
  defenseBonus: number;
  rangeBonus: number;
  impassable: boolean;
  canBuild: boolean;
}

export interface GameMap {
  width: number;
  height: number;
  tiles: TerrainTile[][];
}

export const DEFAULT_MAP_WIDTH = 1280;
export const DEFAULT_MAP_HEIGHT = 720;
export const TILE_SIZE = 40;

export const LANE_Y_RATIOS = [0.28, 0.5, 0.72] as const;

export const TERRAIN_EFFECTS: Record<TerrainType, TerrainEffect> = {
  grass: {
    moveSpeedMultiplier: 1,
    defenseBonus: 0,
    rangeBonus: 0,
    impassable: false,
    canBuild: true,
  },
  forest: {
    moveSpeedMultiplier: 0.7,
    defenseBonus: 0.2,
    rangeBonus: 0,
    impassable: false,
    canBuild: false,
  },
  hill: {
    moveSpeedMultiplier: 0.5,
    defenseBonus: 0.15,
    rangeBonus: 0.3,
    impassable: false,
    canBuild: true,
  },
  water: {
    moveSpeedMultiplier: 0,
    defenseBonus: 0,
    rangeBonus: 0,
    impassable: true,
    canBuild: false,
  },
};

export const TERRAIN_COLORS: Record<TerrainType, string[]> = {
  grass: ['#7bc45a', '#8fd470', '#6ab54a', '#9ee085'],
  forest: ['#4a8f3d', '#5aa84e', '#3d7a33', '#6bc25a'],
  hill: ['#c4b090', '#d4c0a0', '#b8a080', '#e0d0b0'],
  water: ['#5ba0d0', '#6cb8e0', '#4a90c0', '#7ec8f0'],
};

export function getLaneYPositions(height: number): number[] {
  return LANE_Y_RATIOS.map((ratio) => ratio * height);
}

export function generateMap(width: number, height: number): TerrainTile[][] {
  const map: TerrainTile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TerrainTile[] = [];
    for (let x = 0; x < width; x++) {
      const noise = Math.random();
      const nearEdge = x < 4 || y < 4 || x >= width - 4 || y >= height - 4;
      let type: TerrainType;
      if (nearEdge && noise < 0.2) type = 'water';
      else if (noise < 0.25) type = 'forest';
      else if (noise < 0.35) type = 'hill';
      else type = 'grass';
      if ((x < 5 && y < 5) || (x >= width - 5 && y < 5)) {
        type = 'grass';
      }
      row.push({
        x,
        y,
        type,
        variant: Math.floor(Math.random() * 4),
      });
    }
    map.push(row);
  }
  return map;
}

export function getTileAt(terrain: TerrainTile[][], worldX: number, worldY: number): TerrainTile | null {
  if (terrain.length === 0 || terrain[0].length === 0) return null;
  const tx = Math.floor(worldX / TILE_SIZE);
  const ty = Math.floor(worldY / TILE_SIZE);
  if (tx < 0 || ty < 0 || ty >= terrain.length || tx >= terrain[0].length) return null;
  return terrain[ty][tx];
}

export function isWalkable(tile: TerrainTile): boolean {
  return !TERRAIN_EFFECTS[tile.type].impassable;
}

export function canSpawnResourceNodeOnTile(nodeType: ResourceNodeTerrainType, tile: TerrainTile): boolean {
  if (nodeType === 'tree') return tile.type === 'forest';
  if (nodeType === 'berry_bush') return tile.type === 'grass' || tile.type === 'forest';
  if (nodeType === 'gold_mine' || nodeType === 'stone_mine') return tile.type === 'hill';
  return false;
}
