import React, { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import DispositiviAziendaliIntroCard from '../components/DispositiviAziendaliIntroCard';
import SectionNavMenu from '../components/SectionNavMenu';

const DispositiviAziendaliPage = ({
  onClose,
  getAuthHeader,
  readOnly = false,
  currentUser,
  onNavigateOffice,
  onNavigateEmail,
  onNavigateAntiVirus,
  onNavigateNetworkMonitoring,
  onNavigateMappatura
}) => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch(buildApiUrl('/api/network-monitoring/all-clients'), { headers: getAuthHeader() });
        if (res.ok) {
          const data = await res.json();
          const seen = new Set();
          const unique = (data || []).filter(c => {
            const name = (c.azienda || (c.nome && c.cognome ? `${c.nome} ${c.cognome}` : '') || '').trim();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });
          setCompanies(unique);
        }
      } catch (e) {
        console.error('Error fetching companies:', e);
      }
    };
    fetchCompanies();
  }, [getAuthHeader]);

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <SectionNavMenu
            currentPage="dispositivi-aziendali"
            onNavigateHome={onClose}
            onNavigateOffice={onNavigateOffice}
            onNavigateEmail={onNavigateEmail}
            onNavigateAntiVirus={onNavigateAntiVirus}
            onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
            onNavigateMappatura={onNavigateMappatura}
            onNavigateDispositiviAziendali={null}
            currentUser={currentUser}
          />
          <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
            <Monitor size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Dispositivi aziendali</h1>
            {readOnly && <p className="text-sm text-gray-500 mt-0.5">Sola consultazione</p>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            className="border rounded-lg px-3 py-2 bg-gray-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none min-w-[200px]"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            <option value="">{readOnly ? 'Seleziona Azienda...' : 'Seleziona Cliente...'}</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.azienda || (c.nome && c.cognome ? `${c.nome} ${c.cognome}` : `ID ${c.id}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto w-full">
          <DispositiviAziendaliIntroCard
            companies={companies}
            value={selectedCompanyId}
            onChange={(id) => setSelectedCompanyId(id || '')}
          />
          {/* Qui in futuro: lista dispositivi / dati dagli agent quando selectedCompanyId è valorizzato */}
        </div>
      </div>
    </div>
  );
};

export default DispositiviAziendaliPage;
