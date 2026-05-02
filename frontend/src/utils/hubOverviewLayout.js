/**
 * Layout panoramica Hub tecnico — griglia 7 colonne, altezza in unità righe (1–4).
 * Persistenza locale; elenco `items` può essere parziale (moduli eliminati esclusi).
 */

export const HUB_GRID_COLS = 7;
export const HUB_MAX_ROW_SPAN = 4;
export const STORAGE_HUB_LAYOUT = 'techHubOverviewLayout';

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
    label: 'Monitoraggio',
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
  contracts: {
    label: 'Contratti attivi',
    category: 'KPI',
    fixedSize: { w: 5, h: 3 },
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
  'slot-1': {
    label: 'Slot libero 1',
    category: 'Slot',
    defaultPlacement: { col: 1, row: 6, w: 4, h: 1 }
  },
  'slot-2': {
    label: 'Slot libero 2',
    category: 'Slot',
    defaultPlacement: { col: 5, row: 6, w: 3, h: 1 }
  }
};

export const ALL_MODULE_IDS = Object.keys(HUB_MODULE_META);

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
    return { id, col: p.col, row: p.row, w, h, hidden: false };
  });
}

function storageKey(userId) {
  if (userId != null && userId !== '') return `${STORAGE_HUB_LAYOUT}:u${userId}`;
  return STORAGE_HUB_LAYOUT;
}

export function loadHubLayout(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return null;
    return sanitizeLayoutItems(data.items);
  } catch (_) {
    return null;
  }
}

export function saveHubLayout(userId, items) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ v: 1, items: cloneLayout(items) }));
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
    let w = fixed ? fixed.w : clampInt(cur.w, 1, HUB_GRID_COLS);
    let h = fixed ? fixed.h : clampInt(cur.h, 1, HUB_MAX_ROW_SPAN);
    if (!fixed) {
      w = clampInt(w, 1, HUB_GRID_COLS);
      h = clampInt(h, 1, HUB_MAX_ROW_SPAN);
    }
    let col = clampInt(cur.col, 1, HUB_GRID_COLS - w + 1);
    let row = Math.max(1, parseInt(cur.row, 10) || 1);
    out.push({ id: cur.id, col, row, w, h, hidden: Boolean(cur.hidden) });
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
    if (other.hidden) return false;
    return rectsOverlap(item, other);
  });
}

export function maxRowUsed(layout) {
  let m = 1;
  layout.forEach((x) => {
    if (!x.hidden) m = Math.max(m, x.row + x.h - 1);
  });
  return m;
}

export function findFirstFit(layout, w, h, ignoreId = null, maxRowsScan = 48) {
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

/** Spinge le card in caso di sovrapposizioni (preserva ordine array). */
export function resolveCollisions(layout) {
  const next = cloneLayout(layout);
  for (let pass = 0; pass < next.length * 3; pass++) {
    let moved = false;
    for (let i = 0; i < next.length; i++) {
      const item = next[i];
      if (item.hidden) continue;
      const otherBlocks = (j) => next[j].hidden || next[j].id === item.id;
      for (let j = 0; j < next.length; j++) {
        if (i === j || otherBlocks(j)) continue;
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
  const next = cloneLayout(layout);
  const item = { ...next[idx] };
  const meta = HUB_MODULE_META[id];
  const w = meta.fixedSize ? meta.fixedSize.w : item.w;
  const h = meta.fixedSize ? meta.fixedSize.h : item.h;
  item.col = clampInt(col, 1, HUB_GRID_COLS - w + 1);
  item.row = Math.max(1, row);
  item.w = w;
  item.h = h;
  if (hasCollision(next, item, id)) {
    const fit = findFirstFit(next, w, h, id);
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
  item.w = clampInt(w, 1, HUB_GRID_COLS);
  item.h = clampInt(h, 1, HUB_MAX_ROW_SPAN);
  item.col = clampInt(item.col, 1, HUB_GRID_COLS - item.w + 1);
  if (hasCollision(next, item, id)) {
    const fit = findFirstFit(next, item.w, item.h, id);
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
  let trial = { id, col: p.col, row: p.row, w, h, hidden: false };
  const next = cloneLayout(layout);
  if (hasCollision(next, trial, null)) {
    const fit = findFirstFit(next, w, h, null);
    trial = { ...trial, col: fit.col, row: fit.row };
  }
  next.push(trial);
  return resolveCollisions(next);
}

/** Moduli non presenti nel layout (rimossi in passato) per la libreria ripristino. */
export function missingModuleIds(layout) {
  const have = new Set(layout.map((x) => x.id));
  return ALL_MODULE_IDS.filter((id) => !have.has(id));
}

export function snapDropToCell(clientX, clientY, gridEl, rowHeightPx = 118) {
  if (!gridEl) return { col: 1, row: 1 };
  const rect = gridEl.getBoundingClientRect();
  const cw = rect.width / HUB_GRID_COLS;
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  const col = clampInt(Math.floor(relX / cw) + 1, 1, HUB_GRID_COLS);
  const row = Math.max(1, Math.floor(relY / rowHeightPx) + 1);
  return { col, row };
}
