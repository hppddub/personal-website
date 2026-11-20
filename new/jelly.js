// ascii jellyfish: a 3d bell, oral arms and tentacles rasterised into a
// character grid. brightness picks the glyph, a score per cell decides which
// layer shows through (so bright insides read through a dim, glassy dome).
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // wallpaper mode (window.js on v2 pages): one ice hue, no frame, paused while the window covers it
  var WALL = !!window.JELLY_WALLPAPER;
  var FAMILY = "ui-monospace, 'Cascadia Mono', 'SF Mono', Menlo, Consolas, 'Courier New', monospace";
  var SIM_DT = 1 / 30;

  var RAMP = " .`'-:;!il1|tjrxzvcunoaeLCJ0Q8&%$#B@";
  var LETTERS = "aenoucszxrvjtfLCJUYXZ0OQ8&%$#BM@W";
  var PETAL = "oaeQ0O8&%$#B@";

  var bgC = document.getElementById('bg');
  var glowC = document.getElementById('glow');
  var fgC = document.getElementById('fg');
  var bgX = bgC.getContext('2d');
  var glowX = glowC.getContext('2d');
  var fgX = fgC.getContext('2d');

  var W, H, dpr, FONT, LINE, CW, OX, OY;

  // ---------- helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function frac(v) { return v - Math.floor(v); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function wrapAng(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function pick(ramp, b, j) {
    var k = Math.round(b * (ramp.length - 1) + j);
    return ramp[k < 1 ? 1 : k > ramp.length - 1 ? ramp.length - 1 : k];
  }

  var colorCache = new Map();
  function hsl(h, s, l) {
    if (WALL) { h = 205; s = s * 0.5; }
    h = ((Math.round(h / 3) * 3) % 360 + 360) % 360;
    s = clamp(Math.round(s / 5) * 5, 0, 100);
    l = clamp(Math.round(l / 2) * 2, 0, 100);
    var key = h * 1e6 + s * 1e3 + l;
    var v = colorCache.get(key);
    if (!v) { v = 'hsl(' + h + ',' + s + '%,' + l + '%)'; colorCache.set(key, v); }
    return v;
  }

  // a quick contraction, then a slow relax
  function contraction(ph) {
    var A = 0.22;
    if (ph < A) return smooth(ph / A);
    return 1 - smooth((ph - A) / (1 - A));
  }

  // ---------- character grid ----------
  function Grid() {}
  Grid.prototype.resize = function (cols, rows) {
    this.cols = cols; this.rows = rows;
    var n = cols * rows;
    this.ch = new Array(n);
    this.col = new Array(n);
    this.score = new Float32Array(n);
    this.clear();
  };
  Grid.prototype.clear = function () { this.ch.fill(''); this.score.fill(-1e9); };
  Grid.prototype.put = function (x, y, score, ch, color) {
    x -= OX; y -= OY;
    if (x < 0 || y < 0) return;
    var c = (x / CW) | 0, r = (y / LINE) | 0;
    if (c >= this.cols || r >= this.rows) return;
    var k = r * this.cols + c;
    if (score <= this.score[k]) return;
    this.score[k] = score; this.ch[k] = ch; this.col[k] = color;
  };
  Grid.prototype.putCell = function (c, r, score, ch, color) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    var k = r * this.cols + c;
    if (score <= this.score[k]) return;
    this.score[k] = score; this.ch[k] = ch; this.col[k] = color;
  };
  Grid.prototype.draw = function (ctx) {
    ctx.clearRect(0, 0, W, H);
    var n = 0, last = null, cols = this.cols;
    for (var r = 0; r < this.rows; r++) {
      for (var c = 0; c < cols; c++) {
        var k = r * cols + c, ch = this.ch[k];
        if (!ch || ch === ' ') continue;
        var color = this.col[k];
        if (color !== last) { ctx.fillStyle = color; last = color; }
        ctx.fillText(ch, OX + c * CW, OY + r * LINE);
        n++;
      }
    }
    return n;
  };

  var fgGrid = new Grid(), bgGrid = new Grid();

  // ---------- jellyfish ----------
  var CURL = 1.85, COS_CURL = Math.cos(CURL), RIM_LAG = 0.2, LAPPETS = 16;
  var LIGHT = (function () { var x = -0.35, y = 0.55, z = 0.75, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();

  function Chain(n, seg) {
    this.n = n; this.seg = seg;
    this.p = new Float32Array(n * 3);
    this.o = new Float32Array(n * 3);
    this.placed = false;
  }
  Chain.prototype.place = function (x, y, z, dx, dy) {
    for (var k = 0; k < this.n; k++) {
      var i = k * 3;
      this.p[i] = this.o[i] = x + dx * this.seg * k;
      this.p[i + 1] = this.o[i + 1] = y + dy * this.seg * k;
      this.p[i + 2] = this.o[i + 2] = z;
    }
    this.placed = true;
  };
  // verlet: anchored at point 0, pushed along (fx, fy) plus a sideways sway
  Chain.prototype.step = function (ax, ay, az, fx, fy, sway, swx, swy, damp, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    var p = this.p, o = this.o, n = this.n, seg = this.seg;
    p[0] = ax; p[1] = ay; p[2] = az;
    for (var k = 1; k < n; k++) {
      var i = k * 3, s = k / n;
      var vx = (p[i] - o[i]) * damp, vy = (p[i + 1] - o[i + 1]) * damp, vz = (p[i + 2] - o[i + 2]) * damp;
      o[i] = p[i]; o[i + 1] = p[i + 1]; o[i + 2] = p[i + 2];
      var w = Math.sin(sway - k * 0.22) * Math.sqrt(s), sp = (1 - s) * (1 - s);
      p[i] += vx + fx + swx * w + ox * sp;
      p[i + 1] += vy + fy + swy * w + oy * sp;
      p[i + 2] += vz;
    }
    for (var it = 0; it < 4; it++) {
      for (k = 1; k < n; k++) {
        var a = (k - 1) * 3, b = k * 3;
        var dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        var d = (len - seg) / len;
        if (k === 1) { p[b] -= dx * d; p[b + 1] -= dy * d; p[b + 2] -= dz * d; }
        else {
          d *= 0.5;
          p[a] += dx * d; p[a + 1] += dy * d; p[a + 2] += dz * d;
          p[b] -= dx * d; p[b + 1] -= dy * d; p[b + 2] -= dz * d;
        }
      }
    }
  };

  function Jelly(o) {
    this.R = o.R; this.H = o.R * (o.hk || 0.78);
    this.x = o.x; this.y = o.y; this.z = 0;
    this.vx = 0; this.vy = 0;
    this.A = o.A || 0;
    this.yaw = o.yaw || 0; this.yawSpeed = o.yawSpeed || 0.12;
    this.pitch = o.pitch == null ? 0.32 : o.pitch;
    this.period = o.period || 2.2;
    this.ph = o.ph || 0;
    this.nu = o.nu; this.nth = o.nth;
    this.mono = o.mono == null ? null : o.mono;
    this.dim = o.dim || 1;
    this.nTent = o.nTent; this.nArms = o.nArms;
    this.beats = 0; this.c = 0; this.prevC = 0;
    this.thrust = o.thrust || 0.02;
    this.seed = Math.random() * 100;
    this.J = new Float32Array(this.nu * this.nth);
    for (var i = 0; i < this.J.length; i++) this.J[i] = Math.random();
    this.tents = [];
    for (i = 0; i < this.nTent; i++) this.tents.push(new Chain(o.tentPts, this.R * o.tentLen / o.tentPts));
    this.arms = [];
    for (i = 0; i < this.nArms; i++) this.arms.push(new Chain(o.armPts, this.R * o.armLen / o.armPts));
    this.glints = [];
    this.v = { x: 0, y: 0, z: 0 };
  }

  Jelly.prototype.orient = function () {
    this.cp = Math.cos(this.pitch); this.sp = Math.sin(this.pitch);
    this.cA = Math.cos(this.A); this.sA = Math.sin(this.A);
  };
  // local (x, y up the axis, z) -> view space (x right, y up, z towards viewer)
  Jelly.prototype.view = function (lx, ly, lz) {
    var ly2 = ly * this.cp - lz * this.sp, lz2 = ly * this.sp + lz * this.cp;
    var v = this.v;
    v.x = lx * this.cA + ly2 * this.sA;
    v.y = -lx * this.sA + ly2 * this.cA;
    v.z = lz2;
    return v;
  };
  // meridian of the bell: radius and height at u (0 crown, 1 rim) under squeeze cu
  Jelly.prototype.meridian = function (u, cu, out) {
    var a = u * CURL, s = Math.sin(a);
    out[0] = this.R * Math.pow(s > 0 ? s : 0, 0.75) * (1 - 0.2 * cu * Math.pow(u, 1.3)) * (1 + 0.12 * (1 - cu) * Math.pow(u, 8));
    out[1] = this.H * ((Math.cos(a) - COS_CURL) / (1 - COS_CURL) * (1 + 0.14 * cu) - 0.55);
  };
  var M0 = [0, 0], M1 = [0, 0];

  Jelly.prototype.rimPoint = function (th, out) {
    var cu = contraction(frac(this.ph - RIM_LAG));
    this.meridian(1, cu, M0);
    var tw = th + this.yaw;
    var r = M0[0] * (1 + 0.07 * Math.cos(LAPPETS * th));
    var v = this.view(r * Math.cos(tw), M0[1], r * Math.sin(tw));
    out[0] = this.x + v.x; out[1] = this.y - v.y; out[2] = this.z + v.z;
  };

  Jelly.prototype.update = function (dt, t) {
    var prevPh = this.ph;
    this.ph = frac(this.ph + dt / this.period);
    if (this.ph < prevPh) { this.beats++; this.onBeat = true; }
    this.prevC = this.c;
    this.c = contraction(this.ph);
    this.yaw += this.yawSpeed * dt;
    this.orient();

    var dc = this.c - this.prevC;
    if (dc > 0) {
      var k = dc * this.thrust * this.R * (this.thrustScale == null ? 1 : this.thrustScale);
      this.vx += this.sA * k; this.vy -= this.cA * k;
    }
    this.vx *= 0.97; this.vy *= 0.97;
    this.vy += 0.00012 * this.R * (this.sink || 1);
    this.x += this.vx; this.y += this.vy;

    // tentacles and arms trail behind the bell
    var R = this.R, down = 0.05 * R / 100;
    var bx = -this.sA, by = this.cA; // pointing away from the crown, on screen
    var rim = [0, 0, 0];
    for (var i = 0; i < this.tents.length; i++) {
      var th = (i + 0.5) / this.tents.length * TAU;
      this.rimPoint(th, rim);
      var ch = this.tents[i];
      if (!ch.placed) ch.place(rim[0], rim[1], rim[2], bx, by);
      var odx = rim[0] - this.x, ody = rim[1] - this.y, odl = Math.hypot(odx, ody) || 1;
      ch.step(rim[0], rim[1], rim[2],
        bx * 0.025 * R / 100, by * 0.025 * R / 100 + down,
        t * 1.1 + i * 1.7 + this.seed, this.cA * 0.16 * R / 100, this.sA * 0.16 * R / 100, 0.93,
        odx / odl * 0.09 * R / 100, ody / odl * 0.09 * R / 100);
    }
    for (i = 0; i < this.arms.length; i++) {
      var phi = this.yaw + TAU / 8 + i * TAU / this.arms.length;
      var v = this.view(0.1 * R * Math.cos(phi), -0.38 * this.H, 0.1 * R * Math.sin(phi));
      var ax = this.x + v.x, ay = this.y - v.y, az = this.z + v.z;
      var a = this.arms[i];
      if (!a.placed) a.place(ax, ay, az, bx, by);
      a.step(ax, ay, az,
        bx * 0.09 * R / 100, by * 0.09 * R / 100,
        t * 1.1 + i * 2.3 + this.seed, this.cA * 0.05 * R / 100, this.sA * 0.05 * R / 100, 0.9);
    }

    // sparks shed from the rim on each beat
    if (this.onBeat && this.sparks) {
      this.onBeat = false;
      this.spawnGlints(this.sparks);
    }
    this.onBeat = false;
    for (i = this.glints.length - 1; i >= 0; i--) {
      var g = this.glints[i];
      g.age += dt;
      if (g.age > g.life) { this.glints.splice(i, 1); continue; }
      g.x += g.vx; g.y += g.vy; g.vx *= 0.97; g.vy = g.vy * 0.97 + 0.01;
    }

    // refresh a few glyph jitters so the letters shimmer
    var J = this.J;
    for (i = 0; i < J.length * 0.03; i++) J[(Math.random() * J.length) | 0] = Math.random();
  };

  Jelly.prototype.spawnGlints = function (n) {
    var rim = [0, 0, 0];
    for (var i = 0; i < n; i++) {
      var th = Math.random() * TAU;
      this.rimPoint(th, rim);
      var dx = rim[0] - this.x, dy = rim[1] - this.y, l = Math.hypot(dx, dy) || 1;
      var sp = 0.6 + Math.random() * 1.4;
      this.glints.push({ x: rim[0], y: rim[1], vx: dx / l * sp, vy: dy / l * sp - 0.4, age: 0, life: 1 + Math.random() * 1.2, tw: Math.random() * 50 });
    }
  };

  Jelly.prototype.render = function (grid, t) {
    var R = this.R, H = this.H, nu = this.nu, nth = this.nth, mono = this.mono, dim = this.dim, J = this.J;
    var Lx = LIGHT[0], Ly = LIGHT[1], Lz = LIGHT[2];
    var i, j, u, cu, th, tw, v, b, score, hue, nr, ny, nl, x, y, z;

    // --- bell: outer surface (exumbrella) ---
    for (i = 0; i < nu; i++) {
      u = (i + 0.5) / nu;
      cu = contraction(frac(this.ph - RIM_LAG * u));
      this.meridian(u, cu, M0);
      this.meridian(u + 0.01, cu, M1);
      nr = -(M1[1] - M0[1]); ny = M1[0] - M0[0];
      nl = Math.hypot(nr, ny) || 1; nr /= nl; ny /= nl;
      var u6 = Math.pow(u, 6);
      var petalBand = Math.exp(-Math.pow((u - 0.42) / 0.13, 2));
      for (j = 0; j < nth; j++) {
        th = j / nth * TAU; tw = th + this.yaw;
        var ct = Math.cos(tw), st = Math.sin(tw);
        var r = M0[0] * (1 + 0.07 * u6 * Math.cos(LAPPETS * th));
        // normal
        v = this.view(nr * ct, ny, nr * st);
        var nx = v.x, nyv = v.y, nz = v.z;
        v = this.view(r * ct, M0[1], r * st);
        x = this.x + v.x; y = this.y - v.y; z = v.z;

        var lam = nx * Lx + nyv * Ly + nz * Lz; if (lam < 0) lam = 0;
        var fres = 1 - Math.abs(nz);
        b = 0.04 + 0.26 * lam * lam + 0.85 * Math.pow(fres, 2.4);
        var jit = (J[i * nth + j] - 0.5) * 3;
        var ramp = RAMP, hueShift = 0;
        // petals painted on the dome, radial canals, a bright scalloped rim
        var petal = petalBand * Math.pow(0.5 + 0.5 * Math.cos(4 * th), 4);
        if (petal > 0.3) { b += 0.5 * petal; ramp = PETAL; hueShift = 30; }
        var canal = Math.pow(0.5 + 0.5 * Math.cos(LAPPETS * th), 40);
        if (u > 0.15) b += 0.12 * canal;
        if (u > 0.93) b += 0.25;
        var back = nz < 0;
        if (back) b *= 0.45;
        b = clamp(b, 0, 1);
        score = b + 0.3 * z / R - (back ? 0.3 : 0);
        var ch = pick(ramp, b, jit);
        if (mono != null) hue = mono + 20 * u;
        else hue = 48 + 190 * Math.pow(u, 1.1) + 22 * Math.sin(th + t * 0.4) + hueShift;
        grid.put(x, y, score, ch, mono != null
          ? hsl(hue, 55, (10 + 52 * b) * dim)
          : hsl(hue, 82, 18 + 60 * b));
      }
    }

    // --- bell: inner surface (subumbrella), seen through the glass ---
    var nuIn = Math.max(4, (nu * 0.6) | 0);
    for (i = 0; i < nuIn; i++) {
      u = 0.25 + 0.75 * (i + 0.5) / nuIn;
      cu = contraction(frac(this.ph - RIM_LAG * u));
      this.meridian(u, cu, M0);
      for (j = 0; j < nth; j += 2) {
        th = j / nth * TAU; tw = th + this.yaw;
        var rr = M0[0] * 0.84;
        v = this.view(rr * Math.cos(tw), M0[1] - 0.06 * H, rr * Math.sin(tw));
        x = this.x + v.x; y = this.y - v.y; z = v.z;
        b = 0.1 + 0.3 * Math.pow(u, 3);
        score = b + 0.3 * z / R - 0.25;
        hue = mono != null ? mono + 25 : 210 + 40 * u;
        grid.put(x, y, score, pick(RAMP, b, (J[i * nth + j] - 0.5) * 2), mono != null
          ? hsl(hue, 50, (8 + 40 * b) * dim) : hsl(hue, 70, 12 + 50 * b));
      }
    }

    // --- stomach / manubrium, a dense knot under the crown ---
    var sn = Math.max(6, (nu * 0.5) | 0);
    for (i = 0; i < sn; i++) {
      var a = (i + 0.5) / sn * Math.PI;
      for (j = 0; j < sn * 2; j++) {
        var bb = j / (sn * 2) * TAU + this.yaw;
        var sr = R * 0.2 * (1 + 0.08 * Math.sin(3 * bb + t * 2));
        v = this.view(sr * Math.sin(a) * Math.cos(bb), 0.05 * H + sr * 0.7 * Math.cos(a), sr * Math.sin(a) * Math.sin(bb));
        x = this.x + v.x; y = this.y - v.y; z = v.z;
        b = 0.35 + 0.35 * (v.z / sr + 1) * 0.5;
        score = b + 0.3 * z / R - 0.1;
        hue = mono != null ? mono : 150 + 30 * Math.sin(a * 2 + t);
        grid.put(x, y, score, pick(LETTERS, b, (J[(i * 7 + j) % J.length] - 0.5) * 4), mono != null
          ? hsl(hue, 50, (12 + 45 * b) * dim) : hsl(hue, 75, 20 + 55 * b));
      }
    }

    // --- oral arms: frilly ribbons of letters ---
    for (i = 0; i < this.arms.length; i++) this.renderArm(grid, this.arms[i], i, t);
    // --- tentacles ---
    for (i = 0; i < this.tents.length; i++) this.renderTentacle(grid, this.tents[i], i, t);

    // --- glints ---
    for (i = 0; i < this.glints.length; i++) {
      var g = this.glints[i], f = 1 - g.age / g.life;
      var tw2 = Math.sin(t * (5 + g.tw * 0.1) + g.tw);
      grid.put(g.x, g.y, 5, tw2 > 0.4 ? '*' : '+', hsl(50, 30, 40 + 55 * f * f));
    }
  };

  Jelly.prototype.renderArm = function (grid, ch, idx, t) {
    var p = ch.p, n = ch.n, R = this.R, mono = this.mono, dim = this.dim;
    for (var k = 0; k < n - 1; k++) {
      var i = k * 3, x0 = p[i], y0 = p[i + 1], z0 = p[i + 2], x1 = p[i + 3], y1 = p[i + 4];
      var dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      var px = -dy / l, py = dx / l;
      var s = k / (n - 1);
      var w = R * (0.17 + 0.09 * Math.sin(s * 14 - t * 3 + idx)) * (1 - 0.55 * s);
      var steps = Math.max(1, Math.ceil(l / (LINE * 0.5)));
      var m = Math.max(1, Math.ceil(w / (CW * 0.7)));
      for (var q = 0; q < steps; q++) {
        var f = q / steps, cx = x0 + dx * f, cy = y0 + dy * f;
        for (var jj = -m; jj <= m; jj++) {
          var e = Math.abs(jj) / m;
          var b = (0.6 - 0.3 * e + 0.25 * Math.sin(s * 22 - t * 4 + jj * 0.9 + idx)) * (1 - 0.45 * s);
          b = clamp(b, 0.05, 1);
          var hue = mono != null ? mono : 185 + 75 * s + 25 * e;
          var glyph = e > 0.85 ? (jj < 0 ? '(' : ')') : pick(LETTERS, b, (this.J[((k * 31 + jj * 7 + q) & 1023) % this.J.length] - 0.5) * 4);
          grid.put(cx + px * jj * w / m, cy + py * jj * w / m, b + 0.3 * z0 / R + 0.3, glyph,
            mono != null ? hsl(hue, 50, (10 + 45 * b) * dim) : hsl(hue, 70, 18 + 55 * b));
        }
      }
    }
  };

  Jelly.prototype.renderTentacle = function (grid, ch, idx, t) {
    var p = ch.p, n = ch.n, R = this.R, mono = this.mono, dim = this.dim;
    var thick = mono == null && idx % 2 === 0;
    for (var k = 0; k < n - 1; k++) {
      var i = k * 3, x0 = p[i], y0 = p[i + 1], z0 = p[i + 2];
      var dx = p[i + 3] - x0, dy = p[i + 4] - y0;
      var dxc = dx / CW, dyc = dy / LINE;
      var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dxc), Math.abs(dyc)) * 1.6));
      var ang = Math.atan2(dyc, dxc); if (ang < 0) ang += Math.PI;
      var glyph = ang < Math.PI / 8 || ang > 7 * Math.PI / 8 ? '-' : ang < 3 * Math.PI / 8 ? '\\' : ang < 5 * Math.PI / 8 ? '|' : '/';
      var s = k / (n - 1);
      if (s > 0.85) glyph = s > 0.94 ? '.' : ':';
      var b = (0.85 - 0.6 * s);
      var hue = mono != null ? mono : 8 + 12 * Math.sin(idx * 1.3) - 20 * s;
      var color = mono != null ? hsl(hue, 45, (10 + 45 * b) * dim) : hsl(hue, 60, 22 + 50 * b);
      var score = b * 0.6 + 0.3 * z0 / R;
      for (var q = 0; q < steps; q++) {
        var f = q / steps, x = x0 + dx * f, y = y0 + dy * f;
        grid.put(x, y, score, glyph, color);
        if (thick && s < 0.6) grid.put(x + CW * 1.2, y, score - 0.1, glyph, color);
      }
    }
  };

  // ---------- scene ----------
  var main, far = [], stars = [], t = 0, mouse = { x: 0, y: 0, at: -1e9 };
  var FAR_HUES = [190, 268, 330, 12, 160, 220, 290];

  function makeMain() {
    var R = clamp(Math.min(W, H) * (W < 600 ? 0.2 : 0.15), 50, 170);
    main = new Jelly({
      R: R, x: W * 0.5, y: H * 0.42, nu: 64, nth: 200,
      nTent: 14, tentPts: 44, tentLen: 3.0,
      nArms: 4, armPts: 24, armLen: 2.1,
      period: 2.4, thrust: 0.022, pitch: 0.42
    });
    main.sparks = 8;
  }

  function makeFar(i, scatter) {
    var depth = Math.random();
    var R = Math.min(W, H) * (0.03 + 0.05 * depth);
    var j = new Jelly({
      R: R, x: Math.random() * W, y: scatter ? Math.random() * H : H + R * 4,
      nu: 18, nth: 60, mono: FAR_HUES[i % FAR_HUES.length], dim: 0.6 + 0.5 * depth,
      nTent: 8, tentPts: 18, tentLen: 2.8, nArms: 2, armPts: 10, armLen: 1.4,
      period: 2.8 + Math.random() * 1.6, ph: Math.random(), thrust: 0.03,
      pitch: 0.2 + Math.random() * 0.3, yaw: Math.random() * TAU, A: (Math.random() - 0.5) * 0.6
    });
    j.baseA = j.A;
    return j;
  }

  function resize() {
    W = innerWidth; H = innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, WALL ? 1.5 : 2);
    FONT = W < 600 ? 8 : 11;
    LINE = Math.round(FONT * 1.1);
    [bgC, glowC, fgC].forEach(function (c) { c.width = W * dpr; c.height = H * dpr; });
    [bgX, fgX].forEach(function (x) {
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.font = FONT + 'px ' + FAMILY;
      x.textBaseline = 'top';
    });
    CW = fgX.measureText('M').width;
    var cols = Math.floor(W / CW), rows = Math.floor(H / LINE);
    OX = (W - cols * CW) / 2; OY = (H - rows * LINE) / 2;
    fgGrid.resize(cols, rows); bgGrid.resize(cols, rows);

    makeMain();
    far = [];
    var nFar = W < 600 ? 4 : 7;
    for (var i = 0; i < nFar; i++) far.push(makeFar(i, true));
    stars = [];
    var nStars = Math.round(cols * rows / 140);
    for (i = 0; i < nStars; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random(), tw: Math.random() * TAU, near: Math.random() < 0.55 });
    // let the tentacles settle before the first frame
    for (i = 0; i < 60; i++) step(true);
  }

  function step(settle) {
    t += SIM_DT;
    // the main jelly wanders, or follows the cursor if it moved lately
    var tx, ty;
    if (t - mouse.at < 5) { tx = mouse.x; ty = mouse.y + main.R * 0.4; }
    else {
      tx = W * (0.5 + 0.3 * Math.sin(t * 0.071 + 1) + 0.08 * Math.sin(t * 0.19));
      ty = H * (0.46 + 0.2 * Math.sin(t * 0.053 + 2) + 0.05 * Math.sin(t * 0.23));
    }
    var dx = tx - main.x, dy = ty - main.y, dist = Math.hypot(dx, dy);
    var want = clamp(Math.atan2(dx, -dy), -0.42, 0.42);
    if (dist < main.R * 0.5) want *= dist / (main.R * 0.5);
    var turn = clamp(wrapAng(want - main.A), -0.2 * SIM_DT, 0.2 * SIM_DT);
    main.A += turn + 0.002 * Math.sin(t * 0.9);
    main.thrustScale = clamp(dist / (main.R * 2.5), 0.25, 1) * (dy < 0 ? 1 : 0.45);
    main.sink = dy > 0 ? 3 : 1;
    // soft walls
    var m = main.R * 1.2;
    if (main.x < m) main.vx += 0.02; if (main.x > W - m) main.vx -= 0.02;
    if (main.y < m) main.vy += 0.03; if (main.y > H - m * 0.5) main.vy -= 0.03;
    main.update(SIM_DT, t);

    for (var i = 0; i < far.length; i++) {
      var f = far[i];
      f.A = f.baseA + 0.25 * Math.sin(t * 0.13 + f.seed);
      f.x += 0.15 * Math.sin(t * 0.07 + f.seed);
      f.update(SIM_DT, t);
      if (f.y < -f.R * 5 || f.x < -f.R * 4 || f.x > W + f.R * 4) far[i] = makeFar(i, false);
    }
    if (!settle) {
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y -= 0.04 + 0.08 * s.s; s.x += 0.03 * Math.sin(t * 0.3 + s.tw);
        if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; }
      }
    }
  }

  // ---------- border + hud ----------
  function borderGlyph(c, r, cols, rows) {
    var top = r === 0, bot = r === rows - 1, lef = c === 0, rig = c === cols - 1;
    if ((top || bot) && (lef || rig)) return '+';
    if (top || bot) return c % 12 === 0 ? '+' : '-';
    return r % 6 === 0 ? '+' : '|';
  }

  function drawBorder(grid, letters) {
    var cols = grid.cols, rows = grid.rows;
    var P = 2 * (cols + rows) - 4;
    var pulses = [(t * 22) % P, (t * 22 + P / 2) % P];
    var p = 0;
    function cell(c, r) {
      var g = 0;
      for (var k = 0; k < pulses.length; k++) {
        var d = Math.abs(p - pulses[k]); d = Math.min(d, P - d);
        g += Math.exp(-(d * d) / (P * P * 0.0016));
      }
      var cx = OX + (c + 0.5) * CW, cy = OY + (r + 0.5) * LINE;
      var prox = Math.exp(-Math.hypot(cx - main.x, cy - main.y) / (main.R * 2.2));
      var b = clamp(0.16 + 0.75 * g + 0.8 * prox, 0, 1);
      var glyph = borderGlyph(c, r, cols, rows);
      if (b > 0.55 && glyph === '-') glyph = '=';
      if (b > 0.55 && glyph === '|') glyph = '!';
      var hue = 48 + 200 * (p / P) + t * 12;
      grid.putCell(c, r, 50, glyph, hsl(hue, 15 + 70 * clamp(g + prox, 0, 1), 12 + 55 * b));
      p++;
    }
    var c, r;
    for (c = 0; c < cols; c++) cell(c, 0);
    for (r = 1; r < rows; r++) cell(cols - 1, r);
    for (c = cols - 2; c >= 0; c--) cell(c, rows - 1);
    for (r = rows - 2; r > 0; r--) cell(0, r);

    // labels set into the frame
    var dimC = hsl(215, 15, 50), brightC = hsl(48, 20, 92);
    function label(c0, r0, parts) {
      var c = c0;
      for (var i = 0; i < parts.length; i++) {
        var s = parts[i][0], col = parts[i][1];
        for (var k = 0; k < s.length; k++, c++) grid.putCell(c, r0, 60, s[k], col);
      }
      return c;
    }
    function len(parts) { return parts.reduce(function (a, p) { return a + p[0].length; }, 0); }
    var tl = [['[ ', dimC], ['stanley zhou', brightC], [' ]', dimC]];
    var tr = [['[ t ', dimC], [t.toFixed(2) + 's', brightC], [' ]', dimC]];
    var bl = [['[ ', dimC], ['beats ', dimC], [String(main.beats), brightC], ['   tentacles ', dimC], ['14', brightC],
      ['   colours ', dimC], ['3', brightC], ['   sparks ', dimC], [String(main.glints.length), brightC],
      ['   letters ', dimC], [letters.toLocaleString('en-US'), brightC], [' ]', dimC]];
    var br = [['[ ', dimC], ['jelly.js', brightC], [' · running · 30 fps ]', dimC]];
    label(3, 0, tl);
    label(cols - 3 - len(tr), 0, tr);
    if (cols < 80) bl = [['[ ', dimC], ['beats ', dimC], [String(main.beats), brightC], ['  letters ', dimC], [letters.toLocaleString('en-US'), brightC], [' ]', dimC]];
    var end = label(3, rows - 1, bl);
    if (end + 4 < cols - 3 - len(br)) label(cols - 3 - len(br), rows - 1, br);
  }

  // ---------- frame ----------
  var lastLetters = 0;
  function render() {
    bgGrid.clear(); fgGrid.clear();
    var i, s;
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      var tw = 0.5 + 0.5 * Math.sin(t * (0.8 + s.s * 2) + s.tw);
      var glyph = s.s > 0.85 ? (tw > 0.7 ? '*' : '+') : s.s > 0.45 ? '+' : '.';
      (s.near ? fgGrid : bgGrid).put(s.x, s.y, -5, glyph, hsl(215, 30, 18 + 35 * tw * (0.4 + s.s)));
    }
    for (i = 0; i < far.length; i++) far[i].render(bgGrid, t);
    main.render(fgGrid, t);
    if (!WALL) drawBorder(fgGrid, lastLetters);

    bgGrid.draw(bgX);
    lastLetters = fgGrid.draw(fgX);
    glowX.setTransform(1, 0, 0, 1, 0, 0);
    glowX.clearRect(0, 0, glowC.width, glowC.height);
    glowX.drawImage(fgC, 0, 0);
  }

  var acc = 0, prev = 0;
  function loop(now) {
    if (WALL && window.__jellyPaused) { prev = now; requestAnimationFrame(loop); return; }
    var dt = Math.min(0.25, (now - prev) / 1000 || 0);
    prev = now;
    acc += dt;
    if (acc >= SIM_DT) {
      while (acc >= SIM_DT) { step(false); acc -= SIM_DT; }
      render();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', function () { clearTimeout(resize.tid); resize.tid = setTimeout(function () { resize(); render(); }, 120); });
  window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.at = t; });
  window.addEventListener('pointerdown', function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.at = t;
    main.spawnGlints(14);
    main.vx += main.sA * main.R * 0.012; main.vy -= main.cA * main.R * 0.012;
  });


  resize();
  render();
  if (!still) requestAnimationFrame(function (n) { prev = n; loop(n); });
})();
