// frontend/src/pages/EmailPage.jsx
// Pagina Email - struttura da KeePass (cartella Email per azienda, righe divisorie per @nomequalcosa)
// Scadenza editabile come Anti-Virus (salvata nel DB, non KeePass)

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const EmailPage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [drafts, setDrafts] = useState({}); // { key: { expiration_date } } per editing scadenza

  const entryKey = (item) => `${item.title || ''}|${item.username || ''}|${item.url || ''}|${item.divider || ''}`;

  const updateDraft = (key, field, value) => {
    setDrafts(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSaveExpiry = async (item, currentValue) => {
    if (!companyName) return;
    const expiration_date = (currentValue !== undefined ? currentValue : drafts[entryKey(item)]?.expiration_date) || null;
    const key = entryKey(item);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/email-expiry'), {
        method: 'PUT',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aziendaName: companyName,
          title: item.title || '',
          username: item.username || '',
          url: item.url || '',
          divider: item.divider || '',
          expiration_date: expiration_date || null
        })
      });
      if (res.ok) {
        setItems(prev => prev.map(it => {
          if (it.type === 'entry' && entryKey(it) === key) {
            return { ...it, expires: expiration_date ? new Date(expiration_date).toISOString() : null };
          }
          return it;
        }));
      }
    } catch (e) {
      console.error('Errore salvataggio scadenza:', e);
    }
  };

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
      setCompanyName('');
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
    setDrafts({});

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
      const itemsList = data.items || [];
      setItems(itemsList);

      // Inizializza drafts per le entry (scadenza editabile)
      const initialDrafts = {};
      itemsList.forEach((item) => {
        if (item.type === 'entry') {
          const key = entryKey(item);
          initialDrafts[key] = {
            expiration_date: item.expires ? item.expires.split('T')[0] : ''
          };
        }
      });
      setDrafts(initialDrafts);
      setHasSearched(true);
      setCompanyName(aziendaName);
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
          <div>
            <h1 className="text-xl font-bold text-gray-900">Email</h1>
            <p className="text-sm text-gray-600">{companyName || 'Seleziona un\'azienda'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!loadingCompanies && (
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedCompanyId || ''}
              onChange={async (e) => {
                const newCompanyId = e.target.value || null;
                setSelectedCompanyId(newCompanyId);
                setError(null);
                setItems([]);
                setCompanyName('');
                if (newCompanyId) {
                  const company = companies.find(c => String(c.id) === String(newCompanyId));
                  if (company) {
                    setCompanyName((company.azienda || '').split(':')[0].trim());
                  }
                }
              }}
            >
              <option value="">Seleziona Azienda...</option>
              {companies.map(c => (
                <option key={c.id} value={String(c.id)}>{c.azienda || `ID ${c.id}`}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {loadingCompanies && (
            <div className="flex justify-center items-center py-12">
              <Loader size={32} className="animate-spin text-blue-600 mr-3" />
              <span className="text-gray-600">Caricamento aziende...</span>
            </div>
          )}

          {!loadingCompanies && error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {!loadingCompanies && items.length > 0 && (
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
                    const key = entryKey(item);
                    const draft = drafts[key] || { expiration_date: item.expires ? item.expires.split('T')[0] : '' };
                    const expiresDate = draft.expiration_date ? new Date(draft.expiration_date) : null;
                    const isExpired = expiresDate && expiresDate < new Date(new Date().setHours(0, 0, 0, 0));
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
                          <input
                            type="date"
                            className="w-full max-w-[140px] border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={draft.expiration_date || ''}
                            onChange={(e) => updateDraft(key, 'expiration_date', e.target.value)}
                            onBlur={(e) => handleSaveExpiry(item, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loadingCompanies && !selectedCompanyId && (
            <div className="max-w-2xl mx-auto mt-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <div>
                  <h3 className="font-semibold text-blue-800 mb-1">Seleziona un'azienda</h3>
                  <p className="text-blue-700">Seleziona un'azienda dal menu in alto per visualizzare la cartella Email da KeePass.</p>
                </div>
              </div>
            </div>
          )}

          {!loadingCompanies && loading && selectedCompanyId && (
            <div className="flex justify-center items-center py-12">
              <Loader size={32} className="animate-spin text-blue-600 mr-3" />
              <span className="text-gray-600">Caricamento Email da KeePass...</span>
            </div>
          )}

          {!loadingCompanies && selectedCompanyId && !loading && items.length === 0 && !error && hasSearched && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
              Nessuna voce nella cartella Email per questa azienda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailPage;
