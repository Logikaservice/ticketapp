// frontend/src/components/Modals/KeepassCredentialsModal.jsx

import React, { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, Copy, Check, ChevronDown, ChevronRight, Lock, Globe, User, FileText } from 'lucide-react';

const KeepassCredentialsModal = ({ isOpen, onClose, currentUser, getAuthHeader }) => {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedPasswords, setCopiedPasswords] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchCredentials();
    }
  }, [isOpen, currentUser]);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const authHeader = getAuthHeader();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/keepass/credentials`, {
        headers: {
          ...authHeader,
          'x-user-id': currentUser?.id?.toString() || authHeader['x-user-id'] || '',
          'x-user-role': currentUser?.ruolo || ''
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel recupero delle credenziali');
      }

      const data = await response.json();
      setCredentials(data.groups || []);
    } catch (err) {
      console.error('Errore fetch credenziali:', err);
      setError(err.message || 'Errore nel caricamento delle credenziali');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = async (entryId) => {
    console.log('👁️ Toggle password visibility per entryId:', entryId);
    
    if (visiblePasswords[entryId]) {
      console.log('🔒 Nascondo password per entryId:', entryId);
      setVisiblePasswords(prev => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
      return;
    }

    // Altrimenti, decifra la password
    try {
      console.log('🔓 Decifro password per entryId:', entryId);
      const authHeader = getAuthHeader();
      console.log('🔑 Auth header:', { 
        hasAuth: !!authHeader.Authorization, 
        userId: currentUser?.id,
        role: currentUser?.ruolo 
      });
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/keepass/decrypt-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
          'x-user-id': currentUser?.id?.toString() || authHeader['x-user-id'] || '',
          'x-user-role': currentUser?.ruolo || ''
        },
        body: JSON.stringify({ entryId })
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore response:', errorData);
        throw new Error(errorData.details || errorData.error || 'Errore nella decifratura della password');
      }

      const data = await response.json();
      console.log('✅ Password decifrata, lunghezza:', data.password?.length || 0);
      
      if (data.warning) {
        console.warn('⚠️', data.warning);
        alert('Password vuota o non cifrata. Contatta il tecnico per reimportare il file XML.');
      }
      
      setVisiblePasswords(prev => ({
        ...prev,
        [entryId]: data.password || ''
      }));
    } catch (err) {
      console.error('❌ Errore decifratura password:', err);
      alert(`Errore nel recupero della password: ${err.message}`);
    }
  };

  const copyPassword = async (entryId) => {
    console.log('📋 Copia password per entryId:', entryId);
    
    if (!visiblePasswords[entryId]) {
      console.log('🔓 Password non visibile, decifro prima...');
      try {
        const authHeader = getAuthHeader();
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/keepass/decrypt-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader,
            'x-user-id': currentUser?.id?.toString() || authHeader['x-user-id'] || '',
            'x-user-role': currentUser?.ruolo || ''
          },
          body: JSON.stringify({ entryId })
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Errore response:', errorData);
          throw new Error(errorData.details || errorData.error || 'Errore nella decifratura della password');
        }

        const data = await response.json();
        const password = data.password;
        console.log('✅ Password decifrata, lunghezza:', password?.length || 0);
        
        setVisiblePasswords(prev => ({
          ...prev,
          [entryId]: password
        }));
        
        await navigator.clipboard.writeText(password);
        console.log('✅ Password copiata negli appunti');
        setCopiedPasswords(prev => ({ ...prev, [entryId]: true }));
        setTimeout(() => {
          setCopiedPasswords(prev => {
            const next = { ...prev };
            delete next[entryId];
            return next;
          });
        }, 2000);
      } catch (err) {
        console.error('❌ Errore copia password:', err);
        alert(`Errore nel recupero della password: ${err.message}`);
      }
      return;
    }

    console.log('📋 Copio password già visibile');
    await navigator.clipboard.writeText(visiblePasswords[entryId]);
    console.log('✅ Password copiata negli appunti');
    setCopiedPasswords(prev => ({ ...prev, [entryId]: true }));
    setTimeout(() => {
      setCopiedPasswords(prev => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    }, 2000);
  };

  // Helper: Estrae stringa da campo che potrebbe essere oggetto JSON
  const extractString = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
      // Se è una stringa JSON, prova a parsarla
      if (value.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(value);
          return parsed._ !== undefined ? String(parsed._ || '') : value;
        } catch {
          return value;
        }
      }
      return value;
    }
    if (typeof value === 'object') {
      // Se è un oggetto, estrai il valore da _
      return value._ !== undefined ? String(value._ || '') : JSON.stringify(value);
    }
    return String(value || '');
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Key size={28} />
                Credenziali KeePass
              </h2>
              <p className="text-indigo-100 text-sm mt-1">
                Gestisci e visualizza le tue credenziali salvate
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-600">Caricamento credenziali...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center gap-2 text-red-600">
                <Key size={20} />
                <span>{error}</span>
              </div>
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-8">
              <Key size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Nessuna credenziale disponibile</p>
            </div>
          ) : (
            <div className="space-y-2">
              {credentials.map(group => {
                const isExpanded = expandedGroups.has(group.id);
                const hasEntries = group.entries && group.entries.length > 0;

                return (
                  <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Header Gruppo */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        {hasEntries ? (
                          isExpanded ? (
                            <ChevronDown size={16} className="text-indigo-600" />
                          ) : (
                            <ChevronRight size={16} className="text-indigo-600" />
                          )
                        ) : (
                          <div className="w-4" />
                        )}
                        <Key size={16} className="text-indigo-600" />
                        <span className="font-semibold text-gray-800">{extractString(group.name)}</span>
                        {hasEntries && (
                          <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
                            {group.entries.length} {group.entries.length === 1 ? 'credenziale' : 'credenziali'}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Entry del Gruppo */}
                    {isExpanded && hasEntries && (
                      <div className="bg-gray-50 border-t border-gray-200">
                        {group.entries.map(entry => (
                          <div key={entry.id} className="p-4 border-b border-gray-200 last:border-b-0">
                            <div className="space-y-3">
                              {/* Titolo */}
                              {entry.title && (
                                <div className="flex items-center gap-2">
                                  <FileText size={14} className="text-gray-400" />
                                  <span className="font-medium text-gray-900">{extractString(entry.title)}</span>
                                </div>
                              )}

                              {/* Username */}
                              {entry.username && (
                                <div className="flex items-center gap-2">
                                  <User size={14} className="text-gray-400" />
                                  <span className="text-sm text-gray-700">{extractString(entry.username)}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(extractString(entry.username));
                                      alert('Username copiato!');
                                    }}
                                    className="ml-auto p-1 text-gray-400 hover:text-gray-600"
                                    title="Copia username"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>
                              )}

                              {/* Password */}
                              <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                                <Lock size={14} className="text-gray-400" />
                                <span className="text-sm font-mono flex-1">
                                  {visiblePasswords[entry.id] ? (
                                    <span className="text-gray-900">{visiblePasswords[entry.id]}</span>
                                  ) : (
                                    <span className="text-gray-400">••••••••</span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => togglePasswordVisibility(entry.id)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                    title={visiblePasswords[entry.id] ? 'Nascondi password' : 'Mostra password'}
                                  >
                                    {visiblePasswords[entry.id] ? (
                                      <EyeOff size={16} />
                                    ) : (
                                      <Eye size={16} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => copyPassword(entry.id)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                    title="Copia password"
                                  >
                                    {copiedPasswords[entry.id] ? (
                                      <Check size={16} className="text-green-600" />
                                    ) : (
                                      <Copy size={16} />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* URL */}
                              {entry.url && (
                                <div className="flex items-center gap-2">
                                  <Globe size={14} className="text-gray-400" />
                                  <a
                                    href={extractString(entry.url).startsWith('http') ? extractString(entry.url) : `http://${extractString(entry.url)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline"
                                  >
                                    {extractString(entry.url)}
                                  </a>
                                </div>
                              )}

                              {/* Notes */}
                              {entry.notes && (
                                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                  {extractString(entry.notes)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && !hasEntries && (
                      <div className="p-4 bg-gray-50 text-center text-sm text-gray-500">
                        Nessuna credenziale in questo gruppo
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeepassCredentialsModal;

