// ATHENA™ Portrait — procedural wireframe canvas renderer
// Seeded point cloud + nearest-neighbour mesh; transparent background.
// Replaces static PNG: no masking, no dark-bg bleed, infinite resolution.

(function () {
  'use strict';

  const canvas = document.getElementById('mc2-athena-canvas');
  if (!canvas) return;

  // ── Canvas buffer (high-DPR) ────────────────────────────────────────────────
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const W = 530, H = 650;          // logical coordinate space
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  // CSS controls display size; these attrs set intrinsic aspect ratio.

  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // ── Seeded PRNG (mulberry32) — same result every page load ─────────────────
  let _s = 0x6D9F1B;
  function rng() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ── Head profile polygon (normalised 0-1, scaled to W×H) ───────────────────
  // Traces the ATHENA head silhouette: crown → face profile → chin →
  // neck → shoulder → back skull → ear bump → back crown → close.
  const OX = 0.065, OY = 0.025;    // left / top margin
  const NW  = 0.870, NH  = 0.950;  // usable width / height fraction

  const RAW = [
    [0.400, 0.030], // crown top
    [0.330, 0.060], // forehead upper
    [0.270, 0.105], // forehead
    [0.240, 0.155], // brow upper
    [0.213, 0.200], // brow ridge
    [0.205, 0.240], // orbital rim
    [0.200, 0.277], // eye level
    [0.197, 0.322], // nose bridge
    [0.185, 0.371], // nose mid
    [0.150, 0.400], // nose tip  ← furthest forward point
    [0.162, 0.430], // philtrum
    [0.162, 0.452], // upper lip
    [0.153, 0.468], // lip peak
    [0.165, 0.490], // lower lip
    [0.188, 0.520], // chin
    [0.200, 0.553], // chin lower
    [0.326, 0.608], // jaw angle
    [0.370, 0.625], // jaw back
    [0.337, 0.663], // neck front upper
    [0.312, 0.700], // neck front
    [0.290, 0.760], // neck lower front
    [0.252, 0.858], // chest
    [0.655, 0.893], // shoulder mid
    [0.730, 0.863], // shoulder back
    [0.605, 0.780], // back neck lower
    [0.565, 0.720], // back neck upper
    // ── ear protrusion (right side, ~35-49% height) ────────────────────────
    [0.582, 0.490], // below ear — rejoins skull
    [0.633, 0.460], // ear lower right
    [0.658, 0.395], // ear tip (furthest right)
    [0.638, 0.352], // ear upper right
    [0.555, 0.342], // ear top inner
    // ── back to skull above ear ────────────────────────────────────────────
    [0.708, 0.338], // skull above ear
    [0.718, 0.292], // skull upper back
    [0.684, 0.172], // skull back upper
    [0.658, 0.092], // occipital
    [0.622, 0.055], // crown back
  ];

  const POLY = RAW.map(([nx, ny]) => [
    (OX + nx * NW) * W,
    (OY + ny * NH) * H,
  ]);

  // ── Point-in-polygon (ray casting) ─────────────────────────────────────────
  function pip(px, py) {
    let inside = false;
    for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
      const [xi, yi] = POLY[i], [xj, yj] = POLY[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }

  // Bounding box for rejection sampling
  const bMinX = Math.min(...POLY.map(p => p[0]));
  const bMaxX = Math.max(...POLY.map(p => p[0]));
  const bMinY = Math.min(...POLY.map(p => p[1]));
  const bMaxY = Math.max(...POLY.map(p => p[1]));
  const bW = bMaxX - bMinX, bH = bMaxY - bMinY;

  // ── Point cloud: non-uniform density (denser on face/left side) ────────────
  const N_PTS = 620;
  const pts = [];
  let tries = 0;
  while (pts.length < N_PTS && tries < 120000) {
    tries++;
    const x = bMinX + rng() * bW;
    const y = bMinY + rng() * bH;
    const nx = (x - bMinX) / bW;           // 0 = face left, 1 = skull right
    const density = 0.38 + 0.62 * (1 - nx);// 1.0 on face, 0.38 on back
    if (pip(x, y) && rng() < density) pts.push({ x, y });
  }

  // ── Visual helpers ──────────────────────────────────────────────────────────

  // Brightness: bright on face (left), dim on back-of-skull (right)
  function faceBright(x) {
    return Math.max(0.17, 1.0 - ((x - bMinX) / bW) * 0.80);
  }

  // Signed distance from point to nearest polygon segment
  function distToEdge(px, py) {
    let min = Infinity;
    for (let i = 0; i < POLY.length; i++) {
      const j = (i + 1) % POLY.length;
      const [ax, ay] = POLY[i], [bx, by] = POLY[j];
      const dx = bx - ax, dy = by - ay;
      const lsq = dx * dx + dy * dy;
      if (!lsq) continue;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lsq));
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d < min) min = d;
    }
    return min;
  }

  // ── Pre-compute per-point visual properties ─────────────────────────────────
  pts.forEach(p => {
    const fb  = faceBright(p.x);
    const ed  = distToEdge(p.x, p.y);
    const rim = ed < 42 ? (1 - ed / 42) * 0.55 : 0;
    p.b = Math.min(1.0, fb + rim);
    p.r = 0.65 + rng() * 2.3 * p.b;   // dot radius, seeded → deterministic
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, W, H);

  // 1. Mesh connections
  const CONN_DIST = 72;
  ctx.lineWidth = 0.45;
  for (let i = 0; i < pts.length; i++) {
    const { x: xi, y: yi, b: bi } = pts[i];
    for (let j = i + 1; j < pts.length; j++) {
      const { x: xj, y: yj, b: bj } = pts[j];
      const dx = xi - xj, dy = yi - yj;
      if (Math.abs(dx) > CONN_DIST || Math.abs(dy) > CONN_DIST) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= CONN_DIST) continue;
      const b = Math.min(bi, bj);
      const a = (b * 0.44 * (1 - dist / CONN_DIST)).toFixed(3);
      ctx.strokeStyle = `rgba(110,35,190,${a})`;
      ctx.beginPath();
      ctx.moveTo(xi, yi);
      ctx.lineTo(xj, yj);
      ctx.stroke();
    }
  }

  // 2. Dots with radial glow
  for (const { x, y, b, r } of pts) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
    g.addColorStop(0, `rgba(182,88,255,${(b * 0.62).toFixed(3)})`);
    g.addColorStop(1, 'rgba(182,88,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(228,162,255,${b.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Left-profile rim light (face edge, polygon indices 0-15)
  // Two passes: tight bright line + broader ambient halo
  const profileLeft = POLY.slice(0, 16);
  for (const [lw, blur, alpha] of [[1.6, 18, 0.90], [3.5, 42, 0.38]]) {
    ctx.save();
    ctx.shadowColor  = `rgba(190,80,255,${alpha})`;
    ctx.shadowBlur   = blur;
    ctx.strokeStyle  = `rgba(212,108,255,${alpha})`;
    ctx.lineWidth    = lw;
    ctx.lineJoin     = 'round';
    ctx.lineCap      = 'round';
    ctx.beginPath();
    ctx.moveTo(profileLeft[0][0], profileLeft[0][1]);
    for (let i = 1; i < profileLeft.length; i++)
      ctx.lineTo(profileLeft[i][0], profileLeft[i][1]);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Eye — bright focal glow
  const eyeX = (OX + 0.200 * NW) * W;
  const eyeY = (OY + 0.277 * NH) * H;
  ctx.save();
  ctx.shadowColor = 'rgba(255,210,255,1)';
  ctx.shadowBlur  = 28;
  const eg = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 15);
  eg.addColorStop(0,    'rgba(255,235,255,1)');
  eg.addColorStop(0.30, 'rgba(215,130,255,0.88)');
  eg.addColorStop(1,    'rgba(160,55,255,0)');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

}());
