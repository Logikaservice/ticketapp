import React, { useId } from 'react';
import { LOGIKUBE_WORDMARK_PATH } from './logikubeWordmarkPath';

const VIEW_W = 1147;
const VIEW_H = 731;

/**
 * Taglio orizzontale tra “LOGI” e “KUBE” (il path è un unico compound path).
 * Spostare a sinistra se l’accento “manca” sulla K; a destra se colora troppa la I.
 */
const KUBE_CLIP_X = 705;

/** Solo marca grafica (wireframe), senza testo — per sidebar “solo icone”. */
const ICON_MARK_VIEWBOX = '158 268 252 268';

/**
 * Wordmark Logikube (SVG brand in repo: `src/assets/logikube-wordmark.svg`).
 * — Base in `var(--hub-chrome-text)` (leggibile su tema chiaro/scuro).
 * — Il tratto a destra di `KUBE_CLIP_X` è ridisegnato in `var(--hub-accent)` con glow (come concordato per “KUBE”).
 */
export default function HubLogikubeMark({ railMode = false, className = '' }) {
  const clipId = `${useId().replace(/:/g, '')}-kube`;

  if (railMode) {
    return (
      <div className={`flex w-full justify-center ${className}`} role="img" aria-label="Logikube">
        <svg
          viewBox={ICON_MARK_VIEWBOX}
          className="h-[2.65rem] w-[2.65rem] shrink-0 overflow-hidden fill-[color:var(--hub-accent)] [filter:drop-shadow(0_0_10px_var(--hub-accent-glow))]"
          aria-hidden
        >
          <path d={LOGIKUBE_WORDMARK_PATH} />
        </svg>
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 items-center px-0.5 ${className}`} role="img" aria-label="Logikube">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="min-h-[6rem] h-28 w-auto max-w-full shrink-0 overflow-hidden sm:h-32 md:h-36"
        aria-hidden
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <rect x={KUBE_CLIP_X} y="0" width={VIEW_W - KUBE_CLIP_X} height={VIEW_H} />
          </clipPath>
        </defs>
        <path fill="var(--hub-chrome-text)" d={LOGIKUBE_WORDMARK_PATH} />
        <path
          fill="var(--hub-accent)"
          clipPath={`url(#${clipId})`}
          d={LOGIKUBE_WORDMARK_PATH}
          style={{ filter: 'drop-shadow(0 0 10px var(--hub-accent-glow))' }}
        />
      </svg>
    </div>
  );
}
