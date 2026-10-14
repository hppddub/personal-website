// faint gray ascii splotches drifting around behind the page
(function () {
  var canvas = document.createElement('canvas');
  canvas.className = 'backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');

  var FONT = 14, LINE = 18;
  var RAMP = ' .\'`:-~=+*%#';           // sparse -> dense
  var SHADES = ['#131313', '#1a1a1a', '#232323']; // dim -> less dim
  var FPS = 12;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // smooth value noise over a lattice of random values
  // fixed seed + wall-clock time, so every page draws the same frame and the
  // backdrop carries on uninterrupted when you switch pages
  var seed = 1337;
  function rand() {
    seed = (seed + 0x6D2B79F5) | 0;
    var x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  var perm = new Uint8Array(512), vals = new Float32Array(256);
  for (var i = 0; i < 256; i++) { perm[i] = i; vals[i] = rand(); }
  for (i = 255; i > 0; i--) { var j = (rand() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
  function lat(x, y, z) { return vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]]; }
  function fade(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function noise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    return lerp(
      lerp(lerp(lat(xi, yi, zi), lat(xi + 1, yi, zi), u), lerp(lat(xi, yi + 1, zi), lat(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(lat(xi, yi, zi + 1), lat(xi + 1, yi, zi + 1), u), lerp(lat(xi, yi + 1, zi + 1), lat(xi + 1, yi + 1, zi + 1), u), v),
      w);
  }

  var cols, rows, cw, dpr;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT + "px 'Courier New', Courier, monospace";
    ctx.textBaseline = 'top';
    cw = ctx.measureText('M').width;
    cols = Math.ceil(innerWidth / cw);
    rows = Math.ceil(innerHeight / LINE);
    draw();
  }

  function draw() {
    var t = (Date.now() % 1e8) / 1000;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    // build one string per row per shade, so each row is a few fillText calls
    for (var r = 0; r < rows; r++) {
      var lines = ['', '', ''];
      for (var c = 0; c < cols; c++) {
        // two octaves, each drifting in its own direction
        var n = noise(c * 0.045 + t * 0.05, r * 0.09 - t * 0.03, t * 0.04) * 0.7
              + noise(c * 0.11 - t * 0.04, r * 0.22 + t * 0.02, 10 + t * 0.07) * 0.3;
        var s = (n - 0.56) / 0.2;  // only the peaks show up, as splotches
        var ch = ' ', shade = -1;
        if (s > 0) {
          if (s > 1) s = 1;
          // a little per-cell flicker so the texture shimmers as it moves
          var k = s * (RAMP.length - 1) + (lat(c, r, (t * 3) | 0) - 0.5) * 1.5;
          k = Math.max(1, Math.min(RAMP.length - 1, Math.round(k)));
          ch = RAMP[k];
          shade = s < 0.35 ? 0 : s < 0.7 ? 1 : 2;
        }
        for (var b = 0; b < 3; b++) lines[b] += b === shade ? ch : ' ';
      }
      for (b = 0; b < 3; b++) {
        if (lines[b].trim()) {
          ctx.fillStyle = SHADES[b];
          ctx.fillText(lines[b], 0, r * LINE);
        }
      }
    }
  }

  var last = 0;
  function loop(now) {
    if (now - last >= 1000 / FPS) { last = now; draw(); }
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  if (!still) requestAnimationFrame(loop);
})();
