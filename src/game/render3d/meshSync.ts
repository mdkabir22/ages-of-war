import * as THREE from 'three';
import { useGameStore } from '../../core/state';
import type { Unit } from '../../core/types';
import {
  buildBuildingMesh,
  buildUnitMesh,
  disposeBuildingVisual,
  getBuildingDims,
  getUnitDims,
} from './entityVisuals';
import {
  spawnDeathFx,
  spawnHitPuff,
  spawnProjectile,
  type EffectsState,
} from './effects3D';
import { facingDestination, terrainHeightAt } from './spatial';
import {
  applyUnitAnimation,
  createUnitAnimState,
  rememberBaseTransforms,
  type UnitAnimState,
} from './unitAnimation';

interface UnitVisualEntry {
  group: any;
  body: any;
  head: any;
  banner: any;
  healthBg: any;
  healthFill: any;
  geometries: any[];
  materials: any[];
  unitType: string;
  owner: string;
  baseFillWidth: number;
  anim: UnitAnimState;
  lastSeenUnit: Unit;
}

interface BuildingVisualEntry {
  group: any;
  base: any;
  roof: any | null;
  trim: any;
  geometries: any[];
  materials: any[];
  buildingType: string;
  owner: string;
  /** Real-time when the visual was first created — drives grow-in animation. */
  spawnTime: number;
  /** True until the construction puff has been emitted. */
  pendingCompletePuff: boolean;
}

interface MeshSyncOptions {
  fogTileSize: number;
  scene: any;
  unitMeshes: Map<string, UnitVisualEntry>;
  buildingMeshes: Map<string, BuildingVisualEntry>;
  selectionRings: Map<string, any>;
  ringGeo: any;
  ringMat: any;
  effects: EffectsState;
}

function findAttackTargetPos(state: ReturnType<typeof useGameStore.getState>, attacker: Unit): {
  x: number;
  z: number;
} | null {
  // Choose nearest opponent unit/building within attacker.range as a best guess
  // for the attack target (the engine doesn't store explicit target IDs per attack).
  const enemies = state.units.filter((u) => u.owner !== attacker.owner && u.hp > 0);
  let bestX = 0;
  let bestZ = 0;
  let bestDist = Infinity;
  for (const e of enemies) {
    const dx = e.position.x - attacker.position.x;
    const dz = e.position.y - attacker.position.y;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      bestX = e.position.x + 16;
      bestZ = e.position.y + 16;
    }
  }
  const buildings = state.buildings.filter((b) => b.owner !== attacker.owner);
  for (const b of buildings) {
    const bx = b.position.x + 16;
    const bz = b.position.y + 16;
    const dx = bx - attacker.position.x;
    const dz = bz - attacker.position.y;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      bestX = bx;
      bestZ = bz;
    }
  }
  if (bestDist === Infinity) return null;
  return { x: bestX, z: bestZ };
}

export function sync3DMeshes(options: MeshSyncOptions): void {
  const state = useGameStore.getState();
  const terrainMap = state.terrain;
  const now = performance.now();
  const dt = 1 / 60;

  // Detect dead/removed units: spawn death FX before deleting.
  const unitIds = new Set(state.units.map((u) => u.id));
  for (const id of Array.from(options.unitMeshes.keys())) {
    if (!unitIds.has(id)) {
      const entry = options.unitMeshes.get(id)!;
      // Hand the visual over to the death-fx pool which will fade it out
      // and dispose its geometries/materials when finished.
      spawnDeathFx(options.effects, entry.group, entry.geometries, entry.materials);
      options.unitMeshes.delete(id);
    }
  }

  for (const u of state.units) {
    const tx = Math.floor((u.position.x + 16) / options.fogTileSize);
    const ty = Math.floor((u.position.y + 16) / options.fogTileSize);
    const { width, height, tiles } = state.fog;
    const tile =
      tx >= 0 && ty >= 0 && tx < width && ty < height
        ? tiles[ty * width + tx]
        : 0;
    const isPlayer = u.owner !== 'enemy';
    const inVision = tile === 2;
    const inMemory = tile === 1;
    const visible = isPlayer || inVision || inMemory;
    const ghostInFog = !isPlayer && !inVision;

    let entry = options.unitMeshes.get(u.id);
    const needsRebuild =
      !entry || entry.unitType !== u.type || entry.owner !== u.owner;

    if (!entry || needsRebuild) {
      if (entry) {
        // Type/owner change — fade the old shell out cleanly.
        spawnDeathFx(options.effects, entry.group, entry.geometries, entry.materials);
        options.unitMeshes.delete(u.id);
      }
      const built = buildUnitMesh(u);
      const dims = getUnitDims(u.type);
      // Capture local body/head base transforms so animation deltas
      // are relative to the rest pose.
      rememberBaseTransforms(built.body, built.head);
      entry = {
        ...built,
        unitType: u.type,
        owner: u.owner,
        baseFillWidth: dims.bodyW * 1.55,
        anim: createUnitAnimState(u),
        lastSeenUnit: u,
      };
      options.unitMeshes.set(u.id, entry);
      options.scene.add(entry.group);
    }

    entry.group.visible = visible;
    entry.lastSeenUnit = u;

    const bodyMat = entry.body.material as { opacity?: number; transparent?: boolean };
    const headMat = entry.head.material as { opacity?: number; transparent?: boolean };
    if (bodyMat && headMat) {
      bodyMat.transparent = true;
      headMat.transparent = true;
      const op = ghostInFog ? 0.45 : 1;
      bodyMat.opacity = op;
      headMat.opacity = op;
    }

    const ux = u.position.x + 16;
    const uz = u.position.y + 16;
    const groundY = terrainHeightAt(ux, uz, terrainMap);
    entry.group.position.set(ux, groundY + 0.35, uz);

    const face = facingDestination(u);
    if (face) {
      const dx = face.x - ux;
      const dz = face.z - uz;
      if (Math.abs(dx) + Math.abs(dz) > 0.4) {
        entry.group.rotation.y = Math.atan2(dx, dz);
      }
    }

    // Walk bob + attack pulse + emit attack FX if a strike just landed.
    const animResult = applyUnitAnimation(
      u,
      entry.anim,
      entry.body,
      entry.head,
      entry.banner,
      entry.group,
      now,
      dt
    );
    if (animResult.attacked && visible) {
      const target = findAttackTargetPos(state, u);
      if (target) {
        const dims = getUnitDims(u.type);
        spawnProjectile(
          options.effects,
          u.type,
          u.owner,
          ux,
          groundY + dims.bodyH * 0.85,
          uz,
          target.x,
          terrainHeightAt(target.x, target.z, terrainMap) + 8,
          target.z
        );
      }
    }

    // Health bar fill (with a fresh-damage flash via opacity boost).
    const hpRatio = Math.max(0, Math.min(1, u.maxHp > 0 ? u.hp / u.maxHp : 0));
    entry.healthFill.scale.x = Math.max(0.001, hpRatio);
    entry.healthFill.position.x = -((entry.baseFillWidth) * (1 - hpRatio)) / 2;

    const fillMat = entry.healthFill.material as { color?: { setHex?: (n: number) => void } };
    if (fillMat.color?.setHex) {
      const color =
        hpRatio > 0.55 ? 0x22c55e : hpRatio > 0.25 ? 0xfacc15 : 0xef4444;
      fillMat.color.setHex(color);
    }

    entry.healthBg.rotation.y = -entry.group.rotation.y;
    entry.healthFill.rotation.y = -entry.group.rotation.y;
  }

  const buildingIds = new Set(state.buildings.map((b) => b.id));
  for (const id of options.buildingMeshes.keys()) {
    if (!buildingIds.has(id)) {
      const entry = options.buildingMeshes.get(id)!;
      // Building destroyed — also use death-fx so the rubble fades + topples.
      spawnDeathFx(options.effects, entry.group, entry.geometries, entry.materials);
      options.buildingMeshes.delete(id);
    }
  }

  for (const b of state.buildings) {
    let entry = options.buildingMeshes.get(b.id);
    const needsRebuild =
      !entry || entry.buildingType !== b.type || entry.owner !== b.owner;
    if (!entry || needsRebuild) {
      if (entry) {
        options.scene.remove(entry.group);
        disposeBuildingVisual(entry);
        options.buildingMeshes.delete(b.id);
      }
      const built = buildBuildingMesh(b);
      entry = {
        ...built,
        buildingType: b.type,
        owner: b.owner,
        spawnTime: now,
        pendingCompletePuff: true,
      };
      options.buildingMeshes.set(b.id, entry);
      options.scene.add(entry.group);
    }
    const dims = getBuildingDims(b.type);
    const bx = b.position.x + dims.baseW / 2;
    const bz = b.position.y + dims.baseD / 2;
    const bgY = terrainHeightAt(bx, bz, terrainMap);
    entry.group.position.set(bx, bgY, bz);

    // Construction grow-in: first ~3.2s the building scales up from the
    // ground while emitting a translucent emissive accent. When it finishes
    // we emit a one-time completion puff for satisfying feedback.
    const buildDurationMs = 3200;
    const buildT = Math.min(1, (now - entry.spawnTime) / buildDurationMs);
    const eased = 1 - Math.pow(1 - buildT, 3);
    entry.group.scale.set(1, eased, 1);
    // Optional micro-bobble on the final settle (~last 12% of build time).
    if (buildT > 0.88 && buildT < 1) {
      const settle = (buildT - 0.88) / 0.12;
      entry.group.scale.y = eased + Math.sin(settle * Math.PI) * 0.04;
    }
    if (buildT >= 1 && entry.pendingCompletePuff) {
      spawnHitPuff(
        options.effects,
        bx,
        bgY + dims.baseH * 0.6,
        bz,
        b.owner === 'player' ? 0xfde68a : 0xfca5a5
      );
      entry.pendingCompletePuff = false;
    }

    // Trim accent emissive: stronger during construction + when damaged.
    const trimMat = entry.trim.material as { emissiveIntensity?: number };
    if (trimMat) {
      const hpRatio = b.maxHp > 0 ? b.hp / b.maxHp : 1;
      const damageBoost = (1 - hpRatio) * 0.4;
      const buildBoost = (1 - buildT) * 0.55;
      trimMat.emissiveIntensity = 0.15 + damageBoost + buildBoost;
    }
  }

  const selected = new Set(state.selectedIds);
  for (const id of options.selectionRings.keys()) {
    if (!selected.has(id)) {
      const ring = options.selectionRings.get(id)!;
      options.scene.remove(ring);
      ring.material.dispose();
      options.selectionRings.delete(id);
    }
  }

  const pulse = 1 + Math.sin(performance.now() * 0.0045) * 0.07;
  for (const id of selected) {
    const unit = state.units.find((u) => u.id === id);
    const building = state.buildings.find((bd) => bd.id === id);
    let rx: number;
    let rz: number;
    if (unit) {
      rx = unit.position.x + 16;
      rz = unit.position.y + 16;
    } else if (building) {
      const dims = getBuildingDims(building.type);
      rx = building.position.x + dims.baseW / 2;
      rz = building.position.y + dims.baseD / 2;
    } else continue;

    let ring = options.selectionRings.get(id);
    if (!ring) {
      ring = new THREE.Mesh(options.ringGeo, options.ringMat.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 15;
      options.selectionRings.set(id, ring);
      options.scene.add(ring);
    }
    ring.position.set(rx, terrainHeightAt(rx, rz, terrainMap) + 0.22, rz);
    ring.scale.set(pulse, pulse, 1);
  }
}

/** Re-export for callers that need to hand back the puff helper. */
export { spawnHitPuff };
