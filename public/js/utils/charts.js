// Canvas chart drawing — revenue trend on Dashboard, score trend on Monitoring.
// Hand-drawn (no chart library) so we have zero runtime dependencies.
// [Polish candidate] swap to Chart.js or Recharts later for richer interactivity.
import { $ } from './dom.js';
import { REVENUE_TREND } from '../data/revenueTrend.js';

export function drawRevenueChart() {
  const canvas = $('#revenueChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 40, padR = 16, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...REVENUE_TREND.map(d => d.value)) * 1.1;
  const min = 0;

  // Gridlines + Y labels
  ctx.fillStyle = '#6b6b78';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = min + (max - min) * (i / yTicks);
    const y = padT + innerH - (yVal / max) * innerH;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillText('$' + (yVal >= 1000 ? (yVal/1000).toFixed(0)+'K' : Math.round(yVal)), padL - 6, y + 4);
  }

  // X labels
  ctx.textAlign = 'center';
  REVENUE_TREND.forEach((d, i) => {
    const x = padL + (innerW * i) / (REVENUE_TREND.length - 1);
    ctx.fillText(d.month, x, H - 8);
  });

  // Area gradient
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
  grad.addColorStop(1, 'rgba(139, 92, 246, 0)');

  ctx.beginPath();
  REVENUE_TREND.forEach((d, i) => {
    const x = padL + (innerW * i) / (REVENUE_TREND.length - 1);
    const y = padT + innerH - (d.value / max) * innerH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(padL + innerW, H - padB);
  ctx.lineTo(padL, H - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  REVENUE_TREND.forEach((d, i) => {
    const x = padL + (innerW * i) / (REVENUE_TREND.length - 1);
    const y = padT + innerH - (d.value / max) * innerH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Endpoint dot
  const last = REVENUE_TREND[REVENUE_TREND.length - 1];
  const lx = padL + innerW;
  const ly = padT + innerH - (last.value / max) * innerH;
  ctx.beginPath();
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#8b5cf6';
  ctx.fill();
}

export function drawTrendChart() {
  const canvas = $('#trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width, H = rect.height;
  const data = [62, 64, 66, 68, 70, 70, 72, 72];
  const padL = 30, padR = 12, padT = 10, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  ctx.beginPath();
  data.forEach((v, i) => {
    const x = padL + (innerW * i) / (data.length - 1);
    const y = padT + innerH - ((v - 50) / 50) * innerH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.fillStyle = '#6b6b78';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ['8w', '6w', '4w', '2w', 'now'].forEach((lbl, i) => {
    const x = padL + (innerW * i) / 4;
    ctx.fillText(lbl, x, H - 6);
  });
}
