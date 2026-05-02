// frontend/src/components/Modals/KeepassCredentialsModal.jsx

import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Copy, Check, ChevronDown, ChevronRight, Lock, Globe, User, FileText } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalChromeFooter,
  HubModalPrimaryButton
} from './HubModalChrome';

const KeepassCredentialsModal = ({ isOpen, onClose, currentUser, getAuthHeader, highlightEntryId = null }) => {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedPasswords, setCopiedPasswords] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [highlightedEntryId, setHighlightedEntryId] = useState(null);
  const highlightedEntryRef = React.useRef(null);
  const hasScrolledToHighlight = React.useRef(false);

  useEffect(() => {
    if (isOpen) {
      setHighlightedEntryId(highlightEntryId);
      hasScrolledToHighlight.current = false;
      highlightedEntryRef.current = null;
      fetchCredentials();
    } else {
      // Reset quando il modal si chiude
      hasScrolledToHighlight.current = false;
      highlightedEntryRef.current = null;
    }
  }, [isOpen, currentUser, highlightEntryId]);
  
  // Scroll una sola volta quando l'entry evidenziata è renderizzata
  useEffect(() => {
    if (highlightedEntryId && highlightedEntryRef.current && !hasScrolledToHighlight.current) {
      hasScrolledToHighlight.current = true;
      setTimeout(() => {
        if (highlightedEntryRef.current) {
          highlightedEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightedEntryId, expandedGroups]);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const authHeader = getAuthHeader();
      const response = await fetch(buildApiUrl('/api/keepass/credentials'), {
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
      
      console.log('📥 Dati ricevuti dal backend:', data);
      console.log('📥 Numero gruppi root:', data.groups?.length || 0);
      
      if (data.groups && data.groups.length > 0) {
        console.log('📥 Primo gruppo:', {
          id: data.groups[0].id,
          name: data.groups[0].name,
          entries: data.groups[0].entries?.length || 0,
          children: data.groups[0].children?.length || 0,
          parent_id: data.groups[0].parent_id
        });
      }
      
      // Funzione ricorsiva per filtrare entry e gruppi
      const filterGroup = (group) => {
        // Filtra SOLO entry con password vuote o in formato non valido
        // NON filtrare per titolo vuoto - mostreremo l'entry ma nasconderemo il campo titolo
        const filteredEntries = (group.entries || []).filter(entry => {
          // Verifica se la password è vuota o in formato non valido
          // Se c'è una password valida, mostra l'entry (anche se titolo o username sono vuoti)
          const password = entry.password_encrypted;
          if (!password || password.trim() === '') {
            return false; // Escludi entry senza password
          }
          // Se è una stringa JSON (oggetto), escludila
          if (typeof password === 'string' && password.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(password);
              // Se ha solo attributi senza valore, escludila
              if (parsed.$ && Object.keys(parsed).length === 1) {
                return false;
              }
              // Se non ha campo _, escludila
              if (parsed._ === undefined || parsed._ === '') {
                return false;
              }
            } catch {
              // Se non è JSON valido ma non contiene ':', escludila
              if (!password.includes(':')) {
                return false;
              }
            }
          }
          // Se non contiene ':' (formato iv:encrypted), escludila
          if (!password.includes(':')) {
            return false;
          }
          return true; // Mantieni entry con password valida
        });
        
        // Filtra ricorsivamente i children
        const filteredChildren = (group.children || []).map(child => filterGroup(child)).filter(child => {
          // Mantieni gruppi che hanno entry valide O children validi (anche se i children non hanno entries)
          const hasValidEntries = child.entries && child.entries.length > 0;
          const hasValidChildren = child.children && child.children.length > 0;
          const shouldKeep = hasValidEntries || hasValidChildren;
          
          if (!shouldKeep && (group.children || []).length > 0) {
            console.log(`🗑️ Gruppo child "${child.name}" filtrato (no entries: ${!hasValidEntries}, no children: ${!hasValidChildren})`);
          }
          
          return shouldKeep;
        });
        
        return {
          ...group,
          entries: filteredEntries,
          children: filteredChildren
        };
      };
      
      // Applica il filtro a tutti i gruppi root
      const filteredGroups = (data.groups || []).map(group => filterGroup(group)).filter(group => {
        // Mantieni gruppi che hanno entry valide O children validi (anche se i children non hanno entries)
        const hasValidEntries = group.entries && group.entries.length > 0;
        const hasValidChildren = group.children && group.children.length > 0;
        const shouldKeep = hasValidEntries || hasValidChildren;
        
        if (!shouldKeep) {
          console.log(`🗑️ Gruppo root "${group.name}" filtrato (no entries: ${!hasValidEntries}, no children: ${!hasValidChildren})`);
        }
        
        return shouldKeep;
      });
      
      console.log('📊 Gruppi filtrati:', filteredGroups.length, 'gruppi root');
      console.log('📊 Dettagli:', filteredGroups.map(g => ({ name: g.name, entries: g.entries?.length || 0, children: g.children?.length || 0 })));
      
      if (filteredGroups.length === 0 && data.groups && data.groups.length > 0) {
        console.warn('⚠️ ATTENZIONE: Tutti i gruppi sono stati filtrati!');
        console.warn('⚠️ Gruppi originali:', data.groups.map(g => ({
          name: g.name,
          entries: g.entries?.length || 0,
          children: g.children?.length || 0,
          entriesDetails: g.entries?.map(e => ({
            id: e.id,
            title: e.title,
            passwordType: typeof e.password_encrypted,
            passwordLength: e.password_encrypted?.length || 0,
            passwordPreview: e.password_encrypted?.substring(0, 50) || 'vuoto'
          })) || []
        })));
      }
      
      setCredentials(filteredGroups);
      
      // Se c'è un highlightEntryId, espandi i gruppi e evidenzia l'entry
      if (highlightEntryId) {
        setHighlightedEntryId(highlightEntryId);
        // Trova il gruppo che contiene l'entry e espandilo
        const findAndExpandGroup = (groups) => {
          for (const group of groups) {
            if (group.entries && group.entries.some(e => e.id === highlightEntryId)) {
              setExpandedGroups(prev => new Set([...prev, group.id]));
              return true;
            }
            if (group.children) {
              if (findAndExpandGroup(group.children)) {
                setExpandedGroups(prev => new Set([...prev, group.id]));
                return true;
              }
            }
          }
          return false;
        };
        findAndExpandGroup(filteredGroups);
      }
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
      
      const response = await fetch(buildApiUrl('/api/keepass/decrypt-password'), {
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
        const response = await fetch(buildApiUrl('/api/keepass/decrypt-password'), {
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

  // Funzione ricorsiva per verificare se un gruppo ha credenziali effettive (dirette o nei children)
  const hasActualCredentials = (group) => {
    // Verifica se ha entries dirette
    if (group.entries && group.entries.length > 0) {
      return true;
    }
    // Verifica ricorsivamente nei children
    if (group.children && group.children.length > 0) {
      return group.children.some(child => hasActualCredentials(child));
    }
    return false;
  };

  // Funzione ricorsiva per renderizzare i gruppi in struttura ad albero
  const renderGroup = (group, level = 0) => {
    const isExpanded = expandedGroups.has(group.id);
    const hasEntries = group.entries && group.entries.length > 0;
    const hasChildren = group.children && group.children.length > 0;
    const hasCredentials = hasActualCredentials(group);

    return (
      <div key={group.id} className="mb-2">
        <div className="overflow-hidden rounded-lg border border-white/10">
          {/* Header Gruppo */}
          <button
            type="button"
            onClick={() => toggleGroup(group.id)}
            className="flex w-full items-center justify-between bg-black/25 px-4 py-3 text-left transition hover:bg-black/35"
            style={{ paddingLeft: `${1 + level * 1.5}rem` }}
          >
            <div className="flex items-center gap-2">
              {hasCredentials && (
                isExpanded ? (
                  <ChevronDown size={16} className="text-[color:var(--hub-accent)]" aria-hidden />
                ) : (
                  <ChevronRight size={16} className="text-[color:var(--hub-accent)]" aria-hidden />
                )
              )}
              <Key size={16} className="text-[color:var(--hub-accent)]" aria-hidden />
              <span className="font-semibold text-white">{extractString(group.name)}</span>
              {hasEntries && (
                <span className="rounded bg-black/30 px-2 py-0.5 text-xs text-white/65 ring-1 ring-white/10">
                  {group.entries.length} {group.entries.length === 1 ? 'credenziale' : 'credenziali'}
                </span>
              )}
            </div>
          </button>

          {/* Entry del Gruppo */}
          {isExpanded && hasEntries && (
            <div className="border-t border-white/10 bg-black/15" style={{ paddingLeft: `${1 + level * 1.5}rem` }}>
              {group.entries.map(entry => {
                const isHighlighted = highlightedEntryId === entry.id;
                return (
                <div 
                  key={entry.id} 
                  className={`border-b border-white/10 p-4 last:border-b-0 ${isHighlighted ? 'border-l-4 border-l-[color:var(--hub-accent)] bg-[color:var(--hub-accent)]/12' : ''}`}
                  ref={isHighlighted ? highlightedEntryRef : null}
                >
                  <div className="space-y-3">
                    {/* Titolo - mostra solo se esiste e non è vuoto o "Senza titolo" */}
                    {(() => {
                      const title = extractString(entry.title);
                      const hasValidTitle = title && title.trim() !== '' && title.trim().toLowerCase() !== 'senza titolo';
                      return hasValidTitle ? (
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-white/45" aria-hidden />
                          <span className="font-medium text-white">{title}</span>
                        </div>
                      ) : null;
                    })()}

                    {/* Username - mostra solo se esiste e non è vuoto */}
                    {(() => {
                      const username = extractString(entry.username);
                      const hasValidUsername = username && username.trim() !== '';
                      return hasValidUsername ? (
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-white/45" aria-hidden />
                          <span className="text-sm text-white/78">{username}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(username);
                              alert('Username copiato!');
                            }}
                            className="ml-auto p-1 text-white/45 hover:text-white/75"
                            title="Copia username"
                          >
                            <Copy size={14} aria-hidden />
                          </button>
                        </div>
                      ) : null;
                    })()}

                    {/* Password */}
                    <div className="flex items-center gap-2 rounded border border-white/10 bg-black/25 p-2">
                      <Lock size={14} className="text-white/45" aria-hidden />
                      <span className="flex-1 font-mono text-sm">
                        {visiblePasswords[entry.id] ? (
                          <span className="text-white">{visiblePasswords[entry.id]}</span>
                        ) : (
                          <span className="text-white/38">••••••••</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(entry.id)}
                          className="p-1 text-white/45 hover:text-white/75"
                          title={visiblePasswords[entry.id] ? 'Nascondi password' : 'Mostra password'}
                        >
                          {visiblePasswords[entry.id] ? (
                            <EyeOff size={16} aria-hidden />
                          ) : (
                            <Eye size={16} aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyPassword(entry.id)}
                          className="p-1 text-white/45 hover:text-white/75"
                          title="Copia password"
                        >
                          {copiedPasswords[entry.id] ? (
                            <Check size={16} className="text-emerald-400" aria-hidden />
                          ) : (
                            <Copy size={16} aria-hidden />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* URL */}
                    {entry.url && (
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-white/45" aria-hidden />
                        <a
                          href={extractString(entry.url).startsWith('http') ? extractString(entry.url) : `http://${extractString(entry.url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-sky-300 hover:underline"
                        >
                          {extractString(entry.url)}
                        </a>
                      </div>
                    )}

                    {/* Notes */}
                    {entry.notes && (
                      <div className="rounded bg-black/20 p-2 text-xs text-white/65">
                        {extractString(entry.notes)}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Sottogruppi (children) - SEMPRE VISIBILI nella struttura gerarchica */}
          {hasChildren && (
            <div className="border-t border-white/10 bg-black/15">
              <div className="space-y-2 p-2">
                {group.children.map(childGroup => renderGroup(childGroup, level + 1))}
              </div>
            </div>
          )}

          {isExpanded && !hasEntries && !hasChildren && (
            <div className="bg-black/15 p-4 text-center text-sm text-white/45">
              Nessuna credenziale in questo gruppo
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <HubModalInnerCard maxWidthClass="max-w-4xl" className="flex max-h-[90vh] flex-col overflow-hidden">
        <HubModalChromeHeader
          icon={Key}
          title="Credenziali KeePass"
          subtitle="Gestisci e visualizza le tue credenziali salvate"
          onClose={onClose}
        />

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[color:var(--hub-accent)]" aria-hidden />
              <span className="ml-3 text-white/65">Caricamento credenziali...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/15 p-6">
              <div className="flex items-center gap-2 text-red-50">
                <Key size={20} aria-hidden />
                <span>{error}</span>
              </div>
            </div>
          ) : credentials.length === 0 ? (
            <div className="py-8 text-center">
              <Key size={48} className="mx-auto mb-4 text-white/25" aria-hidden />
              <p className="text-white/55">Nessuna credenziale disponibile</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Renderizza ricorsivamente i gruppi in struttura ad albero */}
              {credentials.map(group => renderGroup(group, 0))}
            </div>
          )}
        </div>

        {/* Footer */}
        <HubModalChromeFooter className="justify-end">
          <HubModalPrimaryButton type="button" onClick={onClose}>
            Chiudi
          </HubModalPrimaryButton>
        </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default KeepassCredentialsModal;

