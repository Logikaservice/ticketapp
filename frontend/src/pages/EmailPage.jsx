// frontend/src/pages/EmailPage.jsx
// Pagina Email - struttura da KeePass (cartella Email per azienda, righe divisorie per @nomequalcosa)
// Scadenza letta da KeePass (entry.times.expiryTime); riga in rosso se scaduta

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader, MessageCircle } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import EmailIntroCard from '../components/EmailIntroCard';

const EmailPage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId, currentUser, onOpenTicket }) => {
  const isCliente = currentUser?.ruolo === 'cliente';
  const showAssistenzaButton = isCliente && typeof onOpenTicket === 'function';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const entryKey = (item) => `${item.title || ''}|${item.username || ''}|${item.url || ''}|${item.divider || ''}`;

  const formatExpiry = (expires) => {
    if (!expires) return '—';
    try {
      const d = new Date(expires);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '—';
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
          {!loadingCompanies && (isCliente ? !!selectedCompanyId : true) && (
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
                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Titolo</th>
                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Nome Utente</th>
                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">URL</th>
                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Scadenza</th>
                    {showAssistenzaButton && <th className="text-left py-1.5 px-3 font-semibold text-gray-700 w-32">Assistenza</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let currentLevel = 0;
                    let lastDomainLevel0 = null;
                    const domainFromName = (n) => (n || '').replace(/^@/, '').trim().toLowerCase();
                    const isSubOf = (subName, domainName) => {
                      const d = domainFromName(domainName);
                      const s = (subName || '').toLowerCase();
                      return s === d || s.endsWith('.' + d);
                    };
                    const withLevel = items.map((it) => {
                      if (it.type === 'divider') {
                        const name = (it.name || '').trim();
                        const nestedByTree = it.level === 1;
                        const nestedByName = lastDomainLevel0 != null && name && isSubOf(name, lastDomainLevel0);
                        const isNested = nestedByTree || nestedByName;
                        if (!isNested) lastDomainLevel0 = name;
                        currentLevel = isNested ? 1 : 0;
                        return { ...it, _level: currentLevel };
                      }
                      return { ...it, _level: currentLevel };
                    });
                    return withLevel;
                  })().map((item, idx) => {
                    const isNested = item._level === 1;
                    if (item.type === 'divider') {
                      return (
                        <tr
                          key={`div-${idx}`}
                          className={`bg-sky-100 border-y border-sky-200 ${isNested ? 'border-l-4 border-l-sky-400 bg-sky-50' : ''}`}
                        >
                          <td
                            colSpan={showAssistenzaButton ? 5 : 4}
                            className={`py-1 px-3 font-medium text-sky-800 ${isNested ? 'pl-10' : ''}`}
                          >
                            {isNested && <span className="text-sky-600 mr-2">└</span>}
                            {item.name || '—'}
                          </td>
                        </tr>
                      );
                    }
                    const key = entryKey(item);
                    const expiresDate = item.expires ? new Date(item.expires) : null;
                    const isExpired = expiresDate && !isNaN(expiresDate.getTime()) && expiresDate < new Date();
                    const rowClass = isNested
                      ? 'border-b border-gray-100 border-l-4 border-l-sky-300 bg-sky-50/50 hover:bg-sky-50'
                      : `border-b border-gray-100 ${isExpired ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`;
                    const cellPad = isNested ? 'py-1 px-3 pl-10' : 'py-1 px-3';
                    return (
                      <tr key={`ent-${idx}`} className={rowClass}>
                        <td className={`${cellPad} text-gray-900`}>
                          {isNested && <span className="text-sky-500 mr-2">└</span>}
                          {item.title || '—'}
                        </td>
                        <td className={`${cellPad} text-gray-600 font-mono`}>{item.username || '—'}</td>
                        <td className={`${cellPad} text-gray-600 truncate max-w-[280px]`} title={item.url || ''}>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {item.url}
                            </a>
                          ) : '—'}
                        </td>
                        <td className={`${cellPad} whitespace-nowrap ${isExpired ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                          {item.expires ? (
                            <span title={isExpired ? 'Scaduta' : ''}>
                              {formatExpiry(item.expires)}
                              {isExpired ? ' (scaduta)' : ''}
                            </span>
                          ) : '—'}
                        </td>
                        {showAssistenzaButton && (
                          <td className={cellPad}>
                            <button
                              type="button"
                              onClick={() => onOpenTicket({
                                titolo: `Assistenza Email - ${(item.title || item.username || 'Account').toString().trim()}`,
                                descrizione: `Richiesta assistenza relativa all'account email:\n\nTitolo: ${item.title || '—'}\nUtente: ${item.username || '—'}\nURL: ${item.url || '—'}\nAzienda: ${companyName || '—'}`
                              })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                              title="Apri un ticket di assistenza"
                            >
                              <MessageCircle size={14} />
                              Apri ticket
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loadingCompanies && !selectedCompanyId && (
            <div className="w-full">
              <EmailIntroCard
                companies={companies}
                value={selectedCompanyId || ''}
                onChange={(companyId) => {
                  const newCompanyId = companyId || null;
                  setSelectedCompanyId(newCompanyId);
                  setError(null);
                  setItems([]);
                  setCompanyName('');
                  if (newCompanyId) {
                    const company = companies.find(c => String(c.id) === String(newCompanyId));
                    if (company) setCompanyName((company.azienda || '').split(':')[0].trim());
                  }
                }}
              />
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
