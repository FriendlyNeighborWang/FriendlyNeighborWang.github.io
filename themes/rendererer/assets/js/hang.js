// Posts: once the header scrolls away, the lamp drops out of its socket and
// hangs from the top of the viewport on a cord. It still works as the theme
// switch (lamp.js keeps handling drag / click) and casts a faint warm glow.
(function () {
  'use strict';

  var lamp = document.querySelector('.lamp');
  var article = document.querySelector('.article');
  var header = document.querySelector('.site-header');
  if (!lamp || !article || !header) return;

  var orb = lamp.querySelector('.lamp-orb');
  var CORD = 34;          // cord length, px from the viewport top to the orb
  var wide = matchMedia('(min-width: 1181px)');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The empty socket left behind in the header, so the nav doesn't reflow.
  var dock = document.createElement('span');
  dock.className = 'lamp-dock';
  dock.setAttribute('aria-hidden', 'true');
  lamp.parentNode.insertBefore(dock, lamp);

  var glow = document.createElement('div');
  glow.className = 'lamp-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.appendChild(glow);

  // ---- Hanging -------------------------------------------------------------
  var hanging = false;
  function setHanging(on) {
    if (on === hanging) return;
    hanging = on;
    if (on) {
      var x = lamp.getBoundingClientRect().left;
      dock.classList.add('show');
      lamp.classList.add('hanging');
      lamp.style.setProperty('--cord', CORD + 'px');
      lamp.style.left = x + 'px';
      lamp.style.top = (CORD - lamp.offsetHeight / 2) + 'px';
      if (!reduce) {
        lamp.animate([
          { transform: 'translateY(' + -(CORD + 48) + 'px) rotate(0deg)', easing: 'cubic-bezier(.3, 0, .6, 1)' },
          { transform: 'translateY(0) rotate(0deg)', offset: 0.32 },
          { transform: 'rotate(7deg)', offset: 0.5 },
          { transform: 'rotate(-4deg)', offset: 0.68 },
          { transform: 'rotate(2deg)', offset: 0.84 },
          { transform: 'rotate(0deg)' }
        ], { duration: 1500, easing: 'ease-out' });
      }
    } else {
      lamp.classList.remove('hanging');
      lamp.style.left = lamp.style.top = '';
      dock.classList.remove('show');
    }
    glow.classList.toggle('on', on);
    pump(1600);
  }

  var headerVisible = true;
  new IntersectionObserver(function (es) {
    headerVisible = es[0].isIntersecting;
    setHanging(!headerVisible && wide.matches);
  }).observe(header);
  wide.addEventListener('change', function () { setHanging(!headerVisible && wide.matches); });
  window.addEventListener('resize', function () {
    if (hanging) lamp.style.left = dock.getBoundingClientRect().left + 'px';
    queue();
  });

  // ---- Glow follows the orb --------------------------------------------------
  function render() {
    var o = orb.getBoundingClientRect();
    glow.style.transform = 'translate(' + (o.left + o.width / 2).toFixed(1) + 'px,' + (o.top + o.height / 2).toFixed(1) + 'px)';
  }

  var queued = false, pumpUntil = 0;
  function frame(t) {
    queued = false;
    render();
    if (t < pumpUntil) queue();
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  // Keep rendering for a while: drop animation, spring-back after a drag.
  function pump(ms) { pumpUntil = Math.max(pumpUntil, performance.now() + ms); queue(); }

  window.addEventListener('light:change', function () { pump(500); });
  queue();
})();
