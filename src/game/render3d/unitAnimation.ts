import type { Unit } from '../../core/types';

export interface UnitAnimState {
  prevX: number;
  prevZ: number;
  walkPhase: number;
  prevAttackTime: number;
  attackFlashUntil: number;
}

export function createUnitAnimState(u: Unit): UnitAnimState {
  return {
    prevX: u.position.x,
    prevZ: u.position.y,
    walkPhase: 0,
    prevAttackTime: u.lastAttackTime ?? 0,
    attackFlashUntil: 0,
  };
}

const ATTACK_FLASH_MS = 220;

/**
 * Apply per-frame visual animations for a single unit.
 * Returns whether a fresh attack was detected (caller can dispatch FX).
 */
export function applyUnitAnimation(
  u: Unit,
  anim: UnitAnimState,
  body: any,
  head: any,
  banner: any,
  group: any,
  now: number,
  dt: number
): { attacked: boolean } {
  const ux = u.position.x;
  const uz = u.position.y;
  const dx = ux - anim.prevX;
  const dz = uz - anim.prevZ;
  const speedSq = dx * dx + dz * dz;
  const moving = speedSq > 0.0009; // ~0.03 units / frame threshold

  if (moving) {
    anim.walkPhase += dt * 12;
  } else {
    // Idle sway, slower so units feel alive when standing.
    anim.walkPhase += dt * 1.2;
  }
  anim.prevX = ux;
  anim.prevZ = uz;

  // Body bob — sinusoidal vertical hop & gentle lean.
  const bobAmp = moving ? 1.4 : 0.18;
  const bob = Math.sin(anim.walkPhase * 1.4) * bobAmp;
  body.position.y = (body.userData?.baseY ?? body.position.y) + bob;
  if (head) {
    const headBaseY = head.userData?.baseY ?? head.position.y;
    head.position.y = headBaseY + bob * 0.85;
  }
  // Tiny side-to-side roll while walking.
  group.rotation.z = moving ? Math.sin(anim.walkPhase) * 0.05 : 0;

  // Attack detection — when lastAttackTime jumps forward.
  const lastAttack = u.lastAttackTime ?? 0;
  let attacked = false;
  if (lastAttack > anim.prevAttackTime + 50) {
    anim.attackFlashUntil = now + ATTACK_FLASH_MS;
    attacked = true;
  }
  anim.prevAttackTime = lastAttack;

  // Attack pulse — banner glows + head bobs forward.
  const flashRemaining = Math.max(0, anim.attackFlashUntil - now);
  if (flashRemaining > 0 && banner) {
    const k = flashRemaining / ATTACK_FLASH_MS;
    const bMat = banner.material as { color?: { setHex?: (n: number) => void } };
    if (bMat.color?.setHex) {
      bMat.color.setHex(k > 0.5 ? 0xfffacc : 0xfde047);
    }
    if (head) {
      head.position.z = (head.userData?.baseZ ?? 0) + k * 2.8;
    }
  } else if (banner) {
    const bMat = banner.material as { color?: { setHex?: (n: number) => void } };
    if (bMat.color?.setHex) {
      bMat.color.setHex(u.owner === 'player' ? 0x60a5fa : 0xfca5a5);
    }
    if (head) {
      head.position.z = head.userData?.baseZ ?? 0;
    }
  }

  return { attacked };
}

/** Snapshot the body/head Y so animation deltas stay stable across frames. */
export function rememberBaseTransforms(body: any, head: any): void {
  if (body) {
    body.userData = body.userData || {};
    body.userData.baseY = body.position.y;
  }
  if (head) {
    head.userData = head.userData || {};
    head.userData.baseY = head.position.y;
    head.userData.baseZ = head.position.z;
  }
}
