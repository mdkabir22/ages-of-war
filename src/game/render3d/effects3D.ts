import * as THREE from 'three';

interface ProjectileFx {
  group: any;
  startTime: number;
  duration: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  arcHeight: number;
  hitColor: number;
  spawnedHit: boolean;
  geometries: any[];
  materials: any[];
}

interface HitPuff {
  group: any;
  startTime: number;
  duration: number;
  particles: { mesh: any; vx: number; vy: number; vz: number }[];
  geometries: any[];
  materials: any[];
}

interface DeathFx {
  group: any;
  startTime: number;
  duration: number;
  geometries: any[];
  materials: any[];
}

interface AgeUpFx {
  mesh: any;
  startTime: number;
  duration: number;
  geometry: any;
  material: any;
}

export interface EffectsState {
  scene: any;
  projectiles: ProjectileFx[];
  hitPuffs: HitPuff[];
  deaths: DeathFx[];
  ageUp: AgeUpFx | null;
}

export function createEffectsState(scene: any): EffectsState {
  return {
    scene,
    projectiles: [],
    hitPuffs: [],
    deaths: [],
    ageUp: null,
  };
}

const PROJECTILE_DURATION_MS = 320;
const HIT_PUFF_DURATION_MS = 460;
const DEATH_DURATION_MS = 700;
const AGE_UP_DURATION_MS = 1500;

/** Spawn a small flying arrow/spear/cannonball from attacker to target. */
export function spawnProjectile(
  effects: EffectsState,
  unitType: 'villager' | 'warrior' | 'archer' | 'spearman' | 'cavalry',
  owner: 'player' | 'enemy',
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number
): void {
  const isRanged = unitType === 'archer';
  const isHeavy = unitType === 'cavalry';
  const teamColor = owner === 'player' ? 0xfde047 : 0xfb923c;
  const shaftColor = isRanged ? 0xeab308 : isHeavy ? 0x57534e : 0xa3a3a3;

  const group = new THREE.Group();
  const geometries: any[] = [];
  const materials: any[] = [];

  if (isRanged) {
    const shaftGeo = new THREE.CylinderGeometry(0.6, 0.6, 14, 6);
    const shaftMat = new THREE.MeshBasicMaterial({ color: shaftColor });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.z = Math.PI / 2;
    group.add(shaft);
    geometries.push(shaftGeo);
    materials.push(shaftMat);

    const tipGeo = new THREE.ConeGeometry(1.4, 3.4, 6);
    const tipMat = new THREE.MeshBasicMaterial({ color: teamColor });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 8;
    group.add(tip);
    geometries.push(tipGeo);
    materials.push(tipMat);
  } else {
    // Melee/cavalry - small "spark" sphere flying toward target.
    const sparkGeo = new THREE.SphereGeometry(2.6, 8, 6);
    const sparkMat = new THREE.MeshBasicMaterial({ color: teamColor });
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    group.add(spark);
    geometries.push(sparkGeo);
    materials.push(sparkMat);
  }

  group.position.set(fromX, fromY, fromZ);
  effects.scene.add(group);

  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);

  effects.projectiles.push({
    group,
    startTime: performance.now(),
    duration: Math.max(120, PROJECTILE_DURATION_MS * Math.min(1.2, dist / 220)),
    fromX,
    fromY,
    fromZ,
    toX,
    toY,
    toZ,
    arcHeight: isRanged ? Math.min(60, dist * 0.18) : 6,
    hitColor: owner === 'player' ? 0xfde047 : 0xfca5a5,
    spawnedHit: false,
    geometries,
    materials,
  });
}

/** Create a small explosion of particles at impact point. */
export function spawnHitPuff(
  effects: EffectsState,
  x: number,
  y: number,
  z: number,
  color: number
): void {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const particles: { mesh: any; vx: number; vy: number; vz: number }[] = [];
  const geometries: any[] = [];
  const materials: any[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(1.6 + Math.random() * 1.4, 6, 5);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const angle = (i / count) * Math.PI * 2;
    const speed = 30 + Math.random() * 25;
    particles.push({
      mesh,
      vx: Math.cos(angle) * speed,
      vy: 18 + Math.random() * 22,
      vz: Math.sin(angle) * speed,
    });
    group.add(mesh);
    geometries.push(geo);
    materials.push(mat);
  }
  effects.scene.add(group);

  effects.hitPuffs.push({
    group,
    startTime: performance.now(),
    duration: HIT_PUFF_DURATION_MS,
    particles,
    geometries,
    materials,
  });
}

/** Reuse an existing unit visual as a death ghost (fade + sink). */
export function spawnDeathFx(
  effects: EffectsState,
  group: any,
  geometries: any[],
  materials: any[]
): void {
  effects.deaths.push({
    group,
    startTime: performance.now(),
    duration: DEATH_DURATION_MS,
    geometries,
    materials,
  });
}

/** Briefly tint the sky/scene to celebrate an age advancement. */
export function spawnAgeUpFlash(effects: EffectsState, mapW: number, mapH: number): void {
  if (effects.ageUp) return;
  const geo = new THREE.PlaneGeometry(mapW * 1.4, mapH * 1.4);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfff4cc,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(mapW / 2, 220, mapH / 2);
  mesh.renderOrder = 50;
  effects.scene.add(mesh);
  effects.ageUp = {
    mesh,
    geometry: geo,
    material: mat,
    startTime: performance.now(),
    duration: AGE_UP_DURATION_MS,
  };
}

function disposeArrays(geos: any[], mats: any[]): void {
  for (const g of geos) g.dispose?.();
  for (const m of mats) m.dispose?.();
}

/** Step every active effect; remove ones whose lifetime expired. */
export function tickEffects(
  effects: EffectsState,
  now: number,
  onProjectileHit: (color: number, x: number, y: number, z: number) => void
): void {
  // Projectiles: lerp + arc, spawn hit puff at end.
  for (let i = effects.projectiles.length - 1; i >= 0; i--) {
    const p = effects.projectiles[i];
    const t = Math.min(1, (now - p.startTime) / p.duration);
    const x = p.fromX + (p.toX - p.fromX) * t;
    const z = p.fromZ + (p.toZ - p.fromZ) * t;
    const arc = Math.sin(Math.PI * t) * p.arcHeight;
    const y = p.fromY + (p.toY - p.fromY) * t + arc;
    p.group.position.set(x, y, z);
    const dx = p.toX - p.fromX;
    const dz = p.toZ - p.fromZ;
    if (Math.abs(dx) + Math.abs(dz) > 0.1) {
      p.group.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
    }
    if (t >= 1) {
      if (!p.spawnedHit) {
        onProjectileHit(p.hitColor, p.toX, p.toY, p.toZ);
        p.spawnedHit = true;
      }
      effects.scene.remove(p.group);
      disposeArrays(p.geometries, p.materials);
      effects.projectiles.splice(i, 1);
    }
  }

  // Hit puffs: scatter particles, fade out.
  for (let i = effects.hitPuffs.length - 1; i >= 0; i--) {
    const puff = effects.hitPuffs[i];
    const t = Math.min(1, (now - puff.startTime) / puff.duration);
    for (const part of puff.particles) {
      part.mesh.position.x = part.vx * t * 0.018;
      part.mesh.position.y = part.vy * t * 0.018 - t * t * 18;
      part.mesh.position.z = part.vz * t * 0.018;
      const mat = part.mesh.material as { opacity?: number };
      if (mat) mat.opacity = 0.95 * (1 - t);
    }
    if (t >= 1) {
      effects.scene.remove(puff.group);
      disposeArrays(puff.geometries, puff.materials);
      effects.hitPuffs.splice(i, 1);
    }
  }

  // Death ghosts: fade + topple + sink.
  for (let i = effects.deaths.length - 1; i >= 0; i--) {
    const d = effects.deaths[i];
    const t = Math.min(1, (now - d.startTime) / d.duration);
    d.group.rotation.z = (Math.PI / 2) * t * 0.85;
    d.group.position.y -= 0.18;
    for (const m of d.materials) {
      const mat = m as { transparent?: boolean; opacity?: number };
      mat.transparent = true;
      mat.opacity = Math.max(0, 1 - t);
    }
    if (t >= 1) {
      effects.scene.remove(d.group);
      disposeArrays(d.geometries, d.materials);
      effects.deaths.splice(i, 1);
    }
  }

  // Age-up: fade in then out.
  if (effects.ageUp) {
    const a = effects.ageUp;
    const t = Math.min(1, (now - a.startTime) / a.duration);
    const flash = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
    (a.material as { opacity?: number }).opacity = Math.max(0, 0.55 * flash);
    if (t >= 1) {
      effects.scene.remove(a.mesh);
      a.geometry.dispose?.();
      a.material.dispose?.();
      effects.ageUp = null;
    }
  }
}

export function disposeAllEffects(effects: EffectsState): void {
  for (const p of effects.projectiles) {
    effects.scene.remove(p.group);
    disposeArrays(p.geometries, p.materials);
  }
  for (const puff of effects.hitPuffs) {
    effects.scene.remove(puff.group);
    disposeArrays(puff.geometries, puff.materials);
  }
  for (const d of effects.deaths) {
    effects.scene.remove(d.group);
    disposeArrays(d.geometries, d.materials);
  }
  if (effects.ageUp) {
    effects.scene.remove(effects.ageUp.mesh);
    effects.ageUp.geometry.dispose?.();
    effects.ageUp.material.dispose?.();
  }
  effects.projectiles.length = 0;
  effects.hitPuffs.length = 0;
  effects.deaths.length = 0;
  effects.ageUp = null;
}
