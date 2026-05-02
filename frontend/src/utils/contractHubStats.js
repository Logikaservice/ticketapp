/**
 * Statistiche contratti per Hub / KPI (eventi di fatturazione, esclusi “rinnovo”).
 */

/** @typedef {{ event_date: string; event_type?: string; type?: string; is_processed?: unknown }} BillingEventLite */

/** @param {BillingEventLite} e */
function isRenewalEvent(e) {
  return e?.event_type === 'renewal' || e?.type === 'renewal';
}

/** @param {BillingEventLite} e */
export function isBillingEventProcessed(e) {
  return (
    e.is_processed === true ||
    e.is_processed === 'true' ||
    e.is_processed === 1 ||
    e.is_processed === '1'
  );
}

/** Eventi rilevanti per saldo pagamenti (esclude rinnovo). */
export function getBillingEventsForBalance(contract) {
  const raw = contract?.events;
  if (!Array.isArray(raw)) return [];
  return raw.filter((ev) => !isRenewalEvent(ev));
}

/**
 * Contratto senza cicli di fatturazione (nessun evento non-rinnovo).
 * Nel grafico: barra/stack grigio.
 */
export function contractHasBillingSchedule(contract) {
  return getBillingEventsForBalance(contract).length > 0;
}

export function contractHasPendingBilling(contract) {
  const list = getBillingEventsForBalance(contract);
  if (list.length === 0) return false;
  return list.some((e) => !isBillingEventProcessed(e));
}

/** Completamente saldato: ha rate e sono tutte processate. */
export function contractFullySettled(contract) {
  const list = getBillingEventsForBalance(contract);
  if (list.length === 0) return false;
  return list.every((e) => isBillingEventProcessed(e));
}

/**
 * KPI correnti.
 * @param {unknown[]} contracts
 */
export function summarizeContractsPortfolio(contracts) {
  let totale = 0;
  let saldati = 0;
  let daPagare = 0;
  let senzaRate = 0;

  const list = Array.isArray(contracts) ? contracts : [];
  totale = list.length;

  for (const c of list) {
    if (!contractHasBillingSchedule(c)) {
      senzaRate += 1;
      continue;
    }
    if (contractFullySettled(c)) {
      saldati += 1;
      continue;
    }
    daPagare += 1;
  }

  return { totale, saldati, daPagare, senzaRate };
}

function monthBoundsLocal(year, monthIndex0) {
  const start = new Date(year, monthIndex0, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime(), year, month: monthIndex0 };
}

function tsInMonth(ts, bounds) {
  return ts >= bounds.start && ts <= bounds.end;
}

/** Importo rata da evento/contratto (solo fatture, rinnovo escluso altrove). */
export function billingEventEuroAmount(contract, ev) {
  const raw =
    ev?.amount !== undefined && ev?.amount !== null && ev?.amount !== ''
      ? parseFloat(ev.amount)
      : parseFloat(contract?.amount ?? 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function parseEventTs(eventDateStr) {
  const d = new Date(eventDateStr);
  const t = d.getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Ultimi `count` mesi con il mese corrente incluso (es. count=7 ⇒ 7 colonne).
 * Etichette corte tipo “gen”.
 */
export function buildRecentMonthsLabels(count = 7) {
  const out = [];
  const now = new Date();
  const yNow = now.getFullYear();
  const mNow = now.getMonth();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(yNow, mNow - i, 1);
    const bounds = monthBoundsLocal(d.getFullYear(), d.getMonth());
    const label = new Intl.DateTimeFormat('it', { month: 'short' })
      .format(new Date(bounds.start))
      .replace(/\./g, '');
    out.push({ label, bounds });
  }
  return out;
}

/**
 * Histogramma mensile (per evento nei contratti): grigio = rinnovo; verde = rata marcata pagata nel mese;
 * arancione = rata con scadenza in quel mese ancora da saldare.
 */
export function buildMonthlyContractHistogram(contracts, monthsCount = 7) {
  const monthsMeta = buildRecentMonthsLabels(monthsCount);
  const series = monthsMeta.map(() => ({ verde: 0, arancione: 0, grigio: 0 }));
  const list = Array.isArray(contracts) ? contracts : [];

  for (let mi = 0; mi < monthsMeta.length; mi += 1) {
    const bounds = monthsMeta[mi].bounds;
    for (const c of list) {
      const evs = Array.isArray(c?.events) ? c.events : [];
      for (const ev of evs) {
        const ets = parseEventTs(ev.event_date);
        if (!Number.isFinite(ets) || !tsInMonth(ets, bounds)) continue;

        if (isRenewalEvent(ev)) {
          series[mi].grigio += 1;
        } else if (isBillingEventProcessed(ev)) {
          series[mi].verde += 1;
        } else {
          series[mi].arancione += 1;
        }
      }
    }
  }

  const maxPeak = Math.max(...series.map((s) => Math.max(s.verde, s.arancione, s.grigio)), 1);
  return { monthsMeta, series, maxStack: maxPeak };
}

/**
 * Serie Jan–Dic (anno di calendario): per ogni mese importo previsto dalle rate in scadenza
 * e somma delle rate marcate pagate (`is_processed`) nello stesso mese dell’evento.
 * @param {unknown[]} contracts
 * @param {number} year
 */
export function buildCalendarYearEuroSeries(contracts, year) {
  const monthsMeta = [];
  for (let m = 0; m < 12; m += 1) {
    const bounds = monthBoundsLocal(year, m);
    const label = new Intl.DateTimeFormat('it', { month: 'short' })
      .format(new Date(bounds.start))
      .replace(/\./g, '');
    monthsMeta.push({ label, bounds, monthIndex: m });
  }

  /** @type {Array<{ previsto: number; pagato: number }>} */
  const series = monthsMeta.map(() => ({ previsto: 0, pagato: 0 }));
  const list = Array.isArray(contracts) ? contracts : [];

  for (let mi = 0; mi < 12; mi += 1) {
    const bounds = monthsMeta[mi].bounds;
    for (const c of list) {
      const evs = Array.isArray(c?.events) ? c.events : [];
      for (const ev of evs) {
        if (isRenewalEvent(ev)) continue;
        const ets = parseEventTs(ev.event_date);
        if (!Number.isFinite(ets) || !tsInMonth(ets, bounds)) continue;

        const euro = billingEventEuroAmount(c, ev);
        series[mi].previsto += euro;
        if (isBillingEventProcessed(ev)) series[mi].pagato += euro;
      }
    }
  }

  const maxPrevisto = Math.max(...series.map((s) => s.previsto), 0);
  return { monthsMeta, series, chartEuroMax: Math.max(maxPrevisto, 1) };
}

/**
 * KPI monetari aggregati sul mese calendariale.
 * @param {unknown[]} contracts
 * @param {number} year
 * @param {number} monthIndex0 0–11
 */
export function summarizeEuroForCalendarMonth(contracts, year, monthIndex0) {
  const bounds = monthBoundsLocal(year, monthIndex0);
  let previsto = 0;
  let pagato = 0;
  const list = Array.isArray(contracts) ? contracts : [];
  for (const c of list) {
    const evs = Array.isArray(c?.events) ? c.events : [];
    for (const ev of evs) {
      if (isRenewalEvent(ev)) continue;
      const ets = parseEventTs(ev.event_date);
      if (!Number.isFinite(ets) || !tsInMonth(ets, bounds)) continue;

      const euro = billingEventEuroAmount(c, ev);
      previsto += euro;
      if (isBillingEventProcessed(ev)) pagato += euro;
    }
  }

  const mancante = Math.max(0, previsto - pagato);
  return { previsto, pagato, mancante };
}

/** Somma i 12 bucket della serie annuale (evita doppio passaggio se già calcolata). */
export function rollupEuroYearSeries(series) {
  let previsto = 0;
  let pagato = 0;
  for (const s of series) {
    previsto += s.previsto;
    pagato += s.pagato;
  }
  return { previsto, pagato, mancante: Math.max(0, previsto - pagato) };
}

/**
 * Come sopra ma solo da gennaio fino al mese incluso (indice 0–11).
 * Utile KPI “mese”: Totale/Pagato restano sul mese corrente; Mancante = residuo dall’inizio anno.
 * @param {Array<{ previsto: number; pagato: number }>} series
 * @param {number} monthIndexInclusive
 */
export function rollupEuroSeriesThroughMonth(series, monthIndexInclusive) {
  const arr = Array.isArray(series) ? series : [];
  const end = Math.max(0, Math.min(Number(monthIndexInclusive) | 0, arr.length - 1));
  let previsto = 0;
  let pagato = 0;
  for (let mi = 0; mi <= end; mi += 1) {
    const s = arr[mi] || { previsto: 0, pagato: 0 };
    previsto += Number(s.previsto) || 0;
    pagato += Number(s.pagato) || 0;
  }
  return { previsto, pagato, mancante: Math.max(0, previsto - pagato) };
}
