/**
 * Layout panoramica Hub tecnico — griglia 7 colonne, altezza in unità righe (1–4).
 * Persistenza locale; elenco `items` può essere parziale (moduli eliminati esclusi).
 */

export const HUB_GRID_COLS = 7;
export const HUB_MAX_ROW_SPAN = 4;
export const STORAGE_HUB_LAYOUT = 'techHubOverviewLayout';

/** Incrementare quando si aggiungono moduli da fondere nei layout salvati (vedi `loadHubLayout`). */
export const HUB_LAYOUT_STORAGE_VERSION = 3;

export const HUB_MODULE_META = {
  'new-ticket': { label: 'Nuovo ticket', category: 'Azioni', defaultPlacement: { col: 1, row: 1, w: 3, h: 1 } },
  'stat-aperto': {
    label: 'Ticket · Aperti',
    category: 'Ticket',
    defaultPlacement: { col: 4, row: 1, w: 2, h: 1 }
  },
  'stat-lavorazione': {
    label: 'Ticket · In lavorazione',
    category: 'Ticket',
    defaultPlacement: { col: 6, row: 1, w: 2, h: 1 }
  },
  'launch-email': {
    label: 'Email',
    category: 'Moduli',
    defaultPlacement: { col: 1, row: 2, w: 2, h: 1 }
  },
  'launch-network': {
    label: 'Monitoraggio rete',
    category: 'Moduli',
    defaultPlacement: { col: 3, row: 2, w: 2, h: 1 }
  },
  'launch-comms': {
    label: 'Comunicazioni',
    category: 'Moduli',
    defaultPlacement: { col: 5, row: 2, w: 2, h: 1 }
  },
  'launch-antivirus': {
    label: 'Anti-Virus',
    category: 'Moduli',
    defaultPlacement: { col: 7, row: 2, w: 1, h: 1 }
  },
  /** Eventi agent monitoraggio: card espandibile sulla panoramica (triangolo header). */
  'agent-events': {
    label: 'Notifiche',
    category: 'Moduli',
    resizeBounds: { minW: 1, maxW: 7, minH: 1, maxH: 4 },
    /** Fila 6: sotto i KPI, sopra Office/Dispositivi — resta visibile senza scroll lungo. */
    defaultPlacement: { col: 1, row: 6, w: 5, h: 2 }
  },
  'launch-dispositivi': {
    label: 'Dispositivi',
    category: 'Moduli',
    defaultPlacement: { col: 5, row: 7, w: 3, h: 1 }
  },
  'launch-speedtest': {
    label: 'Speed test',
    category: 'Moduli',
    defaultPlacement: { col: 1, row: 8, w: 2, h: 1 }
  },
  'launch-forniture-resoconto': {
    label: 'Forniture temporanee',
    category: 'Moduli',
    defaultPlacement: { col: 3, row: 8, w: 2, h: 1 }
  },
  contracts: {
    label: 'Contratti attivi',
    category: 'KPI',
    /** Grafico KPI: dentro questi margini puoi ridimensionare la card. */
    resizeBounds: { minW: 4, maxW: 7, minH: 2, maxH: 4 },
    defaultPlacement: { col: 1, row: 3, w: 5, h: 3 }
  },
  'quick-summary': {
    label: 'Riepilogo rapido',
    category: 'Testo',
    defaultPlacement: { col: 6, row: 3, w: 2, h: 1 }
  },
  'launch-mappatura': {
    label: 'Mappatura',
    category: 'Moduli',
    defaultPlacement: { col: 6, row: 4, w: 2, h: 2 }
  },
  'launch-office': {
    label: 'Office',
    category: 'Moduli',
    defaultPlacement: { col: 1, row: 7, w: 4, h: 1 }
  }
};

export const ALL_MODULE_IDS = Object.keys(HUB_MODULE_META);

function clampExtrasInt(n, lo, hi) {
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

/** Campi persistiti su ogni slot griglia (valori sicuri dopo sanitize). */
export function normalizeLayoutExtras(cur) {
  return {
    locked: Boolean(cur?.locked),
    iconOnly: Boolean(cur?.iconOnly),
    /** Senza trim: altrimenti ogni `sanitize` (dopo ogni tasto) mangia spazi finali e rende la digitazione impossibile. */
    customTitle: typeof cur?.customTitle === 'string' ? cur.customTitle.slice(0, 120) : '',
    customSubtitle: typeof cur?.customSubtitle === 'string' ? cur.customSubtitle.slice(0, 200) : '',
    refreshIntervalSec: (() => {
      const s = parseInt(cur?.refreshIntervalSec, 10);
      if (!Number.isFinite(s) || s <= 0) return 0;
      return clampExtrasInt(s, 30, 3600);
    })()
  };
}

export function cloneLayout(items) {
  return items.map((x) => ({ ...x }));
}

export function getDefaultHubLayout() {
  return ALL_MODULE_IDS.map((id) => {
    const meta = HUB_MODULE_META[id];
    const p = meta.defaultPlacement;
    const fx = meta.fixedSize;
    const w = fx ? fx.w : p.w;
    const h = fx ? fx.h : p.h;
    return {
      id,
      col: p.col,
      row: p.row,
      w,
      h,
      hidden: false,
      ...normalizeLayoutExtras({})
    };
  });
}

export function hubModuleSupportsIconOnly(moduleId) {
  return Boolean(moduleId) && moduleId !== 'contracts';
}

/**
 * Ripristina **solo** la card indicata a posizione/dimensioni predefinite del progetto e azzera personalizzazioni
 * (titolo, sottotitolo, icona 1×1, blocco, refresh). Non reintroduce moduli rimossi dalla griglia.
 * Lo stato «nascosta» della card viene mantenuto.
 */
export function restoreSingleCardDefaults(layout, id) {
  const meta = HUB_MODULE_META[id];
  if (!meta || !Array.isArray(layout) || layout.length === 0) return layout;
  const idx = layout.findIndex((x) => x.id === id);
  if (idx < 0) return layout;
  const p = meta.defaultPlacement;
  const fx = meta.fixedSize;
  const bounds = meta.resizeBounds;
  let w = fx ? fx.w : p.w;
  let h = fx ? fx.h : p.h;
  if (bounds) {
    w = clampInt(p.w, bounds.minW, bounds.maxW);
    h = clampInt(p.h, bounds.minH, bounds.maxH);
  } else if (!fx) {
    w = clampInt(w, 1, HUB_GRID_COLS);
    h = clampInt(h, 1, HUB_MAX_ROW_SPAN);
  }
  const prev = layout[idx];
  const next = cloneLayout(layout);
  next[idx] = {
    id,
    col: p.col,
    row: p.row,
    w,
    h,
    hidden: Boolean(prev.hidden),
    ...normalizeLayoutExtras({})
  };
  return sanitizeLayoutItems(next);
}

function storageKey(userId) {
  if (userId != null && userId !== '') return `${STORAGE_HUB_LAYOUT}:u${userId}`;
  return STORAGE_HUB_LAYOUT;
}

/**
 * Inserisce un modulo alle coordinate predefinite (o la posizione libera più vicina).
 * Usato in migrazione layout e come alternativa ad «append in fondo».
 */
export function insertModuleWithDefaultPlacement(layout, id) {
  if (!Array.isArray(layout) || layout.some((x) => x.id === id)) return layout;
  const meta = HUB_MODULE_META[id];
  if (!meta) return layout;
  const p = meta.defaultPlacement;
  const fixed = meta.fixedSize;
  const w = fixed ? fixed.w : p.w;
  const h = fixed ? fixed.h : p.h;
  const next = cloneLayout(layout);
  const trial = { col: p.col, row: p.row, w, h };
  let col = trial.col;
  let row = trial.row;
  if (hasCollision(next, trial, null)) {
    const fit = findNearestFit(next, w, h, null, col, row);
    col = fit.col;
    row = fit.row;
  }
  next.push({
    id,
    col,
    row,
    w,
    h,
    hidden: false,
    ...normalizeLayoutExtras({})
  });
  return resolveCollisions(next);
}

export function loadHubLayout(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return null;
    let items = sanitizeLayoutItems(data.items);
    const fileVer = parseInt(data.v, 10) || 1;
    if (fileVer < HUB_LAYOUT_STORAGE_VERSION) {
      if (!items.some((x) => x.id === 'agent-events')) {
        items = sanitizeLayoutItems(insertModuleWithDefaultPlacement(items, 'agent-events'));
      }
      if (fileVer < 3 && !items.some((x) => x.id === 'launch-forniture-resoconto')) {
        items = sanitizeLayoutItems(insertModuleWithDefaultPlacement(items, 'launch-forniture-resoconto'));
      }
    }
    return items;
  } catch (_) {
    return null;
  }
}

export function saveHubLayout(userId, items) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ v: HUB_LAYOUT_STORAGE_VERSION, items: cloneLayout(items) })
    );
  } catch (_) {
    /* ignore */
  }
}

/** Valida e sistema ogni voce; rimuove id sconosciuti. */
export function sanitizeLayoutItems(items) {
  const known = new Set(ALL_MODULE_IDS);
  const seen = new Set();
  const out = [];
  (items || []).forEach((cur) => {
    if (!cur || !known.has(cur.id) || seen.has(cur.id)) return;
    seen.add(cur.id);
    const meta = HUB_MODULE_META[cur.id];
    const def = meta.defaultPlacement;
    const fixed = meta.fixedSize;
    const bounds = meta.resizeBounds;
    const extras = normalizeLayoutExtras(cur);
    let iconOnly = extras.iconOnly && hubModuleSupportsIconOnly(cur.id);
    if (!hubModuleSupportsIconOnly(cur.id)) iconOnly = false;

    let w;
    let h;
    if (iconOnly) {
      w = 1;
      h = 1;
    } else if (fixed) {
      w = fixed.w;
      h = fixed.h;
    } else if (bounds) {
      w = clampInt(cur.w ?? def.w, bounds.minW, bounds.maxW);
      h = clampInt(cur.h ?? def.h, bounds.minH, bounds.maxH);
      w = clampInt(w, bounds.minW, Math.min(bounds.maxW, HUB_GRID_COLS));
      h = clampInt(h, bounds.minH, Math.min(bounds.maxH, HUB_MAX_ROW_SPAN));
    } else {
      w = clampInt(cur.w ?? def.w, 1, HUB_GRID_COLS);
      h = clampInt(cur.h ?? def.h, 1, HUB_MAX_ROW_SPAN);
    }

    let col = clampInt(cur.col, 1, HUB_GRID_COLS - w + 1);
    let row = Math.max(1, parseInt(cur.row, 10) || 1);
    out.push({
      id: cur.id,
      col,
      row,
      w,
      h,
      hidden: Boolean(cur.hidden),
      locked: extras.locked,
      iconOnly,
      customTitle: extras.customTitle,
      customSubtitle: extras.customSubtitle,
      refreshIntervalSec: extras.refreshIntervalSec
    });
  });
  return resolveCollisions(out);
}

function clampInt(n, lo, hi) {
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

export function rectOccupies(a) {
  return { c0: a.col, c1: a.col + a.w, r0: a.row, r1: a.row + a.h };
}

export function rectsOverlap(a, b) {
  const A = rectOccupies(a);
  const B = rectOccupies(b);
  return A.c0 < B.c1 && B.c0 < A.c1 && A.r0 < B.r1 && B.r0 < A.r1;
}

export function hasCollision(layout, item, ignoreId = null) {
  return layout.some((other) => {
    if (other.id === ignoreId) return false;
    return rectsOverlap(item, other);
  });
}

export function maxRowUsed(layout) {
  let m = 1;
  layout.forEach((x) => {
    m = Math.max(m, x.row + x.h - 1);
  });
  return m;
}

export function findFirstFit(layout, w, h, ignoreId = null, maxRowsScan = 80) {
  const ww = clampInt(w, 1, HUB_GRID_COLS);
  const hh = clampInt(h, 1, HUB_MAX_ROW_SPAN);
  for (let row = 1; row <= maxRowsScan; row++) {
    for (let col = 1; col <= HUB_GRID_COLS - ww + 1; col++) {
      const trial = { col, row, w: ww, h: hh };
      if (!hasCollision(layout, trial, ignoreId)) return { col, row };
    }
  }
  return { col: 1, row: maxRowUsed(layout) + 1 };
}

/**
 * Posizione immediatamente sotto l’occupazione più bassa della griglia (nuova «fila» sotto tutto il layout).
 * Usato quando si aggiunge un modulo dalla libreria: così non va a riempire buchi intermedi.
 */
export function findAppendBelowLayout(layout, w, h, ignoreId = null) {
  const ww = clampInt(w, 1, HUB_GRID_COLS);
  const hh = clampInt(h, 1, HUB_MAX_ROW_SPAN);
  const others = layout.filter((x) => x.id !== ignoreId);
  let maxBottom = 0;
  others.forEach((x) => {
    maxBottom = Math.max(maxBottom, x.row + x.h - 1);
  });
  const baseRow = maxBottom === 0 ? 1 : maxBottom + 1;

  for (let row = baseRow; row <= baseRow + 60; row++) {
    for (let col = 1; col <= HUB_GRID_COLS - ww + 1; col++) {
      const trial = { col, row, w: ww, h: hh };
      if (!hasCollision(layout, trial, ignoreId)) return { col, row };
    }
  }
  return findFirstFit(layout, ww, hh, ignoreId, baseRow + 80);
}

/**
 * Posizione libera più vicina a (preferCol, preferRow); utile dopo drop con coordinate mouse.
 */
export function findNearestFit(
  layout,
  w,
  h,
  ignoreId = null,
  preferCol,
  preferRow,
  maxRowScan = Math.max(maxRowUsed(layout) + 24, 32)
) {
  const ww = clampInt(w, 1, HUB_GRID_COLS);
  const hh = clampInt(h, 1, HUB_MAX_ROW_SPAN);
  const pc = clampInt(preferCol, 1, HUB_GRID_COLS);
  const pr = Math.max(1, parseInt(preferRow, 10) || 1);
  let best = null;
  let bestScore = Infinity;
  const maxCol = HUB_GRID_COLS - ww + 1;
  const pcClamped = clampInt(pc, 1, maxCol);
  const endRow = Math.max(maxRowScan, pr + hh + 8);
  for (let row = 1; row <= endRow; row++) {
    for (let col = 1; col <= maxCol; col++) {
      const trial = { col, row, w: ww, h: hh };
      if (hasCollision(layout, trial, ignoreId)) continue;
      const dc = Math.abs(col - pcClamped);
      const dr = Math.abs(row - pr);
      const score = dc + dr * 2;
      if (!best || score < bestScore || (score === bestScore && (row < best.row || (row === best.row && col < best.col)))) {
        bestScore = score;
        best = { col, row };
      }
    }
  }
  if (best) return best;
  return findFirstFit(layout, ww, hh, ignoreId, endRow + 40);
}

export function swapGridPositions(layout, idA, idB) {
  if (!idA || !idB || idA === idB) return layout;
  const next = cloneLayout(layout);
  const ia = next.findIndex((x) => x.id === idA);
  const ib = next.findIndex((x) => x.id === idB);
  if (ia < 0 || ib < 0) return layout;
  if (next[ia].locked || next[ib].locked) return layout;
  const a = { ...next[ia] };
  const b = { ...next[ib] };
  const swapColRow = () => {
    const tc = a.col;
    const tr = a.row;
    a.col = clampInt(b.col, 1, HUB_GRID_COLS - a.w + 1);
    a.row = Math.max(1, b.row);
    b.col = clampInt(tc, 1, HUB_GRID_COLS - b.w + 1);
    b.row = Math.max(1, tr);
    next[ia] = a;
    next[ib] = b;
  };
  swapColRow();
  return resolveCollisions(next);
}

/** Spinge le card in caso di sovrapposizioni (preserva ordine array). */
export function resolveCollisions(layout) {
  const next = cloneLayout(layout);
  for (let pass = 0; pass < next.length * 3; pass++) {
    let moved = false;
    for (let i = 0; i < next.length; i++) {
      const item = next[i];
      if (item.hidden) continue;
      for (let j = 0; j < next.length; j++) {
        if (i === j || next[j].id === item.id) continue;
        if (rectsOverlap(item, next[j])) {
          const fit = findFirstFit(next, item.w, item.h, item.id);
          item.col = fit.col;
          item.row = fit.row;
          next[i] = { ...item };
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return next;
}

export function applyPlacement(layout, id, col, row) {
  const idx = layout.findIndex((x) => x.id === id);
  if (idx < 0) return layout;
  if (layout[idx].locked) return layout;
  const next = cloneLayout(layout);
  const item = { ...next[idx] };
  const meta = HUB_MODULE_META[id];
  let w = item.w;
  let h = item.h;
  if (meta.fixedSize) {
    w = meta.fixedSize.w;
    h = meta.fixedSize.h;
  } else if (meta.resizeBounds) {
    const b = meta.resizeBounds;
    w = clampInt(item.w, b.minW, b.maxW);
    h = clampInt(item.h, b.minH, b.maxH);
  }
  item.col = clampInt(col, 1, HUB_GRID_COLS - w + 1);
  item.row = Math.max(1, row);
  item.w = w;
  item.h = h;
  if (hasCollision(next, item, id)) {
    const fit = findNearestFit(next, w, h, id, item.col, item.row);
    item.col = fit.col;
    item.row = fit.row;
  }
  next[idx] = item;
  return resolveCollisions(next);
}

export function applyResize(layout, id, w, h) {
  const idx = layout.findIndex((x) => x.id === id);
  if (idx < 0) return layout;
  const meta = HUB_MODULE_META[id];
  if (meta.fixedSize) return layout;
  const next = cloneLayout(layout);
  const item = { ...next[idx] };
  if (item.iconOnly) return layout;
  let minW = 1;
  let maxW = HUB_GRID_COLS;
  let minH = 1;
  let maxH = HUB_MAX_ROW_SPAN;
  if (meta.resizeBounds) {
    minW = meta.resizeBounds.minW;
    maxW = Math.min(meta.resizeBounds.maxW, HUB_GRID_COLS);
    minH = meta.resizeBounds.minH;
    maxH = Math.min(meta.resizeBounds.maxH, HUB_MAX_ROW_SPAN);
  }
  item.w = clampInt(w, minW, maxW);
  item.h = clampInt(h, minH, maxH);
  item.col = clampInt(item.col, 1, HUB_GRID_COLS - item.w + 1);
  if (hasCollision(next, item, id)) {
    const fit = findNearestFit(next, item.w, item.h, id, item.col, item.row);
    item.col = fit.col;
    item.row = fit.row;
  }
  next[idx] = item;
  return resolveCollisions(next);
}

export function setHidden(layout, id, hidden) {
  return resolveCollisions(layout.map((x) => (x.id === id ? { ...x, hidden: Boolean(hidden) } : x)));
}

export function removeModule(layout, id) {
  return layout.filter((x) => x.id !== id);
}

export function restoreDefaultModule(layout, id) {
  if (layout.some((x) => x.id === id)) return layout;
  const meta = HUB_MODULE_META[id];
  if (!meta) return layout;
  const p = meta.defaultPlacement;
  const fixed = meta.fixedSize;
  const w = fixed ? fixed.w : p.w;
  const h = fixed ? fixed.h : p.h;
  const next = cloneLayout(layout);
  const fit = findAppendBelowLayout(next, w, h, null);
  next.push({
    id,
    col: fit.col,
    row: fit.row,
    w,
    h,
    hidden: false,
    ...normalizeLayoutExtras({})
  });
  return resolveCollisions(next);
}

/** Moduli non presenti nel layout (rimossi in passato) per la libreria ripristino. */
export function missingModuleIds(layout) {
  const have = new Set(layout.map((x) => x.id));
  return ALL_MODULE_IDS.filter((id) => !have.has(id));
}

const GRID_GAP_PX_APPROX = 12;
const ROW_MIN_TRACK_PX = 112;

/**
 * Deduce una riga logica **subito sotto la card il cui fondo sta visivamente sopra il puntatore**,
 * preferendo card che si sovrappongono alla colonna del mouse (`preferCol`).
 * Risolve drop che finiscono in fondo alla viewport solo perché il contenitore è alto ma vuoto.
 * @returns `{ row }` dove `row` è `null` se non c’è un ancoraggio sensato (meglio usare la mappa proporzionale).
 */
export function inferDropRowFromAnchor(clientY, gridEl, layout, dragId, preferCol) {
  if (!gridEl || !layout?.length) return { row: null };
  const pc = clampInt(parseInt(preferCol, 10) || 1, 1, HUB_GRID_COLS);
  /** Tolleranza: puntatore sulla linea tra due card conta come “sotto” la sopra */
  const yCut = clientY + 16;
  const slots = gridEl.querySelectorAll('[data-hub-slot]');

  /** @type {{ bottom: number, overlapsCol: boolean, id: string }[]} */
  const candidates = [];
  slots.forEach((el) => {
    const sid = el.getAttribute('data-hub-slot')?.trim?.();
    if (!sid || sid === dragId) return;
    const item = layout.find((x) => x.id === sid);
    if (!item || item.hidden) return;
    const r = el.getBoundingClientRect();
    if (!(r.bottom <= yCut)) return;
    const overlapsCol = item.col <= pc && pc < item.col + item.w;
    candidates.push({ bottom: r.bottom, overlapsCol, id: sid });
  });

  const withOverlap = candidates.filter((c) => c.overlapsCol);
  const pool = withOverlap.length > 0 ? withOverlap : candidates;
  let pickBottom = -Infinity;
  let pickId = null;
  pool.forEach((c) => {
    if (c.bottom > pickBottom) {
      pickBottom = c.bottom;
      pickId = c.id;
    }
  });

  if (!pickId) return { row: null };
  const anchor = layout.find((x) => x.id === pickId);
  if (!anchor) return { row: null };
  return { row: anchor.row + anchor.h };
}

/**
 * Ancora colonne sulla griglia fissa da 7; le righe seguono il mouse rispetto all’altezza reale
 * del contenitore così è possibile “andare più in basso” oltre le card lunghe.
 */
export function snapDropToCell(clientX, clientY, gridEl, layout = null) {
  if (!gridEl) return { col: 1, row: 1 };
  const rect = gridEl.getBoundingClientRect();
  const cw = rect.width / HUB_GRID_COLS;
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  const col = clampInt(Math.floor(relX / cw) + 1, 1, HUB_GRID_COLS);

  const used = layout ? maxRowUsed(layout) : 6;
  const gridGap = GRID_GAP_PX_APPROX;
  /** Unità riga più “fine” sullo schermo ⇒ si possono scegliere righe più in basso sotto blocchi alti. */
  const estimatedRows = Math.max(used + 16, 16);
  const unitH =
    estimatedRows > 0
      ? Math.max((rect.height - gridGap) / estimatedRows, (ROW_MIN_TRACK_PX + gridGap) * 0.45)
      : ROW_MIN_TRACK_PX + gridGap;

  let row = Math.floor(relY / unitH) + 1;
  if (layout && rect.height > 24 && relY > rect.height * 0.42) {
    const deepBoost = Math.floor((relY - rect.height * 0.42) / Math.max(unitH * 0.72, (ROW_MIN_TRACK_PX + gridGap) / 4));
    row += Math.max(0, deepBoost);
  }
  /** Evita righe «virtuali» enormi quando l’area Hub è alta ma poche card: il drop resta vicino al contenuto reale. */
  const sensibleMaxRow = layout ? Math.max(maxRowUsed(layout) + 8, 12) : 40;
  row = clampInt(row, 1, sensibleMaxRow);
  return { col, row };
}
