import * as THREE from 'three';
import { useGameStore } from '../../core/state';
import type { Unit } from '../../core/types';
import { facingDestination, terrainHeightAt, unitBoxDims } from './spatial';

interface MeshSyncOptions {
  fogTileSize: number;
  buildingVisualSize: number;
  scene: any;
  unitMeshes: Map<string, any>;
  buildingMeshes: Map<string, any>;
  selectionRings: Map<string, any>;
  ringGeo: any;
  ringMat: any;
  matUnitPlayer: any;
  matUnitEnemy: any;
  matBuildingPlayer: any;
  matBuildingEnemy: any;
}

export function sync3DMeshes(options: MeshSyncOptions): void {
  const state = useGameStore.getState();
  const terrainMap = state.terrain;

  const unitIds = new Set(state.units.map((u) => u.id));
  for (const id of options.unitMeshes.keys()) {
    if (!unitIds.has(id)) {
      const m = options.unitMeshes.get(id)!;
      options.scene.remove(m);
      m.geometry.dispose();
      options.unitMeshes.delete(id);
    }
  }

  for (const u of state.units) {
    const tx = Math.floor((u.position.x + 16) / options.fogTileSize);
    const ty = Math.floor((u.position.y + 16) / options.fogTileSize);
    const { width, height, tiles } = state.fog;
    const visible =
      u.owner !== 'enemy' ||
      (tx >= 0 &&
        ty >= 0 &&
        tx < width &&
        ty < height &&
        tiles[ty * width + tx] === 2);

    let mesh = options.unitMeshes.get(u.id);
    const dims = unitBoxDims(u.type);
    const needNewGeom =
      !mesh ||
      (mesh.userData as { unitType?: Unit['type'] }).unitType !== u.type ||
      (mesh.userData as { owner?: string }).owner !== u.owner;

    if (!mesh || needNewGeom) {
      if (mesh) {
        options.scene.remove(mesh);
        mesh.geometry.dispose();
        options.unitMeshes.delete(u.id);
      }
      const geo = new THREE.BoxGeometry(dims.w, dims.h, dims.d);
      mesh = new THREE.Mesh(geo, u.owner === 'player' ? options.matUnitPlayer : options.matUnitEnemy);
      mesh.castShadow = true;
      mesh.userData = { unitType: u.type, owner: u.owner };
      options.unitMeshes.set(u.id, mesh);
      options.scene.add(mesh);
    }
    mesh.visible = visible;
    mesh.material = u.owner === 'player' ? options.matUnitPlayer : options.matUnitEnemy;
    const ux = u.position.x + 16;
    const uz = u.position.y + 16;
    const groundY = terrainHeightAt(ux, uz, terrainMap);
    const yLift = groundY + dims.h / 2 + 0.35;
    mesh.position.set(ux, yLift, uz);

    const face = facingDestination(u);
    if (face) {
      const dx = face.x - ux;
      const dz = face.z - uz;
      if (Math.abs(dx) + Math.abs(dz) > 0.4) {
        mesh.rotation.y = Math.atan2(dx, dz);
      }
    } else {
      mesh.rotation.y = 0;
    }
  }

  const buildingIds = new Set(state.buildings.map((b) => b.id));
  for (const id of options.buildingMeshes.keys()) {
    if (!buildingIds.has(id)) {
      const m = options.buildingMeshes.get(id)!;
      options.scene.remove(m);
      m.geometry.dispose();
      options.buildingMeshes.delete(id);
    }
  }

  for (const b of state.buildings) {
    let mesh = options.buildingMeshes.get(b.id);
    if (!mesh) {
      const geo = new THREE.BoxGeometry(options.buildingVisualSize, 26, options.buildingVisualSize);
      mesh = new THREE.Mesh(
        geo,
        b.owner === 'player' ? options.matBuildingPlayer : options.matBuildingEnemy
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      options.buildingMeshes.set(b.id, mesh);
      options.scene.add(mesh);
    }
    const bx = b.position.x + options.buildingVisualSize / 2;
    const bz = b.position.y + options.buildingVisualSize / 2;
    const bgY = terrainHeightAt(bx, bz, terrainMap);
    mesh.position.set(bx, bgY + 13, bz);
    mesh.material = b.owner === 'player' ? options.matBuildingPlayer : options.matBuildingEnemy;
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
      rx = building.position.x + options.buildingVisualSize / 2;
      rz = building.position.y + options.buildingVisualSize / 2;
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
