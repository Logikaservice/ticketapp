import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Package } from 'lucide-react';
import TemporarySuppliesPanel from '../TemporarySuppliesPanel';
import { HubModalScaffold, HubModalChromeHeader, HubModalBody } from '../Modals/HubModalChrome';
import { hubModalCssVars } from '../../utils/techHubAccent';
import { buildApiUrl } from '../../utils/apiConfig';
import { filterTemporarySuppliesByRole } from '../../utils/temporarySuppliesRoleFilter';

export default function TemporarySuppliesSummaryHubModal({
  open,
  onClose,
  getAuthHeader,
  currentUser,
  accentHex,
  tickets = [],
  onOpenTicketFromSupply,
  onTemporarySuppliesMutated
}) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    if (!getAuthHeader) return;
    setLoading(true);
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(buildApiUrl('/api/tickets/forniture/all'), {
        headers: { ...getAuthHeader() },
        signal: controller.signal
      });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        setRaw(Array.isArray(data) ? data : []);
      }
    } catch (_) {
      /* timeout / rete */
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    if (!open) return;
    fetchList();
  }, [open, fetchList]);

  const filtered = useMemo(() => filterTemporarySuppliesByRole(raw, currentUser), [raw, currentUser]);
  const isTech = currentUser?.ruolo === 'tecnico';

  const removeSupply = async (supplyId) => {
    const res = await fetch(buildApiUrl(`/api/tickets/forniture/${supplyId}`), {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    if (res.ok) {
      setRaw((prev) => prev.filter((s) => s.id !== supplyId));
      try {
        onTemporarySuppliesMutated?.();
      } catch (_) {
        /* ignore */
      }
    } else throw new Error('delete');
  };

  if (!open) return null;

  return createPortal(
    <HubModalScaffold
      onBackdropClick={onClose}
      maxWidthClass="max-w-3xl"
      zClass="z-[119]"
      panelClassName="max-h-[90vh] flex flex-col overflow-hidden"
    >
      <HubModalChromeHeader
        icon={Package}
        title="Resoconto forniture temporanee"
        subtitle="Stesso elenco delle forniture inserite nei ticket (prestiti materiali)."
        onClose={onClose}
        compact
      />
      <HubModalBody className="flex min-h-0 flex-1 flex-col space-y-0 p-4">
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto" style={hubModalCssVars(accentHex)}>
          <TemporarySuppliesPanel
            variant="hub"
            temporarySupplies={filtered}
            loading={loading}
            onRefresh={fetchList}
            onRemoveSupply={isTech ? removeSupply : undefined}
            isReadOnly={!isTech}
            onOpenTicket={onOpenTicketFromSupply}
          />
        </div>
      </HubModalBody>
    </HubModalScaffold>,
    document.body
  );
}
