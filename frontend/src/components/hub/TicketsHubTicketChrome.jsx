import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building,
  ChevronDown,
  MessageSquare,
  Plus,
  Search,
  Paperclip,
  X
} from 'lucide-react';

/**
 * Barra alta vista Ticket nell’hub: torna alla panoramica, titolo lista, filtri tecnico (azienda + ricerca avanzata), Nuovo ticket, messaggi non letti.
 */
export default function TicketsHubTicketChrome({
  hubSurfaceMode = 'dark',
  currentUser,
  users = [],
  searchTerm,
  setSearchTerm,
  searchResults,
  selectedCompany,
  setSelectedCompany,
  onOpenNewTicket,
  onBackToOverview,
  onAfterSearchPickTicket,
  onOpenUnreadModal,
  unreadMessagesTotal = 0
}) {
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [companyFilter, setCompanyFilter] = useState('');

  const companies = useMemo(() => {
    if (currentUser?.ruolo !== 'tecnico') return [];
    const a = new Set();
    users
      .filter((u) => u.ruolo === 'cliente')
      .forEach((c) => {
        if (c.azienda && c.azienda.trim()) a.add(c.azienda.trim());
      });
    return Array.from(a).sort((x, y) => x.localeCompare(y));
  }, [users, currentUser]);

  const isTecnico = currentUser?.ruolo === 'tecnico';
  const showResults = searchTerm.trim().length >= 2 && searchResults.length > 0;
  const Lt = hubSurfaceMode === 'light';

  const listaTitle =
    currentUser?.ruolo === 'cliente' ? 'I Miei Interventi' : 'Lista Ticket';

  return (
    <div
      className={
        Lt
          ? 'mb-3 space-y-3 rounded-xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well)] p-3'
          : 'mb-3 space-y-3 rounded-xl border border-white/[0.1] bg-black/35 p-3'
      }
    >
      <div className="flex flex-wrap items-center gap-2 gap-y-2">
        <button
          type="button"
          onClick={onBackToOverview}
          className={
            Lt
              ? 'inline-flex items-center gap-2 rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] px-3 py-2 text-sm font-medium text-[color:var(--hub-chrome-text-secondary)] transition hover:border-[color:var(--hub-accent-border)] hover:bg-[color:var(--hub-chrome-hover)]'
              : 'inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-black/35 px-3 py-2 text-sm font-medium text-white/85 transition hover:border-[color:var(--hub-accent-border)] hover:bg-white/[0.06]'
          }
          title="Torna alla panoramica con le card"
        >
          <ArrowLeft size={18} className="shrink-0 text-[color:var(--hub-accent)]" aria-hidden />
          Panoramica hub
        </button>
        <h2
          className={
            Lt
              ? 'min-w-0 text-base font-semibold leading-tight tracking-tight text-[color:var(--hub-chrome-text)] sm:text-lg'
              : 'min-w-0 text-base font-semibold leading-tight tracking-tight text-white/95 sm:text-lg'
          }
        >
          {listaTitle}
        </h2>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenNewTicket?.()}
            className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--hub-accent)] px-3 py-2 text-sm font-semibold text-[#121212] transition hover:brightness-110"
          >
            <Plus size={18} aria-hidden />
            Nuovo ticket
          </button>
          {(isTecnico || unreadMessagesTotal > 0) && (
            <button
              type="button"
              onClick={() => onOpenUnreadModal?.()}
              title="Messaggi da leggere nei ticket"
              className={
                Lt
                  ? 'relative rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] p-2 text-[color:var(--hub-chrome-text-muted)] transition hover:border-[color:var(--hub-accent-border)] hover:text-[color:var(--hub-chrome-text)]'
                  : 'relative rounded-xl border border-white/[0.12] bg-black/35 p-2 text-white/80 transition hover:border-[color:var(--hub-accent-border)] hover:text-white'
              }
            >
              <MessageSquare size={20} aria-hidden />
              {unreadMessagesTotal > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadMessagesTotal > 99 ? '99+' : unreadMessagesTotal}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {isTecnico && (
          <div className="relative min-w-0 lg:max-w-[min(260px,100%)]">
            <button
              type="button"
              onClick={() => setIsCompanyOpen(!isCompanyOpen)}
              className={
                Lt
                  ? 'flex w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-3 py-2 text-left text-sm text-[color:var(--hub-chrome-text)] outline-none ring-[color:var(--hub-accent)] transition hover:border-[color:var(--hub-accent-border)] focus-visible:ring-2'
                  : 'flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.14] bg-black/40 px-3 py-2 text-left text-sm text-white outline-none ring-[color:var(--hub-accent)] transition hover:border-[color:var(--hub-accent-border)] focus-visible:ring-2'
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                {selectedCompany ? (
                  <>
                    <span
                      className={
                        Lt
                          ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--hub-chrome-row-nested-bg)] text-[11px] font-bold uppercase text-[color:var(--hub-accent)]'
                          : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--hub-accent)]/35 text-[11px] font-bold uppercase text-white'
                      }
                    >
                      {selectedCompany.charAt(0)}
                    </span>
                    <span
                      className={Lt ? 'truncate text-[color:var(--hub-chrome-text)]' : 'truncate text-white'}
                    >
                      {selectedCompany}
                    </span>
                  </>
                ) : (
                  <>
                    <Building
                      size={17}
                      className={
                        Lt
                          ? 'shrink-0 text-[color:var(--hub-chrome-text-faint)]'
                          : 'shrink-0 text-white/45'
                      }
                      aria-hidden
                    />
                    <span
                      className={
                        Lt
                          ? 'text-[color:var(--hub-chrome-placeholder)]'
                          : 'text-white/45'
                      }
                    >
                      Cerca per azienda…
                    </span>
                  </>
                )}
              </span>
              <ChevronDown
                size={17}
                className={`shrink-0 transition ${Lt ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-white/45'} ${isCompanyOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {selectedCompany && (
              <button
                type="button"
                title="Mostra tutte le aziende"
                className={
                  Lt
                    ? 'mt-2 text-[11px] font-medium text-[color:var(--hub-chrome-text-muted)] underline-offset-4 hover:text-[color:var(--hub-chrome-text)] hover:underline'
                    : 'mt-2 text-[11px] font-medium text-white/42 underline-offset-4 hover:text-white/72 hover:underline'
                }
                onClick={() => {
                  setSelectedCompany('');
                  setIsCompanyOpen(false);
                  setCompanyFilter('');
                }}
              >
                Tutte le aziende
              </button>
            )}
            {isCompanyOpen && (
              <>
                <div className="fixed inset-0 z-10 bg-black/0" aria-hidden onClick={() => setIsCompanyOpen(false)} />
                <div
                  className={
                    Lt
                      ? 'absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] py-2 shadow-xl'
                      : 'absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-white/[0.12] bg-[#282828] py-2 shadow-xl'
                  }
                >
                  <div
                    className={
                      Lt
                        ? 'sticky top-0 z-30 border-b border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-surface)] p-2'
                        : 'sticky top-0 z-30 border-b border-white/[0.08] bg-[#282828] p-2'
                    }
                  >
                    <div
                      className={
                        Lt
                          ? 'flex items-center gap-2 rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-2 py-1.5 ring-[color:var(--hub-accent)] focus-within:ring-2'
                          : 'flex items-center gap-2 rounded-lg border border-white/[0.12] px-2 py-1.5 ring-[color:var(--hub-accent)] focus-within:ring-2'
                      }
                    >
                      <Search
                        size={14}
                        className={
                          Lt
                            ? 'text-[color:var(--hub-chrome-text-faint)]'
                            : 'text-white/40'
                        }
                        aria-hidden
                      />
                      <input
                        type="text"
                        value={companyFilter}
                        onChange={(e) => setCompanyFilter(e.target.value)}
                        placeholder="Filtra aziende…"
                        className={
                          Lt
                            ? 'min-w-0 flex-1 border-0 bg-transparent text-sm text-[color:var(--hub-chrome-text)] outline-none placeholder:text-[color:var(--hub-chrome-placeholder)]'
                            : 'min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/38'
                        }
                      />
                      {companyFilter ? (
                        <button
                          type="button"
                          onClick={() => setCompanyFilter('')}
                          className={
                            Lt
                              ? 'text-[color:var(--hub-chrome-text-faint)] hover:text-[color:var(--hub-chrome-text-muted)]'
                              : 'text-white/40 hover:text-white/70'
                          }
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompany('');
                      setIsCompanyOpen(false);
                      setCompanyFilter('');
                    }}
                    className={
                      Lt
                        ? `flex w-full items-center px-4 py-2.5 text-left text-sm hover:bg-[color:var(--hub-chrome-hover)] ${!selectedCompany ? 'bg-[color:var(--hub-chrome-row-nested-bg)]' : ''}`
                        : `flex w-full items-center px-4 py-2.5 text-left text-sm hover:bg-white/[0.06] ${!selectedCompany ? 'bg-white/[0.08]' : ''}`
                    }
                  >
                    <span
                      className={
                        !selectedCompany
                          ? 'font-medium text-[color:var(--hub-accent)]'
                          : Lt
                            ? 'text-[color:var(--hub-chrome-text-secondary)]'
                            : 'text-white/75'
                      }
                    >
                      Tutte le aziende
                    </span>
                  </button>
                  {companies
                    .filter((c) => c.toLowerCase().includes(companyFilter.trim().toLowerCase()))
                    .slice(0, 40)
                    .map((azienda) => {
                      const sel = selectedCompany === azienda;
                      return (
                        <button
                          key={azienda}
                          type="button"
                          onClick={() => {
                            setSelectedCompany(azienda);
                            setIsCompanyOpen(false);
                            setCompanyFilter('');
                          }}
                          className={
                            Lt
                              ? `flex w-full items-center px-4 py-2 text-left text-sm hover:bg-[color:var(--hub-chrome-hover)] ${sel ? 'bg-[color:var(--hub-chrome-row-nested-bg)]' : ''}`
                              : `flex w-full items-center px-4 py-2 text-left text-sm hover:bg-white/[0.06] ${sel ? 'bg-white/[0.08]' : ''}`
                          }
                        >
                          <span
                            className={
                              sel
                                ? 'font-medium text-[color:var(--hub-accent)]'
                                : Lt
                                  ? 'truncate text-[color:var(--hub-chrome-text)]'
                                  : 'truncate text-white/88'
                            }
                          >
                            {azienda}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}

        <div className="relative min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div
              className={
                Lt
                  ? 'flex min-w-0 flex-1 rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-3 py-2 ring-[color:var(--hub-accent)] focus-within:ring-2'
                  : 'flex min-w-0 flex-1 rounded-lg border border-white/[0.14] bg-black/40 px-3 py-2 ring-[color:var(--hub-accent)] focus-within:ring-2'
              }
            >
              <Search
                size={17}
                className={
                  Lt
                    ? 'mt-0.5 shrink-0 text-[color:var(--hub-chrome-text-faint)]'
                    : 'mt-0.5 shrink-0 text-white/40'
                }
                aria-hidden
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    onAfterSearchPickTicket?.(searchResults[0]);
                    setSearchTerm('');
                  }
                }}
                placeholder="Ricerca avanzata (numero, titolo, messaggi…)"
                className={
                  Lt
                    ? 'min-w-0 flex-1 border-0 bg-transparent pl-2 text-sm text-[color:var(--hub-chrome-text)] outline-none placeholder:text-[color:var(--hub-chrome-placeholder)]'
                    : 'min-w-0 flex-1 border-0 bg-transparent pl-2 text-sm text-white outline-none placeholder:text-white/42'
                }
              />
              {searchTerm ? (
                <button
                  type="button"
                  className={
                    Lt
                      ? 'shrink-0 text-[color:var(--hub-chrome-text-faint)] hover:text-[color:var(--hub-chrome-text-muted)]'
                      : 'shrink-0 text-white/40 hover:text-white/75'
                  }
                  onClick={() => setSearchTerm('')}
                  aria-label="Pulisci ricerca"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </div>
          {showResults && (
            <div
              className={
                Lt
                  ? 'absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] py-1 shadow-xl'
                  : 'absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/[0.12] bg-[#252525] py-1 shadow-xl'
              }
            >
              {searchResults.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={
                    Lt
                      ? 'w-full border-b border-[color:var(--hub-chrome-border-soft)] px-3 py-2 text-left last:border-b-0 hover:bg-[color:var(--hub-chrome-hover)]'
                      : 'w-full border-b border-white/[0.06] px-3 py-2 text-left last:border-b-0 hover:bg-white/[0.06]'
                  }
                  onClick={() => {
                    onAfterSearchPickTicket?.(ticket);
                    setSearchTerm('');
                  }}
                >
                  <div
                    className={
                      Lt
                        ? 'flex items-center gap-2 text-sm font-medium text-[color:var(--hub-chrome-text)]'
                        : 'flex items-center gap-2 text-sm font-medium text-white/92'
                    }
                  >
                    {ticket.numero}
                    {ticket.photos?.length > 0 && (
                      <span
                        className={
                          Lt
                            ? 'inline-flex items-center gap-1 text-[11px] text-fuchsia-700'
                            : 'inline-flex items-center gap-1 text-[11px] text-fuchsia-300/90'
                        }
                        title="Allegati"
                      >
                        <Paperclip size={11} aria-hidden /> {ticket.photos.length}
                      </span>
                    )}
                  </div>
                  <div
                    className={
                      Lt
                        ? 'truncate text-[11px] text-[color:var(--hub-chrome-text-muted)]'
                        : 'truncate text-[11px] text-white/50'
                    }
                  >
                    {ticket.titolo}
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchTerm.trim().length >= 2 && searchResults.length === 0 && (
            <p
              className={
                Lt
                  ? 'mt-1 text-[11px] text-[color:var(--hub-chrome-text-faint)]'
                  : 'mt-1 text-[11px] text-white/42'
              }
            >
              Nessun risultato nella selezione corrente.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
