import type { GameState } from '../../core/types';
import { deriveAnimationState, setAnimation, updateAnimation, type AnimatedUnit } from '../systems/animation';

const FOG_TILE_SIZE = 40;

export function drawUnitsLayer(
  ctx: CanvasRenderingContext2D,
  renderState: Pick<GameState, 'units' | 'fog' | 'selectedIds'>,
  unitAnimations: Map<string, AnimatedUnit>,
  dt: number
): void {
  renderState.units.forEach((u) => {
    if (u.owner === 'enemy') {
      const tx = Math.floor((u.position.x + 16) / FOG_TILE_SIZE);
      const ty = Math.floor((u.position.y + 16) / FOG_TILE_SIZE);
      const { width, height, tiles } = renderState.fog;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) return;
      if (tiles[ty * width + tx] !== 2) return;
    }

    let anim = unitAnimations.get(u.id);
    if (!anim) {
      anim = { currentAnim: 'idle', frameIndex: 0, frameTimer: 0, facingRight: true };
      unitAnimations.set(u.id, anim);
    }
    const desiredState = deriveAnimationState(u);
    setAnimation(anim, desiredState);
    updateAnimation(anim, dt);
    if (u.target) anim.facingRight = u.target.x >= u.position.x;

    const isSelected = renderState.selectedIds.includes(u.id);
    const cx = u.position.x + 16;
    const cy = u.position.y + 16;
    const facing = anim.facingRight ? 1 : -1;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 14, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);

    const walkBob = anim.currentAnim === 'walk' ? Math.sin(anim.frameIndex * Math.PI) * 2.5 : 0;
    const attackLunge = anim.currentAnim === 'attack' && anim.frameIndex === 1 ? 4 * facing : 0;
    const gatherSwing = anim.currentAnim === 'gather' ? Math.sin(performance.now() * 0.008) * 0.3 : 0;

    ctx.translate(attackLunge, walkBob);

    const teamPrimary = u.owner === 'player' ? '#2563eb' : '#dc2626';
    const teamLight = u.owner === 'player' ? '#60a5fa' : '#f87171';
    const teamDark = u.owner === 'player' ? '#1e3a8a' : '#991b1b';

    if (u.type === 'villager') {
      ctx.fillStyle = '#d4a373';
      ctx.fillRect(-7, -4, 14, 14);
      ctx.strokeStyle = teamPrimary;
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -4, 14, 14);
      ctx.fillStyle = teamPrimary;
      ctx.fillRect(-7, 4, 14, 3);
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(0, -10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(0, -12, 7, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-2 * facing, -10, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(10 * facing, 2);
      ctx.rotate(gatherSwing + (facing === -1 ? Math.PI : 0));
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-1, -8, 2, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-1, -8);
      ctx.lineTo(6, -10);
      ctx.lineTo(5, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (u.type === 'warrior') {
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(-9, -6);
      ctx.lineTo(9, -6);
      ctx.lineTo(7, 12);
      ctx.lineTo(-7, 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = teamLight;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = teamPrimary;
      ctx.fillRect(-4, -2, 8, 8);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, -12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = teamPrimary;
      ctx.fillRect(-2, -22, 4, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4 * facing, -13, 5 * facing, 2);
      ctx.fillStyle = teamDark;
      ctx.beginPath();
      ctx.moveTo(-12 * facing, 0);
      ctx.lineTo(-6 * facing, -6);
      ctx.lineTo(-6 * facing, 10);
      ctx.lineTo(-12 * facing, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.translate(10 * facing, 0);
      ctx.rotate(anim.currentAnim === 'attack' && anim.frameIndex === 1 ? -0.8 * facing : -0.2 * facing);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-1, -14, 2, 18);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-3, 2, 6, 2);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -16, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (u.type === 'archer') {
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(-6, -4, 12, 14);
      ctx.strokeStyle = teamPrimary;
      ctx.lineWidth = 2;
      ctx.strokeRect(-6, -4, 12, 14);
      ctx.fillStyle = '#3f6212';
      ctx.beginPath();
      ctx.arc(0, -10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(0, -9, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(2 * facing, -9, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(-8 * facing, 0);
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(anim.currentAnim === 'attack' ? 8 * facing : 0, 0);
      ctx.lineTo(0, 12);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#92400e';
      ctx.fillRect(6 * facing, -8, 4, 12);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(8 * facing, -10, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (u.type === 'spearman') {
      ctx.fillStyle = '#78716c';
      ctx.fillRect(-7, -4, 14, 14);
      ctx.strokeStyle = teamPrimary;
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -4, 14, 14);
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(0, -10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.arc(0, -11, 7, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = teamPrimary;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-3, -14);
      ctx.lineTo(3, -14);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.translate(10 * facing, -4);
      ctx.rotate(anim.currentAnim === 'attack' && anim.frameIndex === 1 ? -0.5 * facing : -0.1 * facing);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-1, -22, 2, 32);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-3, -22);
      ctx.lineTo(3, -22);
      ctx.lineTo(0, -30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = teamDark;
      ctx.beginPath();
      ctx.arc(-10 * facing, 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (u.type === 'cavalry') {
      ctx.fillStyle = '#57534e';
      ctx.fillRect(-14, 0, 28, 12);
      ctx.beginPath();
      ctx.moveTo(14 * facing, 2);
      ctx.lineTo(22 * facing, -4);
      ctx.lineTo(22 * facing, 6);
      ctx.lineTo(14 * facing, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#44403c';
      ctx.fillRect(-10, 10, 4, 8);
      ctx.fillRect(-2, 10, 4, 8);
      ctx.fillRect(6, 10, 4, 8);
      ctx.fillRect(12, 10, 4, 8);
      ctx.fillStyle = teamPrimary;
      ctx.fillRect(-6, -12, 12, 12);
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(0, -18, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, -19, 6, Math.PI, 0);
      ctx.fill();
      ctx.save();
      ctx.translate(8 * facing, -6);
      ctx.rotate(-0.3 * facing);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-1, -10, 2, 14);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -12, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    const hpPct = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp)));
    const barW = 32;
    const barH = 4;
    const barX = cx - barW / 2;
    const barY = u.position.y - 14;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = hpPct > 0.6 ? '#22c55e' : hpPct > 0.3 ? '#eab308' : '#ef4444';
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    if (anim.currentAnim === 'attack' && anim.frameIndex === 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  const activeIds = new Set(renderState.units.map((u) => u.id));
  for (const key of unitAnimations.keys()) {
    if (!activeIds.has(key)) unitAnimations.delete(key);
  }
}
