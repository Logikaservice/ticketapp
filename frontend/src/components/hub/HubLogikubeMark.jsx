import React from 'react';

/** Simbolo stile marchio: stroke/fill da `currentColor` → usa `text-[color:var(--hub-accent)]` sul wrapper SVG. */
function LogikubeGlyph({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Esagono + linee “rete/cubo” ispirate al marchio */}
      <path
        d="M20 3.9 33.42 11.74v16.53L20 36.1 6.58 27.26V11.74L20 3.9z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M20 5v30" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
      <path
        d="M7 12 L20 19.25 33 12M7 26.85 20 33.95 33 26.85"
        stroke="currentColor"
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={20} cy={19.35} r={1.82} fill="currentColor" />
      <circle cx={12.85} cy={31.85} r={1.82} fill="currentColor" />
      <circle cx={27.15} cy={31.85} r={1.82} fill="currentColor" />
    </svg>
  );
}

/**
 * Wordmark LOGIKUBE per Hub tecnico: “LOGI” fisso chiaro; icona + “KUBE” seguono `--hub-accent` / `--hub-accent-glow`
 * impostati dal parent (`TechnicianWorkbenchPage` accentStyle).
 */
export default function HubLogikubeMark({ railMode = false, className = '' }) {
  const accentIcon =
    'shrink-0 text-[color:var(--hub-accent)] [filter:drop-shadow(0_0_7px_var(--hub-accent-glow))]';

  if (railMode) {
    return (
      <div className={`flex w-full justify-center ${className}`} role="img" aria-label="Logikube">
        <LogikubeGlyph size={32} className={accentIcon} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label="Logikube">
      <LogikubeGlyph size={38} className={accentIcon} />
      <span className="select-none pt-0.5 font-bold uppercase leading-none tracking-[0.2em] text-[clamp(1rem,2.8vw,1.2rem)]">
        <span className="text-[color:var(--hub-chrome-text)]">LOGI</span>
        <span className="text-[color:var(--hub-accent)] [text-shadow:0_0_18px_var(--hub-accent-glow)]">KUBE</span>
      </span>
    </div>
  );
}
