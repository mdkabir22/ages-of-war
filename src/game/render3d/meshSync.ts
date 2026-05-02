import * as THREE from 'three';
import { useGameStore } from '../../core/state';
import {
  buildBuildingMesh,
  buildUnitMesh,
  disposeBuildingVisual,
  disposeUnitVisual,
  getBuildingDims,
  getUnitDims,
} from './entityVisuals';
import { facingDestination, terrainHeightAt } from './spatial';

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
}

interface MeshSyncOptions {
  fogTileSize: number;
  scene: any;
  unitMeshes: Map<string, UnitVisualEntry>;
  buildingMeshes: Map<string, BuildingVisualEntry>;
  selectionRings: Map<string, any>;
  ringGeo: any;
  ringMat: any;
}

export function sync3DMeshes(options: MeshSyncOptions): void {
  const state = useGameStore.getState();
  const terrainMap = state.terrain;

  const unitIds = new Set(state.units.map((u) => u.id));
  for (const id of options.unitMeshes.keys()) {
    if (!unitIds.has(id)) {
      const entry = options.unitMeshes.get(id)!;
      options.scene.remove(entry.group);
      disposeUnitVisual(entry);
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
    // 0 = unexplored, 1 = explored (memory), 2 = currently visible.
    // Player units always visible. Enemy units render as ghosts in
    // explored fog and are hidden only in completely unexplored tiles.
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
        options.scene.remove(entry.group);
        disposeUnitVisual(entry);
        options.unitMeshes.delete(u.id);
      }
      const built = buildUnitMesh(u);
      const dims = getUnitDims(u.type);
      entry = {
        ...built,
        unitType: u.type,
        owner: u.owner,
        baseFillWidth: dims.bodyW * 1.55,
      };
      options.unitMeshes.set(u.id, entry);
      options.scene.add(entry.group);
    }

    entry.group.visible = visible;

    // Dim enemies when out-of-vision (memory only) for a recon-style cue.
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

    // Health bar fill width by hp ratio.
    const hpRatio = Math.max(0, Math.min(1, u.maxHp > 0 ? u.hp / u.maxHp : 0));
    entry.healthFill.scale.x = Math.max(0.001, hpRatio);
    entry.healthFill.position.x = -((entry.baseFillWidth) * (1 - hpRatio)) / 2;

    // Recolor fill based on hp severity.
    const fillMat = entry.healthFill.material as { color?: { setHex?: (n: number) => void } };
    if (fillMat.color?.setHex) {
      const color =
        hpRatio > 0.55 ? 0x22c55e : hpRatio > 0.25 ? 0xfacc15 : 0xef4444;
      fillMat.color.setHex(color);
    }

    // Billboard the health plates toward the camera (yaw only).
    entry.healthBg.rotation.y = -entry.group.rotation.y;
    entry.healthFill.rotation.y = -entry.group.rotation.y;
  }

  const buildingIds = new Set(state.buildings.map((b) => b.id));
  for (const id of options.buildingMeshes.keys()) {
    if (!buildingIds.has(id)) {
      const entry = options.buildingMeshes.get(id)!;
      options.scene.remove(entry.group);
      disposeBuildingVisual(entry);
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
      };
      options.buildingMeshes.set(b.id, entry);
      options.scene.add(entry.group);
    }
    const dims = getBuildingDims(b.type);
    const bx = b.position.x + dims.baseW / 2;
    const bz = b.position.y + dims.baseD / 2;
    const bgY = terrainHeightAt(bx, bz, terrainMap);
    entry.group.position.set(bx, bgY, bz);
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
