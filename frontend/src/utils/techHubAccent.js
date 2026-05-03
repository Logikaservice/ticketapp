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

/** `dark` = palette Hub attuale; `light` = sfondo bianco/grigio chiaro nella shell Hub tecnico. */
export const STORAGE_KEY_TECH_HUB_SURFACE = 'techHubSurfaceMode';

export function getStoredTechHubSurfaceMode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TECH_HUB_SURFACE);
    return raw === 'light' ? 'light' : 'dark';
  } catch (_) {
    return 'dark';
  }
}

/** Variabili CSS per sfondo e tipografia della shell Hub (sidebar, colonne, card overview). */
export function hubChromeCssVariables(surfaceMode = 'dark') {
  const light = surfaceMode === 'light';
  if (!light) {
    return {
      '--hub-chrome-page': HUB_PAGE_BG,
      '--hub-chrome-surface': HUB_SURFACE,
      '--hub-chrome-sidebar': '#171717',
      '--hub-chrome-ring-offset': HUB_PAGE_BG,
      '--hub-chrome-card-shadow': 'none',
      '--hub-chrome-muted-fill': 'rgba(255,255,255,0.06)',
      '--hub-chrome-row-fill': 'rgba(0,0,0,0.2)',
      '--hub-chrome-input-bg': HUB_SURFACE,
      '--hub-chrome-border': 'rgba(255,255,255,0.10)',
      '--hub-chrome-border-soft': 'rgba(255,255,255,0.06)',
      '--hub-chrome-text': 'rgba(255,255,255,0.92)',
      '--hub-chrome-text-secondary': 'rgba(255,255,255,0.82)',
      '--hub-chrome-text-muted': 'rgba(255,255,255,0.55)',
      '--hub-chrome-text-faint': 'rgba(255,255,255,0.42)',
      '--hub-chrome-text-fainter': 'rgba(255,255,255,0.28)',
      '--hub-chrome-placeholder': 'rgba(255,255,255,0.30)',
      '--hub-chrome-hover': 'rgba(255,255,255,0.06)',
      '--hub-chrome-pagination-dot-off': 'rgba(255,255,255,0.22)',
      '--hub-chrome-well': 'rgba(0,0,0,0.28)',
      '--hub-chrome-well-mid': 'rgba(0,0,0,0.25)',
      '--hub-chrome-input-well': 'rgba(0,0,0,0.35)',
      '--hub-chrome-badge-scrim': 'rgba(0,0,0,0.55)',
      '--hub-chrome-hidden-mask': 'rgba(0,0,0,0.45)',
      '--hub-chrome-link': '#38bdf8',
      '--hub-chrome-band-info-bg': 'rgba(14,165,233,0.12)',
      '--hub-chrome-band-info-text': '#e0f2fe',
      '--hub-chrome-band-info-mark': '#38bdf8',
      '--hub-chrome-row-nested-bg': 'rgba(14,165,233,0.12)',
      '--hub-chrome-row-nested-hover': 'rgba(14,165,233,0.18)',
      '--hub-chrome-row-expired-bg': 'rgba(127,29,29,0.35)',
      '--hub-chrome-msg-error-bg': 'rgba(69,10,10,0.55)',
      '--hub-chrome-msg-error-border': 'rgba(248,113,113,0.35)',
      '--hub-chrome-msg-error-text': '#fecaca',
      '--hub-chrome-chip-live-border': 'rgba(52,211,153,0.4)',
      '--hub-chrome-chip-live-bg': 'rgba(52,211,153,0.15)',
      '--hub-chrome-chip-live-text': '#a7f3d0',
      '--hub-chrome-chip-idle-border': 'rgba(251,191,36,0.4)',
      '--hub-chrome-chip-idle-bg': 'rgba(251,191,36,0.15)',
      '--hub-chrome-chip-idle-text': '#fde68a',
      '--hub-chrome-badge-critical-bg': 'rgba(239,68,68,0.22)',
      '--hub-chrome-badge-critical-text': '#fecaca',
      '--hub-chrome-badge-warn-bg': 'rgba(245,158,11,0.22)',
      '--hub-chrome-badge-warn-text': '#fde68a',
      '--hub-chrome-palette-sky-bg': 'rgba(14,165,233,0.15)',
      '--hub-chrome-palette-sky-fg': '#7dd3fc',
      '--hub-chrome-palette-amber-bg': 'rgba(245,158,11,0.15)',
      '--hub-chrome-palette-amber-fg': '#fcd34d',
      '--hub-chrome-palette-emerald-bg': 'rgba(52,211,153,0.15)',
      '--hub-chrome-palette-emerald-fg': '#6ee7b7',
      '--hub-chrome-palette-violet-bg': 'rgba(167,139,250,0.15)',
      '--hub-chrome-palette-violet-fg': '#c4b5fd',
      '--hub-chrome-tone-danger-icon': '#f87171',
      '--hub-chrome-tone-danger-title': '#f87171',
      '--hub-chrome-tone-danger-body': 'rgba(252,165,165,0.92)',
      '--hub-chrome-tone-info-icon': '#38bdf8',
      '--hub-chrome-tone-info-title': '#7dd3fc',
      '--hub-chrome-tone-info-body': 'rgba(186,230,253,0.88)',
      '--hub-chrome-tone-warn-icon': '#fbbf24',
      '--hub-chrome-tone-warn-title': '#fcd34d',
      '--hub-chrome-tone-warn-body': 'rgba(253,230,138,0.9)',
      '--hub-chrome-tone-success-icon': '#34d399',
      '--hub-chrome-tone-success-title': '#6ee7b7',
      '--hub-chrome-tone-success-body': 'rgba(167,243,208,0.9)',
      '--hub-chrome-notice-danger-bg': 'rgba(127,29,29,0.45)',
      '--hub-chrome-notice-danger-border': 'rgba(248,113,113,0.4)',
      '--hub-chrome-notice-danger-text': '#fecaca',
      '--hub-chrome-notice-warn-bg': 'rgba(120,53,15,0.45)',
      '--hub-chrome-notice-warn-border': 'rgba(251,191,36,0.35)',
      '--hub-chrome-notice-warn-text': '#fef3c7',
      '--hub-chrome-notice-info-bg': 'rgba(12,74,110,0.4)',
      '--hub-chrome-notice-info-border': 'rgba(56,189,248,0.35)',
      '--hub-chrome-notice-info-text': '#e0f2fe',
      '--hub-chrome-notice-neutral-bg': 'rgba(0,0,0,0.22)',
      '--hub-chrome-notice-neutral-border': 'rgba(255,255,255,0.12)',
      '--hub-chrome-notice-neutral-text': 'rgba(255,255,255,0.88)'
    };
  }
  return {
    /** Sfondo pagina leggermente più chiaro delle card (riferimento UI “dashboard chiara”). */
    '--hub-chrome-page': '#f3f5f9',
    '--hub-chrome-surface': '#ffffff',
    '--hub-chrome-sidebar': '#ffffff',
    '--hub-chrome-ring-offset': '#f3f5f9',
    '--hub-chrome-muted-fill': 'rgba(0,0,0,0.04)',
    '--hub-chrome-row-fill': 'rgba(0,0,0,0.04)',
    '--hub-chrome-input-bg': '#f4f6f9',
    '--hub-chrome-border': 'rgba(15,23,42,0.10)',
    '--hub-chrome-border-soft': 'rgba(15,23,42,0.07)',
    '--hub-chrome-text': 'rgba(17,24,39,0.92)',
    '--hub-chrome-text-secondary': 'rgba(31,41,55,0.88)',
    '--hub-chrome-text-muted': 'rgba(75,85,99,0.88)',
    '--hub-chrome-text-faint': 'rgba(100,116,139,0.92)',
    '--hub-chrome-text-fainter': 'rgba(148,163,184,0.96)',
    '--hub-chrome-placeholder': 'rgba(100,116,139,0.65)',
    '--hub-chrome-hover': 'rgba(15,23,42,0.06)',
    '--hub-chrome-pagination-dot-off': 'rgba(15,23,42,0.2)',
    '--hub-chrome-well': 'rgba(15,23,42,0.05)',
    '--hub-chrome-well-mid': 'rgba(15,23,42,0.06)',
    '--hub-chrome-input-well': 'rgba(249,250,251,0.96)',
    '--hub-chrome-badge-scrim': 'rgba(255,255,255,0.75)',
    '--hub-chrome-hidden-mask': 'rgba(15,23,42,0.12)',
    /** Link/evidenziazioni informative: stesso colore scelto in Impostazioni (`--hub-accent` sulla shell). */
    '--hub-chrome-link': 'var(--hub-accent, #0284c7)',
    '--hub-chrome-card-shadow': '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.06)',
    '--hub-chrome-band-info-bg': 'rgba(14,165,233,0.10)',
    '--hub-chrome-band-info-text': '#0c4a6e',
    '--hub-chrome-band-info-mark': '#0284c7',
    '--hub-chrome-row-nested-bg': 'rgba(14,165,233,0.08)',
    '--hub-chrome-row-nested-hover': 'rgba(14,165,233,0.14)',
    '--hub-chrome-row-expired-bg': 'rgba(254,242,242,0.95)',
    '--hub-chrome-msg-error-bg': '#fef2f2',
    '--hub-chrome-msg-error-border': '#fecaca',
    '--hub-chrome-msg-error-text': '#991b1b',
    '--hub-chrome-chip-live-border': 'rgba(16,185,129,0.35)',
    '--hub-chrome-chip-live-bg': 'rgba(16,185,129,0.12)',
    '--hub-chrome-chip-live-text': '#047857',
    '--hub-chrome-chip-idle-border': 'rgba(245,158,11,0.4)',
    '--hub-chrome-chip-idle-bg': 'rgba(251,191,36,0.15)',
    '--hub-chrome-chip-idle-text': '#b45309',
    '--hub-chrome-badge-critical-bg': 'rgba(254,226,226,0.95)',
    '--hub-chrome-badge-critical-text': '#b91c1c',
    '--hub-chrome-badge-warn-bg': 'rgba(254,243,199,0.95)',
    '--hub-chrome-badge-warn-text': '#b45309',
    '--hub-chrome-palette-sky-bg': 'rgba(14,165,233,0.10)',
    '--hub-chrome-palette-sky-fg': '#0369a1',
    '--hub-chrome-palette-amber-bg': 'rgba(245,158,11,0.12)',
    '--hub-chrome-palette-amber-fg': '#b45309',
    '--hub-chrome-palette-emerald-bg': 'rgba(16,185,129,0.12)',
    '--hub-chrome-palette-emerald-fg': '#047857',
    '--hub-chrome-palette-violet-bg': 'rgba(139,92,246,0.12)',
    '--hub-chrome-palette-violet-fg': '#5b21b6',
    '--hub-chrome-tone-danger-icon': '#dc2626',
    '--hub-chrome-tone-danger-title': '#b91c1c',
    '--hub-chrome-tone-danger-body': 'rgba(127,29,29,0.9)',
    /** Titolo/icona info: stesso accento scelto in Impostazioni; corpo resta grigio‑blu leggibile. */
    '--hub-chrome-tone-info-icon': 'var(--hub-accent, #0284c7)',
    '--hub-chrome-tone-info-title': 'var(--hub-accent, #0369a1)',
    '--hub-chrome-tone-info-body': 'rgba(51,65,85,0.92)',
    '--hub-chrome-tone-warn-icon': '#d97706',
    '--hub-chrome-tone-warn-title': '#b45309',
    '--hub-chrome-tone-warn-body': 'rgba(120,53,15,0.9)',
    '--hub-chrome-tone-success-icon': '#059669',
    '--hub-chrome-tone-success-title': '#047857',
    '--hub-chrome-tone-success-body': 'rgba(6,78,59,0.9)',
    '--hub-chrome-notice-danger-bg': '#fef2f2',
    '--hub-chrome-notice-danger-border': '#fecaca',
    '--hub-chrome-notice-danger-text': '#991b1b',
    '--hub-chrome-notice-warn-bg': '#fffbeb',
    '--hub-chrome-notice-warn-border': '#fde68a',
    '--hub-chrome-notice-warn-text': '#92400e',
    '--hub-chrome-notice-info-bg': '#f0f9ff',
    '--hub-chrome-notice-info-border': '#bae6fd',
    '--hub-chrome-notice-info-text': '#0c4a6e',
    '--hub-chrome-notice-neutral-bg': 'rgba(15,23,42,0.04)',
    '--hub-chrome-notice-neutral-border': 'rgba(15,23,42,0.10)',
    '--hub-chrome-notice-neutral-text': 'rgba(17,24,39,0.88)'
  };
}

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

/** Etichetta campo in form modale / Hub (segue `--hub-chrome-*` su :root o shell). */
export const HUB_MODAL_LABEL_CLS =
  'mb-1 block text-sm font-medium text-[color:var(--hub-chrome-text-muted)]';

/** Input / textarea standard su superficie Hub. */
export const HUB_MODAL_FIELD_CLS =
  'w-full rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-3 py-2 text-sm text-[color:var(--hub-chrome-text)] placeholder:text-[color:var(--hub-chrome-placeholder)] outline-none transition focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent,#c1ff72)]';

export const HUB_MODAL_TEXTAREA_CLS = `${HUB_MODAL_FIELD_CLS} min-h-[5rem] resize-y`;

/** Avviso in evidenza (contrasto su tema Hub chiaro/scuro). */
export const HUB_MODAL_NOTICE_DANGER =
  'rounded-lg border border-[color:var(--hub-chrome-notice-danger-border)] bg-[color:var(--hub-chrome-notice-danger-bg)] p-3 text-sm text-[color:var(--hub-chrome-notice-danger-text)]';

export const HUB_MODAL_NOTICE_WARN =
  'rounded-lg border border-[color:var(--hub-chrome-notice-warn-border)] bg-[color:var(--hub-chrome-notice-warn-bg)] p-3 text-sm text-[color:var(--hub-chrome-notice-warn-text)]';

export const HUB_MODAL_NOTICE_INFO =
  'rounded-lg border border-[color:var(--hub-chrome-notice-info-border)] bg-[color:var(--hub-chrome-notice-info-bg)] p-3 text-sm text-[color:var(--hub-chrome-notice-info-text)]';

export const HUB_MODAL_NOTICE_NEUTRAL =
  'rounded-lg border border-[color:var(--hub-chrome-notice-neutral-border)] bg-[color:var(--hub-chrome-notice-neutral-bg)] p-3 text-sm text-[color:var(--hub-chrome-notice-neutral-text)]';

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

/** Stile root pannelli Email/Office/… embedded: pagina Hub + accento (eredita `--hub-chrome-*` dal workbench). */
export function hubEmbeddedRootInlineStyle(accentHex) {
  const a = normalizeHex(accentHex) || getStoredTechHubAccent();
  return {
    backgroundColor: 'var(--hub-chrome-page)',
    ...hubModalCssVars(a)
  };
}

/** Pulsante «Panoramica Hub» su barre moduli embedded. */
export function hubEmbeddedBackBtnInlineStyle() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 12,
    border: '1px solid var(--hub-chrome-border)',
    background: 'var(--hub-chrome-well)',
    color: 'var(--hub-chrome-text-secondary)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0
  };
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
 * Stesso schema di {@link buildCommHubMessagingTheme} ma con colori presi da `--hub-chrome-*`
 * (impostati su shell Hub / modali hub). Usare quando `embedded` nell’Hub tecnico.
 */
export function buildHubEmbeddedMessagingTheme(accentHex) {
  const accent = normalizeHex(accentHex) || getStoredTechHubAccent();
  return {
    accent,
    page: 'var(--hub-chrome-page)',
    surface: 'var(--hub-chrome-surface)',
    well: 'var(--hub-chrome-well)',
    border: 'var(--hub-chrome-border-soft)',
    borderMid: 'var(--hub-chrome-border)',
    label: 'var(--hub-chrome-text-faint)',
    labelHi: 'var(--hub-chrome-text-muted)',
    text: 'var(--hub-chrome-text)',
    textSoft: 'var(--hub-chrome-text-secondary)',
    muted: 'var(--hub-chrome-text-fainter)',
    tabInactive: 'var(--hub-chrome-text-muted)',
    accentSoft: hexToRgba(accent, 0.14),
    accentSoft2: hexToRgba(accent, 0.1),
    accentBorder: hexToRgba(accent, 0.48),
    iconTileBg: hexToRgba(accent, 0.14),
    btnPrimaryBg: accent,
    btnPrimaryFg: readableOnAccent(accent),
    sendDisabled: 'var(--hub-chrome-muted-fill)'
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
