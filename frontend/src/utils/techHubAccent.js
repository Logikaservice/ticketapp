/**
 * Accento tema + palette scura **Hub tecnico** (sfondo `#121212` / superfici `#1E1E1E`), usati anche dai modali
 * allineati all’Hub (nuovo ticket, lista contratti, ecc.) — non alla dashboard ticket chiara (`#f3f4f6`).
 *
 * Comportamento (tecnico e cliente, stesso browser):
 * - Primo accesso: nessun valore in storage → si usa DEFAULT_TECH_HUB_ACCENT.
 * - Dopo la scelta (Hub o Impostazioni account): il valore resta in localStorage
 *   sotto STORAGE_KEY_TECH_HUB_ACCENT finché l’utente non lo cambia di nuovo.
 */

export const STORAGE_KEY_TECH_HUB_ACCENT = 'techHubAccent';

export const DEFAULT_TECH_HUB_ACCENT = '#C1FF72';

/** Sfondo principale Hub tecnico (stesso degli overlay modali «stile Hub»). */
export const HUB_PAGE_BG = '#121212';

/** Card / campo / fascia secondaria nell’Hub. */
export const HUB_SURFACE = '#1E1E1E';

/** Variabili CSS per moduli/modali allineati all'Hub (focus ring sull'accento). */
export function hubModalCssVars(accentHex) {
  const a = normalizeHex(accentHex) || DEFAULT_TECH_HUB_ACCENT;
  return {
    ['--hub-accent']: a,
    ['--hub-accent-border']: hexToRgba(a, 0.52)
  };
}

/** Etichetta campo in form modale stile Hub scuro (toni solidi: meglio contrasto su #121212). */
export const HUB_MODAL_LABEL_CLS =
  'mb-1 block text-sm font-medium text-gray-200';

/** Input / textarea standard su sfondo Hub. */
export const HUB_MODAL_FIELD_CLS =
  'w-full rounded-lg border border-white/[0.12] bg-black/[0.28] px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400 outline-none transition focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)]';

export const HUB_MODAL_TEXTAREA_CLS = `${HUB_MODAL_FIELD_CLS} min-h-[5rem] resize-y`;

/** Avviso in evidenza su sfondo modal scuro. */
export const HUB_MODAL_NOTICE_DANGER =
  'rounded-lg border border-red-500/40 bg-red-500/15 p-3 text-sm text-red-50';

export const HUB_MODAL_NOTICE_WARN =
  'rounded-lg border border-amber-500/38 bg-amber-500/12 p-3 text-sm text-amber-50';

export const HUB_MODAL_NOTICE_INFO =
  'rounded-lg border border-sky-500/35 bg-sky-500/12 p-3 text-sm text-sky-50';

export const HUB_MODAL_NOTICE_NEUTRAL =
  'rounded-lg border border-white/[0.12] bg-black/[0.22] p-3 text-sm text-gray-200';

/**
 * Variabili CSS per moduli allineati all’Hub: accento utente + palette scura base.
 */
export function hubShellThemeVars(accentHex) {
  const a = normalizeHex(accentHex) || DEFAULT_TECH_HUB_ACCENT;
  return {
    '--td-accent': a,
    '--td-soft': hexToRgba(a, 0.08),
    '--td-soft-strong': hexToRgba(a, 0.14),
    '--hub-page': HUB_PAGE_BG,
    '--hub-surface': HUB_SURFACE
  };
}

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

/**
 * Palette per moduli «Comunicazioni» (Centro messaggi + gestione agent) allineata all’Hub tecnico.
 */
export function buildCommHubMessagingTheme(accentHex) {
  const accent = normalizeHex(accentHex) || getStoredTechHubAccent();
  return {
    accent,
    page: HUB_PAGE_BG,
    surface: HUB_SURFACE,
    well: 'rgba(0,0,0,0.28)',
    border: 'rgba(255,255,255,0.08)',
    borderMid: 'rgba(255,255,255,0.12)',
    label: 'rgba(255,255,255,0.42)',
    labelHi: 'rgba(255,255,255,0.55)',
    text: 'rgba(255,255,255,0.92)',
    textSoft: 'rgba(255,255,255,0.78)',
    muted: 'rgba(255,255,255,0.38)',
    tabInactive: 'rgba(255,255,255,0.4)',
    accentSoft: hexToRgba(accent, 0.14),
    accentSoft2: hexToRgba(accent, 0.1),
    accentBorder: hexToRgba(accent, 0.48),
    iconTileBg: hexToRgba(accent, 0.14),
    btnPrimaryBg: accent,
    btnPrimaryFg: readableOnAccent(accent),
    sendDisabled: 'rgba(255,255,255,0.22)'
  };
}

/**
 * Header modali: sfondo **uniforme** = colore accento salvato dall’Hub (`techHubAccent`).
 * Il testo eredita contrasto tramite {@link readableOnAccent}.
 */
export function techHubAccentModalHeaderStyle(hex) {
  const base = normalizeHex(hex) || DEFAULT_TECH_HUB_ACCENT;
  return {
    backgroundColor: base,
    color: readableOnAccent(base),
    backgroundImage: 'none'
  };
}

/** Alias storico — stesso comportamento della versione uniforme (niente più gradiente). */
export const techHubAccentHeaderGradientStyle = techHubAccentModalHeaderStyle;

/** Piccolo gradient per avatar/cerchi elenchi (evita blu fisso). */
export function techHubAccentIconTileStyle(hex) {
  const base = normalizeHex(hex) || DEFAULT_TECH_HUB_ACCENT;
  return {
    backgroundImage: `linear-gradient(to bottom right, ${darkenHex(base, 0.08)}, ${lightenHex(base, 0.05)})`
  };
}
