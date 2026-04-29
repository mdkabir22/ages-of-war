import type { Building } from '../../core/types';

export function drawBuildingsLayer(
  ctx: CanvasRenderingContext2D,
  buildings: Building[],
  selectedIds: string[]
): void {
  buildings.forEach((b) => {
    const size = 42;
    const isSelected = selectedIds.includes(b.id);
    const cx = b.position.x + size / 2;

    if (isSelected) {
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.position.x - 4, b.position.y - 4, size + 8, size + 8);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, b.position.y + size + 3, size * 0.6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();

    if (b.type === 'townCenter') {
      ctx.fillStyle = b.owner === 'player' ? '#475569' : '#7f1d1d';
      ctx.fillRect(b.position.x + 4, b.position.y + 12, size - 8, size - 12);
      ctx.fillStyle = b.owner === 'player' ? '#334155' : '#991b1b';
      ctx.fillRect(b.position.x, b.position.y, 10, 20);
      ctx.fillRect(b.position.x + size - 10, b.position.y, 10, 20);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, b.position.y);
      ctx.lineTo(cx, b.position.y - 14);
      ctx.stroke();
      ctx.fillStyle = b.owner === 'player' ? '#3b82f6' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(cx, b.position.y - 14);
      ctx.lineTo(cx + 10, b.position.y - 10);
      ctx.lineTo(cx, b.position.y - 6);
      ctx.fill();
    } else if (b.type === 'house') {
      ctx.fillStyle = '#d4a373';
      ctx.fillRect(b.position.x + 6, b.position.y + 16, size - 12, size - 16);
      ctx.fillStyle = b.owner === 'player' ? '#3b82f6' : '#ef4444';
      ctx.beginPath();
      ctx.moveTo(b.position.x, b.position.y + 16);
      ctx.lineTo(cx, b.position.y);
      ctx.lineTo(b.position.x + size, b.position.y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(cx - 5, b.position.y + 26, 10, 16);
    } else if (b.type === 'farm') {
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(b.position.x + 2, b.position.y + 18, size - 4, size - 18);
      ctx.fillStyle = '#84cc16';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(b.position.x + 6, b.position.y + 22 + i * 7, size - 12, 3);
      }
      ctx.fillStyle = '#92400e';
      ctx.fillRect(cx - 1, b.position.y + 6, 2, 14);
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.arc(cx, b.position.y + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'mine') {
      ctx.fillStyle = '#57534e';
      ctx.fillRect(b.position.x + 2, b.position.y + 10, size - 4, size - 10);
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(cx, b.position.y + 28, 12, 0, Math.PI, false);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx - 6, b.position.y + 20, 2, 0, Math.PI * 2);
      ctx.arc(cx + 8, b.position.y + 24, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'lumber_camp') {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(b.position.x + 4, b.position.y + 20, size - 8, 6);
      ctx.fillRect(b.position.x + 8, b.position.y + 14, size - 16, 6);
      ctx.fillRect(b.position.x + 6, b.position.y + 26, size - 12, 6);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(cx - 1, b.position.y + 8, 2, 12);
      ctx.beginPath();
      ctx.moveTo(cx - 6, b.position.y + 8);
      ctx.lineTo(cx + 6, b.position.y + 8);
      ctx.lineTo(cx, b.position.y + 4);
      ctx.fill();
    } else if (b.type === 'mill') {
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(b.position.x + 10, b.position.y + 18, size - 20, size - 18);
      ctx.save();
      ctx.translate(cx, b.position.y + 14);
      ctx.rotate(performance.now() * 0.002);
      ctx.fillStyle = '#fcd34d';
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillRect(-2, -12, 4, 12);
      }
      ctx.restore();
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.arc(cx, b.position.y + 14, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'barracks') {
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(b.position.x, b.position.y + size);
      ctx.lineTo(cx, b.position.y + 4);
      ctx.lineTo(b.position.x + size, b.position.y + size);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = b.owner === 'player' ? '#3b82f6' : '#ef4444';
      ctx.fillRect(cx - 3, b.position.y + 12, 6, 14);
    } else {
      ctx.fillStyle = b.owner === 'player' ? '#1e40af' : '#991b1b';
      ctx.fillRect(b.position.x, b.position.y, size, size);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = b.owner === 'player' ? '#60a5fa' : '#f87171';
    ctx.strokeRect(b.position.x, b.position.y, size, size);

    const hpPct = Math.max(0, Math.min(1, b.hp / Math.max(1, b.maxHp)));
    const barW = size;
    const barH = 5;
    const barY = b.position.y - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(b.position.x, barY, barW, barH);
    ctx.fillStyle = hpPct > 0.6 ? '#22c55e' : hpPct > 0.3 ? '#eab308' : '#ef4444';
    ctx.fillRect(b.position.x + 1, barY + 1, (barW - 2) * hpPct, barH - 2);

    ctx.restore();
  });
}
