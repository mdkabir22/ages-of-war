import { type AnimationState, UNIT_ANIMATIONS } from '../../types/animation';

export interface AnimatedUnit {
  currentAnim: AnimationState;
  frameIndex: number;
  frameTimer: number;
  facingRight: boolean;
}

export function updateAnimation(unit: AnimatedUnit, dt: number): void {
  const anim = UNIT_ANIMATIONS.default[unit.currentAnim];
  unit.frameTimer += dt;
  if (unit.frameTimer < anim.frameDuration) return;
  unit.frameTimer = 0;
  unit.frameIndex += 1;
  if (unit.frameIndex >= anim.frameCount) {
    unit.frameIndex = anim.loop ? 0 : anim.frameCount - 1;
  }
}

export function setAnimation(unit: AnimatedUnit, state: AnimationState): void {
  if (unit.currentAnim === state) return;
  unit.currentAnim = state;
  unit.frameIndex = 0;
  unit.frameTimer = 0;
}

export function deriveAnimationState(unit: {
  hp: number;
  target?: { x: number; y: number };
  lastAttackTime: number;
  type: string;
}): AnimationState {
  if (unit.hp <= 0) return 'death';
  if (Date.now() - unit.lastAttackTime < 260) return 'attack';
  if (unit.type === 'villager' && unit.target) return 'gather';
  if (unit.target) return 'walk';
  return 'idle';
}
