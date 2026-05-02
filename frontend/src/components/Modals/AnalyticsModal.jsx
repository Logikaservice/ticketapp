// frontend/src/components/Modals/AnalyticsModal.jsx

import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Building } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { buildApiUrl } from '../../utils/apiConfig';
import { HUB_MODAL_FIELD_CLS, HUB_MODAL_LABEL_CLS } from '../../utils/techHubAccent';
import { HubModalInnerCard, HubModalChromeHeader, HubModalBody } from './HubModalChrome';

const CHART_TICK = { fill: '#c4c4c4', fontSize: 12 };
const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1e1e1e',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#f5f5f5'
};

const AnalyticsModal = ({ currentUser, users, getAuthHeader, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({ pagato: 0, inAttesa: 0, daFatturare: 0, daCompletare: 0 });
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [companies, setCompanies] = useState([]);
  const isFetchingRef = useRef(false); // Prevenire chiamate multiple simultanee
  const [tooltipData, setTooltipData] = useState(null); // Dati per il tooltip
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 }); // Posizione del tooltip

  // Estrai lista aziende uniche
  useEffect(() => {
    if (users && users.length > 0) {
      const clienti = users.filter(u => u.ruolo === 'cliente' && u.azienda);
      const aziendeSet = new Set();
      clienti.forEach(c => {
        if (c.azienda && c.azienda.trim() !== '') {
          aziendeSet.add(c.azienda);
        }
      });
      setCompanies(Array.from(aziendeSet).sort((a, b) => a.localeCompare(b)));
    }
  }, [users]);

  // Carica dati analytics con debounce
  useEffect(() => {
    // Prevenire chiamate multiple simultanee
    let cancelled = false;
    
    const fetchAnalytics = async () => {
      // Se c'è già una richiesta in corso, annulla questa
      if (isFetchingRef.current) {
        console.log('⚠️ Analytics: Richiesta già in corso, annullo');
        return;
      }
      
      isFetchingRef.current = true;
      
      try {
        setLoading(true);
        const url = selectedCompany === 'all' 
          ? buildApiUrl('/api/analytics')
          : buildApiUrl(`/api/analytics?company=${encodeURIComponent(selectedCompany)}`);
        
        console.log('📊 Analytics: Avvio fetch per', selectedCompany);
        const response = await fetch(url, {
          headers: getAuthHeader()
        });
        
        if (cancelled) {
          isFetchingRef.current = false;
          return;
        }
        
        if (!response.ok) {
          throw new Error('Errore nel caricamento dei dati analytics');
        }
        
        const result = await response.json();
        if (cancelled) {
          isFetchingRef.current = false;
          return;
        }
        
        console.log('📊 Analytics: Dati ricevuti,', result.data?.length || 0, 'mesi');
        setData(result.data || []);
        setTotals(result.totals || { pagato: 0, inAttesa: 0, daFatturare: 0, daCompletare: 0 });
      } catch (err) {
        if (cancelled) {
          isFetchingRef.current = false;
          return;
        }
        console.error('❌ Errore caricamento analytics:', err);
        setData([]);
        setTotals({ pagato: 0, inAttesa: 0, daFatturare: 0, daCompletare: 0 });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    };

    // Debounce di 500ms per evitare chiamate multiple quando cambia il filtro
    const timeoutId = setTimeout(() => {
      fetchAnalytics();
    }, 500);
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      isFetchingRef.current = false;
    };
  }, [selectedCompany]); // Rimossa getAuthHeader dalle dipendenze

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const handleTooltipLeave = () => {
    setTooltipData(null);
  };

  const totalGenerale = totals.pagato + totals.inAttesa + totals.daFatturare + totals.daCompletare;

  return (
    <HubModalInnerCard maxWidthClass="max-w-6xl" className="flex max-h-[90vh] flex-col overflow-hidden">
      <HubModalChromeHeader icon={BarChart3} title="Analytics" onClose={onClose} />

      <div className="shrink-0 border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Building size={18} className="text-white/55" aria-hidden />
          <label className={`${HUB_MODAL_LABEL_CLS} mb-0`}>Filtra per Azienda:</label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className={`max-w-xs ${HUB_MODAL_FIELD_CLS}`}
          >
            <option value="all">Tutte le Aziende</option>
            {companies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
        </div>
      </div>

      <HubModalBody className="flex-1 space-y-4 pb-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-white/55">Caricamento dati...</div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-white/55">Nessun dato disponibile</div>
            </div>
          ) : (
            <>
              {/* Grafico */}
              <div className="mb-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Andamento Mensile</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis 
                      dataKey="month" 
                      tick={CHART_TICK}
                      stroke="rgba(255,255,255,0.2)"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={CHART_TICK}
                      stroke="rgba(255,255,255,0.2)"
                      tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: '#e5e5e5' }}
                    />
                    <Legend wrapperStyle={{ color: '#e5e5e5' }} />
                    <Bar dataKey="pagato" stackId="a" fill="#10b981" name="Pagato (Fatturati)" />
                    <Bar dataKey="inAttesa" stackId="a" fill="#f59e0b" name="In Attesa (Inviati)" />
                    <Bar dataKey="daFatturare" stackId="a" fill="#3b82f6" name="Da Fatturare (Chiusi)" />
                    <Bar dataKey="daCompletare" stackId="a" fill="#ef4444" name="Da Completare (Risolti)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Totali */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/12 p-4">
                  <div className="mb-1 text-sm font-medium text-emerald-100">Pagato</div>
                  <div className="text-2xl font-bold text-emerald-50">{formatCurrency(totals.pagato)}</div>
                  <div className="mt-1 text-xs text-emerald-100/80">Fatturati</div>
                </div>
                <div className="rounded-lg border border-amber-500/38 bg-amber-500/12 p-4">
                  <div className="mb-1 text-sm font-medium text-amber-50">In Attesa</div>
                  <div className="text-2xl font-bold text-amber-100">{formatCurrency(totals.inAttesa)}</div>
                  <div className="mt-1 text-xs text-amber-100/75">Inviati</div>
                </div>
                <div className="rounded-lg border border-sky-500/35 bg-sky-500/12 p-4">
                  <div className="mb-1 text-sm font-medium text-sky-50">Da Fatturare</div>
                  <div className="text-2xl font-bold text-sky-100">{formatCurrency(totals.daFatturare)}</div>
                  <div className="mt-1 text-xs text-sky-100/75">Chiusi</div>
                </div>
                <div className="rounded-lg border border-red-500/40 bg-red-500/15 p-4">
                  <div className="mb-1 text-sm font-medium text-red-50">Da Completare</div>
                  <div className="text-2xl font-bold text-red-100">{formatCurrency(totals.daCompletare)}</div>
                  <div className="mt-1 text-xs text-red-100/80">Risolti</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="mb-1 text-sm font-medium text-white/78">Totale</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(totalGenerale)}</div>
                  <div className="mt-1 text-xs text-white/55">Complessivo</div>
                </div>
              </div>

              {/* Tabella Dettagli */}
              <div className="mt-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Dettaglio Mensile</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full rounded-lg border border-white/10 bg-black/20">
                    <thead className="bg-black/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-white/70">Mese</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-white/70">Pagato</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-white/70">In Attesa</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-white/70">Da Fatturare</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-white/70">Da Completare</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-white/70">Totale Mese</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {data.map((row, index) => {
                        const totaleMese = row.pagato + row.inAttesa + row.daFatturare + row.daCompletare;
                        
                        // Handler per mostrare tooltip
                        const handleCellHover = (field, event) => {
                          if (!row.details || !row.details[field] || row.details[field].length === 0) {
                            setTooltipData(null);
                            return;
                          }
                          
                          const rect = event.currentTarget.getBoundingClientRect();
                          setTooltipPosition({
                            x: rect.left + rect.width / 2,
                            y: rect.top - 10
                          });
                          setTooltipData({
                            field,
                            month: row.month,
                            details: row.details[field]
                          });
                        };
                        
                        const handleCellLeave = () => {
                          setTooltipData(null);
                        };
                        
                        return (
                          <tr key={index} className="hover:bg-white/[0.04]">
                            <td className="px-4 py-3 text-sm font-medium text-white">{row.month}</td>
                            <td className="px-4 py-3 text-right text-sm text-emerald-300">{formatCurrency(row.pagato)}</td>
                            <td 
                              className="relative cursor-help px-4 py-3 text-right text-sm text-amber-200"
                              onMouseEnter={(e) => handleCellHover('inAttesa', e)}
                              onMouseLeave={handleCellLeave}
                            >
                              {formatCurrency(row.inAttesa)}
                            </td>
                            <td 
                              className="relative cursor-help px-4 py-3 text-right text-sm text-sky-300"
                              onMouseEnter={(e) => handleCellHover('daFatturare', e)}
                              onMouseLeave={handleCellLeave}
                            >
                              {formatCurrency(row.daFatturare)}
                            </td>
                            <td 
                              className="relative cursor-help px-4 py-3 text-right text-sm text-red-300"
                              onMouseEnter={(e) => handleCellHover('daCompletare', e)}
                              onMouseLeave={handleCellLeave}
                            >
                              {formatCurrency(row.daCompletare)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-white">{formatCurrency(totaleMese)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-black/35 font-semibold">
                      <tr>
                        <td className="px-4 py-3 text-sm text-white">TOTALE</td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-300">{formatCurrency(totals.pagato)}</td>
                        <td className="px-4 py-3 text-right text-sm text-amber-200">{formatCurrency(totals.inAttesa)}</td>
                        <td className="px-4 py-3 text-right text-sm text-sky-300">{formatCurrency(totals.daFatturare)}</td>
                        <td className="px-4 py-3 text-right text-sm text-red-300">{formatCurrency(totals.daCompletare)}</td>
                        <td className="px-4 py-3 text-right text-sm text-white">{formatCurrency(totalGenerale)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
      </HubModalBody>

        {tooltipData && (
          <div
            className="fixed z-[130] min-w-[250px] max-w-[400px] rounded-lg border border-white/10 bg-[#1e1e1e] p-4 shadow-xl text-white"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-10px'
            }}
            onMouseEnter={() => {}} // Mantieni il tooltip visibile quando ci passi sopra
            onMouseLeave={handleTooltipLeave}
          >
            <div className="mb-2 border-b border-white/10 pb-2 text-sm font-semibold text-white">
              {tooltipData.month} - {
                tooltipData.field === 'inAttesa' ? 'In Attesa' :
                tooltipData.field === 'daFatturare' ? 'Da Fatturare' :
                'Da Completare'
              }
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tooltipData.details.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-white/78">{item.azienda}</span>
                  <span className="ml-4 font-semibold text-white">{formatCurrency(item.importo)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/10 pt-2 text-xs text-white/55">
              Totale: {formatCurrency(tooltipData.details.reduce((sum, item) => sum + item.importo, 0))}
            </div>
          </div>
        )}
    </HubModalInnerCard>
  );
};

export default AnalyticsModal;

