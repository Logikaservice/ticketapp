// frontend/src/components/Modals/AnalyticsModal.jsx

import React, { useState, useEffect, useRef } from 'react';
import { X, BarChart3, Building } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
          ? `${process.env.REACT_APP_API_URL}/api/analytics`
          : `${process.env.REACT_APP_API_URL}/api/analytics?company=${encodeURIComponent(selectedCompany)}`;
        
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-blue-600" size={24} />
            <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filtro Azienda */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Building size={18} className="text-gray-600" />
            <label className="text-sm font-medium text-gray-700">Filtra per Azienda:</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tutte le Aziende</option>
              {companies.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Caricamento dati...</div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Nessun dato disponibile</div>
            </div>
          ) : (
            <>
              {/* Grafico */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Andamento Mensile</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <Legend />
                    <Bar dataKey="pagato" stackId="a" fill="#10b981" name="Pagato (Fatturati)" />
                    <Bar dataKey="inAttesa" stackId="a" fill="#f59e0b" name="In Attesa (Inviati)" />
                    <Bar dataKey="daFatturare" stackId="a" fill="#3b82f6" name="Da Fatturare (Chiusi)" />
                    <Bar dataKey="daCompletare" stackId="a" fill="#ef4444" name="Da Completare (Risolti)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Totali */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-700 font-medium mb-1">Pagato</div>
                  <div className="text-2xl font-bold text-green-800">{formatCurrency(totals.pagato)}</div>
                  <div className="text-xs text-green-600 mt-1">Fatturati</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-sm text-yellow-700 font-medium mb-1">In Attesa</div>
                  <div className="text-2xl font-bold text-yellow-800">{formatCurrency(totals.inAttesa)}</div>
                  <div className="text-xs text-yellow-600 mt-1">Inviati</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-700 font-medium mb-1">Da Fatturare</div>
                  <div className="text-2xl font-bold text-blue-800">{formatCurrency(totals.daFatturare)}</div>
                  <div className="text-xs text-blue-600 mt-1">Chiusi</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-sm text-red-700 font-medium mb-1">Da Completare</div>
                  <div className="text-2xl font-bold text-red-800">{formatCurrency(totals.daCompletare)}</div>
                  <div className="text-xs text-red-600 mt-1">Risolti</div>
                </div>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <div className="text-sm text-gray-700 font-medium mb-1">Totale</div>
                  <div className="text-2xl font-bold text-gray-800">{formatCurrency(totalGenerale)}</div>
                  <div className="text-xs text-gray-600 mt-1">Complessivo</div>
                </div>
              </div>

              {/* Tabella Dettagli */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Dettaglio Mensile</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mese</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Pagato</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">In Attesa</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Da Fatturare</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Da Completare</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Totale Mese</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
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
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.month}</td>
                            <td className="px-4 py-3 text-sm text-right text-green-700">{formatCurrency(row.pagato)}</td>
                            <td 
                              className="px-4 py-3 text-sm text-right text-yellow-700 cursor-help relative"
                              onMouseEnter={(e) => handleCellHover('inAttesa', e)}
                              onMouseLeave={handleCellLeave}
                            >
                              {formatCurrency(row.inAttesa)}
                            </td>
                            <td 
                              className="px-4 py-3 text-sm text-right text-blue-700 cursor-help relative"
                              onMouseEnter={(e) => handleCellHover('daFatturare', e)}
                              onMouseLeave={handleCellLeave}
                            >
                              {formatCurrency(row.daFatturare)}
                            </td>
                            <td 
                              className="px-4 py-3 text-sm text-right text-red-700 cursor-help relative"
                              onMouseEnter={(e) => handleCellHover('daCompletare', e)}
                              onMouseLeave={handleCellLeave}
                            >
                              {formatCurrency(row.daCompletare)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(totaleMese)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 font-semibold">
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900">TOTALE</td>
                        <td className="px-4 py-3 text-sm text-right text-green-700">{formatCurrency(totals.pagato)}</td>
                        <td className="px-4 py-3 text-sm text-right text-yellow-700">{formatCurrency(totals.inAttesa)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-700">{formatCurrency(totals.daFatturare)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-700">{formatCurrency(totals.daCompletare)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(totalGenerale)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Tooltip per dettagli aziende */}
        {tooltipData && (
          <div
            className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-4 min-w-[250px] max-w-[400px]"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-10px'
            }}
            onMouseEnter={() => {}} // Mantieni il tooltip visibile quando ci passi sopra
            onMouseLeave={handleTooltipLeave}
          >
            <div className="text-sm font-semibold text-gray-800 mb-2 border-b pb-2">
              {tooltipData.month} - {
                tooltipData.field === 'inAttesa' ? 'In Attesa' :
                tooltipData.field === 'daFatturare' ? 'Da Fatturare' :
                'Da Completare'
              }
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tooltipData.details.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">{item.azienda}</span>
                  <span className="text-gray-900 font-semibold ml-4">{formatCurrency(item.importo)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t text-xs text-gray-600">
              Totale: {formatCurrency(tooltipData.details.reduce((sum, item) => sum + item.importo, 0))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsModal;

