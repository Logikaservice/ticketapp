import React, { useState, useEffect } from 'react';
import { Monitor, Cpu, HardDrive, Battery, Shield, User, Loader2 } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import DispositiviAziendaliIntroCard from '../components/DispositiviAziendaliIntroCard';
import SectionNavMenu from '../components/SectionNavMenu';

const renderDisks = (disksJson) => {
  if (!disksJson) return <span className="text-gray-500">—</span>;
  try {
    const arr = typeof disksJson === 'string' ? JSON.parse(disksJson) : disksJson;
    if (!Array.isArray(arr) || arr.length === 0) return <span className="text-gray-500">—</span>;
    return (
      <div className="flex flex-col gap-2 w-full mt-1">
        {arr.map((d, i) => {
          if (d.total_gb == null || d.free_gb == null) return null;
          const used = Math.max(0, d.total_gb - d.free_gb);
          const percent = d.total_gb > 0 ? Math.round((used / d.total_gb) * 100) : 0;
          return (
            <div key={i} className="flex flex-col gap-1 text-xs w-full bg-gray-50 p-2 rounded border border-gray-100">
              <div className="flex justify-between text-gray-700 font-medium">
                <span>Disco {d.letter}</span>
                <span>{percent}% in uso</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-yellow-500' : 'bg-teal-500'}`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Liberi: {d.free_gb} GB</span>
                <span>Totali: {d.total_gb} GB</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  } catch (e) {
    return <span className="text-gray-500">—</span>;
  }
};

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
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

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

  const selectedCompany = companies.find(c => String(c.id) === String(selectedCompanyId));
  const companyName = selectedCompany?.azienda || selectedCompany?.nome || '';

  useEffect(() => {
    if (!companyName) {
      setDevices([]);
      return;
    }
    let cancelled = false;
    setDevicesLoading(true);
    fetch(buildApiUrl(`/api/comm-agent/device-info?azienda=${encodeURIComponent(companyName)}`), { headers: getAuthHeader() })
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (!cancelled) setDevices(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setDevices([]); })
      .finally(() => { if (!cancelled) setDevicesLoading(false); });
    return () => { cancelled = true; };
  }, [companyName, getAuthHeader]);

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

          {selectedCompanyId && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dispositivi (dati dagli agent)</h3>
              {devicesLoading ? (
                <div className="flex items-center gap-2 text-gray-500 py-8">
                  <Loader2 size={20} className="animate-spin" />
                  Caricamento...
                </div>
              ) : devices.length === 0 ? (
                <p className="text-gray-500 py-6">Nessun dispositivo con agent registrato per questa azienda, oppure i dati non sono ancora stati inviati.</p>
              ) : (
                <div className="space-y-4">
                  {devices.map((row) => {
                    const hasInfo = row.mac || row.device_name || row.os_name;
                    return (
                      <div key={row.agent_id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        {!hasInfo ? (
                          <p className="text-gray-500 text-sm">Dispositivo {row.machine_name || row.email} — in attesa di dati dall&apos;agent.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-800 flex items-center gap-2">
                                <Monitor size={16} className="text-teal-600" />
                                {row.device_name || row.machine_name || '—'} {row.real_status === 'online' && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Online</span>}
                              </div>
                              <div><span className="text-gray-500">MAC:</span> {row.mac || '—'}</div>
                              <div><span className="text-gray-500">IP:</span> {row.ip_addresses || '—'}</div>
                              <div><span className="text-gray-500">SO:</span> {row.os_name || '—'} {row.os_version && `(${row.os_version})`} {row.os_arch && ` · ${row.os_arch}`}</div>
                              {row.os_install_date && <div><span className="text-gray-500">Installato:</span> {new Date(row.os_install_date).toLocaleDateString('it-IT')}</div>}
                            </div>
                            <div className="space-y-1">
                              <div><span className="text-gray-500">Hardware:</span> {row.manufacturer || '—'} {row.model && `· ${row.model}`} {row.device_type && `(${row.device_type})`}</div>
                              <div className="flex items-start gap-1"><Cpu size={14} className="text-gray-400 mt-0.5" />
                                <div className="flex-1">
                                  <div><span className="text-gray-500">CPU:</span> {row.cpu_name || '—'} {row.cpu_cores != null && `· ${row.cpu_cores} core`} {row.cpu_clock_mhz != null && `· ${row.cpu_clock_mhz} MHz`}</div>
                                  {row.gpu_name && <div className="text-xs text-gray-600 mt-0.5"><span className="text-gray-500">GPU:</span> {row.gpu_name}</div>}
                                </div>
                              </div>
                              <div><span className="text-gray-500">RAM:</span> {row.ram_free_gb != null && row.ram_total_gb != null ? `${row.ram_free_gb} / ${row.ram_total_gb} GB liberi` : (row.ram_total_gb != null ? `${row.ram_total_gb} GB` : '—')}</div>
                              <div className="flex flex-col gap-1 w-full"><div className="flex items-center gap-1"><HardDrive size={14} className="text-gray-400" /><span className="text-gray-500 font-medium">Archiviazione Dischi:</span></div> {renderDisks(row.disks_json)}</div>
                              <div className="flex items-center gap-1"><User size={14} className="text-gray-400" /><span className="text-gray-500">Utente:</span> {row.current_user || '—'}</div>
                              {(row.battery_percent != null || row.battery_status) && (
                                <div className="flex items-center gap-1"><Battery size={14} className="text-gray-400" /> {row.battery_status || ''} {row.battery_percent != null && `${row.battery_percent}%`} {row.battery_charging && '(in carica)'}</div>
                              )}
                              {(row.antivirus_name || row.antivirus_state) && (
                                <div className="flex items-center gap-1"><Shield size={14} className="text-gray-400" /> {row.antivirus_name || '—'} {row.antivirus_state && `· ${row.antivirus_state}`}</div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
                          {row.email} · Aggiornato: {row.device_info_updated_at ? new Date(row.device_info_updated_at).toLocaleString('it-IT') : 'mai'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DispositiviAziendaliPage;
