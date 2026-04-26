import type { GameState, GameUnit } from '../types/game';
import { AGES } from './ages';

const imageCache: Record<string, HTMLImageElement> = {};

function loadImage(src: string): HTMLImageElement | null {
  if (imageCache[src]) return imageCache[src];
  
  const img = new Image();
  img.src = src;
  imageCache[src] = img;
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// Preload all images
export function preloadImages(): void {
  const allImages: string[] = [];
  
  for (const age of AGES) {
    allImages.push(age.bgImage);
    allImages.push(age.castleImage);
    for (const unit of age.units) {
      allImages.push(unit.image);
    }
  }
  
  allImages.push('/assets/ui/title-bg.jpg');
  
  for (const src of allImages) {
    if (!imageCache[src]) {
      const img = new Image();
      img.src = src;
      imageCache[src] = img;
    }
  }
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save();
  const cullMargin = 120;
  const minX = -cullMargin;
  const maxX = canvasWidth + cullMargin;
  const minY = -cullMargin;
  const maxY = canvasHeight + cullMargin;
  
  // Screen shake
  if (state.shakeScreen > 0) {
    const amp = Math.pow(state.shakeScreen, 1.15) * 24;
    const shakeX = (Math.random() - 0.5) * amp;
    const shakeY = (Math.random() - 0.5) * amp;
    ctx.translate(shakeX, shakeY);
  }
  
  // Background
  drawBackground(ctx, state, canvasWidth, canvasHeight);
  
  // Ground line
  drawGround(ctx, canvasWidth, canvasHeight);
  
  // Castles
  drawCastle(ctx, state.playerCastle, state, canvasHeight, true);
  drawCastle(ctx, state.aiCastle, state, canvasHeight, false);
  
  // Units (sort by y for depth)
  const sortedUnits = [...state.units].sort((a, b) => a.y - b.y);
  for (const unit of sortedUnits) {
    if (unit.x < minX || unit.x > maxX || unit.y < minY || unit.y > maxY) continue;
    drawUnit(ctx, unit, state);
  }
  
  // Projectiles
  for (const proj of state.projectiles) {
    if (proj.x < minX || proj.x > maxX || proj.y < minY || proj.y > maxY) continue;
    drawProjectile(ctx, proj);
  }
  
  // Particles
  for (const p of state.particles) {
    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
    drawParticle(ctx, p);
  }

  // Floating texts (gold/reward/combat feedback)
  for (const ft of state.floatingTexts) {
    if (ft.x < minX || ft.x > maxX || ft.y < minY || ft.y > maxY) continue;
    drawFloatingText(ctx, ft);
  }
  
  // Age up animation
  if (state.ageUpAnim > 0) {
    drawAgeUpEffect(ctx, state, canvasWidth, canvasHeight);
  }
  
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  const age = state.playerAge;
  const bgImg = loadImage(AGES[age].bgImage);
  
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    // Draw background covering full canvas
    ctx.drawImage(bgImg, 0, 0, canvasWidth, canvasHeight);
  } else {
    // Fallback gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    
    const gradients = [
      ['#4A2511', '#8B4513', '#D4763A'],
      ['#2C5F8A', '#4A7FB5', '#87CEEB'],
      ['#2D3B1E', '#4A7A3F', '#8FBC8F'],
      ['#1A0A2E', '#4A1A6B', '#9B59B6'],
    ];
    
    const colors = gradients[age] || gradients[0];
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
}

function drawGround(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
  const groundY = canvasHeight - 80;
  
  // Ground gradient
  const gradient = ctx.createLinearGradient(0, groundY, 0, canvasHeight);
  gradient.addColorStop(0, '#5C4033');
  gradient.addColorStop(0.3, '#8B7355');
  gradient.addColorStop(1, '#A0522D');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);
  
  // Ground line
  ctx.strokeStyle = '#D4763A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvasWidth, groundY);
  ctx.stroke();
  
  // Grass/texture dots
  ctx.fillStyle = '#6B8E23';
  for (let i = 0; i < canvasWidth; i += 20) {
    const x = i + Math.sin(i * 0.1) * 5;
    ctx.fillRect(x, groundY - 3, 8, 4);
  }
}

function drawCastle(
  ctx: CanvasRenderingContext2D,
  castle: { x: number; health: number; maxHealth: number; age: number; isPlayer: boolean },
  _state: GameState,
  canvasHeight: number,
  isLeft: boolean
): void {
  const castleWidth = 120;
  const castleHeight = 140;
  const groundY = canvasHeight - 80;
  const castleY = groundY - castleHeight + 20;
  
  // Castle image
  const ageConfig = AGES[castle.age];
  const castleImg = loadImage(ageConfig.castleImage);
  
  ctx.save();
  
  if (isLeft) {
    // Player castle - normal
    if (castleImg && castleImg.complete && castleImg.naturalWidth > 0) {
      ctx.drawImage(castleImg, castle.x - castleWidth / 2, castleY, castleWidth, castleHeight);
    }
  } else {
    // AI castle - flipped
    if (castleImg && castleImg.complete && castleImg.naturalWidth > 0) {
      ctx.translate(castle.x + castleWidth / 2, castleY);
      ctx.scale(-1, 1);
      ctx.drawImage(castleImg, 0, 0, castleWidth, castleHeight);
    }
  }
  
  ctx.restore();
  
  // Health bar
  const barWidth = 100;
  const barHeight = 10;
  const barX = castle.x - barWidth / 2;
  const barY = castleY - 20;
  const healthPercent = castle.health / castle.maxHealth;
  const damageRatio = 1 - healthPercent;
  
  // Background
  ctx.fillStyle = '#333333';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  
  // Health
  const healthColor = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FFC107' : '#F44336';
  ctx.fillStyle = healthColor;
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  
  // Border
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  
  // Health text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(castle.health)}/${castle.maxHealth}`, castle.x, barY + 9);

  // Castle damage overlays (cracks + smoke) — stable positions (no per-frame RNG flicker).
  const dmgHash = (s: number) => {
    const t = Math.sin(s * 12.9898) * 43758.5453;
    return t - Math.floor(t);
  };
  if (damageRatio > 0.2) {
    ctx.save();
    const crackAlpha = Math.min(0.55, damageRatio * 0.72);
    ctx.strokeStyle = `rgba(35, 25, 20, ${crackAlpha})`;
    ctx.lineWidth = 1.2 + damageRatio * 1.8;
    const baseY = castleY + 26;
    const crackCount = Math.floor(2 + damageRatio * 7);
    for (let i = 0; i < crackCount; i++) {
      const seed = castle.x * 0.07 + i * 19.1 + damageRatio * 3;
      const offset = (i - 2) * 13 + (dmgHash(seed) - 0.5) * 5;
      const startX = castle.x + offset;
      const startY = baseY + i * 8;
      const j1 = dmgHash(seed + 1.1);
      const j2 = dmgHash(seed + 2.2);
      const j3 = dmgHash(seed + 3.3);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + (j1 - 0.5) * 16, startY + 12 + j2 * 10);
      ctx.lineTo(startX + (j3 - 0.5) * 14, startY + 22 + dmgHash(seed + 4.4) * 8);
      ctx.stroke();
    }

    if (damageRatio > 0.38) {
      const smokeAlpha = Math.min(0.42, (damageRatio - 0.3) * 0.75);
      ctx.fillStyle = `rgba(70, 68, 65, ${smokeAlpha})`;
      const puffCount = Math.floor(2 + damageRatio * 6);
      for (let i = 0; i < puffCount; i++) {
        const seed = castle.x * 0.11 + i * 23.7;
        const sx = castle.x + (dmgHash(seed) - 0.5) * 50;
        const sy = castleY + 10 + dmgHash(seed + 1.7) * 34;
        const sr = 6 + dmgHash(seed + 2.9) * 10;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: GameUnit, state: GameState): void {
  const deathElapsed = Math.max(0, state.time - unit.deathTime);
  if (unit.isDead) {
    // Fade out dead units with collapse animation.
    const alpha = Math.max(0, 1 - deathElapsed / 2.4);
    ctx.globalAlpha = alpha;
  }
  
  const ageConfig = AGES[unit.age];
  const unitStats = ageConfig.units[unit.type];
  const unitImg = loadImage(unitStats.image);
  
  const unitWidth = 50;
  const unitHeight = 50;
  
  ctx.save();
  ctx.translate(unit.x, unit.y);

  if (unit.isDead) {
    const deathProgress = Math.min(1, deathElapsed / 1.25);
    const fallDir = unit.isPlayer ? 1 : -1;
    ctx.translate(0, deathProgress * 12);
    ctx.rotate(deathProgress * fallDir * 0.95);
    const squash = 1 - deathProgress * 0.2;
    ctx.scale(Math.max(0.78, 1 + deathProgress * 0.12), Math.max(0.72, squash));
  }
  
  // Flip for AI units
  if (!unit.isPlayer) {
    ctx.scale(-1, 1);
  }
  
  // Attack animation - slight scale bounce
  if (unit.isAttacking) {
    const scale = 1 + Math.sin(unit.attackAnim) * 0.1;
    ctx.scale(scale, scale);
  }

  if (!unit.isPlayer && unit.aiStrategyTag) {
    const auraColor = unit.aiStrategyTag === 'aggressive'
      ? 'rgba(255,80,80,0.38)'
      : unit.aiStrategyTag === 'defensive'
        ? 'rgba(120,190,255,0.34)'
        : 'rgba(191,120,255,0.34)';
    const auraRadius = 20 + (unit.type === 2 ? 8 : unit.type === 3 ? 6 : 3);
    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, auraRadius);
    aura.addColorStop(0, auraColor);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw unit image
  if (unitImg && unitImg.complete && unitImg.naturalWidth > 0) {
    ctx.drawImage(unitImg, -unitWidth / 2, -unitHeight / 2, unitWidth, unitHeight);
  } else {
    // Fallback: colored circle
    ctx.fillStyle = unit.isPlayer ? '#4CAF50' : '#F44336';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
  
  // Health bar above unit
  if (!unit.isDead) {
    const barWidth = 40;
    const barHeight = 5;
    const barX = unit.x - barWidth / 2;
    const barY = unit.y - unitHeight / 2 - 10;
    const healthPercent = unit.health / unit.maxHealth;
    
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    const healthColor = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FFC107' : '#F44336';
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  }
  
  ctx.globalAlpha = 1;
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  proj: {
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    color: string;
    isPlayer: boolean;
    attackType: 'melee' | 'ranged' | 'tank' | 'siege';
  }
): void {
  ctx.save();

  // Trail style by projectile class.
  const trailWidth = proj.attackType === 'siege' ? 5.2 : proj.attackType === 'tank' ? 4.2 : 2.8;
  const coreRadius = proj.attackType === 'siege' ? 6 : proj.attackType === 'tank' ? 5 : 4;
  const innerRadius = proj.attackType === 'siege' ? 2.4 : 1.9;
  const trailStartAlpha = proj.attackType === 'ranged' ? 'rgba(255,255,255,0)' : 'rgba(255,220,180,0.05)';

  const trail = ctx.createLinearGradient(proj.prevX, proj.prevY, proj.x, proj.y);
  trail.addColorStop(0, trailStartAlpha);
  if (proj.attackType === 'ranged') trail.addColorStop(0.55, 'rgba(220,240,255,0.45)');
  if (proj.attackType === 'tank') trail.addColorStop(0.45, 'rgba(255,220,120,0.42)');
  if (proj.attackType === 'siege') trail.addColorStop(0.4, 'rgba(255,170,120,0.55)');
  trail.addColorStop(1, proj.color);
  ctx.strokeStyle = trail;
  ctx.lineWidth = trailWidth;
  if (proj.attackType === 'ranged') ctx.setLineDash([5, 4]);
  if (proj.attackType === 'tank') ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(proj.prevX, proj.prevY);
  ctx.lineTo(proj.x, proj.y);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Glow effect
  ctx.shadowColor = proj.color;
  ctx.shadowBlur = proj.attackType === 'siege' ? 16 : proj.attackType === 'tank' ? 13 : 9;
  
  ctx.fillStyle = proj.color;
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner bright core
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; life: number; maxLife: number; color: string; size: number; type: string }
): void {
  const alpha = p.life / p.maxLife;
  ctx.globalAlpha = alpha;
  
  if (p.type === 'spark') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'dust') {
    const radius = p.size * (0.65 + alpha * 0.7);
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(2, radius));
    grad.addColorStop(0, p.color);
    grad.addColorStop(1, 'rgba(120,100,80,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'levelup') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    // Star shape
    const spikes = 5;
    const outerRadius = p.size * alpha;
    const innerRadius = outerRadius * 0.5;
    
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const x = p.x + Math.cos(angle) * radius;
      const y = p.y + Math.sin(angle) * radius;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
}

function drawFloatingText(
  ctx: CanvasRenderingContext2D,
  ft: { x: number; y: number; text: string; color: string; life: number; maxLife: number; size: number }
): void {
  const alpha = Math.max(0, ft.life / ft.maxLife);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${ft.size}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3;
  ctx.strokeText(ft.text, ft.x, ft.y);
  ctx.fillStyle = ft.color;
  ctx.fillText(ft.text, ft.x, ft.y);
  ctx.restore();
}

function drawAgeUpEffect(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  const alpha = state.ageUpAnim;
  
  ctx.save();
  ctx.globalAlpha = alpha * 0.3;
  
  // Flash overlay
  const gradient = ctx.createRadialGradient(
    canvasWidth / 2, canvasHeight / 2, 0,
    canvasWidth / 2, canvasHeight / 2, canvasWidth
  );
  gradient.addColorStop(0, AGES[state.playerAge].themeColor);
  gradient.addColorStop(1, 'transparent');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(AGES[state.playerAge].name, canvasWidth / 2, canvasHeight / 2);
  
  ctx.font = '24px Arial';
  ctx.fillText(AGES[state.playerAge].era, canvasWidth / 2, canvasHeight / 2 + 40);
  
  ctx.restore();
}

export function drawMenuBackground(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
): void {
  const bgImg = loadImage('/assets/ui/title-bg.jpg');
  
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    ctx.drawImage(bgImg, 0, 0, canvasWidth, canvasHeight);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#0A0A0A');
    gradient.addColorStop(0.5, '#1A0A2E');
    gradient.addColorStop(1, '#0D1B2A');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  
  // Animated particles for menu
  const time = Date.now() / 1000;
  for (let i = 0; i < 30; i++) {
    const x = (Math.sin(time * 0.3 + i * 1.5) * 0.5 + 0.5) * canvasWidth;
    const y = (Math.cos(time * 0.2 + i * 2.1) * 0.5 + 0.5) * canvasHeight;
    const size = 2 + Math.sin(time + i) * 2;
    const alpha = 0.3 + Math.sin(time * 0.5 + i) * 0.2;
    
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FF6B35' : '#4ECDC4';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
