// flip the cursor between its two sprite frames, like a little idle animation
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ['/cursor-2.svg', '/cursor-pointer-2.svg'].forEach(function (src) { new Image().src = src; });
  var root = document.documentElement;
  setInterval(function () { root.classList.toggle('cursor-alt'); }, 450);
})();
