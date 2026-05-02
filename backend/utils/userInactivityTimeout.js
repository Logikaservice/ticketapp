/**
 * Minuti prima del logout automatico per inattività.
 * NULL / non impostato: 30 per tecnici, 3 per clienti (coerente con frontend).
 * 0 = mai disconnettere.
 *
 * @param {{ ruolo?: string, inactivity_timeout_minutes?: number | null }} user
 */
function resolveUserInactivityTimeoutMinutes(user) {
  if (!user) return 3;
  const v = user.inactivity_timeout_minutes;
  if (v !== null && v !== undefined && v !== '') {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return user.ruolo === 'tecnico' ? 30 : 3;
}

module.exports = { resolveUserInactivityTimeoutMinutes };
