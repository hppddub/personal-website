// keep scrolling past the end of a page to go to the next section,
// or past the top to go back to the previous one.
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('nav a:not([target])'));
  var pages = links.map(function (a) { return a.getAttribute('href'); });
  var i = links.findIndex(function (a) { return a.getAttribute('aria-current') === 'page'; });
  if (i < 0) return;

  var prev = i > 0 ? pages[i - 1] : null;
  var next = i < pages.length - 1 ? pages[i + 1] : null;

  // load the other sections in the background so switching is instant.
  // chrome/edge prerender them; other browsers at least get them cached.
  var others = pages.filter(function (p, j) { return j !== i; });
  if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    var rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({ prerender: [{ source: 'list', urls: others, eagerness: 'eager' }] });
    document.head.appendChild(rules);
  } else {
    others.forEach(function (p) {
      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = p;
      document.head.appendChild(link);
    });
  }

  // arriving from the next page going backwards: start at the bottom.
  // a flag rather than a #hash, so the prerendered page still gets used.
  function arrive() {
    var end = false;
    try { end = sessionStorage.getItem('scroll-to-end') === location.pathname.replace(/\/$/, ''); sessionStorage.removeItem('scroll-to-end'); } catch (e) {}
    if (end) window.scrollTo(0, document.documentElement.scrollHeight);
  }
  if (document.prerendering) document.addEventListener('prerenderingchange', arrive, { once: true });
  else arrive();

  var hint = document.querySelector('.next-hint');
  if (hint && next) {
    hint.textContent = 'v keep scrolling: ' + links[i + 1].textContent + ' v';
    hint.hidden = false;
  }

  // one scroll gesture = a burst of wheel events with no pause longer than GAP.
  // a gesture that starts at the edge moves to the next/previous page; a gesture
  // that only reaches the edge (e.g. scrolling down to the bottom) never does.
  var GAP = 200;      // ms of quiet that ends a gesture (covers trackpad momentum)
  var NUDGE = 30;     // px of scrolling to ignore, so tiny trackpad touches don't count
  var lastWheel = 0, gestureEdge = null, push = 0, leaving = false;

  function atBottom() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  }
  function atTop() { return window.scrollY <= 0; }

  // coming back via the back button restores this page as it was, mid-"leaving"
  window.addEventListener('pageshow', function () { leaving = false; });

  function go(url, toEnd) {
    if (leaving || !url) return;
    leaving = true;
    if (toEnd) try { sessionStorage.setItem('scroll-to-end', url); } catch (e) {}
    location.href = url;
  }

  window.addEventListener('wheel', function (ev) {
    var dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY; // firefox reports lines
    if (!dy) return;
    var now = Date.now();
    if (now - lastWheel > GAP) {
      gestureEdge = dy > 0 && atBottom() ? 'bottom' : dy < 0 && atTop() ? 'top' : null;
      push = 0;
    }
    lastWheel = now;
    if (!gestureEdge || (gestureEdge === 'bottom') !== (dy > 0)) return;
    push += Math.abs(dy);
    if (push < NUDGE) return;
    if (gestureEdge === 'bottom') go(next);
    else if (prev) go(prev, true);
  }, { passive: true });

  // arrow keys: down/right go to the next section, up/left go back
  window.addEventListener('keydown', function (ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
      if (next) { ev.preventDefault(); go(next); }
    } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
      if (prev) { ev.preventDefault(); go(prev); }
    }
  });

  var touchY = null, touchEdge = null;
  window.addEventListener('touchstart', function (ev) {
    touchY = ev.touches[0].clientY;
    touchEdge = atBottom() ? 'bottom' : atTop() ? 'top' : null;
  }, { passive: true });
  window.addEventListener('touchend', function (ev) {
    if (touchY === null || !touchEdge) return;
    var dy = touchY - ev.changedTouches[0].clientY; // > 0 means swiped up
    if (touchEdge === 'bottom' && dy > 120 && atBottom()) go(next);
    else if (touchEdge === 'top' && dy < -120 && atTop() && prev) go(prev, true);
    touchY = null;
  }, { passive: true });
})();
