// In-page image viewer for posts.
//
//  - Click an image: it grows from its place in the text to fill the screen.
//  - ← / → step through every image in the post. Swaps are instant so two
//    renders can be blinked against each other.
//  - Click the image again: 1:1 pixels, pan by moving the pointer. The zoom and
//    the region being looked at survive ← / →, for side-by-side pixel peeping.
//  - Click anywhere around the image, or Esc: it shrinks back into the text.
//  - Touch: swipe left / right to step, tap outside to close.
(function () {
  'use strict';

  var article = document.querySelector('.article-content');
  if (!article) return;
  var root = document.documentElement;

  var lb = document.createElement('div');
  lb.className = 'lb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', '图片查看');
  lb.innerHTML =
    '<img class="lb-img" alt="">' +
    '<button class="lb-nav lb-prev" type="button" aria-label="上一张">‹</button>' +
    '<button class="lb-nav lb-next" type="button" aria-label="下一张">›</button>' +
    '<div class="lb-bar"><span class="lb-caption"></span><span class="lb-count"></span>' +
    '<span class="lb-hint">← → 切换 · 点击图片 1:1 · Esc 关闭</span></div>';
  document.body.appendChild(lb);

  var img = lb.querySelector('.lb-img');
  var caption = lb.querySelector('.lb-caption');
  var count = lb.querySelector('.lb-count');
  var BAR = 52, PAD = 24;

  var items = [], index = -1, open = false;
  var natW = 0, natH = 0;
  var zoomed = false, fx = 0.5, fy = 0.5;   // pan position as a fraction of the overflow

  // Images currently visible in the post (diagrams have a light and a dark copy; skip the hidden one).
  function collect() {
    return Array.prototype.slice.call(article.querySelectorAll('a.img-link')).filter(function (a) {
      return a.offsetParent !== null;
    });
  }

  function label(a) {
    var fig = a.closest('figure');
    var cap = fig && fig.querySelector('figcaption');
    if (cap) return cap.textContent.trim();
    var td = a.closest('td');
    if (td) {
      var table = td.closest('table');
      var th = table && table.querySelectorAll('thead th')[td.cellIndex];
      if (th && th.textContent.trim()) return th.textContent.trim();
    }
    var alt = a.querySelector('img').getAttribute('alt');
    return alt || '';
  }

  // ---- Layout ----------------------------------------------------------------
  function fitRect() {
    var maxW = innerWidth - 2 * PAD, maxH = innerHeight - BAR - 2 * PAD;
    var s = Math.min(maxW / natW, maxH / natH, 1);
    return { s: s, x: (innerWidth - natW * s) / 2, y: (innerHeight - BAR - natH * s) / 2 };
  }
  function zoomRect() {
    var vw = innerWidth, vh = innerHeight - BAR;
    return {
      s: 1,
      x: natW > vw ? -fx * (natW - vw) : (vw - natW) / 2,
      y: natH > vh ? -fy * (natH - vh) : (vh - natH) / 2
    };
  }
  function canZoom() { return fitRect().s < 0.999; }
  function place(r) {
    img.style.width = natW + 'px';
    img.style.height = natH + 'px';
    img.style.transform = 'translate(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px) scale(' + r.s.toFixed(4) + ')';
  }
  function layout() { place(zoomed && canZoom() ? zoomRect() : fitRect()); }
  function thumbRect(a) {
    var r = a.querySelector('img').getBoundingClientRect();
    return { s: r.width / natW, x: r.left, y: r.top, visible: r.bottom > 0 && r.top < innerHeight };
  }
  function animated(fn) {
    img.classList.add('lb-anim');
    fn();
    clearTimeout(animated.t);
    animated.t = setTimeout(function () { img.classList.remove('lb-anim'); }, 320);
  }

  // ---- Content -----------------------------------------------------------------
  function load(i) {
    index = (i + items.length) % items.length;
    var a = items[index], thumb = a.querySelector('img');
    // Start from the thumbnail's aspect; the real size arrives with the full image.
    var tw = +thumb.getAttribute('width') || thumb.naturalWidth || 1;
    var th = +thumb.getAttribute('height') || thumb.naturalHeight || 1;
    if (!natW || Math.abs(natW / natH - tw / th) > 0.01) { natW = tw; natH = th; }
    img.src = a.href;
    img.alt = thumb.alt || '';
    caption.textContent = label(a);
    count.textContent = (index + 1) + ' / ' + items.length;
    lb.classList.toggle('single', items.length < 2);
    // Warm the neighbours so stepping is instant.
    [index - 1, index + 1].forEach(function (j) {
      var n = items[(j + items.length) % items.length];
      if (n) { var pre = new Image(); pre.src = n.href; }
    });
  }
  img.addEventListener('load', function () {
    if (!open) return;
    natW = img.naturalWidth; natH = img.naturalHeight;
    lb.classList.toggle('can-zoom', canZoom());
    if (!img.classList.contains('lb-anim')) layout();
  });

  function show(a) {
    items = collect();
    var i = items.indexOf(a);
    if (i < 0) return;
    natW = 0;
    load(i);
    open = true;
    zoomed = false;
    lb.classList.remove('zoomed');
    root.classList.add('lb-open');
    lb.classList.add('open');
    place(thumbRect(a));
    img.getBoundingClientRect();                    // commit the start state
    animated(layout);
    lb.querySelector('.lb-next').focus({ preventScroll: true });
  }

  function close() {
    if (!open) return;
    open = false;
    var a = items[index];
    var back = a && thumbRect(a);
    lb.classList.remove('open');
    if (back && back.visible) animated(function () { place(back); });
    setTimeout(function () {
      root.classList.remove('lb-open');
      img.removeAttribute('src');
      if (a) a.focus({ preventScroll: true });
    }, 300);
  }

  function step(d) {
    if (!open || items.length < 2) return;
    load(index + d);
    layout();
  }

  function setZoom(on, e) {
    if (on && !canZoom()) return;
    zoomed = on;
    lb.classList.toggle('zoomed', on);
    if (on && e) panTo(e);
    animated(layout);
  }
  function panTo(e) {
    fx = Math.min(1, Math.max(0, e.clientX / innerWidth));
    fy = Math.min(1, Math.max(0, e.clientY / (innerHeight - BAR)));
  }

  // ---- Events ------------------------------------------------------------------

  article.addEventListener('click', function (e) {
    var a = e.target.closest('a.img-link');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    show(a);
  });

  lb.addEventListener('click', function (e) {
    if (e.target.closest('.lb-prev')) return step(-1);
    if (e.target.closest('.lb-next')) return step(1);
    if (e.target === img) { if (!swiped) setZoom(!zoomed, e); return; }
    close();
  });

  lb.addEventListener('pointermove', function (e) {
    if (!zoomed || e.pointerType !== 'mouse') return;
    panTo(e);
    layout();
  });

  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); zoomed ? setZoom(false) : close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Tab') {
      // Keep focus inside the viewer.
      var btns = lb.querySelectorAll('button');
      e.preventDefault();
      (document.activeElement === btns[0] ? btns[1] : btns[0]).focus();
    }
  });

  // Touch: horizontal swipe steps; drag while zoomed pans.
  var touch = null, swiped = false;
  lb.addEventListener('touchstart', function (e) {
    swiped = false;
    if (e.touches.length === 1) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  lb.addEventListener('touchmove', function (e) {
    if (!touch || e.touches.length !== 1) return;
    if (zoomed) { panTo(e.touches[0]); layout(); swiped = true; }
  }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (!touch || zoomed) { touch = null; return; }
    var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; step(dx < 0 ? 1 : -1); }
    touch = null;
  });

  window.addEventListener('resize', function () { if (open) layout(); });
})();
