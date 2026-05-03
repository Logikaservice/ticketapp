/** Stessa visibilità della dashboard: tecnico vede tutto; cliente per azienda / admin multi-azienda. */
export function filterTemporarySuppliesByRole(temporarySupplies, currentUser) {
  if (!temporarySupplies || temporarySupplies.length === 0) return [];
  if (currentUser?.ruolo === 'tecnico') return temporarySupplies;
  if (currentUser?.ruolo === 'cliente') {
    const isAdmin =
      currentUser.admin_companies &&
      Array.isArray(currentUser.admin_companies) &&
      currentUser.admin_companies.length > 0;
    if (isAdmin) {
      const companyNames = currentUser.admin_companies;
      return temporarySupplies.filter((supply) => supply.azienda && companyNames.includes(supply.azienda));
    }
    if (currentUser?.azienda) {
      return temporarySupplies.filter((supply) => supply.azienda === currentUser.azienda);
    }
    return [];
  }
  return [];
}
