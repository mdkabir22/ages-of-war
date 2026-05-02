import * as THREE from 'three';
import type { Building, Unit } from '../../core/types';

/**
 * Per-unit color so the player can tell warrior/archer/cavalry/villager apart
 * at a glance, while still keeping a clear team tint via head color.
 */
const UNIT_BODY_COLOR: Record<Unit['type'], number> = {
  villager: 0xc8a780,
  warrior: 0x9ca3af,
  archer: 0x4ade80,
  spearman: 0xf59e0b,
  cavalry: 0x8b5cf6,
};

const TEAM_HEAD_COLOR: Record<'player' | 'enemy', number> = {
  player: 0x3b82f6,
  enemy: 0xef4444,
};

const TEAM_BANNER_COLOR: Record<'player' | 'enemy', number> = {
  player: 0x60a5fa,
  enemy: 0xfca5a5,
};

const BUILDING_BODY_COLOR: Record<Building['type'], number> = {
  townCenter: 0xd1c7a8,
  barracks: 0xa1887f,
  farm: 0xead196,
  house: 0xc0a576,
  mine: 0x8b8680,
  lumber_camp: 0x7c5e3c,
  mill: 0xd0b27a,
};

const BUILDING_ROOF_COLOR: Record<Building['type'], number> = {
  townCenter: 0xb91c1c,
  barracks: 0x7c2d12,
  farm: 0x65a30d,
  house: 0x991b1b,
  mine: 0x44403c,
  lumber_camp: 0x854d0e,
  mill: 0x92400e,
};

interface UnitDims {
  bodyW: number;
  bodyH: number;
  bodyD: number;
  headR: number;
  total: number;
}

export function getUnitDims(type: Unit['type']): UnitDims {
  switch (type) {
    case 'villager':
      return { bodyW: 12, bodyH: 16, bodyD: 12, headR: 5, total: 16 + 5 * 2 };
    case 'warrior':
      return { bodyW: 18, bodyH: 22, bodyD: 18, headR: 7, total: 22 + 7 * 2 };
    case 'archer':
      return { bodyW: 14, bodyH: 22, bodyD: 14, headR: 6, total: 22 + 6 * 2 };
    case 'spearman':
      return { bodyW: 16, bodyH: 24, bodyD: 16, headR: 6, total: 24 + 6 * 2 };
    case 'cavalry':
      return { bodyW: 28, bodyH: 18, bodyD: 18, headR: 7, total: 18 + 7 * 2 };
    default:
      return { bodyW: 14, bodyH: 18, bodyD: 14, headR: 5, total: 18 + 5 * 2 };
  }
}

/**
 * Create a small 3D unit "figure" (body + head + team banner).
 * Returns the root Group plus references for material updates.
 */
export function buildUnitMesh(unit: Unit): {
  group: any;
  body: any;
  head: any;
  banner: any;
  healthBg: any;
  healthFill: any;
  geometries: any[];
  materials: any[];
} {
  const dims = getUnitDims(unit.type);
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(dims.bodyW, dims.bodyH, dims.bodyD);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: UNIT_BODY_COLOR[unit.type] ?? 0x94a3b8,
    roughness: 0.7,
    metalness: 0.05,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = false;
  body.position.y = dims.bodyH / 2;
  group.add(body);

  const headGeo = new THREE.SphereGeometry(dims.headR, 12, 10);
  const headMat = new THREE.MeshStandardMaterial({
    color: TEAM_HEAD_COLOR[unit.owner],
    roughness: 0.55,
    metalness: 0.1,
    emissive: TEAM_HEAD_COLOR[unit.owner],
    emissiveIntensity: 0.18,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.castShadow = true;
  head.position.y = dims.bodyH + dims.headR * 0.85;
  group.add(head);

  // Small team banner / shoulder pad facing forward so players can pick out friends/foes.
  const bannerGeo = new THREE.BoxGeometry(dims.bodyW * 0.45, dims.bodyH * 0.32, 1.4);
  const bannerMat = new THREE.MeshBasicMaterial({
    color: TEAM_BANNER_COLOR[unit.owner],
  });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, dims.bodyH * 0.72, dims.bodyD / 2 + 0.7);
  group.add(banner);

  // Floating health bar (billboarded by the loop) — background + fill plates.
  const healthBgGeo = new THREE.PlaneGeometry(dims.bodyW * 1.6, 2.4);
  const healthBgMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const healthBg = new THREE.Mesh(healthBgGeo, healthBgMat);
  healthBg.position.y = dims.total + 4;
  healthBg.renderOrder = 20;
  group.add(healthBg);

  const healthFillGeo = new THREE.PlaneGeometry(dims.bodyW * 1.55, 1.7);
  const healthFillMat = new THREE.MeshBasicMaterial({
    color: unit.owner === 'player' ? 0x22c55e : 0xf87171,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const healthFill = new THREE.Mesh(healthFillGeo, healthFillMat);
  healthFill.position.set(0, dims.total + 4, 0.05);
  healthFill.renderOrder = 21;
  group.add(healthFill);

  return {
    group,
    body,
    head,
    banner,
    healthBg,
    healthFill,
    geometries: [bodyGeo, headGeo, bannerGeo, healthBgGeo, healthFillGeo],
    materials: [bodyMat, headMat, bannerMat, healthBgMat, healthFillMat],
  };
}

interface BuildingDims {
  baseW: number;
  baseH: number;
  baseD: number;
  roofH: number;
}

export function getBuildingDims(type: Building['type']): BuildingDims {
  switch (type) {
    case 'townCenter':
      return { baseW: 64, baseH: 32, baseD: 64, roofH: 22 };
    case 'barracks':
      return { baseW: 56, baseH: 28, baseD: 56, roofH: 18 };
    case 'farm':
      return { baseW: 48, baseH: 6, baseD: 48, roofH: 0 };
    case 'house':
      return { baseW: 36, baseH: 22, baseD: 36, roofH: 16 };
    case 'mine':
      return { baseW: 44, baseH: 26, baseD: 44, roofH: 8 };
    case 'lumber_camp':
      return { baseW: 48, baseH: 24, baseD: 48, roofH: 14 };
    case 'mill':
      return { baseW: 44, baseH: 30, baseD: 44, roofH: 16 };
    default:
      return { baseW: 44, baseH: 24, baseD: 44, roofH: 14 };
  }
}

const TEAM_TRIM_COLOR: Record<'player' | 'enemy', number> = {
  player: 0x2563eb,
  enemy: 0xb91c1c,
};

export function buildBuildingMesh(building: Building): {
  group: any;
  base: any;
  roof: any | null;
  trim: any;
  geometries: any[];
  materials: any[];
} {
  const dims = getBuildingDims(building.type);
  const group = new THREE.Group();

  const baseGeo = new THREE.BoxGeometry(dims.baseW, dims.baseH, dims.baseD);
  const baseMat = new THREE.MeshStandardMaterial({
    color: BUILDING_BODY_COLOR[building.type] ?? 0xa3a3a3,
    roughness: 0.85,
    metalness: 0.05,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.castShadow = true;
  base.receiveShadow = true;
  base.position.y = dims.baseH / 2;
  group.add(base);

  const trimGeo = new THREE.BoxGeometry(dims.baseW + 1.4, 2.6, dims.baseD + 1.4);
  const trimMat = new THREE.MeshStandardMaterial({
    color: TEAM_TRIM_COLOR[building.owner],
    roughness: 0.5,
    metalness: 0.2,
    emissive: TEAM_TRIM_COLOR[building.owner],
    emissiveIntensity: 0.15,
  });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.y = 1.3;
  group.add(trim);

  let roof: any | null = null;
  const geometries: any[] = [baseGeo, trimGeo];
  const materials: any[] = [baseMat, trimMat];
  if (dims.roofH > 0) {
    const roofGeo = new THREE.ConeGeometry(
      Math.max(dims.baseW, dims.baseD) * 0.74,
      dims.roofH,
      4
    );
    const roofMat = new THREE.MeshStandardMaterial({
      color: BUILDING_ROOF_COLOR[building.type] ?? 0x7f1d1d,
      roughness: 0.65,
      metalness: 0.05,
    });
    roof = new THREE.Mesh(roofGeo, roofMat);
    roof.castShadow = true;
    roof.position.y = dims.baseH + dims.roofH / 2;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    geometries.push(roofGeo);
    materials.push(roofMat);
  }

  return { group, base, roof, trim, geometries, materials };
}

export function disposeUnitVisual(visual: {
  geometries: any[];
  materials: any[];
}): void {
  for (const g of visual.geometries) g.dispose?.();
  for (const m of visual.materials) m.dispose?.();
}

export function disposeBuildingVisual(visual: {
  geometries: any[];
  materials: any[];
}): void {
  for (const g of visual.geometries) g.dispose?.();
  for (const m of visual.materials) m.dispose?.();
}
