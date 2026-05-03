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

// 3x larger battlefield for a "paradise" feel — wide enough for distinct
// regional biomes (river to the north, forest west, mountains east, open
// grassland in the center+south). Tile granularity stays at 40 so the
// pathfinder grid is 60x40 = 2400 cells (still fast).
export const DEFAULT_MAP_WIDTH = 2400;
export const DEFAULT_MAP_HEIGHT = 1600;
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
  // Lush, vibrant palette for the "janat" look — saturated grass, deep
  // forest greens, warm earthy mountains, vivid river blues.
  grass: ['#7fd066', '#94de7c', '#6cc857', '#a5e890'],
  forest: ['#3d8a36', '#4ea34a', '#306e2c', '#5fbb56'],
  hill: ['#a89578', '#b8a484', '#998568', '#c8b698'],
  water: ['#2682b6', '#3a98c8', '#1f72a8', '#54add6'],
};

export function getLaneYPositions(height: number): number[] {
  return LANE_Y_RATIOS.map((ratio) => ratio * height);
}

/**
 * Deterministic 1D pseudo-noise for shaping biome edges with wavy borders
 * instead of straight columns/rows. Returns a value roughly in [-1, 1].
 */
function wavyNoise(x: number, seed: number): number {
  return (
    Math.sin(x * 0.42 + seed * 1.7) * 0.55 +
    Math.sin(x * 0.18 + seed * 0.4) * 0.35 +
    Math.sin(x * 0.07 + seed * 3.1) * 0.18
  );
}

/**
 * Biome-aware map generator.
 *
 * Layout (looking top-down at the world):
 *   - North band:  meandering river (water).
 *   - West region: dense forest (with grass clearings).
 *   - East region: mountain range (hills) with stone outcrops.
 *   - Center & south: open grassland — the main battlefield.
 */
export function generateMap(width: number, height: number): TerrainTile[][] {
  const map: TerrainTile[][] = [];

  const forestEdge = Math.floor(width * 0.28);
  const mountainEdge = Math.floor(width * 0.72);
  const riverCenterRow = Math.floor(height * 0.12);
  const riverHalfBand = Math.max(2, Math.floor(height * 0.05));

  for (let y = 0; y < height; y++) {
    const row: TerrainTile[] = [];
    for (let x = 0; x < width; x++) {
      let type: TerrainType = 'grass';

      // 1. North river — meanders across the top using wavy noise.
      const riverWave = wavyNoise(x, 7) * 2.4;
      const riverDistance = Math.abs(y - (riverCenterRow + riverWave));
      if (riverDistance <= riverHalfBand) {
        type = 'water';
      }

      // 2. West dense forest — wavy western edge.
      const forestWave = wavyNoise(y, 3) * 4;
      const forestRight = forestEdge + forestWave;
      if (type === 'grass' && x < forestRight) {
        const depth = forestRight - x;
        const noise = (Math.sin(x * 1.3 + y * 0.7) + 1) * 0.5;
        if (depth > 5 || noise < 0.78) type = 'forest';
      }

      // 3. East mountain range — wavy eastern edge.
      const mountainWave = wavyNoise(y + 11, 5) * 3.5;
      const mountainLeft = mountainEdge + mountainWave;
      if (type === 'grass' && x > mountainLeft) {
        const depth = x - mountainLeft;
        const noise = (Math.sin(x * 0.9 + y * 1.1) + 1) * 0.5;
        if (depth > 4 || noise < 0.78) type = 'hill';
      }

      // 4. Sprinkle sparse hills/forest patches in the central battlefield
      //    so it doesn't feel sterile, but keep it walkable.
      if (type === 'grass') {
        const sprinkle =
          (Math.sin(x * 2.1 + y * 1.7) + Math.sin(x * 0.6 - y * 0.9)) * 0.5;
        if (sprinkle > 0.78) type = 'hill';
        else if (sprinkle < -0.85) type = 'forest';
      }

      // 5. Always-grass safe zones near each player's expected starting base
      //    so the engine has a guaranteed place to spawn buildings/units.
      const inPlayerSpawn =
        x >= 8 && x <= 22 && y >= height - 18 && y <= height - 4;
      const inEnemySpawn =
        x >= width - 22 && x <= width - 8 && y >= height - 18 && y <= height - 4;
      if (inPlayerSpawn || inEnemySpawn) {
        type = 'grass';
      }

      row.push({
        x,
        y,
        type,
        variant: (x * 31 + y * 7) % 4,
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
