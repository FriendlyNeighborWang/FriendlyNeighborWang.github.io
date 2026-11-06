(function () {
  'use strict';

  var article = document.querySelector('.article-content');

  // ---- KaTeX ---------------------------------------------------------------
  function renderMath() {
    if (!article || typeof renderMathInElement !== 'function') return;
    renderMathInElement(article, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
  var katexLib = document.getElementById('katex-lib');
  if (katexLib) {
    if (typeof renderMathInElement === 'function') renderMath();
    else katexLib.addEventListener('load', renderMath);
  }

  // ---- Prose rewrite: "->" becomes an arrow, \t keeps its width --------------
  // Text inside code / math is left alone.
  function skip(node) {
    for (var p = node.parentElement; p && p !== article; p = p.parentElement) {
      if (p.tagName === 'CODE' || p.tagName === 'PRE' || p.classList.contains('katex')) return true;
    }
    return false;
  }
  function textNodes(test) {
    var out = [];
    var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return test(n.nodeValue) && !skip(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    for (var n; (n = walker.nextNode());) out.push(n);
    return out;
  }
  if (article) {
    textNodes(function (s) { return s.indexOf('->') !== -1 && s.indexOf('$') === -1; })
      .forEach(function (n) { n.nodeValue = n.nodeValue.replace(/->/g, '→'); });
    textNodes(function (s) { return s.indexOf('\t') !== -1; })
      .forEach(function (n) {
        var frag = document.createDocumentFragment();
        n.nodeValue.split('\t').forEach(function (part, i) {
          if (i > 0) {
            var tab = document.createElement('span');
            tab.className = 'md-tab';
            frag.appendChild(tab);
          }
          if (part) frag.appendChild(document.createTextNode(part));
        });
        n.parentNode.replaceChild(frag, n);
      });
  }

  // ---- Code copy -----------------------------------------------------------
  document.querySelectorAll('.code-copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var code = btn.closest('.code').querySelector('pre code');
      if (!code || !navigator.clipboard) return;
      navigator.clipboard.writeText(code.innerText).then(function () {
        btn.textContent = 'copied';
        btn.classList.add('done');
        setTimeout(function () { btn.textContent = 'copy'; btn.classList.remove('done'); }, 1500);
      });
    });
  });

  // ---- Vim-style ruler: Top / NN% / Bot; click or `gg` for top, `G` for bottom --
  var ruler = document.querySelector('.ruler');
  var rulerPos = ruler && ruler.querySelector('.ruler-pos');
  function updateRuler() {
    if (!ruler) return;
    var max = document.documentElement.scrollHeight - innerHeight;
    var y = window.scrollY;
    ruler.classList.toggle('show', max > innerHeight * 0.5 && y > 320);
    rulerPos.textContent = y <= 0 ? 'Top' : y >= max - 2 ? 'Bot' : Math.round(y / max * 100) + '%';
  }
  function toTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (ruler) {
    ruler.addEventListener('click', toTop);
    window.addEventListener('scroll', function () { requestAnimationFrame(updateRuler); }, { passive: true });
    window.addEventListener('resize', updateRuler);
    updateRuler();
    var lastG = 0;
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || document.documentElement.classList.contains('lb-open')) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'g') {
        if (e.timeStamp - lastG < 500) { lastG = 0; toTop(); } else lastG = e.timeStamp;
      } else if (e.key === 'G') {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      }
    });
  }

  // ---- Reading progress + TOC scrollspy --------------------------------------
  var bar = document.querySelector('.progress');
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc-rail a[href^="#"]'));
  var targets = links.map(function (a) {
    return document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
  });
  var ticking = false;

  function update() {
    ticking = false;
    if (bar && article) {
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      bar.style.transform = 'scaleX(' + p + ')';
    }
    var current = -1;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i] && targets[i].getBoundingClientRect().top < 120) current = i;
    }
    links.forEach(function (a, i) { a.classList.toggle('active', i === current); });
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  if (article) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }
})();
