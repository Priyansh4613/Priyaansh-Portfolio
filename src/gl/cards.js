// Draws each project card face onto a 2D canvas. The canvases become WebGL
// textures for the ring, and DOM fallbacks when WebGL is unavailable.

import { ACCENTS } from '../data.js';

export const CARD_W = 720;
export const CARD_H = 1000;
const PAD = 48;
const BONE = '#F1EEE8';
const ASH = '#8C8A85';
const FAMILY = '"Archivo X", "Arial Black", Arial, sans-serif';

function font(ctx, weight, stretch, size) {
  ctx.font = `${weight} ${stretch} ${size}px ${FAMILY}`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch;
}

function rand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function fitTitle(ctx, text, maxW, maxLines) {
  for (let size = 66; size >= 30; size -= 2) {
    font(ctx, 900, 'expanded', size);
    const lines = wrap(ctx, text, maxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= maxLines && widest <= maxW) return { size, lines };
  }
  font(ctx, 900, 'expanded', 30);
  return { size: 30, lines: wrap(ctx, text, maxW) };
}

/* ---------------------------------------------------------------- art */

const ART = {
  graph(ctx, x, y, w, h, A) {
    // The SLA auditor pipeline: linear intake, a judge, a three-way split, merge, report.
    const cy = y + h / 2;
    const cols = [0.06, 0.2, 0.34, 0.5, 0.68, 0.82, 0.95].map((f) => x + f * w);
    const nodes = [
      { x: cols[0], y: cy, ai: false },
      { x: cols[1], y: cy, ai: true },
      { x: cols[2], y: cy, ai: false },
      { x: cols[3], y: cy - h * 0.18, ai: true },
      { x: cols[4], y: cy - h * 0.3, ai: true },
      { x: cols[4], y: cy, ai: false },
      { x: cols[4], y: cy + h * 0.3, ai: true },
      { x: cols[5], y: cy + h * 0.06, ai: false },
      { x: cols[6], y: cy + h * 0.06, ai: false },
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7], [7, 8]];
    ctx.lineWidth = 2;
    for (const [a, b] of edges) {
      const p = nodes[a], q = nodes[b];
      ctx.strokeStyle = hexA('#F1EEE8', 0.32);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      const mx = (p.x + q.x) / 2;
      ctx.bezierCurveTo(mx, p.y, mx, q.y, q.x, q.y);
      ctx.stroke();
    }
    // tool sub-nodes under agents (vector store lookups)
    for (const i of [3, 6]) {
      const n = nodes[i];
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = hexA(A, 0.55);
      ctx.beginPath();
      ctx.moveTo(n.x, n.y + 22);
      ctx.lineTo(n.x, n.y + 62);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = A;
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 74, 16, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 84, 16, 6, 0, 0, Math.PI);
      ctx.stroke();
    }
    for (const n of nodes) {
      const s = n.ai ? 34 : 24;
      ctx.fillStyle = '#0B0B0B';
      ctx.strokeStyle = n.ai ? A : BONE;
      ctx.lineWidth = n.ai ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(n.x - s / 2, n.y - s / 2, s, s, 7);
      ctx.fill();
      ctx.stroke();
      if (n.ai) {
        ctx.fillStyle = A;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexA(A, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  },

  bars(ctx, x, y, w, h, A) {
    // raw rows on the left resolve into clean bars on the right
    const r = rand(7);
    const rows = 11;
    const rh = h / rows;
    for (let i = 0; i < rows; i++) {
      let cx = x;
      const yy = y + i * rh + rh * 0.3;
      while (cx < x + w * 0.42) {
        const cw = 14 + r() * 40;
        ctx.fillStyle = hexA('#F1EEE8', 0.08 + r() * 0.22);
        ctx.fillRect(cx, yy, Math.min(cw, x + w * 0.42 - cx), rh * 0.36);
        cx += cw + 6;
      }
    }
    ctx.strokeStyle = hexA('#F1EEE8', 0.35);
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.5, y + h);
    ctx.stroke();
    ctx.setLineDash([]);
    const vals = [0.38, 0.55, 0.47, 0.72, 0.64, 0.9];
    const bx = x + w * 0.58;
    const bw = (w * 0.42) / vals.length;
    vals.forEach((v, i) => {
      const bh = v * h * 0.86;
      ctx.fillStyle = i === vals.length - 1 ? A : hexA('#F1EEE8', 0.85);
      ctx.fillRect(bx + i * bw + 4, y + h - bh, bw - 12, bh);
    });
  },

  print(ctx, x, y, w, h, A) {
    // fingerprint-like ridges with a scan line
    const cx = x + w / 2, cy = y + h / 2;
    ctx.lineWidth = 2.2;
    for (let i = 1; i < 22; i++) {
      const rx = i * 9.5, ry = i * 12;
      ctx.strokeStyle = i % 6 === 0 ? A : hexA('#F1EEE8', 0.55 - i * 0.012);
      ctx.beginPath();
      const start = (i * 0.37) % 1.2;
      for (let a = start; a < Math.PI * 2 - 0.25 + start * 0.2; a += 0.04) {
        const wob = Math.sin(a * 5 + i) * 2.4;
        const px = cx + Math.cos(a) * (rx + wob);
        const py = cy + Math.sin(a) * (ry + wob) * 0.92;
        if (a === start) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    const sy = cy - 40;
    const g = ctx.createLinearGradient(0, sy - 60, 0, sy);
    g.addColorStop(0, hexA(A, 0));
    g.addColorStop(1, hexA(A, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(x + w * 0.12, sy - 60, w * 0.76, 60);
    ctx.fillStyle = A;
    ctx.fillRect(x + w * 0.1, sy, w * 0.8, 3);
  },

  cube(ctx, x, y, w, h, A) {
    const cx = x + w / 2, cy = y + h / 2 + 10;
    const iso = (px, py, pz, s) => [cx + (px - pz) * 0.866 * s, cy + (px + pz) * 0.5 * s - py * s];
    const box = (s, col, lw) => {
      const v = [];
      for (const X of [-1, 1]) for (const Y of [-1, 1]) for (const Z of [-1, 1]) v.push(iso(X, Y, Z, s));
      const e = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      for (const [a, b] of e) {
        ctx.beginPath();
        ctx.moveTo(...v[a]);
        ctx.lineTo(...v[b]);
        ctx.stroke();
      }
    };
    box(150, hexA('#F1EEE8', 0.8), 2);
    box(82, A, 2.5);
    ctx.fillStyle = A;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([2, 8]);
    ctx.strokeStyle = hexA('#F1EEE8', 0.28);
    ctx.beginPath();
    ctx.arc(cx, cy, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  roi(ctx, x, y, w, h, A) {
    const pts = [0.55, 0.58, 0.56, 0.63, 0.61, 0.68, 0.71, 0.69, 0.75, 0.79];
    const lo = 0.45, hi = 0.85;
    const px = (i) => x + (i / (pts.length - 1)) * w;
    const py = (v) => y + h - ((v - lo) / (hi - lo)) * h;
    ctx.strokeStyle = hexA('#F1EEE8', 0.12);
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const yy = y + (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
    }
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, hexA(A, 0.35));
    grad.addColorStop(1, hexA(A, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px(0), y + h);
    pts.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(pts.length - 1), y + h);
    ctx.fill();
    ctx.strokeStyle = A;
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
    ctx.stroke();
    for (const i of [0, pts.length - 1]) {
      ctx.fillStyle = i ? A : BONE;
      ctx.beginPath();
      ctx.arc(px(i), py(pts[i]), 9, 0, Math.PI * 2);
      ctx.fill();
    }
    font(ctx, 700, 'normal', 30);
    ctx.fillStyle = BONE;
    ctx.fillText('55%', px(0) + 4, py(pts[0]) - 22);
    ctx.textAlign = 'right';
    ctx.fillText('79%', px(pts.length - 1), py(pts[pts.length - 1]) - 22);
    ctx.textAlign = 'left';
  },

  tiles(ctx, x, y, w, h, A) {
    const cols = 5, rows = 2, gap = 14;
    const tw = (w - gap * (cols - 1)) / cols;
    const th = Math.min((h - gap) / rows, tw * 1.25);
    const oy = y + (h - (th * rows + gap)) / 2;
    const r = rand(11);
    for (let i = 0; i < cols * rows; i++) {
      const tx = x + (i % cols) * (tw + gap);
      const ty = oy + Math.floor(i / cols) * (th + gap);
      const hot = i === 6;
      ctx.fillStyle = hot ? A : '#151515';
      ctx.strokeStyle = hot ? A : hexA('#F1EEE8', 0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hot ? '#0B0B0B' : hexA('#F1EEE8', 0.75);
      ctx.fillRect(tx + 10, ty + 12, tw * (0.4 + r() * 0.4), 7);
      ctx.fillRect(tx + 10, ty + 24, tw * (0.3 + r() * 0.3), 7);
      ctx.fillStyle = hot ? hexA('#0B0B0B', 0.5) : hexA('#F1EEE8', 0.18);
      const shape = i % 3;
      const sx = tx + tw / 2, sy = ty + th * 0.62;
      ctx.beginPath();
      if (shape === 0) ctx.arc(sx, sy, tw * 0.26, 0, Math.PI * 2);
      else if (shape === 1) ctx.roundRect(sx - tw * 0.18, sy - th * 0.2, tw * 0.36, th * 0.4, 6);
      else {
        ctx.moveTo(sx, sy - th * 0.18);
        ctx.lineTo(sx + tw * 0.26, sy + th * 0.16);
        ctx.lineTo(sx - tw * 0.26, sy + th * 0.16);
      }
      ctx.fill();
    }
  },

  film(ctx, x, y, w, h, A) {
    const fh = h * 0.56, fy = y + (h - fh) / 2;
    ctx.fillStyle = '#141414';
    ctx.fillRect(x - PAD, fy, w + PAD * 2, fh);
    ctx.fillStyle = '#000';
    for (let sx = x - PAD + 10; sx < x + w + PAD; sx += 34) {
      ctx.fillRect(sx, fy + 10, 18, 14);
      ctx.fillRect(sx, fy + fh - 24, 18, 14);
    }
    const fw = (w - 30) / 3;
    for (let i = 0; i < 3; i++) {
      const fx = x + i * (fw + 15);
      const g = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
      g.addColorStop(0, i === 1 ? hexA(A, 0.9) : '#2a2a2a');
      g.addColorStop(1, i === 1 ? hexA(A, 0.35) : '#0d0d0d');
      ctx.fillStyle = g;
      ctx.fillRect(fx, fy + 38, fw, fh - 76);
    }
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = BONE;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy - 30);
    ctx.lineTo(cx + 32, cy);
    ctx.lineTo(cx - 22, cy + 30);
    ctx.fill();
  },

  flow(ctx, x, y, w, h, A) {
    const cy = y + h / 2;
    // folder
    const fx = x + 10, fw = 150, fh = 112;
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fx, cy - fh / 2 + 18);
    ctx.lineTo(fx + 52, cy - fh / 2 + 18);
    ctx.lineTo(fx + 66, cy - fh / 2);
    ctx.lineTo(fx + fw, cy - fh / 2);
    ctx.lineTo(fx + fw, cy + fh / 2);
    ctx.lineTo(fx, cy + fh / 2);
    ctx.closePath();
    ctx.stroke();
    // phone / live ad
    const pw = 130, ph = 230, px = x + w - pw - 6, py = cy - ph / 2;
    ctx.strokeStyle = A;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 18);
    ctx.stroke();
    ctx.fillStyle = hexA(A, 0.85);
    ctx.fillRect(px + 14, py + 30, pw - 28, ph * 0.46);
    ctx.fillStyle = hexA('#F1EEE8', 0.7);
    ctx.fillRect(px + 14, py + 30 + ph * 0.5, pw * 0.6, 8);
    ctx.fillRect(px + 14, py + 30 + ph * 0.5 + 16, pw * 0.4, 8);
    // conveyor of creatives
    const x0 = fx + fw + 24, x1 = px - 24;
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = hexA('#F1EEE8', 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, cy);
    ctx.lineTo(x1, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4;
      const bx = x0 + (x1 - x0) * t;
      ctx.fillStyle = i === 3 ? A : BONE;
      ctx.fillRect(bx - 14, cy - 18, 28, 36);
    }
    ctx.fillStyle = A;
    ctx.beginPath();
    ctx.moveTo(x1, cy - 10);
    ctx.lineTo(x1 + 16, cy);
    ctx.lineTo(x1, cy + 10);
    ctx.fill();
  },

  seo(ctx, x, y, w, h, A) {
    const pts = [0.72, 0.7, 0.66, 0.58, 0.47, 0.4, 0.48, 0.6, 0.7, 0.82];
    const px = (i) => x + (i / (pts.length - 1)) * w;
    const py = (v) => y + h - v * h;
    const k = 5;
    ctx.lineWidth = 4;
    ctx.strokeStyle = hexA('#F1EEE8', 0.6);
    ctx.beginPath();
    for (let i = 0; i <= k; i++) (i ? ctx.lineTo(px(i), py(pts[i])) : ctx.moveTo(px(i), py(pts[i])));
    ctx.stroke();
    ctx.strokeStyle = A;
    ctx.beginPath();
    for (let i = k; i < pts.length; i++) (i > k ? ctx.lineTo(px(i), py(pts[i])) : ctx.moveTo(px(i), py(pts[i])));
    ctx.stroke();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = hexA('#F1EEE8', 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(k), y);
    ctx.lineTo(px(k), y + h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = A;
    ctx.beginPath();
    ctx.arc(px(k), py(pts[k]), 10, 0, Math.PI * 2);
    ctx.fill();
    // search bar
    ctx.strokeStyle = hexA('#F1EEE8', 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w * 0.62, 46, 23);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 26, y + 23, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = hexA('#F1EEE8', 0.4);
    ctx.fillRect(x + 48, y + 20, w * 0.36, 6);
  },

  phones(ctx, x, y, w, h, A) {
    const pw = 170, ph = 330;
    const drawPhone = (px, py, hot) => {
      ctx.strokeStyle = hot ? A : BONE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 24);
      ctx.stroke();
      ctx.fillStyle = hot ? hexA(A, 0.9) : hexA('#F1EEE8', 0.85);
      ctx.beginPath();
      ctx.roundRect(px + 18, py + 30, 46, 46, 12);
      ctx.fill();
      ctx.fillStyle = hexA('#F1EEE8', 0.6);
      ctx.fillRect(px + 76, py + 36, 70, 9);
      ctx.fillRect(px + 76, py + 54, 46, 9);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = hexA('#F1EEE8', hot && i === 1 ? 0.4 : 0.15);
        ctx.fillRect(px + 18 + i * 46, py + 96, 40, 150);
        if (hot && i === 1) {
          ctx.strokeStyle = A;
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 18 + i * 46, py + 96, 40, 150);
        }
      }
      for (let s = 0; s < 5; s++) {
        ctx.fillStyle = s < 5 ? (hot ? A : BONE) : '#333';
        star(ctx, px + 28 + s * 26, py + 278, 9);
      }
    };
    drawPhone(x + w * 0.12, y + (h - ph) / 2 + 20, false);
    drawPhone(x + w * 0.52, y + (h - ph) / 2 - 20, true);
  },

  weave(ctx, x, y, w, h, A) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.lineWidth = 3;
    for (let i = -h; i < w + h; i += 26) {
      ctx.strokeStyle = hexA('#F1EEE8', 0.16);
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i - h, y + h);
      ctx.stroke();
    }
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = hexA('#F1EEE8', 0.55);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 30, y + 30, w - 60, h - 60);
    ctx.setLineDash([]);
    ctx.restore();
    // hanger
    const cx = x + w / 2, cy = y + h / 2 - 20;
    ctx.strokeStyle = A;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy - 64, 22, Math.PI, Math.PI * 2.25);
    ctx.lineTo(cx, cy - 20);
    ctx.lineTo(cx + 170, cy + 70);
    ctx.lineTo(cx - 170, cy + 70);
    ctx.closePath();
    ctx.stroke();
    font(ctx, 900, 'expanded', 40);
    ctx.fillStyle = BONE;
    ctx.textAlign = 'center';
    ctx.fillText('CLOZ', cx, cy + 150);
    ctx.textAlign = 'left';
  },
};

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPhoto(ctx, img, x, y, w, h, A) {
  const ir = img.width / img.height, br = w / h;
  let sw, sh, sx, sy;
  if (ir > br) { sh = img.height; sw = sh * br; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / br; sx = 0; sy = (img.height - sh) * 0.3; }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  const g = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  g.addColorStop(0, 'rgba(11,11,11,0)');
  g.addColorStop(1, 'rgba(11,11,11,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.fillStyle = A;
  ctx.fillRect(x, y + h - 4, w * 0.3, 4);
}

/* ---------------------------------------------------------------- card */

export function drawCard(project, images = {}) {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d');
  const A = ACCENTS[project.tone];

  // base
  ctx.fillStyle = '#0B0B0B';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W * 0.8, 120, 10, CARD_W * 0.8, 120, 620);
  glow.addColorStop(0, hexA(A, 0.16));
  glow.addColorStop(1, hexA(A, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // grain
  const r = rand(project.id.length * 97 + 13);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
    ctx.fillRect(r() * CARD_W, r() * CARD_H, 1.4, 1.4);
  }

  // header
  font(ctx, 600, 'normal', 25);
  ctx.fillStyle = BONE;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(project.org, PAD, 70);
  ctx.fillStyle = ASH;
  ctx.textAlign = 'right';
  ctx.fillText(project.year, CARD_W - PAD, 70);
  ctx.textAlign = 'left';
  ctx.fillStyle = A;
  ctx.beginPath();
  ctx.arc(PAD + ctx.measureText(project.org).width + 30, 62, 6, 0, Math.PI * 2);
  ctx.fill();

  // art
  const ax = PAD, ay = 112, aw = CARD_W - PAD * 2, ah = 430;
  if (project.art.startsWith('photo:')) {
    const img = images[project.art.slice(6)];
    if (img) drawPhoto(ctx, img, 0, ay - 12, CARD_W, ah + 40, A);
  } else {
    ART[project.art]?.(ctx, ax, ay, aw, ah, A);
  }

  // kicker + title
  font(ctx, 500, 'normal', 25);
  ctx.fillStyle = ASH;
  ctx.fillText(project.kicker, PAD, 610);
  const { size, lines } = fitTitle(ctx, project.title.toUpperCase(), CARD_W - PAD * 2, 2);
  ctx.fillStyle = BONE;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-1px';
  lines.forEach((l, i) => ctx.fillText(l, PAD - 2, 610 + 18 + size * 0.92 * (i + 1)));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // rule + metric
  const my = 860;
  ctx.fillStyle = 'rgba(241,238,232,0.16)';
  ctx.fillRect(PAD, my - 44, CARD_W - PAD * 2, 1.5);
  font(ctx, 900, 'expanded', 68);
  ctx.fillStyle = A;
  const v = project.metric.v;
  ctx.fillText(v, PAD - 2, my + 46);
  const vw = ctx.measureText(v).width;
  font(ctx, 500, 'normal', 24);
  ctx.fillStyle = BONE;
  const labelX = PAD + vw + 26;
  const labelLines = wrap(ctx, project.metric.l, CARD_W - PAD - labelX);
  labelLines.slice(0, 2).forEach((l, i) => ctx.fillText(l, labelX, my + 12 + i * 30));

  return c;
}
