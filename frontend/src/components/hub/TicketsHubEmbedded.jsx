import React, { useMemo, useState, useEffect } from 'react';
import TicketListContainer from '../TicketListContainer';
import TicketsHubTicketChrome from './TicketsHubTicketChrome';
import { hubModalCssVars } from '../../utils/techHubAccent';
import { ticketMatchesAdvancedSearch } from '../../utils/ticketAdvancedSearch';

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
  hubSurfaceMode = 'dark',
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
  hubUnreadMessagesTotal = 0,
  hubTemporarySuppliesCount = undefined,
  onOpenHubTemporarySupplies = null
}) {
  const [selectedCompany, setSelectedCompany] = useState('');
  const visibleTickets = useVisibleTicketsForHub({ currentUser, users, tickets, selectedCompany });

  const [advancedSearchTerm, setAdvancedSearchTerm] = useState('');
  const [advancedSearchResults, setAdvancedSearchResults] = useState([]);

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
      className="w-full shrink-0 rounded-2xl border border-[color:var(--hub-chrome-border-soft)]"
      style={{ backgroundColor: 'var(--hub-chrome-surface)', ...hubModalCssVars(accentHex) }}
    >
      <div className="px-3 py-3 md:px-4 md:py-4">
        <TicketsHubTicketChrome
          hubSurfaceMode={hubSurfaceMode}
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
        <TicketListContainer
          hubEmbed
          hubSurfaceMode={hubSurfaceMode}
          currentUser={currentUser}
          tickets={visibleTickets}
          users={users}
          selectedTicket={selectedTicket}
          setSelectedTicket={setSelectedTicket}
          handlers={handlers}
          getUnreadCount={getUnreadCount}
          showFilters
          externalViewState={externalViewState}
          hubTemporarySuppliesCount={hubTemporarySuppliesCount}
          onOpenHubTemporarySupplies={onOpenHubTemporarySupplies ?? undefined}
          hubAccentHex={accentHex}
        />
      </div>
    </div>
  );
}
