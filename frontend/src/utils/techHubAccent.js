/**
 * Accento Hub tecnico (dashboard / tema) — stessa palette e localStorage dell'Hub.
 */

export const STORAGE_KEY_TECH_HUB_ACCENT = 'techHubAccent';

export const DEFAULT_TECH_HUB_ACCENT = '#C1FF72';

export const TECH_HUB_ACCENT_PALETTE = [
  { id: 'lime', label: 'Lime', hex: '#C1FF72' },
  { id: 'chartreuse', label: 'Chartreuse', hex: '#D4FF47' },
  { id: 'spring', label: 'Primavera', hex: '#00FF9F' },
  { id: 'cyan', label: 'Ciano', hex: '#22D3EE' },
  { id: 'sky', label: 'Cielo', hex: '#38BDF8' },
  { id: 'blue', label: 'Blu elettrico', hex: '#60A5FA' },
  { id: 'violet', label: 'Violetto', hex: '#A78BFA' },
  { id: 'fuchsia', label: 'Fucsia', hex: '#E879F9' },
  { id: 'pink', label: 'Rosa', hex: '#FB7185' },
  { id: 'coral', label: 'Corallo', hex: '#FF6B6B' },
  { id: 'amber', label: 'Ambra', hex: '#FBBF24' },
  { id: 'orange', label: 'Arancione', hex: '#FB923C' }
];

export function normalizeHex(hex) {
  const h = (hex || '').trim();
  const re = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
  const m = h.match(re);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) {
    s = s.split('').map((c) => c + c).join('');
  }
  return `#${s}`;
}

export function hexToRgba(hex, alpha) {
  const normalized = normalizeHex(hex);
  if (!normalized) return `rgba(255,255,255,${alpha})`;
  const h = normalized.slice(1);
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function rgbFromHex(hexNorm) {
  const h = hexNorm.slice(1);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexFromRgb(r, g, b) {
  return `#${[r, g, b].map((x) => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
}

/** Schiarisce verso bianco (amount 0–1). */
export function lightenHex(hex, amount) {
  const h = normalizeHex(hex);
  if (!h) return DEFAULT_TECH_HUB_ACCENT;
  const [r, g, b] = rgbFromHex(h);
  const a = Math.min(1, Math.max(0, amount));
  return hexFromRgb(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a);
}

/** Scurisce verso nero (amount 0–1). */
export function darkenHex(hex, amount) {
  const h = normalizeHex(hex);
  if (!h) return DEFAULT_TECH_HUB_ACCENT;
  const [r, g, b] = rgbFromHex(h);
  const f = Math.min(1, Math.max(0, 1 - amount));
  return hexFromRgb(r * f, g * f, b * f);
}

/** Testo leggibile su sfondo pieno colore accent. */
export function readableOnAccent(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return '#111111';
  const h = normalized.slice(1);
  const n = parseInt(h, 16);
  const R = ((n >> 16) & 255) / 255;
  const G = ((n >> 8) & 255) / 255;
  const Bl = (n & 255) / 255;
  const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * Bl;
  return luminance > 0.62 ? '#121212' : '#fafafa';
}

/** Legge l’accent salvato dall’Hub; validazione palette (fallback default). */
export function getStoredTechHubAccent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TECH_HUB_ACCENT);
    const n = normalizeHex(raw);
    if (!n) return DEFAULT_TECH_HUB_ACCENT;
    const known = TECH_HUB_ACCENT_PALETTE.some((p) => p.hex.toLowerCase() === n.toLowerCase());
    return known ? n : DEFAULT_TECH_HUB_ACCENT;
  } catch (_) {
    /* ignore */
  }
  return DEFAULT_TECH_HUB_ACCENT;
}

/** Stile header modali/dashboard allineati al tema Hub (gradient sul colore scelto). */
export function techHubAccentHeaderGradientStyle(hex) {
  const base = normalizeHex(hex) || DEFAULT_TECH_HUB_ACCENT;
  return {
    backgroundImage: `linear-gradient(to right, ${darkenHex(base, 0.24)}, ${lightenHex(base, 0.18)})`
  };
}

/** Piccolo gradient per avatar/cerchi elenchi (evita blu fisso). */
export function techHubAccentIconTileStyle(hex) {
  const base = normalizeHex(hex) || DEFAULT_TECH_HUB_ACCENT;
  return {
    backgroundImage: `linear-gradient(to bottom right, ${darkenHex(base, 0.08)}, ${lightenHex(base, 0.05)})`
  };
}
