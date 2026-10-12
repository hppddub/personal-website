// keep scrolling past the end of a page to go to the next section,
// or past the top to go back to the previous one.
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('nav a[href^="/test/"]'));
  var pages = links.map(function (a) { return a.getAttribute('href'); });
  var i = links.findIndex(function (a) { return a.getAttribute('aria-current') === 'page'; });
  if (i < 0) return;

  var prev = i > 0 ? pages[i - 1] : null;
  var next = i < pages.length - 1 ? pages[i + 1] : null;

  // arriving from the next page going backwards: start at the bottom
  if (location.hash === '#end') {
    history.replaceState(null, '', location.pathname);
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

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

  function go(url) {
    if (leaving || !url) return;
    leaving = true;
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
    else if (prev) go(prev + '#end');
  }, { passive: true });

  var touchY = null, touchEdge = null;
  window.addEventListener('touchstart', function (ev) {
    touchY = ev.touches[0].clientY;
    touchEdge = atBottom() ? 'bottom' : atTop() ? 'top' : null;
  }, { passive: true });
  window.addEventListener('touchend', function (ev) {
    if (touchY === null || !touchEdge) return;
    var dy = touchY - ev.changedTouches[0].clientY; // > 0 means swiped up
    if (touchEdge === 'bottom' && dy > 120 && atBottom()) go(next);
    else if (touchEdge === 'top' && dy < -120 && atTop() && prev) go(prev + '#end');
    touchY = null;
  }, { passive: true });
})();
