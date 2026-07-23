/* girvi explained — page logic. No network, no trackers; the CSP's
   connect-src 'none' makes that a browser-enforced guarantee.
   localStorage holds exactly one key: the theme preference. */

'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const THEME_KEY = 'girvi-explained:theme';

  /* ---------- theme ---------- */

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    const btn = $('themeToggle');
    if (btn) {
      btn.textContent = mode === 'dark' ? 'Switch to light' : 'Switch to dark';
      btn.setAttribute('aria-pressed', String(mode === 'light'));
    }
  }

  function initTheme() {
    let mode = null;
    try { mode = localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
    if (mode !== 'dark' && mode !== 'light') {
      mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light' : 'dark';
    }
    applyTheme(mode);
    const btn = $('themeToggle');
    if (btn) btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    });
  }

  /* ---------- scene animations (IntersectionObserver → .inview) ---------- */

  function initScenes() {
    const scenes = document.querySelectorAll('.scene');
    if (!('IntersectionObserver' in window)) {
      scenes.forEach((s) => s.classList.add('inview'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('inview'); io.unobserve(e.target); }
      }
    }, { threshold: 0.25 });
    scenes.forEach((s) => io.observe(s));
  }

  /* ---------- interactive ceiling demo ---------- */

  const fmtINR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  function rupees(paise) { return '₹' + fmtINR.format(paise / 100); }

  // SVG mapping (must match the hard-coded ceiling path in index.html):
  // x: value ₹0…₹10,00,000 → 20…620; y: ceiling ₹0…₹8,00,000 → 280…20
  function xOf(valuePaise) { return 20 + (valuePaise / 100000000) * 600; }
  function yOf(ceilingPaise) { return 280 - (ceilingPaise / 80000000) * 260; }

  function initDemo() {
    const slider = $('demoValue');
    if (!slider || typeof GIRVI_X === 'undefined') return;

    const outV = $('demoV'), outC = $('demoC'), outT = $('demoT'), outP = $('demoP');
    const dot = $('demoDot'), drop = $('demoDropX');

    function render() {
      const valuePaise = Number(slider.value) * 100;
      const info = GIRVI_X.ceilingInfo(valuePaise);
      outV.textContent = rupees(valuePaise);
      outC.textContent = rupees(info.ceilingPaise);
      outT.textContent = info.plateau > 0 ? 'plateau — cap pinned' : info.capPctAtCeiling + '% tier';
      if (info.plateau > 0) {
        outP.hidden = false;
        outP.textContent = 'Plateau ' + (info.plateau === 1 ? '①' : '②') +
          ': the ceiling is stuck at ' + rupees(info.ceilingPaise) +
          ' — more gold does not raise it until your collateral value crosses ' +
          rupees(info.exitValuePaise) + '.';
      } else {
        outP.hidden = true;
        outP.textContent = '';
      }
      const x = xOf(valuePaise).toFixed(1);
      const y = yOf(info.ceilingPaise).toFixed(1);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      drop.setAttribute('x1', x); drop.setAttribute('x2', x);
      drop.setAttribute('y1', y);
      slider.setAttribute('aria-valuetext',
        rupees(valuePaise) + ' of gold — lawful ceiling ' + rupees(info.ceilingPaise));
    }

    slider.addEventListener('input', render);
    render();
  }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initScenes();
    initDemo();
  });
})();
