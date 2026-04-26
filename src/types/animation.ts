export type AnimationState = 'idle' | 'walk' | 'attack' | 'death' | 'gather';

export interface SpriteAnimation {
  state: AnimationState;
  frameCount: number;
  frameDuration: number;
  loop: boolean;
}

export const UNIT_ANIMATIONS: Record<string, Record<AnimationState, SpriteAnimation>> = {
  default: {
    idle: { state: 'idle', frameCount: 2, frameDuration: 0.5, loop: true },
    walk: { state: 'walk', frameCount: 4, frameDuration: 0.15, loop: true },
    attack: { state: 'attack', frameCount: 3, frameDuration: 0.12, loop: false },
    death: { state: 'death', frameCount: 1, frameDuration: 1, loop: false },
    gather: { state: 'gather', frameCount: 3, frameDuration: 0.2, loop: true },
  },
};
