import type { Castle, GameState, GameUnit } from '../../types/game';

const PARTICLE_POOL_LIMIT = 600;
const PROJECTILE_POOL_LIMIT = 220;
const FLOATING_TEXT_POOL_LIMIT = 120;
const particlePool: GameState['particles'] = [];
const projectilePool: GameState['projectiles'] = [];
const floatingTextPool: GameState['floatingTexts'] = [];

export function allocParticle(
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  color: string,
  size: number,
  type: 'blood' | 'explosion' | 'spark' | 'levelup' | 'coin' | 'dust'
): GameState['particles'][number] {
  const p = particlePool.pop();
  if (p) {
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.color = color;
    p.size = size;
    p.type = type;
    return p;
  }
  return { x, y, vx, vy, life, maxLife: life, color, size, type };
}

export function recycleParticle(p: GameState['particles'][number]): void {
  if (particlePool.length < PARTICLE_POOL_LIMIT) particlePool.push(p);
}

export function allocProjectile(
  x: number,
  y: number,
  targetX: number,
  targetY: number,
  speed: number,
  damage: number,
  color: string,
  isPlayer: boolean,
  attackType: 'melee' | 'ranged' | 'tank' | 'siege'
): GameState['projectiles'][number] {
  const proj = projectilePool.pop();
  if (proj) {
    proj.x = x;
    proj.y = y;
    proj.prevX = x;
    proj.prevY = y;
    proj.targetX = targetX;
    proj.targetY = targetY;
    proj.speed = speed;
    proj.damage = damage;
    proj.color = color;
    proj.isPlayer = isPlayer;
    proj.attackType = attackType;
    return proj;
  }
  return { x, y, prevX: x, prevY: y, targetX, targetY, speed, damage, color, isPlayer, attackType };
}

export function recycleProjectile(proj: GameState['projectiles'][number]): void {
  if (projectilePool.length < PROJECTILE_POOL_LIMIT) projectilePool.push(proj);
}

function allocFloatingText(
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
  life: number
): GameState['floatingTexts'][number] {
  const ft = floatingTextPool.pop();
  if (ft) {
    ft.text = text;
    ft.x = x;
    ft.y = y;
    ft.color = color;
    ft.size = size;
    ft.life = life;
    ft.maxLife = life;
    return ft;
  }
  return { text, x, y, color, size, life, maxLife: life };
}

export function recycleFloatingText(ft: GameState['floatingTexts'][number]): void {
  if (floatingTextPool.length < FLOATING_TEXT_POOL_LIMIT) floatingTextPool.push(ft);
}

export function addFloatingText(
  state: GameState,
  text: string,
  x: number,
  y: number,
  color = '#FFD76A',
  size = 18,
  life = 1.2
): void {
  state.floatingTexts.push(allocFloatingText(text, x, y, color, size, life));
}

export function applyCameraShake(state: GameState, intensity: number): void {
  state.shakeScreen = Math.max(state.shakeScreen, Math.min(1, intensity));
}

export function emitRadialParticles(
  state: GameState,
  x: number,
  y: number,
  count: number,
  color: string,
  type: 'blood' | 'explosion' | 'spark' | 'dust',
  speedMin: number,
  speedMax: number,
  lifeMin: number,
  lifeMax: number,
  sizeMin: number,
  sizeMax: number
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const life = lifeMin + Math.random() * (lifeMax - lifeMin);
    state.particles.push(
      allocParticle(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 12,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - Math.random() * 50,
        life,
        color,
        sizeMin + Math.random() * (sizeMax - sizeMin),
        type
      )
    );
  }
}

export function emitUnitHitEffect(state: GameState, target: GameUnit, heavy = false): void {
  const burst = heavy ? 10 : 6;
  emitRadialParticles(state, target.x, target.y, burst, '#FF5A5A', 'blood', 35, 95, 0.28, 0.56, 1.8, 3.4);
  emitRadialParticles(state, target.x, target.y, Math.ceil(burst * 0.75), '#FFD2A0', 'spark', 45, 130, 0.18, 0.4, 1.2, 2.4);
}

export function emitCastleImpactEffect(state: GameState, castle: Castle, y: number, damage: number): void {
  const dustCount = Math.max(8, Math.min(24, Math.floor(damage / 14)));
  const sparkCount = Math.max(4, Math.min(16, Math.floor(damage / 22)));
  const debrisCount = Math.max(2, Math.min(10, Math.floor(damage / 35)));
  emitRadialParticles(state, castle.x, y, dustCount, '#B48A64', 'dust', 25, 90, 0.4, 0.95, 2.8, 6);
  emitRadialParticles(state, castle.x, y, sparkCount, '#FF9A52', 'spark', 35, 115, 0.25, 0.6, 1.8, 3.6);
  emitRadialParticles(state, castle.x, y + 6, debrisCount, '#4A3A32', 'explosion', 40, 125, 0.5, 1.05, 3.2, 6.5);
}

export function updateParticles(state: GameState, dt: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.type === 'dust' ? 35 : 100) * dt;
    if (p.type === 'dust') {
      p.vx *= 0.985;
    }
    p.life -= dt;
    if (p.life <= 0) {
      recycleParticle(p);
      state.particles.splice(i, 1);
    }
  }
}

export function updateFloatingTexts(state: GameState, dt: number): void {
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y -= 32 * dt;
    ft.life -= dt;
    if (ft.life <= 0) {
      recycleFloatingText(ft);
      state.floatingTexts.splice(i, 1);
    }
  }
}
