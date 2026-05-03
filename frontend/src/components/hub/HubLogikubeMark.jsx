import React, { useId } from 'react';
import { LOGIKUBE_WORDMARK_PATH } from './logikubeWordmarkPath';

const VIEW_W = 1147;
const VIEW_H = 731;

/**
 * Taglio orizzontale approssimativo tra icona+“LOGI” e “KUBE” nel wordmark vettoriale.
 * Se in UI la parte accento risulta troppo a sinistra/destra, aggiustare qui (tipicamente 640–700).
 */
const KUBE_CLIP_X = 672;

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
          viewBox="155 274 298 446"
          className="h-24 w-auto max-w-[8rem] shrink-0 overflow-visible fill-current text-[color:var(--hub-chrome-text)]"
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
        className="min-h-[6rem] h-28 w-auto max-w-full shrink-0 overflow-visible sm:h-32 md:h-36"
        aria-hidden
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <rect x={KUBE_CLIP_X} y="0" width={VIEW_W - KUBE_CLIP_X} height={VIEW_H} />
          </clipPath>
        </defs>
        <path className="fill-current text-[color:var(--hub-chrome-text)]" d={LOGIKUBE_WORDMARK_PATH} />
        <path
          className="fill-current text-[color:var(--hub-accent)] [filter:drop-shadow(0_0_12px_var(--hub-accent-glow))]"
          clipPath={`url(#${clipId})`}
          d={LOGIKUBE_WORDMARK_PATH}
        />
      </svg>
    </div>
  );
}
