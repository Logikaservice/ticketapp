// components/TemporarySuppliesPanel.jsx

import React from 'react';
import { Package, Trash2, User, FileText, RefreshCw } from 'lucide-react';

const TemporarySuppliesPanel = ({
  temporarySupplies = [],
  loading,
  onRemoveSupply,
  users = [],
  onRefresh,
  onOpenTicket,
  onEditSupply,
  isReadOnly = false,
  /** `hub` = colori variabili tema Hub (modale resoconto). */
  variant = 'default'
}) => {
  const hub = variant === 'hub';
  const handleRemove = async (supplyId) => {
    if (window.confirm('Sei sicuro di voler restituire questa fornitura?')) {
      try {
        await onRemoveSupply(supplyId);
      } catch (error) {
        console.error('Errore nell\'eliminare la fornitura:', error);
      }
    }
  };

  const rootCls = hub
    ? 'rounded-xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text)]'
    : 'bg-white rounded-xl border';
  const headBorder = hub ? 'border-b border-[color:var(--hub-chrome-border-soft)]' : 'border-b';
  const titleCls = hub ? 'font-semibold flex items-center gap-2 text-[color:var(--hub-chrome-text)]' : 'font-semibold flex items-center gap-2';
  const countCls = hub ? 'text-xs text-[color:var(--hub-chrome-text-faint)]' : 'text-xs text-gray-500';
  const refreshCls = hub
    ? 'rounded p-1 text-[color:var(--hub-chrome-text-muted)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-chrome-text)]'
    : 'text-gray-500 hover:text-gray-700 p-1';
  const bodyMuted = hub ? 'text-sm text-[color:var(--hub-chrome-text-muted)]' : 'text-sm text-gray-500';
  const rowCls = hub
    ? 'rounded-lg border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-row-fill)] p-3'
    : 'bg-blue-50 border border-blue-200 rounded-lg p-3';
  const pkgCls = hub ? 'text-[color:var(--hub-accent)]' : 'text-blue-600';
  const badgeCls = hub
    ? 'text-xs rounded px-2 py-0.5 bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text)]'
    : 'text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded';
  const metaCls = hub ? 'flex items-center gap-1 text-xs text-[color:var(--hub-chrome-text-secondary)] mb-1' : 'flex items-center gap-1 text-xs text-gray-600 mb-1';
  const notaCls = hub ? 'text-xs text-[color:var(--hub-chrome-text-muted)] mb-1' : 'text-xs text-blue-600 mb-1';
  const dateCls = hub ? 'text-xs text-[color:var(--hub-chrome-text-faint)]' : 'text-xs text-gray-400';
  const btnApri = hub
    ? 'rounded border border-[color:var(--hub-chrome-border-soft)] px-2 py-1 text-xs font-medium text-[color:var(--hub-accent)] transition hover:bg-[color:var(--hub-chrome-hover)]'
    : 'text-blue-500 hover:text-blue-700 px-2 py-1 text-xs font-medium border border-blue-300 rounded hover:bg-blue-50';
  const btnMod = hub
    ? 'rounded border border-[color:var(--hub-chrome-border-soft)] px-2 py-1 text-xs font-medium text-emerald-600 transition hover:bg-[color:var(--hub-chrome-hover)]'
    : 'text-green-500 hover:text-green-700 px-2 py-1 text-xs font-medium border border-green-300 rounded hover:bg-green-50';
  const btnDel = hub
    ? 'rounded p-1 text-red-500 transition hover:bg-[color:var(--hub-chrome-hover)] hover:text-red-600'
    : 'text-red-500 hover:text-red-700 p-1';

  return (
    <div className={rootCls}>
      <div className={`flex items-center justify-between p-4 ${headBorder}`}>
        <h3 className={titleCls}>
          <Package size={18} />
          Forniture Temporanee
        </h3>
        <div className="flex items-center gap-2">
          <div className={countCls}>{temporarySupplies.length} forniture attive</div>
          {onRefresh ? (
            <button type="button" onClick={onRefresh} className={refreshCls} title="Aggiorna forniture">
              <RefreshCw size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {loading ? (
          <div className={bodyMuted}>Caricamento...</div>
        ) : (
          <>
            {temporarySupplies.length === 0 ? (
              <div className={bodyMuted}>Nessuna fornitura temporanea presente.</div>
            ) : (
              <div className="space-y-2">
                {temporarySupplies.map((supply) => (
                  <div key={supply.id} className={rowCls}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Package size={14} className={`shrink-0 ${pkgCls}`} />
                          <span className="text-sm font-medium">{supply.materiale}</span>
                          <span className={badgeCls}>Qty: {supply.quantita}</span>
                        </div>

                        <div className={metaCls}>
                          <User size={12} className="shrink-0" />
                          <span>
                            {supply.azienda} - {supply.cliente_nome}
                          </span>
                        </div>

                        <div className={metaCls}>
                          <FileText size={12} className="shrink-0" />
                          <span>
                            Ticket #{supply.ticket_numero}: {supply.ticket_titolo}
                          </span>
                        </div>

                        {supply.nota ? <div className={notaCls}>Note: {supply.nota}</div> : null}

                        <div className={dateCls}>Prestato il {new Date(supply.data_prestito).toLocaleDateString('it-IT')}</div>
                      </div>

                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {onOpenTicket ? (
                          <button type="button" onClick={() => onOpenTicket(supply.ticket_id)} className={btnApri} title="Apri ticket">
                            Apri
                          </button>
                        ) : null}
                        {!isReadOnly ? (
                          <>
                            {onEditSupply ? (
                              <button type="button" onClick={() => onEditSupply(supply)} className={btnMod} title="Modifica fornitura">
                                Modifica
                              </button>
                            ) : null}
                            <button type="button" onClick={() => handleRemove(supply.id)} className={btnDel} title="Restituisci fornitura">
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TemporarySuppliesPanel;
