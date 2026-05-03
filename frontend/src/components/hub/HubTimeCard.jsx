import React, { useEffect, useMemo, useState } from 'react';
import { hubModalCssVars } from '../../utils/techHubAccent';

const ROME_TZ = 'Europe/Rome';

function formatTimeRome(date) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: ROME_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function formatDateLineRome(date) {
  const raw = new Intl.DateTimeFormat('it-IT', {
    timeZone: ROME_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
  const firstSpace = raw.indexOf(' ');
  if (firstSpace <= 0) return raw;
  const weekday = raw.slice(0, firstSpace);
  const rest = raw.slice(firstSpace + 1).trim();
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap}, ${rest}`;
}

/** Card orario stile lock screen: ora grande, data sotto (Italia). */
export default function HubTimeCard({ accentHex }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeStr = useMemo(() => formatTimeRome(now), [now]);
  const dateLine = useMemo(() => formatDateLineRome(now), [now]);

  const style = useMemo(
    () => ({ backgroundColor: 'var(--hub-chrome-surface)', ...hubModalCssVars(accentHex) }),
    [accentHex]
  );

  return (
    <div
      className="shrink-0 rounded-2xl border border-[color:var(--hub-chrome-border-soft)] px-4 py-5 text-center"
      style={style}
    >
      <div className="text-[2.75rem] font-semibold leading-none tracking-tight text-[color:var(--hub-chrome-text)] tabular-nums">
        {timeStr}
      </div>
      <p className="mt-2.5 text-sm font-medium leading-snug text-[color:var(--hub-chrome-text-muted)]">{dateLine}</p>
    </div>
  );
}
