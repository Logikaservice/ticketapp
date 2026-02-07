// frontend/src/pages/EmailPage.jsx
// Pagina Email - struttura da KeePass (cartella Email per azienda, righe divisorie per @nomequalcosa)

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Loader } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const EmailPage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!getAuthHeader) return;
      try {
        setLoadingCompanies(true);
        const response = await fetch(buildApiUrl('/api/network-monitoring/all-clients'), {
          headers: getAuthHeader()
        });
        if (response.ok) {
          const data = await response.json();
          const seen = new Set();
          const unique = (data || []).filter(c => {
            const name = (c.azienda || '').trim();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });
          setCompanies(unique);
        }
      } catch (err) {
        console.error('Errore caricamento aziende:', err);
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, [getAuthHeader]);

  useEffect(() => {
    if (selectedCompanyId && companies.length > 0 && !loadingCompanies) {
      loadEmailData();
    } else if (!selectedCompanyId) {
      setItems([]);
      setError(null);
      setHasSearched(false);
    }
  }, [selectedCompanyId, companies, loadingCompanies]);

  const loadEmailData = async () => {
    if (!selectedCompanyId || !getAuthHeader) {
      setError('Seleziona un\'azienda');
      return;
    }

    const company = companies.find(c => String(c.id) === String(selectedCompanyId));
    if (!company) {
      setError('Azienda non trovata');
      return;
    }

    const aziendaName = (company.azienda || '').split(':')[0].trim();
    setLoading(true);
    setError(null);
    setItems([]);

    try {
      const response = await fetch(buildApiUrl(`/api/keepass/email/${encodeURIComponent(aziendaName)}`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setError('Cartella Email non trovata in KeePass per questa azienda');
        } else {
          setError(errData.error || 'Errore nel caricamento');
        }
        setHasSearched(true);
        return;
      }

      const data = await response.json();
      setItems(data.items || []);
      setHasSearched(true);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento');
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
            title="Chiudi Email"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Mail size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Email</h1>
              <p className="text-sm text-gray-600">Domini e caselle da KeePass</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Azienda</label>
            <select
              value={selectedCompanyId || ''}
              onChange={(e) => setSelectedCompanyId(e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
            >
              <option value="">Seleziona azienda</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.azienda || `ID ${c.id}`}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {items.length > 0 && (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Titolo</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Nome Utente</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">URL</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Scadenza</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    if (item.type === 'divider') {
                      return (
                        <tr key={`div-${idx}`} className="bg-sky-100 border-y border-sky-200">
                          <td colSpan={4} className="py-2 px-4 font-medium text-sky-800">
                            {item.name || '—'}
                          </td>
                        </tr>
                      );
                    }
                    const expiresDate = item.expires ? new Date(item.expires) : null;
                    const isExpired = expiresDate && expiresDate < new Date();
                    const formatScadenza = (d) => {
                      if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '—';
                      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    };
                    return (
                      <tr
                        key={`ent-${idx}`}
                        className={`border-b border-gray-100 ${isExpired ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-2 px-4 text-gray-900">{item.title || '—'}</td>
                        <td className="py-2 px-4 text-gray-600 font-mono">{item.username || '—'}</td>
                        <td className="py-2 px-4 text-gray-600 truncate max-w-[280px]" title={item.url || ''}>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {item.url}
                            </a>
                          ) : '—'}
                        </td>
                        <td className={`py-2 px-4 whitespace-nowrap ${isExpired ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                          {formatScadenza(expiresDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && items.length === 0 && !error && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
              {hasSearched
                ? 'Nessuna voce nella cartella Email per questa azienda.'
                : 'Seleziona un\'azienda e clicca "Carica Email" per vedere la cartella Email da KeePass.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailPage;
