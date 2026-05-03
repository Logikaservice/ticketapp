import React, { useMemo, useState, useEffect } from 'react';
import TicketListContainer from '../TicketListContainer';
import TicketsHubTicketChrome from './TicketsHubTicketChrome';
import { formatDateItalian } from '../../utils/formatters';
import { HUB_SURFACE, hubModalCssVars } from '../../utils/techHubAccent';
import { ticketMatchesAdvancedSearch } from '../../utils/ticketAdvancedSearch';

const STORAGE_HUB_LIST_CAP = 'techHubTicketHubListCap';

function loadHubListCap() {
  try {
    const v = localStorage.getItem(STORAGE_HUB_LIST_CAP);
    if (v === '50') return 50;
    if (v === '100') return 100;
    if (v === '200') return 200;
    return null;
  } catch (_) {
    return null;
  }
}

/** Stessa logica “ticket visibili” della dashboard per ruolo / filtro azienda. */
function useVisibleTicketsForHub({ currentUser, users, tickets, selectedCompany }) {
  const companyTickets = useMemo(() => {
    if (currentUser?.ruolo !== 'tecnico' || !selectedCompany) return [];
    const companyClients = users.filter((u) => u.ruolo === 'cliente' && u.azienda === selectedCompany);
    const ids = companyClients.map((c) => c.id);
    return tickets.filter((t) => ids.some((id) => Number(id) === Number(t.clienteid)));
  }, [selectedCompany, tickets, users, currentUser]);

  return useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.ruolo === 'cliente') {
      const isAdmin =
        currentUser.admin_companies && Array.isArray(currentUser.admin_companies) && currentUser.admin_companies.length > 0;
      if (isAdmin) {
        const companyNames = currentUser.admin_companies;
        const companyClients = users.filter(
          (u) => u.ruolo === 'cliente' && u.azienda && companyNames.includes(u.azienda)
        );
        const companyClientIds = companyClients.map((c) => c.id);
        if (companyClientIds.length > 0) {
          return tickets.filter((t) => companyClientIds.some((id) => Number(id) === Number(t.clienteid)));
        }
      }
      const currentUserId = Number(currentUser.id);
      return tickets.filter((t) => Number(t.clienteid) === currentUserId);
    }
    if (currentUser.ruolo === 'tecnico') {
      return selectedCompany ? companyTickets : tickets;
    }
    return tickets;
  }, [tickets, currentUser, users, selectedCompany, companyTickets]);
}

/**
 * Lista ticket nel pannello centrale dell’Hub: toolbar (panoramica, titolo, nuovo ticket, ricerche) + lista tema scuro.
 */
export default function TicketsHubEmbedded({
  accentHex,
  currentUser,
  tickets,
  users,
  selectedTicket,
  setSelectedTicket,
  handlers,
  getUnreadCount,
  externalViewState,
  onBackToOverview,
  onOpenNewTicket,
  onNavigateTicketTabState,
  onOpenUnreadModal,
  hubUnreadMessagesTotal = 0
}) {
  const [selectedCompany, setSelectedCompany] = useState('');
  const visibleTickets = useVisibleTicketsForHub({ currentUser, users, tickets, selectedCompany });

  const [advancedSearchTerm, setAdvancedSearchTerm] = useState(() => formatDateItalian(new Date().toISOString()));
  const [advancedSearchResults, setAdvancedSearchResults] = useState([]);
  /** null = tutti; altrimenti max righe renderizzate (performance su liste enormi). */
  const [hubListCap, setHubListCap] = useState(loadHubListCap);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HUB_LIST_CAP, hubListCap == null ? 'all' : String(hubListCap));
    } catch (_) {
      /* ignore */
    }
  }, [hubListCap]);

  useEffect(() => {
    const q = advancedSearchTerm.trim();
    if (q.length >= 2) {
      const results = visibleTickets
        .filter((ticket) => ticketMatchesAdvancedSearch(ticket, advancedSearchTerm))
        .slice(0, 10);
      setAdvancedSearchResults(results);
    } else {
      setAdvancedSearchResults([]);
    }
  }, [advancedSearchTerm, visibleTickets]);

  return (
    <div
      className="w-full shrink-0 rounded-2xl border border-white/[0.08]"
      style={{ backgroundColor: HUB_SURFACE, ...hubModalCssVars(accentHex) }}
    >
      <div className="px-3 py-3 md:px-4 md:py-4">
        <TicketsHubTicketChrome
          currentUser={currentUser}
          users={users}
          searchTerm={advancedSearchTerm}
          setSearchTerm={setAdvancedSearchTerm}
          searchResults={advancedSearchResults}
          selectedCompany={selectedCompany}
          setSelectedCompany={setSelectedCompany}
          onOpenNewTicket={onOpenNewTicket}
          onBackToOverview={onBackToOverview}
          onAfterSearchPickTicket={(ticket) => {
            if (!ticket) return;
            handlers?.handleSelectTicket?.(ticket);
            onNavigateTicketTabState?.(ticket.stato);
          }}
          onOpenUnreadModal={onOpenUnreadModal}
          unreadMessagesTotal={hubUnreadMessagesTotal}
        />
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <label htmlFor="hub-ticket-list-cap" className="text-[11px] text-white/42">
            Card in lista
          </label>
          <select
            id="hub-ticket-list-cap"
            value={hubListCap == null ? 'all' : String(hubListCap)}
            onChange={(e) => {
              const v = e.target.value;
              setHubListCap(v === 'all' ? null : Number(v));
            }}
            className="max-w-[11rem] rounded-lg border border-white/[0.12] bg-black/35 px-2 py-1.5 text-[11px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)]"
          >
            <option value="all">Tutti (scorri la pagina)</option>
            <option value="50">Primi 50</option>
            <option value="100">Primi 100</option>
            <option value="200">Primi 200</option>
          </select>
        </div>
        <TicketListContainer
          hubEmbed
          hubEmbedMaxItems={hubListCap}
          currentUser={currentUser}
          tickets={visibleTickets}
          users={users}
          selectedTicket={selectedTicket}
          setSelectedTicket={setSelectedTicket}
          handlers={handlers}
          getUnreadCount={getUnreadCount}
          showFilters
          externalViewState={externalViewState}
        />
      </div>
    </div>
  );
}
