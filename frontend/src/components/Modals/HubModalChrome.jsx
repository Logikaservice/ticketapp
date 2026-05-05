import React from 'react';
import { X } from 'lucide-react';
import {
  getStoredTechHubAccent,
  getStoredTechHubSurfaceMode,
  hubChromeCssVariables,
  HUB_PAGE_BG,
  HUB_SURFACE,
  hexToRgba,
  readableOnAccent,
  hubModalCssVars,
  HUB_MODAL_LABEL_CLS,
  HUB_MODAL_FIELD_CLS,
  HUB_MODAL_TEXTAREA_CLS
} from '../../utils/techHubAccent';

function modalChromeInlineStyle(ah) {
  const skin = getStoredTechHubSurfaceMode();
  return {
    ...hubChromeCssVariables(skin),
    ...hubModalCssVars(ah, skin),
    colorScheme: skin === 'light' ? 'light' : 'dark'
  };
}

export {
  getStoredTechHubAccent,
  HUB_PAGE_BG,
  HUB_SURFACE,
  hexToRgba,
  readableOnAccent,
  hubModalCssVars,
  HUB_MODAL_LABEL_CLS,
  HUB_MODAL_FIELD_CLS,
  HUB_MODAL_TEXTAREA_CLS
};

/**
 * Overlay proprio — per modali che gestiscono il backdrop (non sempre necessario se già dentro `AllModals`).
 */
export function HubModalBackdrop({ children, zClass = 'z-[118]', className = '' }) {
  return (
    <div className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/60 p-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Pannello scuro tema Hub (`--hub-accent`).
 * `nestedInAllModals`: se true il click sul backdrop NON chiude qui (solo stopPropagation sulla card).
 */
export function HubModalScaffold({
  children,
  onBackdropClick,
  maxWidthClass = 'max-w-lg',
  panelClassName = '',
  zClass = 'z-[118]',
  nestedInAllModals = false
}) {
  const ah = getStoredTechHubAccent();
  return (
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/60 p-4`}
      onClick={nestedInAllModals ? undefined : onBackdropClick}
      role={onBackdropClick ? 'presentation' : undefined}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border)] shadow-2xl ${maxWidthClass} ${panelClassName}`}
        style={{ backgroundColor: 'var(--hub-chrome-page)', ...modalChromeInlineStyle(ah) }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** Card senza backdrop: per contenuti dentro il wrapper centrato di `AllModals`. */
export function HubModalInnerCard({ children, maxWidthClass = 'max-w-md', className = '', accentHex: accentOverride = null }) {
  const ah = accentOverride ?? getStoredTechHubAccent();
  return (
    <div
      className={`w-full rounded-2xl border border-[color:var(--hub-chrome-border)] shadow-2xl ${maxWidthClass} ${className}`}
      style={{ backgroundColor: 'var(--hub-chrome-page)', ...modalChromeInlineStyle(ah) }}
    >
      {children}
    </div>
  );
}

export function HubModalChromeHeader({
  icon: Icon,
  title,
  subtitle,
  onClose,
  compact = false
}) {
  const accentHex = getStoredTechHubAccent();
  const pad = compact ? 'px-5 py-4' : 'px-6 py-5';

  return (
    <div
      className={`shrink-0 border-b border-[color:var(--hub-chrome-border-soft)] ${pad}`}
      style={{ backgroundColor: 'var(--hub-chrome-surface)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl md:h-11 md:w-11"
              style={{ backgroundColor: hexToRgba(accentHex, 0.2), color: accentHex }}
            >
              <Icon size={compact ? 20 : 22} aria-hidden className="shrink-0" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[color:var(--hub-chrome-text)] md:text-xl">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-[color:var(--hub-chrome-text-muted)]">{subtitle}</p> : null}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-[color:var(--hub-chrome-muted-fill)] p-2 text-[color:var(--hub-chrome-text)] ring-1 ring-[color:var(--hub-chrome-border)] transition hover:bg-[color:var(--hub-chrome-hover)]"
            aria-label="Chiudi"
          >
            <X size={20} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function HubModalChromeFooter({ children, className = '' }) {
  return (
    <div
      className={`flex shrink-0 flex-wrap gap-2 border-t border-[color:var(--hub-chrome-border-soft)] p-4 ${className}`}
      style={{ backgroundColor: 'var(--hub-chrome-surface)' }}
    >
      {children}
    </div>
  );
}

export function HubModalBody({ children, className = '' }) {
  return (
    <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto p-6 text-[color:var(--hub-chrome-text)] ${className}`}>
      {children}
    </div>
  );
}

export function HubModalPrimaryButton({ children, onClick, type = 'button', disabled, className = '' }) {
  const accentHex = getStoredTechHubAccent();
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-45 ${className}`}
      style={{ backgroundColor: accentHex, color: readableOnAccent(accentHex) }}
    >
      {children}
    </button>
  );
}

export function HubModalSecondaryButton({ children, onClick, type = 'button', disabled, className = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg bg-[color:var(--hub-chrome-muted-fill)] px-4 py-2 text-sm font-medium text-[color:var(--hub-chrome-text)] transition hover:bg-[color:var(--hub-chrome-hover)] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      {children}
    </button>
  );
}
