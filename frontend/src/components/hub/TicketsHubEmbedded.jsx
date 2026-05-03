import React from 'react';
import TicketListContainer from '../TicketListContainer';
import { HUB_SURFACE, hubModalCssVars } from '../../utils/techHubAccent';

/**
 * Lista ticket nel pannello centrale dell’Hub: stesso dominio dati/modali di App.jsx, tema scuro allineato agli altri moduli embedded.
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
  externalViewState
}) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08]"
      style={{ backgroundColor: HUB_SURFACE, ...hubModalCssVars(accentHex) }}
    >
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-4 md:py-4">
        <TicketListContainer
          hubEmbed
          currentUser={currentUser}
          tickets={tickets}
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
