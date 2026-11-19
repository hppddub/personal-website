// the page lives inside an ascii window.
//   [_]  shrinks it to a small window you can drag by the title bar and resize from the corner
//   [^]  maximizes it again (double-clicking the title bar toggles too)
//   [x]  closes it, leaving the jellyfish wallpaper and a button in the corner to reopen it
// the state carries across pages for the rest of the visit. while the window is small, moving
// between sections swaps the window's content in place, so the wallpaper keeps swimming.
(function () {
  var root = document.documentElement;
  if (!root.classList.contains('v2')) return;

  var KEY = 'sz-win';
  var st = { s: 'max' };
  function load() {
    st = { s: 'max' };
    try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved && /^(max|min|closed)$/.test(saved.s)) st = saved; } catch (e) {}
    if (root.classList.contains('intro')) st.s = 'max'; // the intro always lands on the full window
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
  function button(cls, text, label) { var b = el('button', 'win-btn ' + cls, text); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; return b; }

  // ---- build the window around the page content
  var seg = location.pathname.replace(/\/+$/, '').split('/').pop() || 'about';
  var win = el('div', 'win');
  var bar = el('div', 'win-bar');
  var title = el('span', 'win-title', '~/' + seg);
  var bMin = button('win-min', '[_]', 'minimize window');
  var bMax = button('win-max', '[^]', 'maximize window');
  var bX = button('win-x', '[x]', 'close window');
  bar.append(el('span', 'win-edge', '+-[ '), title, el('span', 'win-edge', ' ]'), el('span', 'win-fill'), bMin, bMax, bX, el('span', 'win-edge', '-+'));
  var mid = el('div', 'win-mid'), body = el('div', 'win-body');
  mid.append(el('span', 'win-side'), body, el('span', 'win-side'));
  // status bar pinned to the bottom of the window: the scroll hint and the last-updated line
  var status = el('div', 'win-status'), statusIn = el('div', 'win-status-in');
  status.append(el('span', 'win-side'), statusIn, el('span', 'win-side'));
  var foot = el('div', 'win-foot');
  foot.append(el('span', 'win-edge', '+'), el('span', 'win-fill'), el('span', 'win-edge', '+'));
  win.append(bar, mid, status, foot);
  function dockStatus() {
    var hint = body.querySelector('.next-hint'), f = body.querySelector('footer');
    statusIn.replaceChildren();
    if (hint) statusIn.appendChild(hint);
    if (f) statusIn.appendChild(f);
  }

  var kids = Array.prototype.slice.call(document.body.children).filter(function (n) {
    return n.tagName !== 'SCRIPT' && !n.classList.contains('backdrop') && !n.classList.contains('intro-ui');
  });
  kids.forEach(function (n) { body.appendChild(n); });
  dockStatus();

  // a little jellyfish under the corner, pointing up at [_]
  // the arrow stays put under [_]; the jellyfish beside it bobs (css), wiggles and blinks (frames below)
  var ARROW = ['       ^', '       |', "  -----'", ' try me'];
  var FACE = ['( ^_^ )', '( ^_^ )', '( ^_^ )', '( -_- )'];
  var LEGS = [' )/)/(', ' (\\(\\)'];
  var tip = el('div', 'win-tip'), jelly = el('pre', 'win-tip-jelly'), arrow = el('pre', 'win-tip-arrow'), tipFrame = 0;
  tip.setAttribute('aria-hidden', 'true'); arrow.textContent = ARROW.join('\n');
  function drawJelly() { jelly.textContent = ['', ' .-"-.', FACE[tipFrame % FACE.length], LEGS[tipFrame % 2]].join('\n'); }
  drawJelly();
  tip.append(jelly, arrow); win.appendChild(tip);
  function placeTip() {
    if (st.s !== 'max') return;
    var w = win.getBoundingClientRect(), b = bMin.getBoundingClientRect(), cw = arrow.getBoundingClientRect().width / ARROW[0].length;
    tip.style.right = (w.right - (b.left + b.width / 2) - cw / 2) + 'px';
    tip.style.top = (b.bottom - w.top + 1) + 'px';
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(function () {
    if (st.s !== 'max') return;
    tipFrame = (tipFrame + 1) % 8; drawJelly();
  }, 450);
  // every bob (the css animation restarting) puffs a tiny word out of a random side
  var SOUNDS = ['bloop', 'gloop', 'schloop', 'blub', 'plip'];
  var SIDES = [ // start x, start y, drift x, drift y, leftward (anchor the word by its right edge)
    [-2, 22, -14, -4, 1], [0, 40, -12, 10, 1], [10, 48, 0, 14, 0], [34, 44, 12, 10, 0], [0, 6, -12, -8, 1]
  ];
  function puff() {
    if (st.s !== 'max') return;
    var s = SIDES[(Math.random() * SIDES.length) | 0], w = el('span', 'win-tip-word' + (s[4] ? ' l' : ''), SOUNDS[(Math.random() * SOUNDS.length) | 0]);
    w.style.left = s[0] + 'px'; w.style.top = s[1] + 'px';
    w.style.setProperty('--dx', s[2] + 'px'); w.style.setProperty('--dy', s[3] + 'px');
    w.addEventListener('animationend', function () { w.remove(); });
    tip.appendChild(w);
  }
  jelly.addEventListener('animationiteration', puff);
  // and clicking the jellyfish makes it bloop too
  jelly.addEventListener('click', puff);
  addEventListener('resize', placeTip);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeTip);
  var firstScript = document.body.querySelector('script');
  document.body.insertBefore(win, firstScript);

  var dock = el('button', 'win-dock', '[ ~/' + seg + ' ]');
  dock.type = 'button'; dock.setAttribute('aria-label', 'open window'); dock.title = 'open window';
  document.body.insertBefore(dock, firstScript);

  // ---- the jellyfish wallpaper, loaded the first time it is needed
  var wall = null;
  function ensureWall() {
    if (wall) return;
    wall = el('div', 'wall'); wall.setAttribute('aria-hidden', 'true');
    ['bg', 'glow', 'fg'].forEach(function (id) { var c = el('canvas'); c.id = id; wall.appendChild(c); });
    document.body.insertBefore(wall, document.body.firstChild);
    window.JELLY_WALLPAPER = true;
    var s = el('script'); s.src = '/new/jelly.js'; document.body.appendChild(s);
  }

  // ---- states
  function clampBox() {
    var W = innerWidth, H = innerHeight;
    st.w = Math.min(st.w || Math.min(640, W - 32), W - 16);
    st.h = Math.min(st.h || Math.min(480, H - 90), H - 16);
    if (st.x == null) st.x = Math.round((W - st.w) / 2);
    if (st.y == null) st.y = Math.round(Math.max(16, (H - st.h) * 0.3));
    st.x = Math.max(8 - st.w + 120, Math.min(W - 120, st.x));
    st.y = Math.max(8, Math.min(H - 40, st.y));
  }
  function apply(focus) {
    root.classList.remove('win-max', 'win-min', 'win-closed');
    root.classList.add('win-' + st.s);
    if (st.s !== 'max') ensureWall();
    window.__jellyPaused = st.s === 'max';
    if (st.s === 'min') {
      clampBox();
      win.style.left = st.x + 'px'; win.style.top = st.y + 'px'; win.style.width = st.w + 'px'; win.style.height = st.h + 'px';
    } else {
      win.style.left = win.style.top = win.style.width = win.style.height = '';
    }
    if (focus) (st.s === 'closed' ? dock : st.s === 'min' ? bMax : bMin).focus({ preventScroll: true });
    placeTip();
  }
  function set(s) { st.s = s; save(); apply(true); if (s === 'max') window.scrollTo(0, 0); }

  bMin.addEventListener('click', function () {
    set('min');
  });
  bMax.addEventListener('click', function () { set('max'); });
  // [x] remembers which state it closed from, so the corner button brings back the same one
  bX.addEventListener('click', function () { st.prev = st.s; set('closed'); });
  dock.addEventListener('click', function () { set(st.prev === 'min' ? 'min' : 'max'); });
  bar.addEventListener('dblclick', function (e) { if (e.target.closest('.win-btn')) return; set(st.s === 'max' ? 'min' : 'max'); });

  // drag by the title bar while minimized
  var drag = null;
  bar.addEventListener('pointerdown', function (e) {
    if (st.s !== 'min' || e.button !== 0 || e.target.closest('.win-btn')) return;
    drag = { id: e.pointerId, dx: e.clientX - st.x, dy: e.clientY - st.y };
    bar.setPointerCapture(e.pointerId); e.preventDefault();
  });
  bar.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    st.x = e.clientX - drag.dx; st.y = e.clientY - drag.dy; clampBox();
    win.style.left = st.x + 'px'; win.style.top = st.y + 'px';
  });
  function endDrag(e) { if (drag && e.pointerId === drag.id) { drag = null; save(); } }
  bar.addEventListener('pointerup', endDrag); bar.addEventListener('pointercancel', endDrag);

  // remember the size after resizing from the corner
  if (window.ResizeObserver) new ResizeObserver(function () {
    if (st.s !== 'min' || drag) return;
    var r = win.getBoundingClientRect();
    if (Math.abs(r.width - st.w) > 1 || Math.abs(r.height - st.h) > 1) { st.w = Math.round(r.width); st.h = Math.round(r.height); save(); }
  }).observe(win);
  addEventListener('resize', function () { if (st.s === 'min') apply(false); });

  // ---- while minimized, moving between sections swaps the window's content in place
  var SECTION = /^\/(about|education|experiences|projects|contact)?\/?$/;
  var swapping = 0;
  function pageContent(doc) {
    return Array.prototype.slice.call(doc.body.children).filter(function (n) {
      return n.tagName !== 'SCRIPT' && !n.classList.contains('backdrop') && !n.classList.contains('intro-ui');
    });
  }
  function swap(url, push) {
    var token = ++swapping;
    body.classList.add('win-fade'); statusIn.classList.add('win-fade');
    var faded = new Promise(function (r) { setTimeout(r, 140); });
    var page = fetch(url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
    Promise.all([page, faded]).then(function (res) {
      if (token !== swapping) return;
      var doc = new DOMParser().parseFromString(res[0], 'text/html'), nodes = pageContent(doc);
      if (!nodes.length) throw new Error('empty page');
      body.replaceChildren.apply(body, nodes.map(function (n) { return document.importNode(n, true); }));
      dockStatus();
      if (push) history.pushState({ win: 1 }, '', url);
      document.title = doc.title;
      seg = location.pathname.replace(/\/+$/, '').split('/').pop() || 'about';
      title.textContent = '~/' + seg; dock.textContent = '[ ~/' + seg + ' ]';
      body.scrollTop = 0;
      if (window.__scrollNavRefresh) window.__scrollNavRefresh();
      requestAnimationFrame(function () { body.classList.remove('win-fade'); statusIn.classList.remove('win-fade'); });
    }).catch(function () { location.href = url; });
  }
  document.addEventListener('click', function (e) {
    if (st.s !== 'min' || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.origin !== location.origin || a.search || !SECTION.test(a.pathname)) return;
    e.preventDefault();
    if (a.pathname.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '')) return;
    swap(a.href, true);
  });
  addEventListener('popstate', function () { if (st.s === 'min') swap(location.href, false); else location.reload(); });

  // pages can be prerendered or restored from the back/forward cache: pick up the latest state then
  document.addEventListener('prerenderingchange', function () { load(); apply(false); });
  addEventListener('pageshow', function (e) { if (e.persisted) { load(); apply(false); } });

  load(); apply(false);
})();
