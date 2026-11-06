// Theme switch, variant B: a point light you can pick up.
//
//  - The orb sits in a socket in the header. Lit = light theme, ember = dark theme.
//  - Drag it out: in the dark theme it casts a growing pool of light around itself,
//    in the light theme the room dims everywhere except around it. Let go far enough
//    from the socket and the theme flips, revealed as a circle spreading from the
//    drop point. Let go early and it springs back.
//  - Click (or Enter / Space) toggles too, revealed from the socket.
//  - Dark theme only: a faint warm glow follows the cursor.
(function () {
  'use strict';

  var root = document.documentElement;
  var lamp = document.querySelector('.lamp');
  if (!lamp) return;
  var orb = lamp.querySelector('.lamp-orb');
  var veil = document.createElement('div');
  veil.className = 'light-veil';
  veil.setAttribute('aria-hidden', 'true');
  document.body.appendChild(veil);

  var REACH = 170;            // px from the socket at which a drop commits
  var fine = matchMedia('(pointer: fine)').matches;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isLight() { return root.getAttribute('data-theme') === 'light'; }
  function label() {
    lamp.setAttribute('aria-label', isLight() ? '拿走光源：切换到暗色' : '放出光源：切换到亮色');
    lamp.setAttribute('aria-pressed', String(isLight()));
  }
  label();

  function socketCenter() {
    var r = lamp.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Circle reveal from (x, y) via the View Transitions API; plain swap otherwise.
  function flip(x, y) {
    var next = isLight() ? 'dark' : 'light';
    function apply() {
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    }
    if (!document.startViewTransition || reduce) { apply(); return; }
    var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var t = document.startViewTransition(apply);
    t.ready.then(function () {
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 650, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  }

  // Tell anything that casts shadows (shards.js) where the light is.
  // detail: { x, y, h: height above the page in px, i: intensity 0..1 } or null.
  function emit(detail) {
    window.dispatchEvent(new CustomEvent('light:change', { detail: detail }));
  }

  // ---- Veil: the light pool / shadow painted over the page ----------------
  function paintDrag(x, y, t) {
    if (isLight()) {
      // Bulb pulled out: everything outside a shrinking pool falls into shadow.
      var pool = 260 - 90 * t;
      veil.style.background =
        'radial-gradient(circle at ' + x + 'px ' + y + 'px, rgba(18,17,16,0) 0, rgba(18,17,16,0) ' + (pool * 0.35) + 'px, rgba(18,17,16,' + (0.78 * t).toFixed(3) + ') ' + pool + 'px)';
      veil.style.mixBlendMode = 'normal';
    } else {
      // Bulb carried into a dark room: a warm pool that widens and brightens.
      var radius = 140 + 520 * t;
      veil.style.background =
        'radial-gradient(circle at ' + x + 'px ' + y + 'px, rgba(255,232,190,' + (0.16 + 0.34 * t).toFixed(3) + ') 0, rgba(255,214,150,' + (0.06 + 0.12 * t).toFixed(3) + ') ' + (radius * 0.35) + 'px, rgba(255,214,150,0) ' + radius + 'px)';
      veil.style.mixBlendMode = 'screen';
    }
    veil.style.opacity = '1';
    emit({ x: x, y: y, h: isLight() ? 260 : 240, i: isLight() ? 1 : 0.35 + 0.65 * t });
  }
  function paintCursor(x, y) {
    veil.style.background =
      'radial-gradient(circle at ' + x + 'px ' + y + 'px, rgba(220,174,95,0.07) 0, rgba(220,174,95,0) 280px)';
    veil.style.mixBlendMode = 'screen';
    veil.style.opacity = '1';
    emit({ x: x, y: y, h: 240, i: 0.45 });
  }
  function clearVeil() { veil.style.opacity = '0'; emit(null); }

  // ---- Drag ----------------------------------------------------------------
  var drag = null;

  lamp.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var c = socketCenter();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: c.x, cy: c.y, moved: false, t: 0 };
    lamp.setPointerCapture(e.pointerId);
  });

  lamp.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
    drag.moved = true;
    lamp.classList.add('dragging');
    var d = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
    drag.t = Math.min(1, Math.max(0, (d - 16) / (REACH - 16)));
    orb.style.transform = 'translate(' + (e.clientX - drag.cx) + 'px,' + (e.clientY - drag.cy) + 'px)';
    lamp.style.setProperty('--charge', drag.t.toFixed(3));
    lamp.classList.toggle('armed', drag.t >= 1);
    paintDrag(e.clientX, e.clientY, drag.t);
  });

  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    lamp.classList.remove('dragging', 'armed');
    lamp.style.removeProperty('--charge');
    clearVeil();
    if (!d.moved) {
      if (e.type === 'pointerup') flip(d.cx, d.cy);
    } else if (d.t >= 1 && e.type === 'pointerup') {
      flip(e.clientX, e.clientY);
    }
    // Spring back to the socket.
    orb.style.transition = 'transform .45s cubic-bezier(.34, 1.56, .64, 1)';
    orb.style.transform = '';
    setTimeout(function () { orb.style.transition = ''; }, 460);
  }
  lamp.addEventListener('pointerup', release);
  lamp.addEventListener('pointercancel', release);

  // Keyboard: the button's own click (Enter / Space). Pointer clicks are handled above.
  lamp.addEventListener('click', function (e) {
    if (e.detail === 0) { var c = socketCenter(); flip(c.x, c.y); }
  });

  // ---- Cursor glow (dark theme, mouse only) --------------------------------
  if (fine && !reduce && !document.body.classList.contains('is-post')) {
    var raf = 0, px = 0, py = 0;
    window.addEventListener('pointermove', function (e) {
      if (drag || isLight() || e.pointerType !== 'mouse') return;
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (!drag && !isLight()) paintCursor(px, py); });
    }, { passive: true });
    document.addEventListener('pointerleave', function () { if (!drag) clearVeil(); });
    new MutationObserver(function () { if (isLight() && !drag) clearVeil(); })
      .observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }
})();
