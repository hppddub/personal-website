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

  var THRESHOLD = 250; // px of extra scrolling needed at an edge
  var DWELL = 350;     // ms the page must rest at an edge before counting
  var push = 0, edge = null, edgeSince = 0, leaving = false;

  function atBottom() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  }
  function atTop() { return window.scrollY <= 0; }

  function go(url) {
    if (leaving || !url) return;
    leaving = true;
    location.href = url;
  }

  function overscroll(dy) {
    var e = dy > 0 && atBottom() ? 'bottom' : dy < 0 && atTop() ? 'top' : null;
    var now = Date.now();
    if (e !== edge) { edge = e; edgeSince = now; push = 0; }
    if (!e || now - edgeSince < DWELL) return;
    push += Math.abs(dy);
    if (push < THRESHOLD) return;
    if (e === 'bottom') go(next);
    else if (prev) go(prev + '#end');
  }

  window.addEventListener('wheel', function (ev) { overscroll(ev.deltaY); }, { passive: true });

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
