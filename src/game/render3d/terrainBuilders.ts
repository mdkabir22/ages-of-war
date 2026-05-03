import * as THREE from 'three';
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  TILE_SIZE,
  TERRAIN_COLORS,
  type TerrainTile,
} from '../../core/map';
import { terrainHeightAt } from './spatial';

export function buildForestTrees(terrain: TerrainTile[][]): {
  mesh: any;
  dispose: () => void;
} | null {
  let count = 0;
  for (let ty = 0; ty < terrain.length; ty++) {
    for (let tx = 0; tx < (terrain[ty]?.length ?? 0); tx++) {
      if (terrain[ty][tx]?.type === 'forest') count++;
    }
  }
  if (count === 0) return null;

  const geo = new THREE.ConeGeometry(13, 26, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2d6b36,
    roughness: 0.88,
    metalness: 0.05,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let i = 0;
  for (let ty = 0; ty < terrain.length; ty++) {
    for (let tx = 0; tx < (terrain[ty]?.length ?? 0); tx++) {
      if (terrain[ty][tx]?.type !== 'forest') continue;
      const rnd = (salt: number) => {
        const v = Math.sin(tx * 12.9898 + ty * 78.233 + salt * 31.37) * 43758.5453123;
        return v - Math.floor(v);
      };
      const jx = (rnd(1) - 0.5) * 14;
      const jz = (rnd(2) - 0.5) * 14;
      const wx = tx * TILE_SIZE + TILE_SIZE / 2 + jx;
      const wz = ty * TILE_SIZE + TILE_SIZE / 2 + jz;
      const yBase = terrainHeightAt(wx, wz, terrain);
      const scale = 0.72 + rnd(3) * 0.38;
      dummy.position.set(wx, yBase + 13 * scale, wz);
      dummy.rotation.y = rnd(4) * Math.PI * 2;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

/**
 * Build a chunky low-poly mountain mesh per `hill` tile in the eastern
 * range so it visibly rises from the ground. Hill tiles sprinkled in the
 * central battlefield (used for terrain variety) stay as flat textured
 * ground so they don't clutter the playable area with cone props.
 */
export function buildMountainRange(terrain: TerrainTile[][]): {
  mesh: any;
  dispose: () => void;
} | null {
  const cols = terrain[0]?.length ?? 0;
  // Mountains only render east of this column (matches the mountain band
  // produced by core/map's generateMap).
  const eastStart = Math.floor(cols * 0.66);
  const isMountainTile = (tx: number, ty: number): boolean =>
    tx >= eastStart && terrain[ty]?.[tx]?.type === 'hill';

  let count = 0;
  for (let ty = 0; ty < terrain.length; ty++) {
    for (let tx = 0; tx < (terrain[ty]?.length ?? 0); tx++) {
      if (isMountainTile(tx, ty)) count++;
    }
  }
  if (count === 0) return null;

  const geo = new THREE.ConeGeometry(TILE_SIZE * 0.7, TILE_SIZE * 1.6, 5);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9b8a72,
    roughness: 0.95,
    metalness: 0.04,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let i = 0;
  for (let ty = 0; ty < terrain.length; ty++) {
    for (let tx = 0; tx < (terrain[ty]?.length ?? 0); tx++) {
      if (!isMountainTile(tx, ty)) continue;
      const rnd = (salt: number) => {
        const v = Math.sin(tx * 12.9898 + ty * 78.233 + salt * 31.37) * 43758.5453123;
        return v - Math.floor(v);
      };
      const wx = tx * TILE_SIZE + TILE_SIZE / 2 + (rnd(1) - 0.5) * 6;
      const wz = ty * TILE_SIZE + TILE_SIZE / 2 + (rnd(2) - 0.5) * 6;
      // Bigger peaks the deeper east we go, so the range silhouette
      // builds towards a tall ridge near the map edge.
      const eastDepth = (tx - eastStart) / Math.max(1, cols - eastStart);
      const scale = 0.9 + rnd(3) * 0.5 + eastDepth * 0.7;
      const peakY = (TILE_SIZE * 1.6 * scale) / 2;
      dummy.position.set(wx, peakY, wz);
      dummy.rotation.y = rnd(4) * Math.PI * 2;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

export function buildWaterSurface(terrain: TerrainTile[][]): {
  mesh: any;
  dispose: () => void;
} | null {
  let count = 0;
  for (let ty = 0; ty < terrain.length; ty++) {
    for (let tx = 0; tx < (terrain[ty]?.length ?? 0); tx++) {
      if (terrain[ty][tx]?.type === 'water') count++;
    }
  }
  if (count === 0) return null;

  const geo = new THREE.PlaneGeometry(TILE_SIZE - 1, TILE_SIZE - 1);
  // Deeper, more saturated river — feels like a real water body rather than
  // a translucent wash over the ground.
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1f7fb8,
    emissive: 0x0a2440,
    emissiveIntensity: 0.32,
    transparent: true,
    opacity: 0.78,
    roughness: 0.18,
    metalness: 0.55,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  let i = 0;
  for (let ty = 0; ty < terrain.length; ty++) {
    for (let tx = 0; tx < (terrain[ty]?.length ?? 0); tx++) {
      if (terrain[ty][tx]?.type !== 'water') continue;
      const wx = tx * TILE_SIZE + TILE_SIZE / 2;
      const wz = ty * TILE_SIZE + TILE_SIZE / 2;
      dummy.position.set(wx, 0, wz);
      dummy.rotation.x = -Math.PI / 2;
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

/**
 * Convert a hex color string like "#7fd066" into normalized RGB in [0,1].
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

/**
 * Cheap, continuous value-noise in [0,1]. Bilinearly interpolates a
 * deterministic per-cell hash so the result has no visible grid seams,
 * unlike per-tile color variants which produce an obvious checkerboard.
 */
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const hash = (a: number, b: number): number => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const v00 = hash(xi, yi);
  const v10 = hash(xi + 1, yi);
  const v01 = hash(xi, yi + 1);
  const v11 = hash(xi + 1, yi + 1);
  // Smoothstep interpolation for soft transitions.
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  return (
    v00 * (1 - sx) * (1 - sy) +
    v10 * sx * (1 - sy) +
    v01 * (1 - sx) * sy +
    v11 * sx * sy
  );
}

/**
 * Two-octave noise gives finer surface detail without a single dominant
 * frequency, which is what produced the "tiled squares" look before.
 */
function fbm2(x: number, y: number): number {
  return valueNoise(x, y) * 0.65 + valueNoise(x * 2.13, y * 2.13) * 0.35;
}

/**
 * Build the ground texture so it reads as continuous, organic terrain
 * instead of a grid of solid colored squares. Each output pixel:
 *   - Picks the biome color of the underlying tile
 *   - Softly blends with neighbor biomes near tile boundaries (so grass <-> forest
 *     and grass <-> water look like a gradient, not a hard edge)
 *   - Modulates brightness with continuous fbm noise (no visible seams)
 */
export function buildTerrainFromMap(terrain: TerrainTile[][]): {
  mesh: any;
  dispose: () => void;
} {
  const cols = terrain[0]?.length ?? 0;
  const rows = terrain.length;
  const cw = cols * TILE_SIZE;
  const ch = rows * TILE_SIZE;

  // Render the texture at a lower per-tile resolution and let GPU
  // mip-mapping/anisotropy upscale it: massively cheaper than 2400x1600
  // per-pixel work, and the result still hides the grid under the noise.
  const PIXELS_PER_TILE = 8;
  const tw = cols * PIXELS_PER_TILE;
  const th = rows * PIXELS_PER_TILE;

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) {
    const geo = new THREE.PlaneGeometry(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d6b47 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(DEFAULT_MAP_WIDTH / 2, 0, DEFAULT_MAP_HEIGHT / 2);
    return {
      mesh,
      dispose: () => {
        geo.dispose();
        mat.dispose();
      },
    };
  }

  // Pre-resolve the base color of each tile (biome-only, no per-tile variant).
  const tileColor: { r: number; g: number; b: number }[][] = [];
  for (let ty = 0; ty < rows; ty++) {
    const row: { r: number; g: number; b: number }[] = [];
    for (let tx = 0; tx < cols; tx++) {
      const tile = terrain[ty][tx];
      row.push(hexToRgb(TERRAIN_COLORS[tile.type][0]));
    }
    tileColor.push(row);
  }
  const sampleTile = (tx: number, ty: number) => {
    const cx = Math.max(0, Math.min(cols - 1, tx));
    const cy = Math.max(0, Math.min(rows - 1, ty));
    return tileColor[cy][cx];
  };

  const img = ctx2d.createImageData(tw, th);
  const data = img.data;

  for (let py = 0; py < th; py++) {
    for (let px = 0; px < tw; px++) {
      // Sample location in tile-space (fractional => sits between tiles).
      const u = px / PIXELS_PER_TILE;
      const v = py / PIXELS_PER_TILE;
      const tx = Math.floor(u);
      const ty = Math.floor(v);
      const fu = u - tx;
      const fv = v - ty;

      // Bilinear blend across the 4 neighbor biomes so tile boundaries
      // dissolve into soft gradients instead of hard color steps.
      const c00 = sampleTile(tx, ty);
      const c10 = sampleTile(tx + 1, ty);
      const c01 = sampleTile(tx, ty + 1);
      const c11 = sampleTile(tx + 1, ty + 1);
      const w00 = (1 - fu) * (1 - fv);
      const w10 = fu * (1 - fv);
      const w01 = (1 - fu) * fv;
      const w11 = fu * fv;
      let r = c00.r * w00 + c10.r * w10 + c01.r * w01 + c11.r * w11;
      let g = c00.g * w00 + c10.g * w10 + c01.g * w01 + c11.g * w11;
      let b = c00.b * w00 + c10.b * w10 + c01.b * w01 + c11.b * w11;

      // Continuous brightness noise — no per-tile cell, so no checkerboard.
      const n = fbm2(u * 1.7, v * 1.7);
      const tint = 0.82 + n * 0.36;
      r = Math.min(1, Math.max(0, r * tint));
      g = Math.min(1, Math.max(0, g * tint));
      b = Math.min(1, Math.max(0, b * tint));

      const i = (py * tw + px) * 4;
      data[i] = (r * 255) | 0;
      data[i + 1] = (g * 255) | 0;
      data[i + 2] = (b * 255) | 0;
      data[i + 3] = 255;
    }
  }
  ctx2d.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;

  const geo = new THREE.PlaneGeometry(cw, ch, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.92,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cw / 2, 0, ch / 2);
  mesh.receiveShadow = true;
  return {
    mesh,
    dispose: () => {
      tex.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}
