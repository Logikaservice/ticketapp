// frontend/src/components/KeepassCredentials.jsx

import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Copy, Check, ChevronDown, ChevronRight, Lock, Globe, User, FileText } from 'lucide-react';

const KeepassCredentials = ({ currentUser, getAuthHeader }) => {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedPasswords, setCopiedPasswords] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    fetchCredentials();
  }, [currentUser]);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const authHeader = getAuthHeader();
      // L'endpoint usa req.user dal middleware authenticateToken, quindi passiamo solo l'header Authorization
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
    // Se la password è già visibile, nascondila
    if (visiblePasswords[entryId]) {
      setVisiblePasswords(prev => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
      return;
    }

    // Altrimenti, decifra la password
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

      if (!response.ok) {
        throw new Error('Errore nella decifratura della password');
      }

      const data = await response.json();
      setVisiblePasswords(prev => ({
        ...prev,
        [entryId]: data.password
      }));
    } catch (err) {
      console.error('Errore decifratura password:', err);
      alert('Errore nel recupero della password');
    }
  };

  const copyPassword = async (entryId) => {
    // Se la password non è già visibile, decifrala prima
    if (!visiblePasswords[entryId]) {
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

        if (!response.ok) {
          throw new Error('Errore nella decifratura della password');
        }

        const data = await response.json();
        const password = data.password;
        
        // Mostra la password e copiala
        setVisiblePasswords(prev => ({
          ...prev,
          [entryId]: password
        }));
        
        navigator.clipboard.writeText(password);
        setCopiedPasswords(prev => ({ ...prev, [entryId]: true }));
        setTimeout(() => {
          setCopiedPasswords(prev => {
            const next = { ...prev };
            delete next[entryId];
            return next;
          });
        }, 2000);
      } catch (err) {
        console.error('Errore copia password:', err);
        alert('Errore nel recupero della password');
      }
      return;
    }

    // Se è già visibile, copiala direttamente
    navigator.clipboard.writeText(visiblePasswords[entryId]);
    setCopiedPasswords(prev => ({ ...prev, [entryId]: true }));
    setTimeout(() => {
      setCopiedPasswords(prev => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    }, 2000);
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Caricamento credenziali...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <Key size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (credentials.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center py-8">
          <Key size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Nessuna credenziale disponibile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Key size={20} className="text-indigo-600" />
          Credenziali KeePass
        </h3>
        <button
          onClick={fetchCredentials}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Aggiorna
        </button>
      </div>

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
                  {hasEntries && (
                    isExpanded ? (
                      <ChevronDown size={16} className="text-indigo-600" />
                    ) : (
                      <ChevronRight size={16} className="text-indigo-600" />
                    )
                  )}
                  <Key size={16} className="text-indigo-600" />
                  <span className="font-semibold text-gray-800">{group.name}</span>
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
                            <span className="font-medium text-gray-900">{entry.title}</span>
                          </div>
                        )}

                        {/* Username */}
                        {entry.username && (
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-700">{entry.username}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(entry.username);
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
                              href={entry.url.startsWith('http') ? entry.url : `http://${entry.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {entry.url}
                            </a>
                          </div>
                        )}

                        {/* Notes */}
                        {entry.notes && (
                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            {entry.notes}
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
    </div>
  );
};

export default KeepassCredentials;

