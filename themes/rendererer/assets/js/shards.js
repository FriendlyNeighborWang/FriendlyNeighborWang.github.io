// Home page shards: flat polygons floating parallel to the page, each at its own
// height h, lit by the current point light (lamp.js dispatches `light:change`).
//
// A planar polygon parallel to the receiver projects from a point light into a
// similar polygon: every point P maps to L + (P - L) * k with k = H / (H - h).
// So each shadow is just the shard's own shape, scaled by k about the light,
// with a penumbra that widens with h / (H - h). The ball is treated the same way
// (a disc), plus the stretch a sphere's shadow gets as the light drops.
(function () {
  'use strict';

  var shards = Array.prototype.slice.call(document.querySelectorAll('.shard, .occluder-ball'));
  if (!shards.length) return;

  var root = document.documentElement;
  var LIGHT_SIZE = 8;      // emitter diameter, drives penumbra width
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var items = shards.map(function (el, n) {
    var ball = el.classList.contains('occluder-ball');
    var shadow = document.createElement('div');
    shadow.className = 'shard-shadow' + (ball ? ' round' : '');
    shadow.setAttribute('aria-hidden', 'true');
    shadow.style.setProperty('--shape', el.style.getPropertyValue('--shape'));
    shadow.appendChild(document.createElement('i'));
    document.body.appendChild(shadow);
    return {
      el: el, shadow: shadow, ball: ball,
      h: parseFloat(el.dataset.h) || 80,
      r: parseFloat(el.dataset.r) || 0,
      // Per-shard drift so they don't move in lockstep.
      phase: n * 1.7, speed: 0.00018 + (n % 3) * 0.00005
    };
  });

  var override = null;
  function isLight() { return root.getAttribute('data-theme') === 'light'; }

  // Resting light: the lit bulb in its socket (light theme only).
  function restingLight() {
    if (!isLight()) return null;
    var lamp = document.querySelector('.lamp');
    if (!lamp) return null;
    var r = lamp.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: 420, i: 1 };
  }

  function render(t) {
    var L = override || restingLight();
    items.forEach(function (it) {
      var drift = reduce ? 0 : Math.sin(t * it.speed + it.phase) * (it.ball ? 0.4 : 1);
      var rot = it.r + drift * 5;
      var h = it.h + drift * 8;
      if (it.ball) rot = 0;
      it.el.style.transform = 'translateY(' + (-drift * 3).toFixed(2) + 'px) rotate(' + rot.toFixed(2) + 'deg)';

      if (!L || L.i <= 0.01 || !it.el.offsetWidth) {
        it.shadow.style.opacity = '0';
        it.el.style.setProperty('--lit', '0');
        return;
      }
      // Centre and size of the shard on screen, independent of its rotation.
      var b = it.el.getBoundingClientRect();
      var w = it.el.offsetWidth, hh = it.el.offsetHeight;
      var cx = b.left + b.width / 2, cy = b.top + b.height / 2;

      var H = Math.max(L.h, h + 60);
      var k = H / (H - h);
      var sx = L.x + (cx - L.x) * k, sy = L.y + (cy - L.y) * k;
      var blur = 1.5 + LIGHT_SIZE * h / (H - h);

      var s = it.shadow.style;
      if (it.ball) {
        // Sphere: stretch away from the light, softer edge.
        var dist = Math.hypot(cx - L.x, cy - L.y);
        var stretch = Math.sqrt(1 + Math.pow(dist / H, 2));
        var dir = Math.atan2(cy - L.y, cx - L.x);
        s.width = s.height = w + 'px';
        s.transform = 'translate(' + (sx - w / 2).toFixed(1) + 'px,' + (sy - w / 2).toFixed(1) + 'px) rotate(' + dir + 'rad) scale(' + (k * stretch).toFixed(3) + ',' + k.toFixed(3) + ')';
        s.filter = 'blur(' + (blur + w * 0.12).toFixed(1) + 'px)';
        s.opacity = Math.min(1, L.i).toFixed(3);
        var hl = Math.min(0.42, 0.42 * dist / (dist + H * 0.35));
        it.el.style.setProperty('--hx', (50 - (cx - L.x) / (dist || 1) * hl * 100).toFixed(1) + '%');
        it.el.style.setProperty('--hy', (50 - (cy - L.y) / (dist || 1) * hl * 100).toFixed(1) + '%');
        it.el.style.setProperty('--lit', Math.min(1, L.i).toFixed(3));
        return;
      }
      s.width = w + 'px';
      s.height = hh + 'px';
      s.transform = 'translate(' + (sx - w / 2).toFixed(1) + 'px,' + (sy - hh / 2).toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg) scale(' + k.toFixed(3) + ')';
      s.filter = 'blur(' + blur.toFixed(1) + 'px)';
      s.opacity = (Math.min(1, L.i) * 0.7 * (1 - h / 400)).toFixed(3);

      // Lambert-ish shading: brightest on the edge facing the light.
      var dx = L.x - cx, dy = L.y - cy, d = Math.hypot(dx, dy) || 1;
      var ang = -rot * Math.PI / 180;   // into the shard's local frame
      var lx = (dx * Math.cos(ang) - dy * Math.sin(ang)) / d;
      var ly = (dx * Math.sin(ang) + dy * Math.cos(ang)) / d;
      it.el.style.setProperty('--gx', (50 + lx * 50).toFixed(1) + '%');
      it.el.style.setProperty('--gy', (50 + ly * 50).toFixed(1) + '%');
      it.el.style.setProperty('--lit', (Math.min(1, L.i) * H / Math.hypot(d, H)).toFixed(3));
    });
  }

  // Animate only while the hero is on screen; otherwise render on demand.
  var visible = true, running = false;
  function loop(t) {
    render(t);
    if (visible && !reduce && !document.hidden) requestAnimationFrame(loop);
    else running = false;
  }
  function kick() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); })
    .observe(shards[0].closest('.hero, .page-head, .article-head') || shards[0]);
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('light:change', function (e) { override = e.detail; kick(); });
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);
  new MutationObserver(kick).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  kick();
})();
