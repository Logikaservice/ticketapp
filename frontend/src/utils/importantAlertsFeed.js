import { buildApiUrl } from './apiConfig';

/** Allinea la logica alla dashboard: parsing clienti, filtro ruolo, scadenza. */
function normalizeAlertClients(alert) {
  let clients = [];
  try {
    if (alert.clients) {
      if (Array.isArray(alert.clients)) {
        clients = alert.clients;
      } else if (typeof alert.clients === 'string') {
        clients = JSON.parse(alert.clients);
      } else {
        clients = alert.clients;
      }
      if (!Array.isArray(clients)) clients = [];
    }
  } catch (_) {
    clients = [];
  }
  return { ...alert, clients };
}

function filterAlertsByRole(parsedAlerts, currentUser) {
  if (!currentUser || currentUser.ruolo !== 'cliente') {
    return parsedAlerts;
  }
  const userId = Number(currentUser.id);
  const isAdmin =
    currentUser.admin_companies &&
    Array.isArray(currentUser.admin_companies) &&
    currentUser.admin_companies.length > 0;

  return parsedAlerts.filter((alert) => {
    if (alert.clients && Array.isArray(alert.clients) && alert.clients.length > 0) {
      return alert.clients.some((clientId) => Number(clientId) === userId);
    }
    return isAdmin;
  });
}

function filterActiveNonExpiredDashboard(filteredAlerts) {
  return filteredAlerts.filter((alert) => {
    if (alert.isPermanent) {
      return true;
    }
    const createdAt = new Date(alert.createdAt || alert.created_at);
    const daysToExpire = alert.daysToExpire || 7;
    const expirationDate = new Date(createdAt);
    expirationDate.setDate(expirationDate.getDate() + daysToExpire);
    return new Date() <= expirationDate;
  });
}

async function fetchEmailExpirySyntheticAlerts(getAuthHeader) {
  const res = await fetch(buildApiUrl('/api/keepass/email-upcoming-expiries?days=30'), {
    headers: getAuthHeader()
  });
  if (!res.ok) {
    return [];
  }
  const list = await res.json();
  const formatDate = (d) => {
    if (!d) return 'N/D';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? 'N/D' : dt.toLocaleDateString('it-IT');
  };
  return (list || []).map((e) => ({
    id: `email-expiry-${String(e.aziendaName || '').replace(/[^a-z0-9]/gi, '-')}-${String(e.username || e.title || '').replace(/[^a-z0-9]/gi, '-')}`,
    title: 'Email in scadenza',
    body: `${e.aziendaName || ''} – ${e.username || ''} – scade il ${formatDate(e.expires)} (tra ${e.daysLeft ?? '?'} giorni)`,
    level: 'warning'
  }));
}

/**
 * Stessi avvisi mostrati nella dashboard (pannello Avvisi importanti) + email in scadenza per tecnico/admin.
 */
export async function fetchImportantAlertsForHub(getAuthHeader, currentUser) {
  if (!getAuthHeader || !currentUser) {
    return [];
  }
  const res = await fetch(buildApiUrl('/api/alerts'), {
    headers: getAuthHeader()
  });
  if (!res.ok) {
    throw new Error('Errore caricamento avvisi');
  }
  const allAlerts = await res.json();
  const parsedAlerts = (allAlerts || []).map(normalizeAlertClients);
  let filtered = filterAlertsByRole(parsedAlerts, currentUser);
  let active = filterActiveNonExpiredDashboard(filtered);

  if (currentUser.ruolo === 'tecnico' || currentUser.ruolo === 'admin') {
    try {
      const emailExtra = await fetchEmailExpirySyntheticAlerts(getAuthHeader);
      active = [...active, ...emailExtra];
    } catch (_) {
      /* ignore */
    }
  }

  return active.sort((a, b) => {
    const ta = new Date(a.createdAt || a.created_at || 0).getTime();
    const tb = new Date(b.createdAt || b.created_at || 0).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}
