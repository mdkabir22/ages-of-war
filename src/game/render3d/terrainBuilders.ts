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

export function buildTerrainFromMap(terrain: TerrainTile[][]): {
  mesh: any;
  dispose: () => void;
} {
  const cols = terrain[0]?.length ?? 0;
  const rows = terrain.length;
  const cw = cols * TILE_SIZE;
  const ch = rows * TILE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
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
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const tile = terrain[ty][tx];
      const palette = TERRAIN_COLORS[tile.type];
      ctx2d.fillStyle = palette[tile.variant % palette.length];
      ctx2d.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(cw, ch, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.9,
    metalness: 0.04,
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
