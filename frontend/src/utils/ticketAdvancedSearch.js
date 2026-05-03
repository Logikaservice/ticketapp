import { formatDate, formatDateItalian } from './formatters';

/**
 * Ricerca avanzata allineata alla dashboard ticket (titolo, chat, timelog, ecc.) + campi data formattati.
 */
export function ticketMatchesAdvancedSearch(ticket, rawSearchTerm) {
  const searchLower = rawSearchTerm.toLowerCase().trim();
  const t = rawSearchTerm.trim();

  if (!searchLower || !ticket) return false;

  try {
    if (ticket.dataapertura && formatDate(ticket.dataapertura).toLowerCase().includes(searchLower)) return true;
    if (ticket.dataapertura && formatDateItalian(ticket.dataapertura).toLowerCase().includes(searchLower)) return true;
    if (ticket.datachiusura && formatDate(ticket.datachiusura).toLowerCase().includes(searchLower)) return true;
    if (ticket.datacreazione && formatDate(ticket.datacreazione).toLowerCase().includes(searchLower)) return true;
    if (
      typeof rawSearchTerm === 'string' &&
      rawSearchTerm.includes('/') &&
      ticket.timelogs &&
      Array.isArray(ticket.timelogs)
    ) {
      const hit = ticket.timelogs.some((log) =>
        log.data ? formatDateItalian(log.data).includes(t) || formatDate(log.data).toLowerCase().includes(searchLower) : false
      );
      if (hit) return true;
    }
  } catch {
    /* ignore */
  }

  if (
    ticket.numero?.toLowerCase().includes(searchLower) ||
    ticket.titolo?.toLowerCase().includes(searchLower) ||
    ticket.id?.toString().includes(t) ||
    ticket.descrizione?.toLowerCase().includes(searchLower) ||
    ticket.nomerichiedente?.toLowerCase().includes(searchLower)
  ) {
    return true;
  }

  if (ticket.messaggi && Array.isArray(ticket.messaggi)) {
    const ok = ticket.messaggi.some(
      (message) =>
        message.contenuto?.toLowerCase().includes(searchLower) ||
        message.autore?.toLowerCase().includes(searchLower)
    );
    if (ok) return true;
  }

  if (ticket.timelogs && Array.isArray(ticket.timelogs)) {
    const ok = ticket.timelogs.some(
      (log) =>
        log.descrizione?.toLowerCase().includes(searchLower) ||
        log.modalita?.toLowerCase().includes(searchLower) ||
        (log.materials &&
          Array.isArray(log.materials) &&
          log.materials.some((m) => m.nome?.toLowerCase().includes(searchLower))) ||
        (log.offerte &&
          Array.isArray(log.offerte) &&
          log.offerte.some(
            (o) =>
              o.descrizione?.toLowerCase().includes(searchLower) ||
              o.numeroOfferta?.toLowerCase().includes(searchLower)
          ))
    );
    if (ok) return true;
  }

  return false;
}
