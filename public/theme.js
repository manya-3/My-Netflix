'use strict';
(function (win) {

  // ── PRESET THEMES ────────────────────────────────────────
  const PRESETS = [
    { name: 'Netflix Red', hex: '#e50914' },
    { name: 'Pink',        hex: '#e91e8c' },
    { name: 'Purple',      hex: '#7c3aed' },
    { name: 'Blue',        hex: '#1565c0' },
    { name: 'Cyan',        hex: '#0097a7' },
    { name: 'Green',       hex: '#1b8a44' },
    { name: 'Orange',      hex: '#e65100' },
    { name: 'Gold',        hex: '#d97706' },
  ];

  // ── COLOR MATH ───────────────────────────────────────────
  function hexToHSL(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function hsl(h, s, l)     { return `hsl(${h},${clamp(s,0,100)}%,${clamp(l,0,95)}%)`; }
  function hsla(h, s, l, a) { return `hsla(${h},${clamp(s,0,100)}%,${clamp(l,0,95)}%,${a})`; }

  // ── PALETTE GENERATOR ────────────────────────────────────
  function generatePalette(hex) {
    const [h, s, l] = hexToHSL(hex);
    // normalise lightness so very dark/bright colors still look good
    const lp = clamp(l, 35, 62);   // primary display lightness
    const ls = clamp(s, 45, 95);   // saturation

    return {
      // replaces --red / --dark-red used throughout existing CSS
      '--red':                  hsl(h, ls, lp),
      '--dark-red':             hsl(h, ls, lp - 12),

      // new theme tokens
      '--theme-primary':        hsl(h, ls, lp),
      '--theme-dark':           hsl(h, ls, lp - 12),
      '--theme-darker':         hsl(h, ls, lp - 22),
      '--theme-light':          hsl(h, Math.max(ls - 15, 20), lp + 22),
      '--theme-xlight':         hsl(h, Math.max(ls - 30, 15), lp + 38),
      '--theme-glow':           hsla(h, ls, lp, 0.45),
      '--theme-glow-strong':    hsla(h, ls, lp, 0.7),
      '--theme-surface-tint':   hsla(h, ls, lp, 0.13),
      '--theme-border':         hsla(h, ls, lp, 0.5),
      '--theme-accent-text':    hsl(h, Math.max(ls - 20, 20), lp + 30),

      // background — deep tinted dark
      '--bg':                   hsl(h, Math.min(ls * 0.35, 28), 8),
      '--surface':              hsl(h, Math.min(ls * 0.25, 22), 12),
      '--surface2':             hsl(h, Math.min(ls * 0.2,  18), 17),

      // hero gradient overlay
      '--theme-hero-from':      hsla(h, ls, clamp(lp - 18, 5, 50), 0.88),
      '--theme-hero-to':        hsla(h, ls, lp, 0.18),

      // card glow on hover
      '--theme-card-glow':      `0 8px 36px ${hsla(h, ls, lp, 0.5)}`,
    };
  }

  // ── APPLY ────────────────────────────────────────────────
  function applyHex(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) hex = '#e50914';
    const palette = generatePalette(hex);
    const root = document.documentElement;
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v));
    // body bg gradient
    const [h, s, l] = hexToHSL(hex);
    const lp = clamp(l, 35, 62), ls = clamp(s, 45, 95);
    document.body.style.background =
      `linear-gradient(160deg, hsl(${h},${Math.min(ls*0.35,28)}%,9%) 0%, #080808 55%)`;
  }

  function apply(profileId) {
    const hex = localStorage.getItem('nf_theme_' + profileId) || '#e50914';
    applyHex(hex);
  }

  function save(profileId, hex) {
    localStorage.setItem('nf_theme_' + profileId, hex);
  }

  function load(profileId) {
    return localStorage.getItem('nf_theme_' + profileId) || '#e50914';
  }

  win.NfTheme = { PRESETS, apply, applyHex, save, load, generatePalette };

})(window);
