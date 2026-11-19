// intro montage for stanleyzhou.vercel.app (v2 only, home page only).
// big bang -> first atoms -> galaxy -> earth -> toronto -> through a window -> this page.
// everything is drawn as free-floating glyphs on a WebGL canvas (2d canvas fallback), driven by scroll.
(() => {
'use strict';
// ================================================================ math
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const sm = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const frac = v => v - Math.floor(v);
const h1 = i => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const PERM = new Uint8Array(512), VAL = new Float32Array(256);
(() => { const r = mulberry(1337); for (let i = 0; i < 256; i++) { PERM[i] = i; VAL[i] = r(); } for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0, t = PERM[i]; PERM[i] = PERM[j]; PERM[j] = t; } for (let i = 0; i < 256; i++) PERM[i + 256] = PERM[i]; })();
const lat = (x, y, z) => VAL[PERM[PERM[PERM[x & 255] + (y & 255)] + (z & 255)]];
const fd = t => t * t * (3 - 2 * t);
function n3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fd(x - xi), v = fd(y - yi), w = fd(z - zi);
  return lerp(lerp(lerp(lat(xi, yi, zi), lat(xi + 1, yi, zi), u), lerp(lat(xi, yi + 1, zi), lat(xi + 1, yi + 1, zi), u), v),
    lerp(lerp(lat(xi, yi, zi + 1), lat(xi + 1, yi, zi + 1), u), lerp(lat(xi, yi + 1, zi + 1), lat(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm = (x, y, z = 0.5) => n3(x, y, z) * 0.55 + n3(x * 2.03, y * 2.03, z * 2.03 + 7) * 0.3 + n3(x * 4.1, y * 4.1, z * 4.1 + 3) * 0.15;

// ================================================================ glyph atlas
const FONT = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
const CHARS = ".'`,:;-~_=+*^\"!/\\|()[]{}<>?#$%&@0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const AS = 48, ADV = 0.48, AC = 16;
let ATLAS = null, RAMP = [], SRAMP = [], AR = 1;
const IDX = new Int16Array(128).fill(-1);
function buildAtlas() {
  const chars = [...CHARS];
  AR = Math.ceil(chars.length / AC);
  const c = document.createElement('canvas'); c.width = AS * AC; c.height = AS * AR;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.font = `400 ${Math.round(AS * 0.8)}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  chars.forEach((ch, i) => { x.fillText(ch, (i % AC) * AS + AS / 2, Math.floor(i / AC) * AS + AS / 2 + 1); IDX[ch.charCodeAt(0)] = i; });
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const cov = chars.map((ch, i) => { let s = 0; const ox = (i % AC) * AS, oy = Math.floor(i / AC) * AS; for (let yy = oy; yy < oy + AS; yy += 2) for (let xx = ox; xx < ox + AS; xx += 2) s += d[(yy * c.width + xx) * 4 + 3]; return [ch, s]; });
  cov.sort((a, b) => a[1] - b[1]);
  const skip = '()[]{}<>|/\\_"`^';
  RAMP = cov.filter(o => !skip.includes(o[0])).map(o => IDX[o[0].charCodeAt(0)]);
  const sym = ".,'`:-~=+*xoO0#%&@";
  SRAMP = cov.filter(o => sym.includes(o[0])).map(o => IDX[o[0].charCodeAt(0)]);
  const g = document.createElement('canvas'); g.width = c.width; g.height = c.height; g.getContext('2d').drawImage(c, 0, 0);
  ATLAS = g;
}
const rc = b => RAMP[Math.round(clamp(b) * (RAMP.length - 1))];
const rs = b => SRAMP[Math.round(clamp(b) * (SRAMP.length - 1))];

// ================================================================ glyph buffer and transforms
const MAX = 90000;
const GX = new Float32Array(MAX), GY = new Float32Array(MAX), GS = new Float32Array(MAX), GB = new Float32Array(MAX), GC = new Int16Array(MAX);
let GN = 0, Ts = 1, Ttx = 0, Tty = 0, Ta = 1, VW = 1.78, VH = 1;
function setT(s, tx, ty, a) { Ts = s; Ttx = tx; Tty = ty; Ta = a; }
function withT(s, tx, ty, a, fn) { const o = [Ts, Ttx, Tty, Ta]; Ttx += tx * Ts; Tty += ty * Ts; Ts *= s; Ta *= a; if (Ta > 0.004) fn(); Ts = o[0]; Ttx = o[1]; Tty = o[2]; Ta = o[3]; }
function emit(x, y, s, b, ch) {
  const idx = ch === undefined ? rs(b) : typeof ch === 'string' ? IDX[ch.charCodeAt(0)] : ch;
  if (idx === undefined || idx < 0 || GN >= MAX) return;
  let bb = b * Ta; const vs = s * Ts;
  if (Ts > 1.5 && vs > 0.07) bb *= (0.07 / vs) * (0.07 / vs); // glyphs blown up by a zoom fade instead of becoming giant letters
  if (bb < 0.012) return;
  const vx = x * Ts + Ttx, vy = y * Ts + Tty;
  if (vx + vs < -VW || vx - vs > VW || vy + vs < -VH || vy - vs > VH) return;
  GX[GN] = vx; GY[GN] = vy; GS[GN] = vs; GB[GN] = bb > 1 ? 1 : bb; GC[GN] = idx; GN++;
}
function nest(zz, K, F, outer, inner) {
  const e = sm(0, 1, zz), sO = Math.pow(K, zz), sI = Math.pow(K, zz - 1), ox = F[0] * (1 - e), oy = F[1] * (1 - e);
  const aO = 1 - sm(0.4, 0.85, zz), aI = sm(0.12, 0.6, zz);
  if (aO > 0.004) withT(sO, -F[0] * sO + ox, -F[1] * sO + oy, aO, outer);
  if (aI > 0.004) withT(sI, ox, oy, aI, inner);
}

// ================================================================ drawing helpers
function lc(dx, dy) { let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI; const d = a * 180 / Math.PI; if (d < 22.5 || d >= 157.5) return '-'; if (d < 67.5) return '\\'; if (d < 112.5) return '|'; return '/'; }
function line(x1, y1, x2, y2, step, s, b, ch) { const dx = x2 - x1, dy = y2 - y1, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step)), c = ch === undefined ? lc(dx, dy) : ch; for (let i = 0; i <= n; i++) emit(x1 + dx * i / n, y1 + dy * i / n, s, b, c); }
function text(str, x, y, s, b) { for (let i = 0; i < str.length; i++) { const c = str[i]; if (c !== ' ') emit(x + i * s * ADV + s * ADV / 2, y, s, b, c); } }
function ring(cx, cy, rx, ry, s, b, rot = 0, ch) {
  const c = Math.cos(rot), sn = Math.sin(rot), n = Math.max(10, Math.min(420, Math.round(TAU * Math.max(rx, ry) / (s * 0.55))));
  for (let i = 0; i < n; i++) { const a = i / n * TAU, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, tx = -Math.sin(a) * rx, ty = Math.cos(a) * ry; emit(cx + ex * c - ey * sn, cy + ex * sn + ey * c, s, b, ch === undefined ? lc(tx * c - ty * sn, tx * sn + ty * c) : ch); }
}

// ================================================================ shared scene pieces
const LIGHT = (() => { const v = [-0.5, -0.45, 0.74], l = Math.hypot(...v); return v.map(c => c / l); })();
const HALF = (() => { const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1], l = Math.hypot(...v); return v.map(c => c / l); })();
let STARS = null;
function starfield(fwd, warp, t, occ) {
  for (const [x, y, z0, q] of STARS) {
    const z = 0.04 + frac(z0 - fwd) * 0.96, px = x / z * 0.3, py = y / z * 0.3;
    if (occ && Math.hypot(px - occ[0], py - occ[1]) < occ[2] * 1.03) continue;
    const b = clamp((1 - z) * 1.1) * (0.7 + 0.3 * Math.sin(t * 3 + q * 30)), s = 0.013 + (1 - z) * 0.035;
    const L = warp * 0.22 / z;
    if (L > 0.03) { const n = Math.min(16, Math.ceil(L / 0.028)), dl = Math.hypot(px, py) || 1, c = lc(px, py); for (let i = 0; i <= n; i++) { const k = i / n; emit(px - px / dl * L * k, py - py / dl * L * k, s * (1 - k * 0.5), b * (1 - k * 0.85), i ? c : '*'); } }
    else emit(px, py, s, b, q > 0.92 ? '*' : undefined);
  }
}
function sun(cx, cy, R, t, a) {
  const n = Math.round(clamp(R * 40, 8, 34)), d = R / n;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const px = (i + (h1(i * 13 + j * 7) - 0.5) * 0.8) * d, py = (j + (h1(i * 7 + j * 29) - 0.5) * 0.8) * d, r2 = (px * px + py * py) / (R * R); if (r2 > 1) continue;
    const nz = Math.sqrt(1 - r2), g = n3(px / R * 7, py / R * 7, t * 0.6), b = (0.55 + 0.45 * g) * (0.5 + 0.5 * nz);
    emit(cx + px, cy + py, d * 1.8, b * a, rc(b));
  }
  for (let k = 0; k < 120; k++) { const an = k / 120 * TAU, L = R * (0.15 + 1.1 * Math.pow(n3(Math.cos(an) * 2.5, Math.sin(an) * 2.5, t * 0.3), 2)), c = lc(Math.cos(an), Math.sin(an)), st = Math.max(0.02, R * 0.05);
    for (let s = 0; s < L; s += st) emit(cx + Math.cos(an) * (R * 1.02 + s), cy + Math.sin(an) * (R * 1.02 + s), Math.max(0.018, R * 0.05), a * 0.5 * (1 - s / L), c); }
  for (let p = 0; p < 4; p++) { const an = p * 1.7 + 0.5; for (let k = 0; k <= 24; k++) { const s = k / 24, ang = an - 0.22 + 0.44 * s, h = Math.sin(s * Math.PI) * R * 0.28 * (1 + 0.2 * Math.sin(t + p)); emit(cx + Math.cos(ang) * (R + h), cy + Math.sin(ang) * (R + h), Math.max(0.02, R * 0.05), a * 0.75, '*'); } }
  emit(cx, cy, R * 2.6, 0.12 * a, '@'); emit(cx, cy, R * 1.6, 0.18 * a, '#');
}
function earth2(cx, cy, R, t, spin, a) {
  const n = Math.round(clamp(R * 42, 10, 48)), d = R / n;
  const cs = Math.cos(spin), sn = Math.sin(spin), cs2 = Math.cos(spin * 1.3 + 0.6), sn2 = Math.sin(spin * 1.3 + 0.6);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const hx = h1(i * 131 + j * 7.1), hy = h1(i * 17.3 + j * 91.7);
    const px = (i + (hx - 0.5) * 0.9) * d, py = (j + (hy - 0.5) * 0.9) * d, r2 = (px * px + py * py) / (R * R); if (r2 > 1) continue;
    const nx = px / R, ny = py / R, nz = Math.sqrt(1 - r2);
    const lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], lc0 = Math.max(0, lam);
    const X = nx * cs + nz * sn, Z = -nx * sn + nz * cs, Y = ny;
    const land = fbm(X * 1.7 + 3, Y * 1.7, Z * 1.7), sz = d * 1.75 * (0.8 + 0.4 * hx), rim = Math.pow(1 - nz, 3) * 0.4 * (lam > 0 ? 1 : 0.15);
    if (land > 0.55) {
      const mtn = Math.pow(1 - Math.abs(2 * n3(X * 9, Y * 9, Z * 9) - 1), 3), ice = Math.abs(Y) > 0.8;
      const lb = lc0 * (0.5 + 1.4 * (land - 0.55) + 0.45 * mtn + (ice ? 0.45 : 0)) + rim;
      emit(cx + px, cy + py, sz, lb * a, ice ? '#' : rc(lb));
      if (lam < 0.06) { const city = n3(X * 15, Y * 15, Z * 15); if (city > 0.6) emit(cx + px, cy + py, sz * 0.55, (city - 0.6) * 3.5 * a * clamp(1 - lam * 12), city > 0.7 ? '+' : '.'); }
    } else {
      const spec = Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), 70);
      emit(cx + px, cy + py, sz, (lc0 * 0.26 + spec * 1.3 + rim) * a, spec > 0.25 ? '*' : '~');
    }
    const X2 = nx * cs2 + nz * sn2, Z2 = -nx * sn2 + nz * cs2;
    const sw = Math.atan2(Y - 0.25, X2 - 0.2), sr = Math.hypot(Y - 0.25, X2 - 0.2);
    const cl = fbm(X2 * 2.6 + 9 + (sr < 0.35 ? Math.cos(sw + sr * 9) * 0.2 : 0), Y * 5.5 + (sr < 0.35 ? Math.sin(sw + sr * 9) * 0.2 : 0), Z2 * 2.6);
    if (cl > 0.6) emit(cx + px + d * 0.3, cy + py - d * 0.2, sz * 0.9, lc0 * (0.45 + (cl - 0.6) * 2.6) * a, cl > 0.7 ? '=' : "'");
  }
  const la = Math.atan2(LIGHT[1], LIGHT[0]), m = Math.round(clamp(R * 320, 60, 300));
  for (const [f, bb, ch] of [[1.022, 0.55, '.'], [1.05, 0.3, "'"], [1.09, 0.14, '.']]) for (let k = 0; k < m; k++) { const an = k / m * TAU, l = Math.pow(Math.max(0, Math.cos(an - la) * 0.8 + 0.2), 1.5); if (l < 0.03) continue; emit(cx + Math.cos(an) * R * f, cy + Math.sin(an) * R * f, Math.max(0.012, R * 0.03), bb * l * a, ch); }
}
function moon(C, R, t, u, a) {
  const ang = t * 0.08 + u * 1.8 + 2.2, mx = C[0] + Math.cos(ang) * R * 1.75, my = C[1] + Math.sin(ang) * R * 0.3 - R * 0.18, mz = Math.sin(ang);
  if (mz < 0 && Math.hypot(mx - C[0], my - C[1]) < R * 1.05) return;
  const mR = R * 0.27 * (1 + mz * 0.08), n = Math.round(clamp(mR * 44, 6, 20)), d = mR / n;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const px = (i + (h1(i * 41 + j * 3) - 0.5) * 0.8) * d, py = (j + (h1(i * 5 + j * 43) - 0.5) * 0.8) * d, r2 = (px * px + py * py) / (mR * mR); if (r2 > 1) continue;
    const nx = px / mR, ny = py / mR, nz = Math.sqrt(1 - r2), lam = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]), cr = n3(nx * 6 + 40, ny * 6, nz * 6);
    const b = lam * (0.55 + 0.35 * cr - (cr > 0.66 ? 0.3 : 0));
    emit(mx + px, my + py, d * 1.8, b * a, rc(b));
  }
}
function miniAtom(x, y, sc, t, seed, form) {
  for (let k = 0; k < (seed % 3 ? 2 : 4); k++) { const an = k * 2.4 + seed; emit(x + Math.cos(an) * 0.02 * sc, y + Math.sin(an) * 0.02 * sc, 0.06 * sc, 0.8, k % 2 ? 'O' : '@'); }
  emit(x, y, 0.3 * sc, 0.07, '@');
  const rot = seed * 1.3 + t * 0.06, A = 0.32 * sc, B = 0.12 * sc; ring(x, y, A, B, Math.max(0.014, 0.03 * sc), 0.22 * form, rot, '.');
  const rf = lerp(2.2, 1, form), a0 = t * (2 + seed * 0.15) + seed, c = Math.cos(rot), s = Math.sin(rot);
  for (let j = 0; j < 10; j++) { const an = a0 - j * 0.1, ex = Math.cos(an) * A * rf, ey = Math.sin(an) * B * rf; emit(x + ex * c - ey * s, y + ex * s + ey * c, 0.05 * sc * (1 - j / 12) + 0.01, (1 - j / 10) * 0.9, j ? undefined : '@'); }
  text(seed % 3 ? 'H' : 'He', x + A + 0.03, y - B - 0.02, 0.035, 0.35 * form);
}
// toronto: waterline and the window the camera flies through
const WL = 0.22, TWIN = [-0.1, -0.05], NB = 480;
const TX = px => (px - 500) / 1000 * 3.6, TY = py => (py - 300) / 300;
function rect2(x1, y1, x2, y2, b) { line(x1, y1, x2, y1, 0.008, 0.012, b, '-'); line(x1, y2, x2, y2, 0.008, 0.012, b, '-'); line(x1, y1, x1, y2, 0.008, 0.012, b, '|'); line(x2, y1, x2, y2, 0.008, 0.012, b, '|'); }

// ================================================================ scenes
const SCENES = [
// ---------------------------------------------------------------- 1
{ name: 'Big Bang', thumb: 0.38, out: { type: 'in', f: [0.3, -0.2], k: 20 },
  init() {
    const r = mulberry(11); this.foam = []; for (let i = 0; i < 1000; i++) this.foam.push([(r() - 0.5) * 4.8, (r() - 0.5) * 2.8, r()]);
    this.p = new Float32Array(3600 * 6);
    for (let i = 0; i < 3600; i++) { let x, y, z, l; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.01); l = Math.sqrt(l); this.p.set([x / l, y / l, z / l, Math.pow(r(), 0.5), r(), r()], i * 6); }
    this.rays = []; for (let i = 0; i < 96; i++) this.rays.push([i / 96 * TAU + (r() - 0.5) * 0.05, 0.5 + r() * 1.6, r()]);
  },
  draw(u, t) {
    const tension = sm(0, 0.27, u), pre = 1 - sm(0.26, 0.31, u), ign = sm(0.265, 0.29, u) * (1 - sm(0.29, 0.5, u)), e = clamp((u - 0.28) / 0.72);
    const sh = ign * 0.035, sx = (h1(Math.floor(t * 30)) - 0.5) * sh, sy = (h1(Math.floor(t * 30) + 5) - 0.5) * sh;
    withT(1, sx, sy, 1, () => {
      if (pre > 0.01) {
        for (const [x0, y0, q] of this.foam) {
          const k = frac(q + t * 0.12 + u * 0.9), r0 = Math.hypot(x0, y0), a = Math.atan2(y0, x0) + k * 0.8 * tension, r = r0 * (1 - k * 0.85 * (0.3 + tension));
          const x = Math.cos(a) * r, y = Math.sin(a) * r, b = pre * (0.12 + 0.3 * tension) * Math.sin(k * Math.PI) * (0.4 + 0.6 * n3(x0 * 3, y0 * 3, t * 0.5));
          emit(x, y, 0.018 + 0.01 * q, b, q > 0.8 ? "'" : '.'); if (tension > 0.3) emit(x * 1.05, y * 1.05, 0.014, b * 0.5, lc(x, y));
        }
        const fq = 2 + 14 * tension * tension, pulse = 0.5 + 0.5 * Math.sin(t * fq), stack = '@#O0o:.';
        for (let k = 0; k < 7; k++) emit(0, 0, 0.035 + k * 0.035 * (1 + pulse * 0.25 * tension), pre * (0.95 - k * 0.12), stack[k]);
        for (let k = 0; k < 5; k++) { const rr = (1 - frac(k / 5 + t * 0.35 * (1 + 2 * tension))) * 0.75; ring(0, 0, rr * 1.1, rr, 0.022, pre * 0.45 * (1 - rr / 0.75) * (0.4 + tension), 0, '.'); }
        if (tension > 0.15) for (let a = 0; a < 8; a++) { const seed = a * 13 + Math.floor(t * 7); if (h1(seed) < 0.55 - 0.3 * tension) continue; let x = 0, y = 0, ang = h1(seed + 1) * TAU; const n = 6 + Math.floor(h1(seed + 2) * 9);
          for (let s = 0; s < n; s++) { ang += (h1(seed + s * 3) - 0.5) * 1.1; const nx = x + Math.cos(ang) * 0.06, ny = y + Math.sin(ang) * 0.06; line(x, y, nx, ny, 0.02, 0.03, pre * tension * (1 - s / n)); x = nx; y = ny; } }
      }
      if (ign > 0.01) for (let k = 0; k < 180; k++) { const a = h1(k) * TAU, r = Math.pow(h1(k + 50), 2) * 0.5 * (1 + ign); emit(Math.cos(a) * r * 1.3, Math.sin(a) * r, 0.06 + h1(k + 99) * 0.45, ign * (1 - r * 1.2), '@#*o0%'[k % 6]); }
      const rl = sm(0.27, 0.36, u), ra = sm(0.265, 0.29, u) * (1 - sm(0.32, 0.62, u));
      if (ra > 0.01) for (const [a, L, q] of this.rays) { const len = L * rl * 1.4, c = lc(Math.cos(a), Math.sin(a)); for (let s = 0.08; s < len; s += 0.035) emit(Math.cos(a) * s * 1.2, Math.sin(a) * s, 0.03 + 0.02 * (1 - s / len), ra * (1 - s / len) * (0.5 + 0.5 * q), c); }
      if (e > 0) {
        const R = 2.6 * (1 - Math.pow(1 - e, 2.2)), ry = t * 0.04 + e * 0.6, cy = Math.cos(ry), syy = Math.sin(ry), fw = sm(0.4, 1, e), P = this.p;
        for (let i = 0; i < P.length; i += 6) {
          const v = P[i + 3], s = P[i + 4], q = P[i + 5], r = R * v * (1 + 0.02 * Math.sin(t + q * 30));
          const x = P[i] * r, y = P[i + 1] * r, z = P[i + 2] * r, x2 = x * cy + z * syy, z2 = -x * syy + z * cy, pz = 1 / (1 + z2 * 0.18);
          const heat = (1 - e) * (1 - v * 0.55), web = 1 - Math.abs(2 * n3(P[i] * v * 4 + 5, P[i + 1] * v * 4, P[i + 2] * v * 4 + e * 0.5) - 1);
          const b = (0.15 + 0.85 * heat) * lerp(1, sm(0.62, 0.9, web) * 1.4 + 0.04, fw) * (0.7 + 0.3 * Math.sin(t * 3 + q * 40));
          const px = x2 * pz * 1.15, py = y * pz, sz = (0.012 + 0.06 * heat * heat * s + 0.008) * pz;
          emit(px, py, sz, b, rs(clamp(heat * 1.1 + (s - 0.5) * 0.3 + 0.15 * web * fw)));
          if (heat > 0.35 && q > 0.5) { const d = Math.hypot(px, py) || 1; emit(px - px / d * 0.04 * heat, py - py / d * 0.04 * heat, sz * 0.7, b * 0.5, lc(px, py)); }
        }
        const sa = 1 - sm(0, 0.7, e);
        if (sa > 0.01) {
          for (let k = 0; k < 420; k++) { const a = k / 420 * TAU, nn = n3(Math.cos(a) * 2 + 3, Math.sin(a) * 2, t * 0.4 + e * 3), rr = R * 1.05 * (1 + 0.12 * (nn - 0.5)); emit(Math.cos(a) * rr * 1.15, Math.sin(a) * rr, 0.035 + 0.03 * nn, sa * (0.5 + 0.6 * nn), nn > 0.6 ? '#' : '*'); }
          for (let k = 0; k < 260; k++) { const a = k / 260 * TAU + 0.01, rr = R * 0.82 * (1 + 0.08 * (n3(Math.cos(a) * 3, Math.sin(a) * 3, t * 0.6) - 0.5)); emit(Math.cos(a) * rr * 1.15, Math.sin(a) * rr, 0.025, sa * 0.4, '+'); }
        }
      }
    });
  }
},
// ---------------------------------------------------------------- 2
{ name: 'First atoms', thumb: 0.62, out: { type: 'out', f: [0, 0], k: 18 },
  init() {
    const r = mulberry(12), g = () => (r() + r() + r() - 1.5) / 1.5;
    this.pl = []; for (let i = 0; i < 520; i++) this.pl.push([(r() - 0.5) * 4.8, (r() - 0.5) * 2.8, r() - 0.5, r() - 0.5, r() < 0.6 ? 1 : 0, r()]);
    this.mini = [[-1.25, -0.55, 0.42, 1], [1.2, -0.6, 0.36, 2], [-1.35, 0.55, 0.32, 3], [1.3, 0.5, 0.45, 4], [-0.6, 0.78, 0.26, 5], [0.65, -0.85, 0.24, 6], [1.65, -0.05, 0.28, 7], [-1.7, 0.02, 0.3, 8]];
    this.nuc = []; for (let i = 0; i < 24; i++) { let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1); this.nuc.push([x * 0.1, y * 0.1, z * 0.1, i % 2]); }
    this.s1 = []; for (let i = 0; i < 420; i++) { const d = [g(), g(), g()], l = Math.hypot(...d) || 1, rr = -Math.log(1 - r() * 0.95) * 0.11; this.s1.push([d[0] / l * rr, d[1] / l * rr, d[2] / l * rr]); }
    this.p2 = []; for (let ax = 0; ax < 3; ax++) for (let i = 0; i < 260; i++) { const sg = i % 2 ? 1 : -1, along = (0.12 + Math.abs(g()) * 0.28) * sg, sp = 0.07 * (Math.abs(along) / 0.3 + 0.3), v = [g() * sp, g() * sp, g() * sp]; v[ax] = along; this.p2.push(v); }
  },
  draw(u, t) {
    const c = sm(-0.25, 0.5, u), clear = 1 - 0.55 * c;
    for (const [x0, y0, vx, vy, e, q] of this.pl) {
      const sp = e ? 0.5 : 0.12; let x = x0 + vx * sp * t, y = y0 + vy * sp * t; x = ((x + 2.4) % 4.8 + 4.8) % 4.8 - 2.4; y = ((y + 1.4) % 2.8 + 2.8) % 2.8 - 1.4;
      const b = (e ? 0.35 : 0.5) * clear * (0.6 + 0.4 * Math.sin(t * 4 + q * 20));
      if (e) { const l = Math.hypot(vx, vy) || 1; for (let k = 0; k < 4; k++) emit(x - vx / l * 0.03 * k, y - vy / l * 0.03 * k, 0.024 - k * 0.003, b / (1 + k * 1.2), k ? '.' : '*'); } else { emit(x, y, 0.042, b, 'o'); emit(x, y, 0.1, b * 0.12, 'O'); }
    }
    for (let k = 0; k < 7; k++) { const ph = t * 0.35 + k / 7, id = Math.floor(ph), f = frac(ph); if (f > 0.35) continue; const x = (h1(id * 7 + k) - 0.5) * 3.6, y = (h1(id * 11 + k) - 0.5) * 2; ring(x, y, f * 0.5, f * 0.5, 0.018, (0.35 - f) * 1.6, 0, '.'); emit(x, y, 0.05, (0.35 - f) * 2, '*'); }
    for (const [x, y, sc, sd] of this.mini) miniAtom(x + Math.sin(t * 0.2 + sd) * 0.02, y + Math.cos(t * 0.17 + sd) * 0.02, sc, t, sd, sm(-0.2 + sd * 0.06, 0.3 + sd * 0.06, u));
    withT(1.3, 0, 0, 1, () => {
      const ay = t * 0.35, ax = 0.5 + 0.2 * Math.sin(t * 0.13), cya = Math.cos(ay), sya = Math.sin(ay), cxa = Math.cos(ax), sxa = Math.sin(ax);
      const P = (x, y, z) => { const x1 = x * cya + z * sya, z1 = -x * sya + z * cya; return [x1, y * cxa - z1 * sxa, y * sxa + z1 * cxa]; };
      emit(0, 0, 0.5, 0.08, '@'); emit(0, 0, 0.28, 0.15, '#');
      for (const [x, y, z, k] of this.nuc) { const p = P(x, y, z), j = 0.005 * Math.sin(t * 9 + x * 90); emit(p[0] + j, p[1], 0.07 + p[2] * 0.15, 0.45 + 0.45 * (p[2] / 0.1 + 1) / 2, k ? 'O' : '@'); }
      const cl = 0.2 + 0.18 * c;
      for (const [x, y, z] of this.s1) { const p = P(x, y, z); emit(p[0], p[1], 0.02, cl * (0.6 + 0.4 * Math.sin(t * 7 + x * 200)), '.'); }
      const pa = sm(0.05, 0.5, u);
      if (pa > 0) for (let i = 0; i < this.p2.length; i++) { const [x, y, z] = this.p2[i], p = P(x * 2.2, y * 2.2, z * 2.2); emit(p[0], p[1], 0.022 + 0.012 * (p[2] + 0.6), pa * 0.3 * (0.7 + 0.3 * Math.sin(t * 5 + i)), i % 7 ? '.' : ':'); }
      for (let o = 0; o < 3; o++) {
        const rot = o * TAU / 3 + 0.3 + t * 0.03, cr = Math.cos(rot), sr = Math.sin(rot), A = 0.9, B = 0.28;
        for (let k = 0; k < 160; k++) { const a = k / 160 * TAU, ex = Math.cos(a) * A, ey = Math.sin(a) * B; emit(ex * cr - ey * sr, ex * sr + ey * cr, 0.024, 0.32 * c, '.'); }
        const rf = lerp(2.8, 1, c), a0 = t * (1.6 + o * 0.3) + o * 2;
        for (let j = 0; j < 22; j++) { const a = a0 - j * 0.06, ex = Math.cos(a) * A * rf, ey = Math.sin(a) * B * rf; emit(ex * cr - ey * sr, ex * sr + ey * cr, 0.07 * (1 - j / 24), 1 - j / 22, j ? undefined : '@'); }
        const ex = Math.cos(a0) * A * rf, ey = Math.sin(a0) * B * rf; emit(ex * cr - ey * sr, ex * sr + ey * cr, 0.2, 0.12, '@');
      }
      for (let k = 0; k < 3; k++) { const ph = frac(t * 0.22 + k / 3), ang = k * 2.2 + 0.4 + Math.floor(t * 0.22 + k / 3) * 1.3, d = 0.25 + ph * 2.2, ca = Math.cos(ang), sa = Math.sin(ang);
        for (let j = 0; j < 30; j++) { const s = j * 0.018, env = Math.sin(j / 30 * Math.PI), off = Math.sin((d - s) * 55 - t * 10) * 0.035 * env; emit(ca * (d - s) - sa * off, sa * (d - s) + ca * off, 0.026, (1 - ph) * 0.8 * c * env, '~'); } }
      text('1s', 0.12, 0.12, 0.04, 0.45 * c); text('2p', 0.42, -0.3, 0.04, 0.45 * pa);
    });
    text('recombination  ·  t = 380,000 yr  ·  3000 K', -VW + 0.08, VH - 0.08, 0.036, 0.45);
  }
},
// ---------------------------------------------------------------- 3
{ name: 'Galaxy', thumb: 0.45, out: { type: 'in', f: [0.55, 0.12], k: 30 },
  init() {
    const r = mulberry(13), g = () => (r() + r() + r() + r() - 2) / 2, A = [];
    // two arms coming off the ends of the bar and winding about 1.2 turns around each other
    for (let i = 0; i < 9000; i++) { const arm = i % 2, tt = Math.pow(r(), 0.8), off = g() * 0.17 * (1 - tt * 0.35);
      let b = 0.85 * (0.35 + 0.65 * (1 - tt)); if (off > -0.2 && off < -0.07 && tt < 0.9) b *= 0.16;
      A.push(0.2 + tt * 1.0 + g() * 0.03, arm * Math.PI + tt * 7.6 + off, g() * 0.02, b, r(), r()); }
    this.nArm = A.length;
    for (let i = 0; i < 2600; i++) A.push(-Math.log(1 - r() * 0.97) * 0.35 + 0.05, r() * TAU, g() * 0.03, 0.26 + 0.16 * r(), r() * 0.5, r());
    this.A = new Float32Array(A);
    this.B = []; for (let i = 0; i < 1900; i++) this.B.push(g() * 0.34, g() * 0.13, g() * 0.1);
    this.K = []; for (let i = 0; i < 70; i++) { const arm = i % 2, tt = 0.1 + r() * 0.8; this.K.push([0.2 + tt * 1.0, arm * Math.PI + tt * 7.6 + g() * 0.05, r(), r() < 0.5]); }
    this.GCl = []; for (let i = 0; i < 14; i++) { const d = [g(), g(), g()], l = Math.hypot(...d) || 1, rr = 0.8 + r() * 0.6; this.GCl.push([d[0] / l * rr, d[1] / l * rr, d[2] / l * rr]); }
    this.BG = []; for (let i = 0; i < 520; i++) this.BG.push([(r() - 0.5) * 5, (r() - 0.5) * 3, r()]);
    this.FG = []; for (let i = 0; i < 9; i++) this.FG.push([(r() - 0.5) * 4, (r() - 0.5) * 2.4, 0.4 + r() * 0.6]);
    this.FAR = []; for (let i = 0; i < 7; i++) this.FAR.push([(r() - 0.5) * 4.4, (r() - 0.5) * 2.6, r() * TAU, 0.04 + r() * 0.05]);
  },
  draw(u, t) {
    const rot = t * 0.02 + Math.max(-0.5, u) * 1.2, inc = lerp(1.12, 0.98, clamp(u)), roll = -0.38;
    const ci = Math.cos(inc), si = Math.sin(inc), cr = Math.cos(roll), sr = Math.sin(roll);
    const proj = (x, y, z) => { const y1 = y * ci - z * si, z1 = y * si + z * ci, pz = 1 / (1 + z1 * 0.35), px = x * pz, py = y1 * pz; return [px * cr - py * sr, px * sr + py * cr, pz]; };
    for (const [x, y, q] of this.BG) emit(x, y, 0.014 + q * 0.008, 0.12 + 0.2 * q * (0.6 + 0.4 * Math.sin(t * 2 + q * 60)), q > 0.85 ? '+' : '.');
    for (const [x, y, a, s] of this.FAR) { ring(x, y, s, s * 0.4, 0.012, 0.18, a, '.'); emit(x, y, 0.02, 0.3, '*'); }
    const A = this.A;
    for (let i = 0; i < A.length; i += 6) {
      const rr = A[i], th = A[i + 1] + rot * (0.38 / (rr + 0.15)), b0 = A[i + 3], s = A[i + 4], q = A[i + 5];
      const p = proj(Math.cos(th) * rr * 1.1, Math.sin(th) * rr * 1.1, A[i + 2]), b = b0 * (0.75 + 0.25 * Math.sin(t * 2 + q * 50)) + Math.pow(s, 14) * 0.5;
      emit(p[0], p[1], (0.012 + Math.pow(s, 12) * 0.05 + b0 * 0.008) * p[2], b, s > 0.985 ? '*' : rs(b * 0.85));
      if (i < this.nArm && i % 42 === 0 && b0 > 0.2) emit(p[0], p[1], 0.11 * p[2], 0.05 + 0.04 * b0, '#');
    }
    const Bg = this.B, ab = rot * 0.38 / 0.35, cb = Math.cos(ab), sb = Math.sin(ab);
    for (let i = 0; i < Bg.length; i += 3) { const x = Bg[i] * cb - Bg[i + 1] * sb, y = Bg[i] * sb + Bg[i + 1] * cb, p = proj(x, y, Bg[i + 2]), d = Math.hypot(Bg[i], Bg[i + 1], Bg[i + 2]), b = clamp(1 - d * 2.2) * 0.9 + 0.15; emit(p[0], p[1], (0.016 + 0.02 * Math.max(0, 1 - d * 3)) * p[2], b, rs(b)); }
    for (const [rr, th0, q, hii] of this.K) { const th = th0 + rot * (0.38 / (rr + 0.15)), p = proj(Math.cos(th) * rr * 1.1, Math.sin(th) * rr * 1.1, 0);
      if (hii) for (let k = 0; k < 5; k++) emit(p[0] + (h1(q * 99 + k) - 0.5) * 0.05, p[1] + (h1(q * 77 + k) - 0.5) * 0.03, 0.05 + 0.04 * h1(q * 55 + k), 0.1, '@%#'[k % 3]);
      else for (let k = 0; k < 9; k++) emit(p[0] + (h1(q * 99 + k) - 0.5) * 0.035, p[1] + (h1(q * 77 + k) - 0.5) * 0.025, 0.02 + 0.02 * h1(q * 33 + k), 0.85, k ? '*' : '+'); }
    for (const [x, y, z] of this.GCl) { const p = proj(x, y, z); for (let k = 0; k < 14; k++) emit(p[0] + (h1(x * 99 + k) - 0.5) * 0.03, p[1] + (h1(y * 77 + k) - 0.5) * 0.03, 0.016, 0.45, '.'); emit(p[0], p[1], 0.03, 0.5, '*'); }
    const G = '@#%*+:.'; for (let k = 0; k < 7; k++) emit(0, 0, 0.08 + k * 0.1, 0.45 - k * 0.055, G[k]);
    for (const [x, y, b] of this.FG) { emit(x, y, 0.045, b, '*'); const L = 0.18 * b; line(x - L, y, x + L, y, 0.02, 0.022, b * 0.35, '-'); line(x, y - L * 0.8, x, y + L * 0.8, 0.02, 0.022, b * 0.35, '|'); }
    text('spiral galaxy  ·  ~100,000 ly across', -VW + 0.08, VH - 0.08, 0.036, 0.4);
  }
},
// ---------------------------------------------------------------- 4
{ name: 'Arm dive → Earth', thumb: 0.75, out: { type: 'in', f: [0.34, 0.26], k: 24 },
  init() {
    const r = mulberry(14); STARS = []; for (let i = 0; i < 1300; i++) STARS.push([(r() - 0.5) * 3.6, (r() - 0.5) * 2, r(), r()]);
    const N = []; for (let i = 0; i < 2800; i++) { const x = (r() - 0.5) * 2.6, y = (r() - 0.5) * 1.6, n = fbm(x * 1.6 + 3, y * 1.6); if (n > 0.5) N.push(x, y, (n - 0.5) * 2, r()); } this.neb = new Float32Array(N);
  },
  draw(u, t) {
    const warp = sm(-0.35, 0.05, u) * (1 - sm(0.28, 0.5, u)), e = sm(0.35, 0.78, u), R = lerp(0.02, 0.85, e), C = [0.05, 0.05];
    starfield(u * 1.6 + t * 0.012, warp, t, e > 0 ? [C[0], C[1], R] : null);
    const na = 1 - sm(0.3, 0.5, u);
    if (na > 0.01) for (let L = 0; L < 3; L++) { const zf = frac(L / 3 + u * 1.3 + t * 0.01), sc = 0.25 * Math.exp(zf * 3.2), al = Math.sin(zf * Math.PI) * na, ro = L * 2.1, c = Math.cos(ro), s = Math.sin(ro), N = this.neb;
      for (let i = 0; i < N.length; i += 4) emit((N[i] * c - N[i + 1] * s) * sc, (N[i] * s + N[i + 1] * c) * sc, 0.03 * sc + 0.01, al * N[i + 2] * 0.35, rc(N[i + 2] * 0.8)); }
    const sa = sm(0.18, 0.26, u) * (1 - sm(0.42, 0.5, u));
    if (sa > 0.01) { const k = sm(0.18, 0.5, u); sun(lerp(0.3, -2.4, k), lerp(-0.1, -0.6, k), lerp(0.04, 0.7, k), t, sa); }
    if (e > 0) { earth2(C[0], C[1], R, t, t * 0.05 + u * 0.8, e); moon(C, R, t, u, e); }
  }
},
// ---------------------------------------------------------------- 5
{ name: 'Toronto', thumb: 0.18, out: { type: 'in', f: TWIN, k: 60 },
  init() {
    const r = mulberry(21), C = [];
    for (let k = 0; k < 30; k++) { const horiz = k % 2, off = (r() - 0.5) * 2.4, a = (r() - 0.5) * 0.3, main = r() < 0.25;
      for (let s = -1.3; s <= 1.3; s += 0.016) { if (r() < (main ? 0.1 : 0.4)) continue; const x = horiz ? s : off + s * a, y = horiz ? off + s * a : s; C.push(x, y, (main ? 0.6 : 0.3) + 0.4 * r()); } }
    for (let i = 0; i < 2600; i++) { const x = (r() - 0.5) * 2.6, y = (r() - 0.5) * 2.6, d = fbm(x * 2 + 5, y * 2); if (d > 0.52) C.push(x, y, 0.2 + (d - 0.52) * 2.5 * r()); }
    this.city = new Float32Array(C);
    // the harbour view from Toronto Island, traced from a photo: [left px, right px, top py, facade, crown] on a 1000 x 600 frame
    const M = [
      [0, 12, 285, 'grid'], [20, 45, 282, 'glass', 'mech'], [62, 90, 298, 'lit'], [92, 110, 318, 'grid'], [115, 145, 310, 'grid', 'mech'], [228, 242, 322, 'stripe'], [245, 265, 296, 'glass'], [266, 286, 316, 'grid'], [288, 300, 288, 'dark'],
      [318, 335, 305, 'grid'], [338, 352, 300, 'stripe'], [355, 368, 310, 'grid'], [372, 388, 288, 'grid', 'mech'], [388, 410, 265, 'glass'], [412, 428, 280, 'stripe'], [430, 450, 248, 'glass', 'mech'],
      [450, 462, 275, 'grid'], [462, 480, 230, 'glass'], [482, 500, 265, 'lit'], [500, 515, 268, 'grid'], [515, 530, 290, 'stripe'], [532, 550, 228, 'glass', 'crane'], [555, 575, 222, 'stripe', 'crane'],
      [575, 592, 290, 'grid'], [592, 612, 305, 'lit'], [612, 630, 280, 'grid'], [630, 645, 268, 'dark'], [640, 660, 255, 'grid'], [650, 680, 232, 'grid', 'spire'], [683, 700, 268, 'grid'],
      [700, 725, 250, 'lit', 'glow'], [712, 735, 238, 'grid', 'spire'], [740, 765, 235, 'stripe', 'mech'], [762, 778, 280, 'lit'], [778, 792, 290, 'grid'], [790, 810, 255, 'dark', 'mech'], [812, 828, 272, 'grid'],
      [830, 845, 262, 'glass', 'crane'], [848, 862, 290, 'grid'], [858, 870, 288, 'dark'], [875, 890, 300, 'grid'], [895, 910, 312, 'lit'], [920, 940, 298, 'grid', 'mech'], [945, 960, 320, 'grid'], [960, 980, 315, 'glass'], [980, 1000, 322, 'grid']
    ];
    const B = [];
    for (let i = 0; i < 80; i++) { const c = r() * 1000, w = 8 + r() * 18, core = Math.abs(c - 600) < 260; B.push({ x0: TX(c), x1: TX(c + w), top: TY(300 + r() * 40 - (core ? 35 : 0)), f: ['grid', 'glass', 'stripe', 'dark'][(r() * 4) | 0], cr: '', seed: r() * 1000, z: 0.55 }); }
    for (const [a, b, tp, f, cr] of M) B.push({ x0: TX(a), x1: TX(b), top: TY(tp), f, cr: cr || '', seed: r() * 1000, z: 1 });
    for (let i = 0; i < 95; i++) { const c = r() * 1000, w = 10 + r() * 26; B.push({ x0: TX(c), x1: TX(c + w), top: TY(328 + r() * 26), f: ['grid', 'lit', 'grid', 'stripe', 'glass'][(r() * 5) | 0], cr: '', seed: r() * 1000, z: 1 }); }
    // bake every static glyph of the skyline once; windows that flicker carry a flag and a phase
    const G = [], LB = new Float32Array(NB), beacons = [], cranes = [];
    const P = (x, y, s, b, ch, fl = 0, ph = 0) => { G.push(x, y, s, b, IDX[ch.charCodeAt(0)], fl, ph); if (b > 0.3) { const i = Math.floor((x + 2) / 4 * NB); if (i >= 0 && i < NB) LB[i] += b * (fl ? 0.55 : 1) * 0.085; } };
    const PL = (x1, y1, x2, y2, st, s, b, ch) => { const dx = x2 - x1, dy = y2 - y1, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / st)), c = ch || lc(dx, dy); for (let i = 0; i <= n; i++) P(x1 + dx * i / n, y1 + dy * i / n, s, b, c); };
    for (const bd of B) {
      const { x0, x1, top, f, cr, seed, z } = bd, base = WL - 0.012, w = x1 - x0, mx = (x0 + x1) / 2;
      PL(x0, top, x0, base, 0.016, 0.018, 0.3 * z, '|'); PL(x1, top, x1, base, 0.016, 0.018, 0.3 * z, '|'); PL(x0, top, x1, top, 0.013, 0.018, 0.4 * z, '-');
      let row = 0;
      for (let y = top + 0.012; y < base - 0.004; y += 0.0145, row++) { let col = 0; for (let x = x0 + 0.007; x < x1 - 0.004; x += 0.0115, col++) {
        const id = seed * 7 + row * 131 + col * 17, hv = h1(id);
        if (cr === 'glow' && y < top + 0.06) { P(x, y, 0.016, z, '#'); continue; }
        if (f === 'grid') P(x, y, 0.016, (0.45 + 0.4 * h1(id + 3)) * z, hv > 0.5 ? '#' : '=', 1, h1(id + 7) * 100);
        else if (f === 'glass') P(x, y, 0.016, (0.15 + 0.12 * h1(row * 3 + seed) + (hv > 0.9 ? 0.5 : 0)) * z, hv > 0.9 ? '#' : '-');
        else if (f === 'stripe') { const on = col % 2 === 0; P(x, y, 0.016, (on ? 0.45 + 0.3 * hv : 0.06) * z, on ? '|' : '.'); }
        else if (f === 'lit') P(x, y, 0.016, (0.6 + 0.35 * hv) * z, hv > 0.4 ? '#' : '%');
        else { const on = hv > 0.86; P(x, y, 0.016, (on ? 0.6 : 0.035) * z, on ? '=' : '.'); }
      } }
      if (cr === 'spire') { PL(mx, top, mx, top - 0.1, 0.012, 0.016, 0.7, '|'); PL(mx - 0.006, top, mx - 0.004, top - 0.05, 0.012, 0.014, 0.4, '|'); beacons.push(mx, top - 0.105); }
      if (cr === 'mech') { const a = x0 + w * 0.25, b2 = x1 - w * 0.3; PL(a, top - 0.02, b2, top - 0.02, 0.012, 0.016, 0.4, '-'); PL(a, top - 0.02, a, top, 0.012, 0.016, 0.35, '|'); PL(b2, top - 0.02, b2, top, 0.012, 0.016, 0.35, '|'); beacons.push(mx, top - 0.028); }
      if (cr === 'glow') { PL(x0, top, x1, top, 0.01, 0.018, 0.9, '='); P(mx, top - 0.02, 0.05, 0.45, '@'); }
      if (cr === 'crane') {
        const mxc = x0 + w * 0.35, jt = top - 0.075;
        for (let y = top; y > jt; y -= 0.012) { P(mxc - 0.004, y, 0.013, 0.45, '|'); P(mxc + 0.004, y, 0.013, 0.45, '|'); P(mxc, y - 0.006, 0.012, 0.3, Math.round(y * 160) % 2 ? '/' : '\\'); }
        PL(mxc - 0.045, jt, mxc + 0.13, jt, 0.009, 0.014, 0.55, '-'); PL(mxc - 0.045, jt + 0.008, mxc + 0.13, jt + 0.008, 0.009, 0.012, 0.35, '-');
        for (let x = mxc - 0.04; x < mxc + 0.13; x += 0.012) P(x + 0.006, jt + 0.004, 0.011, 0.3, Math.round(x * 160) % 2 ? '/' : '\\');
        PL(mxc, jt - 0.025, mxc + 0.12, jt, 0.01, 0.012, 0.3); PL(mxc, jt - 0.025, mxc - 0.04, jt, 0.01, 0.012, 0.3); P(mxc - 0.04, jt + 0.012, 0.024, 0.45, '#');
        cranes.push(mxc, jt, seed); beacons.push(mxc + 0.13, jt - 0.004);
      }
    }
    // Rogers Centre dome
    const rcx = TX(178), rrx = 0.13, rtop = TY(318);
    for (let k = 0; k <= 50; k++) { const a = Math.PI + k / 50 * Math.PI; P(rcx + Math.cos(a) * rrx, WL - 0.03 + Math.sin(a) * (WL - 0.03 - rtop), 0.016, 0.5, '-'); }
    for (let k = 1; k < 8; k++) { const a = Math.PI + k / 8 * Math.PI; PL(rcx, WL - 0.03, rcx + Math.cos(a) * rrx, WL - 0.03 + Math.sin(a) * (WL - 0.03 - rtop), 0.014, 0.012, 0.15); }
    for (let x = rcx - rrx; x <= rcx + rrx; x += 0.008) P(x, WL - 0.028, 0.016, 0.9, '=');
    // waterfront ribbon of lights
    for (let x = -2.0; x <= 2.0; x += 0.006) { const n = n3(x * 8, 3, 0.5); P(x, WL - 0.006 - h1(x * 991) * 0.02, 0.016, 0.3 + 0.7 * n * n, n > 0.65 ? '*' : '.'); }
    PL(-2.2, WL, 2.2, WL, 0.012, 0.018, 0.45, '_');
    this.G = new Float32Array(G); this.LB = LB; this.beacons = beacons; this.cranes = cranes; this.light = new Float32Array(NB);
    this.dot = IDX[46];
  },
  draw(u, t) {
    const v = Math.max(u + 0.35, 0), ca = 1 - sm(-0.02, 0.2, u), sa = sm(-0.08, 0.16, u);
    // coming down out of orbit: layers of city lights rushing up
    if (ca > 0.01) for (let Lr = 0; Lr < 3; Lr++) {
      const zf = frac(Lr / 3 + v * 1.5), sc = 0.35 * Math.exp(zf * 3), al = Math.sin(zf * Math.PI) * ca, ro = Lr * 1.3 + v * 0.4, c = Math.cos(ro), s = Math.sin(ro), A = this.city;
      for (let i = 0; i < A.length; i += 3) { const x = (A[i] * c - A[i + 1] * s) * sc, y = (A[i] * s + A[i + 1] * c) * sc; emit(x, y, 0.012 + 0.012 * sc, al * A[i + 2] * 0.85, A[i + 2] > 0.85 ? '+' : '.'); }
    }
    if (sa < 0.01) return;
    const ps = 1 + 0.8 * sm(0.22, 0.65, u), light = this.light; light.set(this.LB);
    withT(ps, TWIN[0] * (1 - ps), TWIN[1] * (1 - ps), sa, () => {
      const L = (x, y, s, b, ch) => { emit(x, y, s, b, ch); if (b > 0.3) { const i = Math.floor((x + 2) / 4 * NB); if (i >= 0 && i < NB) light[i] += b * 0.085; } };
      // dusk sky: glow toward the horizon, long thin clouds, a few early stars, a plane
      for (let i = 0; i < 1500; i++) { const x = (h1(i * 3.1) - 0.5) * 4.4, f = Math.pow(h1(i * 5.7), 0.45), y = lerp(-1.05, WL - 0.02, f); emit(x, y, 0.018, 0.03 + 0.42 * f * f * f * f, f > 0.85 ? ':' : '.'); }
      for (let i = 0; i < 420; i++) { const x = (h1(i * 2.3) - 0.5) * 4.4, f = Math.pow(h1(i * 4.9), 2.2), y = WL - 0.03 - f * 0.55; emit(x, y, 0.08, 0.075 * (1 - f), '-'); }
      for (let i = 0; i < 900; i++) { const x = (h1(i * 7.3) - 0.5) * 4.4, y = -1.0 + h1(i * 11.9) * 0.78, n = fbm(x * 0.8 + t * 0.01, y * 7 + 3); if (n > 0.55) emit(x, y, 0.034, (n - 0.55) * 2.4, n > 0.63 ? '=' : '-'); }
      for (let i = 0; i < 50; i++) emit((h1(i * 13) - 0.5) * 4.4, -1.02 + h1(i * 17) * 0.3, 0.014, 0.25 * (0.6 + 0.4 * Math.sin(t * 2 + i)), '.');
      const pp = frac(t * 0.025), pxp = lerp(2.2, -2.2, pp), pyp = -0.62 + pp * 0.2; emit(pxp, pyp, 0.02, 0.45, '-'); emit(pxp + 0.02, pyp, 0.018, Math.sin(t * 5) > 0.3 ? 1 : 0.1, '*');
      const beacon = Math.sin(t * 3) > 0.4 ? 1 : 0.15;
      // the baked skyline, with windows flicking on and off
      const G = this.G, dot = this.dot;
      for (let i = 0; i < G.length; i += 7) {
        if (G[i + 5]) { const on = Math.sin(t * 0.21 + G[i + 6]) > -0.35; emit(G[i], G[i + 1], G[i + 2], on ? G[i + 3] : 0.05, on ? G[i + 4] : dot); }
        else emit(G[i], G[i + 1], G[i + 2], G[i + 3], G[i + 4]);
      }
      const Bc = this.beacons; for (let i = 0; i < Bc.length; i += 2) L(Bc[i], Bc[i + 1], 0.022, beacon * (0.6 + 0.4 * h1(i)), '*');
      const Cr = this.cranes; for (let i = 0; i < Cr.length; i += 3) { const hk = Cr[i] + 0.06 + 0.04 * Math.sin(t * 0.3 + Cr[i + 2]); line(hk, Cr[i + 1] + 0.008, hk, Cr[i + 1] + 0.06, 0.01, 0.01, 0.3, '|'); emit(hk, Cr[i + 1] + 0.064, 0.014, 0.5, 'J'); }
      // CN Tower
      const cx = TX(305), pod = TY(185), sky = TY(163), tip = TY(86);
      for (const s of [-1, 1]) { line(cx + s * 0.03, WL - 0.01, cx + s * 0.009, pod + 0.02, 0.012, 0.018, 0.55); line(cx + s * 0.05, WL - 0.01, cx + s * 0.02, WL - 0.07, 0.012, 0.016, 0.45); }
      for (let y = WL - 0.02; y > pod + 0.02; y -= 0.013) { const f = (WL - y) / (WL - pod), wv = lerp(0.02, 0.006, f), pul = 0.45 + 0.5 * Math.pow(frac(-y * 1.4 + t * 0.35), 5); L(cx - wv * 0.5, y, 0.016, pul, '|'); L(cx + wv * 0.5, y, 0.016, pul, '|'); emit(cx, y, 0.012, 0.2, ':'); }
      ring(cx, pod, 0.034, 0.011, 0.014, 0.8); ring(cx, pod + 0.016, 0.028, 0.008, 0.013, 0.6);
      for (let k = 0; k < 11; k++) L(cx - 0.028 + k * 0.0056, pod + 0.004, 0.014, 0.9 + 0.1 * Math.sin(t * 2 + k), '=');
      emit(cx, pod + 0.004, 0.06, 0.3, '@');
      line(cx - 0.005, pod - 0.012, cx - 0.004, sky + 0.01, 0.011, 0.014, 0.55, '|'); line(cx + 0.005, pod - 0.012, cx + 0.004, sky + 0.01, 0.011, 0.014, 0.55, '|');
      ring(cx, sky, 0.011, 0.005, 0.011, 0.75); L(cx, sky, 0.014, 0.85, '=');
      line(cx, sky - 0.008, cx, tip, 0.011, 0.012, 0.6, '|'); L(cx, tip - 0.006, 0.022, beacon, '*'); emit(cx, tip, 0.05, 0.25 * beacon, '@');
      // the window the camera goes through: someone's monitor glowing inside
      const [wx, wy] = TWIN; rect2(wx - 0.009, wy - 0.008, wx + 0.009, wy + 0.008, 0.9); emit(wx, wy, 0.014, 0.95, '#'); emit(wx, wy, 0.05, 0.25, '@');
      for (let k = 0; k < 4; k++) emit(wx - 0.005 + k * 0.0034, wy - 0.003 + (k % 2) * 0.003, 0.004, 0.9, '-');
      // the harbour: long vertical reflections under every light, shimmering, plus faint ripples and a ferry
      let mx = 0.001; for (let i = 0; i < NB; i++) mx = Math.max(mx, light[i]);
      for (let i = 0; i < NB; i++) { const q = light[i] / mx, br = Math.pow(q, 1.15); if (br < 0.1) continue; const x = -2 + (i + 0.5) / NB * 4, len = 0.08 + q * 0.62;
        for (let y = WL + 0.01; y < WL + len; y += 0.016) { const d = (y - WL) / len, sh = 0.55 + 0.45 * Math.sin(y * 80 + t * 2.5 + i * 1.7); emit(x + Math.sin(y * 35 + t * 2 + i) * 0.004, y, 0.019, Math.min(1, br * 1.1) * (1 - d * 0.85) * sh, d < 0.45 ? '|' : (h1(i * 7 + y * 100) > 0.5 ? ':' : '|')); } }
      for (let y = WL + 0.01; y < WL + 0.8; y += 0.016) emit(TX(305) + Math.sin(y * 30 + t * 2) * 0.004, y, 0.02, 0.9 * (1 - (y - WL) / 0.8), '|');
      for (let i = 0; i < 260; i++) { const x = (h1(i * 13) - 0.5) * 4.4, y = WL + 0.02 + h1(i * 17) * 0.8; emit(x + Math.sin(t + i) * 0.02, y, 0.022, 0.08, '-'); }
      const fx = lerp(-1.7, 1.7, frac(t * 0.012)); line(fx - 0.05, WL + 0.12, fx + 0.05, WL + 0.12, 0.012, 0.016, 0.5, '='); for (let k = 0; k < 7; k++) emit(fx - 0.04 + k * 0.013, WL + 0.11, 0.014, 0.85, '.');
      text('toronto  ·  43.65 N  79.38 W', -1.62, 0.9, 0.03, 0.4);
    });
  }
},
// ---------------------------------------------------------------- 6
// the landing: every character of the real page flies in along a streak and lands exactly on top of
// its own text in the DOM (positions measured from the page, see measureTargets), then the page fades in
{ name: 'Your site', out: null,
  init() {},
  draw(u, t) {
    const Tg = TARGETS, v = Math.max(u + 0.35, 0);
    for (let i = 0; i < Tg.length; i++) {
      const [tx, ty, sz, lum, ch] = Tg[i], id = i * 7.31 + 3, d = h1(id * 3.7) * 0.45, k = sm(0.06 + d, 0.42 + d, u);
      const th = h1(id) * TAU, r0 = 0.15 + Math.pow(h1(id + 0.5), 0.7) * 2.1 + (1 - k) * v * 0.5, sx = Math.cos(th) * r0 * 1.15, sy = Math.sin(th) * r0;
      const sw = Math.sin(k * Math.PI) * 0.3, x = lerp(sx, tx, k) - Math.sin(th) * sw, y = lerp(sy, ty, k) + Math.cos(th) * sw;
      const fin = Math.min(1, lum * 1.1 + 0.04), b = lerp(0.75, fin, k) * (k < 1 ? 0.75 + 0.25 * Math.sin(t * 9 + i) : 1);
      emit(x, y, lerp(0.03 + h1(id + 0.25) * 0.06, sz, k), b, ch);
      if (k < 0.85) { let dx = k < 0.02 ? Math.cos(th) * 1.15 : tx - sx, dy = k < 0.02 ? Math.sin(th) : ty - sy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; const c = lc(dx, dy), tl = 0.03 + 0.04 * (1 - k);
        for (let j = 1; j <= 4; j++) emit(x - dx * tl * j, y - dy * tl * j, 0.02, b * (1 - k) * (0.55 - j * 0.12), c); }
    }
  }
}
];
const TR = 0.35;

function drawMontage(T, time) {
  T = clamp(T, 0, NS - 0.0001);
  const i = Math.floor(T), u = T - i;
  setT(1, 0, 0, 1);
  if (i < NS - 1 && u > 1 - TR) {
    const w = (u - (1 - TR)) / TR, A = SCENES[i], B = SCENES[i + 1], tr = A.out, uB = u - 1;
    if (tr.type === 'cross') { const e = sm(0, 1, w); setT(1, 0, 0, 1 - e); A.draw(u, time); setT(1, 0, 0, e); B.draw(uB, time); return; }
    const zin = tr.type === 'in', ww = zin ? w : 1 - w, outer = zin ? A : B, inner = zin ? B : A, uo = zin ? u : uB, ui = zin ? uB : u;
    nest(ww, tr.k, tr.f, () => outer.draw(uo, time), () => inner.draw(ui, time));
    return;
  }
  SCENES[i].draw(u, time);
}

// ================================================================ renderers
const TINT = '#9fd4ff', TINTV = [159 / 255, 212 / 255, 1];
const VS_G = `#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 inst;
layout(location=2) in float ch;
uniform vec2 res; uniform vec2 grid;
out vec2 uv; out float vb;
void main() {
  float s = max(inst.z, 1.5);
  vec2 p = inst.xy + (corner - 0.5) * s;
  vec2 c = p / res * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  float col = mod(ch, grid.x), row = floor(ch / grid.x + 0.001);
  uv = (vec2(col, row) + corner) / grid;
  float k = min(1.0, inst.z / 1.5);
  vb = min(1.0, inst.w * 1.3) * k * k;
}`;
const FS_G = `#version 300 es
precision highp float;
in vec2 uv; in float vb; uniform sampler2D atlas; out vec4 o;
void main() { float a = texture(atlas, uv).a * vb; o = vec4(a, a, a, 1.0); }`;
const VS_F = `#version 300 es
void main() { vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }`;
const FS_COPY = `#version 300 es
precision highp float;
uniform sampler2D src; uniform vec2 dres; out vec4 o;
void main() { o = texture(src, gl_FragCoord.xy / dres); }`;
const FS_COMP = `#version 300 es
precision highp float;
uniform sampler2D g; uniform sampler2D bl; uniform vec2 res; uniform vec2 bres; uniform vec3 tint; out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / res; float v = texture(g, uv).r, b = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) b += texture(bl, uv + vec2(float(i), float(j)) / bres).r;
  b /= 9.0;
  o = vec4(tint * (v + b * 0.75 + 0.03), 1.0);
}`;
class GLR {
  constructor(canvas, preserve) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: !!preserve });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    this.pG = prog(VS_G, FS_G); this.pC = prog(VS_F, FS_COPY); this.pK = prog(VS_F, FS_COMP);
    const L = (p, n) => gl.getUniformLocation(p, n);
    this.u = { res: L(this.pG, 'res'), grid: L(this.pG, 'grid'), atlas: L(this.pG, 'atlas'), src: L(this.pC, 'src'), dres: L(this.pC, 'dres'), g: L(this.pK, 'g'), bl: L(this.pK, 'bl'), kres: L(this.pK, 'res'), bres: L(this.pK, 'bres'), tint: L(this.pK, 'tint') };
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.ib); gl.bufferData(gl.ARRAY_BUFFER, MAX * 20, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 20, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null); this.evao = gl.createVertexArray();
    this.data = new Float32Array(MAX * 5);
    this.atlas = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ATLAS); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.W = 0; this.H = 0; this.targets = [];
  }
  tex(w, h) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const o = { t, f, w, h }; this.targets.push(o); return o;
  }
  resize(W, H) {
    const gl = this.gl; for (const o of this.targets) { gl.deleteTexture(o.t); gl.deleteFramebuffer(o.f); } this.targets = [];
    this.g = this.tex(W, H); this.b = [this.tex(Math.max(1, W >> 1), Math.max(1, H >> 1)), this.tex(Math.max(1, W >> 2), Math.max(1, H >> 2)), this.tex(Math.max(1, W >> 3), Math.max(1, H >> 3))];
    this.W = W; this.H = H;
  }
  draw(W, H, U) {
    if (W !== this.W || H !== this.H) this.resize(W, H);
    const gl = this.gl, d = this.data, cx = W / 2, cy = H / 2, u = this.u; let n = 0;
    for (let k = 0; k < GN; k++) { const sz = GS[k] * U; if (sz > W * 3) continue; const o = n * 5; d[o] = cx + GX[k] * U; d[o + 1] = cy + GY[k] * U; d[o + 2] = sz; d[o + 3] = GB[k]; d[o + 4] = GC[k]; n++; }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ib); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 5);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.g.f); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.pG); gl.bindVertexArray(this.vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(u.atlas, 0); gl.uniform2f(u.res, W, H); gl.uniform2f(u.grid, AC, AR);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.disable(gl.BLEND); gl.bindVertexArray(this.evao); gl.useProgram(this.pC); gl.uniform1i(u.src, 0);
    let src = this.g;
    for (const dst of this.b) { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform2f(u.dres, dst.w, dst.h); gl.drawArrays(gl.TRIANGLES, 0, 3); src = dst; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(this.pK);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.g.t); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src.t);
    gl.uniform1i(u.g, 0); gl.uniform1i(u.bl, 1); gl.uniform2f(u.kres, W, H); gl.uniform2f(u.bres, src.w, src.h); gl.uniform3f(u.tint, TINTV[0], TINTV[1], TINTV[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.activeTexture(gl.TEXTURE0);
    return n;
  }
}
class View {
  constructor(canvas, cap, preserve) {
    this.c = canvas; this.cap = cap; this.W = 0; this.H = 0; this.gl = null;
    try { this.gl = new GLR(canvas, preserve); } catch (e) { this.gl = null; }
    if (!this.gl) { this.ctx = canvas.getContext('2d'); this.off = document.createElement('canvas'); this.ox = this.off.getContext('2d'); this.bl = document.createElement('canvas'); this.bx = this.bl.getContext('2d'); }
  }
  fit(w, h) {
    let W = w, H = h;
    if (!W) { const r = this.c.getBoundingClientRect(), d = Math.min(this.cap, window.devicePixelRatio || 1); W = Math.max(2, Math.round(r.width * d)); H = Math.max(2, Math.round(r.height * d)); }
    if (W !== this.W || H !== this.H) { this.W = this.c.width = W; this.H = this.c.height = H; if (!this.gl) { this.off.width = W; this.off.height = H; this.bl.width = Math.max(1, W >> 3); this.bl.height = Math.max(1, H >> 3); } }
  }
  render(fn, w, h) {
    if (!ATLAS) return;
    this.fit(w, h);
    const W = this.W, H = this.H, U = Math.min(W, H) / 2, cx = W / 2, cy = H / 2;
    VW = W / 2 / U; VH = H / 2 / U; GN = 0; fn();
    if (this.gl) { this.n = this.gl.draw(W, H, U); return; }
    // 2D canvas fallback for browsers without WebGL2
    const o = this.ox;
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.fillStyle = '#000'; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'lighter'; o.fillStyle = '#fff';
    for (let k = 0; k < GN; k++) {
      const sz = GS[k] * U, px = cx + GX[k] * U, py = cy + GY[k] * U;
      if (sz < 2) { o.globalAlpha = GB[k] * Math.max(0.2, sz * 0.5); o.fillRect(px, py, 1, 1); continue; }
      if (sz > W * 3) continue;
      o.globalAlpha = Math.min(1, GB[k] * 1.3); o.drawImage(ATLAS, (GC[k] % AC) * AS, Math.floor(GC[k] / AC) * AS, AS, AS, px - sz / 2, py - sz / 2, sz, sz);
    }
    const m = this.ctx;
    m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1; m.fillStyle = TINT; m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'multiply'; m.drawImage(this.off, 0, 0);
    const b = this.bx, bw = this.bl.width, bh = this.bl.height;
    b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.imageSmoothingQuality = 'high'; b.drawImage(this.off, 0, 0, bw, bh);
    b.globalCompositeOperation = 'multiply'; b.fillStyle = TINT; b.fillRect(0, 0, bw, bh);
    m.globalCompositeOperation = 'lighter'; m.globalAlpha = 0.75; m.imageSmoothingEnabled = true; m.drawImage(this.bl, 0, 0, W, H);
    m.globalAlpha = 0.03; m.fillStyle = TINT; m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
    this.n = GN;
  }
}

// ================================================================ the intro on the home page
const root = document.documentElement;
let TARGETS = [];

function addReplay() {
  const f = document.querySelector('footer');
  if (!f || f.querySelector('.replay')) return;
  const a = document.createElement('a'); a.href = '/?intro'; a.className = 'replay'; a.textContent = 'replay intro';
  f.append('  ·  ', a);
}
if (!root.classList.contains('v2')) return;
if (!root.classList.contains('intro')) { addReplay(); return; }
window.__introStarted = true;

function luminance(c) { const m = c.match(/[\d.]+/g); if (!m) return 0.7; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }
// where every visible character of the page sits, in the montage's view units
function measureTargets() {
  const out = [], W = innerWidth, H = innerHeight, U = Math.min(W, H) / 2, range = document.createRange();
  for (const rootEl of document.querySelectorAll('header, main, .next-hint, footer')) {
    if (rootEl.hidden) continue;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement, cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
      const fs = parseFloat(cs.fontSize), lum = luminance(cs.color), txt = n.textContent;
      for (let i = 0; i < txt.length; i++) {
        const ch = txt[i], code = ch.charCodeAt(0);
        if (code > 127 || IDX[code] < 0) continue;
        range.setStart(n, i); range.setEnd(n, i + 1);
        const r = range.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > H) continue;
        out.push([(r.left + r.width / 2 - W / 2) / U, (r.top + r.height / 2 - H / 2) / U, fs / 0.8 / U, lum, ch]);
      }
    }
  }
  TARGETS = out;
}

// the layer: a canvas over the page, a transparent scroller on top that turns scrolling into the timeline
const cv = document.createElement('canvas'); cv.className = 'intro-canvas intro-ui'; cv.setAttribute('aria-hidden', 'true');
const sc = document.createElement('div'); sc.className = 'intro-scroll intro-ui'; sc.tabIndex = -1; sc.setAttribute('aria-label', 'intro animation, scroll to play');
const spacer = document.createElement('div'); sc.appendChild(spacer);
const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'intro-skip intro-ui'; skip.textContent = 'skip intro';
const hint = document.createElement('div'); hint.className = 'intro-hint intro-ui'; hint.textContent = 'scroll ↓';
document.body.append(cv, sc, skip, hint);

const NS = SCENES.length;
let view = null, Tsc = 0, Ttarget = 0, done = false, clock = 3, last = performance.now();
const sizeSpacer = () => { spacer.style.height = (NS + 1) * sc.clientHeight + 'px'; };
sc.addEventListener('scroll', () => {
  const max = sc.scrollHeight - sc.clientHeight;
  Ttarget = max > 0 ? Math.min(NS, sc.scrollTop / max * NS) : 0;
  hint.style.opacity = sc.scrollTop > 40 ? '0' : '1';
}, { passive: true });

function finish() {
  if (done) return;
  done = true;
  try { localStorage.setItem('sz-intro', '1'); } catch (e) {}
  window.__introQuietUntil = Date.now() + 1500; // let a still-spinning scroll gesture die out before scroll.js listens again
  root.style.setProperty('--intro-o', '1');
  cv.style.transition = 'opacity .6s'; cv.style.opacity = '0';
  sc.remove(); skip.remove(); hint.remove();
  setTimeout(() => { root.classList.remove('intro'); root.style.removeProperty('--intro-o'); cv.remove(); addReplay(); }, 650);
}
skip.addEventListener('click', finish);
document.addEventListener('keydown', e => { if (e.key === 'Escape') finish(); });

function frame(now) {
  if (done) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  Tsc += (Ttarget - Tsc) * Math.min(1, dt * 5);
  view.render(() => drawMontage(Tsc, clock));
  const uF = Tsc - (NS - 1);
  root.style.setProperty('--intro-o', String(sm(0.88, 0.99, uF)));
  cv.style.opacity = String(1 - sm(0.95, 1.0, uF));
  if (Tsc > NS - 0.004 && Ttarget > NS - 0.001) { finish(); return; }
  requestAnimationFrame(frame);
}

function start() {
  buildAtlas(); SCENES.forEach(s => s.init());
  view = new View(cv, 1.5);
  measureTargets(); sizeSpacer(); sc.scrollTop = 0; sc.focus({ preventScroll: true });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measureTargets(); sizeSpacer(); }, 150); });
  requestAnimationFrame(t => { last = t; frame(t); });
}
if (!document.querySelector('link[href*="IBM+Plex+Mono"]')) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&display=swap'; document.head.appendChild(l);
}
let started = false;
const go = () => { if (started) return; started = true; start(); };
if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('40px "IBM Plex Mono"'), new Promise(r => setTimeout(r, 1500))]).then(go, go); else go();
})();
