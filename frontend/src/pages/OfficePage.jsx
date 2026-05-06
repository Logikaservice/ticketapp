// frontend/src/pages/OfficePage.jsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader, Calendar, X, Eye, EyeOff, RefreshCw, ArrowLeft, Plus, Trash2, GripVertical, Copy, Search } from 'lucide-react';
import SectionNavMenu from '../components/SectionNavMenu';
import { buildApiUrl } from '../utils/apiConfig';
import OfficeIntroCard from '../components/OfficeIntroCard';
import {
  hexToRgba,
  normalizeHex,
  getStoredTechHubAccent,
  hubEmbeddedRootInlineStyle,
  hubEmbeddedBackBtnInlineStyle
} from '../utils/techHubAccent';
import { getOfficeContentTheme } from '../utils/officePageContentTheme';

const OfficePage = ({
  onClose,
  getAuthHeader,
  selectedCompanyId: initialCompanyId,
  initialCompanyName,
  onCompanyChange,
  currentUser,
  onOpenTicket,
  onNavigateEmail,
  onNavigateAntiVirus,
  onNavigateDispositiviAziendali,
  onNavigateNetworkMonitoring,
  onNavigateMappatura,
  onNavigateSpeedTest,
  onNavigateVpn,
  onNavigateHome,
  embedded = false,
  closeEmbedded,
  accentHex: accentHexProp,
  hubSurfaceMode: hubSurfaceModeProp = 'dark',
  hubRefreshTick = 0,
  hubRefreshView = ''
}) => {
  const accent = useMemo(() => normalizeHex(accentHexProp) || getStoredTechHubAccent(), [accentHexProp]);
  const isCliente = currentUser?.ruolo === 'cliente';
  const isTecnico = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const showPasswordColumn = isTecnico || (currentUser?.ruolo === 'cliente' && currentUser?.admin_companies && currentUser.admin_companies.length > 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [officeData, setOfficeData] = useState(null);
  const [companyName, setCompanyName] = useState('');
  // Chiave usata nelle chiamate a KeePass (può includere suffissi/ID)
  const [companyKey, setCompanyKey] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [cardStatuses, setCardStatuses] = useState({});  // chiave = "title||username" → { note }
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [loadingPasswords, setLoadingPasswords] = useState({});
  const [activeView, setActiveView] = useState('licenses');
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [loadingDownloadLinks, setLoadingDownloadLinks] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [newDownload, setNewDownload] = useState({ title: '', description: '', links: [{ label: '', url: '' }] });
  const [savingDownload, setSavingDownload] = useState(false);
  const [editingDownloadId, setEditingDownloadId] = useState(null);
  const [editingDownload, setEditingDownload] = useState({ title: '', description: '', links: [{ label: '', url: '' }] });
  const [draggingDownloadId, setDraggingDownloadId] = useState(null);
  const [dragOverDownloadId, setDragOverDownloadId] = useState(null);
  const [activationGuides, setActivationGuides] = useState([]);
  const [loadingActivationGuides, setLoadingActivationGuides] = useState(false);
  const [activationError, setActivationError] = useState(null);
  const [newActivation, setNewActivation] = useState({ title: '', description: '', links: [{ label: '', url: '' }] });
  const [savingActivation, setSavingActivation] = useState(false);
  const [editingActivationId, setEditingActivationId] = useState(null);
  const [editingActivation, setEditingActivation] = useState({ title: '', description: '', links: [{ label: '', url: '' }] });
  const [draggingActivationId, setDraggingActivationId] = useState(null);
  const [dragOverActivationId, setDragOverActivationId] = useState(null);
  const [usefulGuidelines, setUsefulGuidelines] = useState([]);
  const [loadingUsefulGuidelines, setLoadingUsefulGuidelines] = useState(false);
  const [usefulGuidelinesError, setUsefulGuidelinesError] = useState(null);
  const [newUsefulGuideline, setNewUsefulGuideline] = useState({ title: '', description: '', links: [{ label: '', url: '' }] });
  const [savingUsefulGuideline, setSavingUsefulGuideline] = useState(false);
  const [editingUsefulGuidelineId, setEditingUsefulGuidelineId] = useState(null);
  const [editingUsefulGuideline, setEditingUsefulGuideline] = useState({ title: '', description: '', links: [{ label: '', url: '' }] });
  const [draggingUsefulGuidelineId, setDraggingUsefulGuidelineId] = useState(null);
  const [dragOverUsefulGuidelineId, setDragOverUsefulGuidelineId] = useState(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneSection, setCloneSection] = useState(null); // 'downloads' | 'activations' | 'useful-guidelines'
  const [cloneTargets, setCloneTargets] = useState([]);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneError, setCloneError] = useState(null);
  const [cloneQuery, setCloneQuery] = useState('');

  const companiesForClone = useMemo(() => {
    const q = String(cloneQuery || '').trim().toLowerCase();
    const list = (companies || []).filter((c) => c && c.id != null);
    if (!q) return list;
    return list.filter((c) => String(c.azienda || '').toLowerCase().includes(q));
  }, [companies, cloneQuery]);

  const openCloneModal = (section) => {
    if (!isTecnico) return;
    setCloneSection(section);
    setCloneTargets([]);
    setCloneError(null);
    setCloneQuery('');
    setCloneOpen(true);
  };

  const toggleCloneTarget = (aziendaName) => {
    const key = String(aziendaName || '');
    if (!key) return;
    setCloneTargets((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const submitClone = async () => {
    if (!isTecnico || !cloneSection || !companyKey || cloneBusy) return;
    if (!Array.isArray(cloneTargets) || cloneTargets.length === 0) {
      setCloneError('Seleziona almeno un’azienda');
      return;
    }
    setCloneBusy(true);
    setCloneError(null);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-section-clone'), {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: cloneSection,
          source_azienda_name: companyKey,
          target_azienda_names: cloneTargets
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Errore copia');
      }
      setCloneOpen(false);
      // Ricarica la sezione corrente per sicurezza
      if (cloneSection === 'downloads') await loadDownloadLinks(companyKey);
      if (cloneSection === 'activations') await loadActivationGuides(companyKey);
      if (cloneSection === 'useful-guidelines') await loadUsefulGuidelines(companyKey);
    } catch (e) {
      setCloneError(e.message || 'Errore copia');
    } finally {
      setCloneBusy(false);
    }
  };

  // Sincronizza lo stato locale con initialCompanyId se cambia esternamente
  useEffect(() => {
    if (initialCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(initialCompanyId);
    }
  }, [initialCompanyId]);

  // Se l'azienda selezionata non è nella lista, considera come "nessuna selezione" (stesso fix di EmailPage per cliente)
  const selectedCompanyValid = companies.length > 0 && selectedCompanyId &&
    companies.some(c => String(c.id) === String(selectedCompanyId));
  const showIntro = !loadingCompanies && (!selectedCompanyId || !selectedCompanyValid);
  const saveTimers = useRef({});
  /** Evita che risposte lente sovrascrivano stato dopo cambio azienda rapido. */
  const officeLoadGen = useRef(0);

  // Carica le aziende al mount
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
          // Deduplica per nome azienda (mantieni primo id per ogni nome)
          const seen = new Set();
          const unique = (data || []).filter(c => {
            const name = (c.azienda || '').trim();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });
          setCompanies(unique);
        } else {
          console.error("Errore fetch aziende:", response.status);
          setError('Errore nel caricamento delle aziende');
        }
      } catch (err) {
        console.error("Errore caricamento aziende:", err);
        setError('Errore nel caricamento delle aziende');
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, []);

  // Auto-selezione azienda da nome (usato dall'Hub scadenze Office).
  useEffect(() => {
    if (!initialCompanyName) return;
    if (!companies || companies.length === 0) return;
    if (selectedCompanyId) return;
    const target = String(initialCompanyName || '').trim().toLowerCase();
    if (!target) return;
    const match = companies.find((c) => {
      const raw = String(c?.azienda || '').trim();
      const clean = raw.includes(':') ? raw.split(':')[0].trim() : raw;
      return clean.toLowerCase() === target || raw.toLowerCase() === target;
    });
    if (!match) return;
    setSelectedCompanyId(match.id);
    onCompanyChange?.(match.id);
  }, [initialCompanyName, companies, selectedCompanyId, onCompanyChange]);

  // Reset selezione se l'azienda non è nella lista (es. cliente con default non allineato)
  useEffect(() => {
    if (!loadingCompanies && companies.length > 0 && selectedCompanyId && !selectedCompanyValid) {
      setSelectedCompanyId('');
    }
  }, [loadingCompanies, companies, selectedCompanyId, selectedCompanyValid]);

  useEffect(() => {
    if (selectedCompanyValid) {
      loadOfficeData();
    } else if (!selectedCompanyId) {
      setOfficeData(null);
      setError(null);
      setCompanyName('');
      setCompanyKey('');
    }
    setVisiblePasswords({});
    setLoadingPasswords({});
  }, [selectedCompanyId, companies, loadingCompanies, selectedCompanyValid]);

  const officeEntryKey = (file) => `${file.title || ''}|${file.username || ''}`;

  const fetchPassword = async (file) => {
    if (!showPasswordColumn || !companyKey || !getAuthHeader) return;
    const key = officeEntryKey(file);
    setLoadingPasswords(p => ({ ...p, [key]: true }));
    try {
      const params = new URLSearchParams({ aziendaName: companyKey, title: file.title || '', username: file.username || '' });
      const res = await fetch(buildApiUrl(`/api/keepass/office-password?${params}`), {
        headers: getAuthHeader(),
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Password non trovata');
      const data = await res.json();
      setVisiblePasswords(v => ({ ...v, [key]: data.password || '' }));
    } catch (err) {
      console.error('Errore recupero password Office:', err);
    } finally {
      setLoadingPasswords(p => ({ ...p, [key]: false }));
    }
  };

  const hidePassword = (file) => {
    const key = officeEntryKey(file);
    setVisiblePasswords(v => { const n = { ...v }; delete n[key]; return n; });
  };

  // Non usare loadOfficeData in deps qui: la funzione è dichiarata più sotto (evita TDZ in runtime).
  const refreshOfficeData = useCallback(async () => {
    if (!selectedCompanyValid) return;
    setVisiblePasswords({});
    setLoadingPasswords({});
    // trigger "soft refresh": la useEffect che ascolta selectedCompanyId/selectedCompanyValid ricarica i dati
    // e inoltre eseguiamo il refresh diretto se la funzione esiste già.
    try {
      // eslint-disable-next-line no-use-before-define
      await loadOfficeData(selectedCompanyId);
    } catch (_) {
      // ignore
    }
  }, [selectedCompanyId, selectedCompanyValid]);

  // Refresh "locale" dalla topbar dell'Hub: non ricarica tutta l'app.
  useEffect(() => {
    if (!embedded) return;
    const handler = (e) => {
      const view = e?.detail?.view;
      if (view !== 'office') return;
      refreshOfficeData();
    };
    window.addEventListener('hub:refresh', handler);
    return () => window.removeEventListener('hub:refresh', handler);
  }, [embedded, refreshOfficeData]);

  // Fallback robusto: refresh via prop (non dipende da CustomEvent)
  useEffect(() => {
    if (!embedded) return;
    if (hubRefreshView !== 'office') return;
    if (!hubRefreshTick) return;
    refreshOfficeData();
  }, [embedded, hubRefreshTick, hubRefreshView, refreshOfficeData]);

  const loadDownloadLinks = useCallback(async (azienda) => {
    if (!azienda || !getAuthHeader) return;
    setLoadingDownloadLinks(true);
    setDownloadError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/keepass/office-download-links/${encodeURIComponent(azienda)}`), {
        headers: getAuthHeader(),
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error('Errore nel caricamento dei link download');
      }
      const data = await res.json();
      setDownloadLinks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore caricamento office download links:', err);
      setDownloadError('Impossibile caricare i link download');
      setDownloadLinks([]);
    } finally {
      setLoadingDownloadLinks(false);
    }
  }, [getAuthHeader]);

  const loadActivationGuides = useCallback(async (azienda) => {
    if (!azienda || !getAuthHeader) return;
    setLoadingActivationGuides(true);
    setActivationError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/keepass/office-activation-guides/${encodeURIComponent(azienda)}`), {
        headers: getAuthHeader(),
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Errore nel caricamento delle guide attivazione');
      const data = await res.json();
      setActivationGuides(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore caricamento office activation guides:', err);
      setActivationError('Impossibile caricare le guide di attivazione');
      setActivationGuides([]);
    } finally {
      setLoadingActivationGuides(false);
    }
  }, [getAuthHeader]);

  const loadUsefulGuidelines = useCallback(async (azienda) => {
    if (!azienda || !getAuthHeader) return;
    setLoadingUsefulGuidelines(true);
    setUsefulGuidelinesError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/keepass/office-useful-guidelines/${encodeURIComponent(azienda)}`), {
        headers: getAuthHeader(),
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Errore nel caricamento delle linee guida');
      const data = await res.json();
      setUsefulGuidelines(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore caricamento office useful guidelines:', err);
      setUsefulGuidelinesError('Impossibile caricare le linee guida utili');
      setUsefulGuidelines([]);
    } finally {
      setLoadingUsefulGuidelines(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    if (!selectedCompanyValid || !companyKey) {
      setDownloadLinks([]);
      setDownloadError(null);
      setActivationGuides([]);
      setActivationError(null);
      setUsefulGuidelines([]);
      setUsefulGuidelinesError(null);
      setActiveView('licenses');
      return;
    }
    loadDownloadLinks(companyKey);
    loadActivationGuides(companyKey);
    loadUsefulGuidelines(companyKey);
  }, [selectedCompanyValid, companyKey, loadDownloadLinks, loadActivationGuides, loadUsefulGuidelines]);

  const handleCreateDownloadLink = async () => {
    if (!isTecnico || !companyKey || savingDownload) return;
    const title = newDownload.title.trim();
    const description = newDownload.description.trim();
    const links = (newDownload.links || [])
      .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
      .filter((link) => link.label && link.url);
    if (!title || links.length === 0) return;

    setSavingDownload(true);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-download-links'), {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyKey,
          title,
          description,
          links,
          sort_order: downloadLinks.length
        })
      });
      if (!res.ok) throw new Error('Errore creazione link');
      setNewDownload({ title: '', description: '', links: [{ label: '', url: '' }] });
      await loadDownloadLinks(companyKey);
    } catch (err) {
      console.error('Errore creazione link download:', err);
      setDownloadError('Impossibile creare il link');
    } finally {
      setSavingDownload(false);
    }
  };

  const handleSaveDownloadLink = async (id) => {
    if (!isTecnico || !companyKey || !id) return;
    const title = editingDownload.title.trim();
    const description = editingDownload.description.trim();
    const links = (editingDownload.links || [])
      .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
      .filter((link) => link.label && link.url);
    if (!title || links.length === 0) return;

    setSavingDownload(true);
    try {
      const target = downloadLinks.find(link => link.id === id);
      const res = await fetch(buildApiUrl(`/api/keepass/office-download-links/${id}`), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          links,
          sort_order: target?.sort_order ?? 0
        })
      });
      if (!res.ok) throw new Error('Errore aggiornamento link');
      setEditingDownloadId(null);
      setEditingDownload({ title: '', description: '', links: [{ label: '', url: '' }] });
      await loadDownloadLinks(companyKey);
    } catch (err) {
      console.error('Errore salvataggio link download:', err);
      setDownloadError('Impossibile aggiornare il link');
    } finally {
      setSavingDownload(false);
    }
  };

  const handleDeleteDownloadLink = async (id) => {
    if (!isTecnico || !companyKey || !id || savingDownload) return;
    setSavingDownload(true);
    try {
      const res = await fetch(buildApiUrl(`/api/keepass/office-download-links/${id}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Errore eliminazione link');
      if (editingDownloadId === id) {
        setEditingDownloadId(null);
        setEditingDownload({ title: '', description: '', links: [{ label: '', url: '' }] });
      }
      await loadDownloadLinks(companyKey);
    } catch (err) {
      console.error('Errore eliminazione link download:', err);
      setDownloadError('Impossibile eliminare il link');
    } finally {
      setSavingDownload(false);
    }
  };

  const updateNewLinkField = (index, field, value) => {
    setNewDownload((prev) => {
      const nextLinks = [...(prev.links || [])];
      nextLinks[index] = { ...(nextLinks[index] || { label: '', url: '' }), [field]: value };
      return { ...prev, links: nextLinks };
    });
  };

  const addNewLinkRow = () => {
    setNewDownload((prev) => ({ ...prev, links: [...(prev.links || []), { label: '', url: '' }] }));
  };

  const removeNewLinkRow = (index) => {
    setNewDownload((prev) => {
      const current = prev.links || [];
      if (current.length <= 1) return prev;
      return { ...prev, links: current.filter((_, idx) => idx !== index) };
    });
  };

  const updateEditingLinkField = (index, field, value) => {
    setEditingDownload((prev) => {
      const nextLinks = [...(prev.links || [])];
      nextLinks[index] = { ...(nextLinks[index] || { label: '', url: '' }), [field]: value };
      return { ...prev, links: nextLinks };
    });
  };

  const addEditingLinkRow = () => {
    setEditingDownload((prev) => ({ ...prev, links: [...(prev.links || []), { label: '', url: '' }] }));
  };

  const removeEditingLinkRow = (index) => {
    setEditingDownload((prev) => {
      const current = prev.links || [];
      if (current.length <= 1) return prev;
      return { ...prev, links: current.filter((_, idx) => idx !== index) };
    });
  };

  const persistDownloadOrder = async (reordered) => {
    if (!isTecnico || !companyKey || savingDownload) return;
    setSavingDownload(true);
    setDownloadError(null);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-download-links-reorder'), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyKey,
          ordered_ids: reordered.map((item) => item.id)
        })
      });
      if (!res.ok) throw new Error('Errore riordino link');
      setDownloadLinks(reordered.map((item, idx) => ({ ...item, sort_order: idx })));
    } catch (err) {
      console.error('Errore riordino link download:', err);
      setDownloadError('Impossibile riordinare i link');
      await loadDownloadLinks(companyKey);
    } finally {
      setSavingDownload(false);
    }
  };

  const handleDownloadDrop = async (targetId) => {
    if (!isTecnico || !draggingDownloadId || draggingDownloadId === targetId) {
      setDraggingDownloadId(null);
      setDragOverDownloadId(null);
      return;
    }
    const fromIndex = downloadLinks.findIndex((item) => item.id === draggingDownloadId);
    const toIndex = downloadLinks.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingDownloadId(null);
      setDragOverDownloadId(null);
      return;
    }

    const reordered = [...downloadLinks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setDraggingDownloadId(null);
    setDragOverDownloadId(null);
    await persistDownloadOrder(reordered);
  };

  const handleCreateActivationGuide = async () => {
    if (!isTecnico || !companyKey || savingActivation) return;
    const title = newActivation.title.trim();
    const description = newActivation.description.trim();
    const links = (newActivation.links || [])
      .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
      .filter((link) => link.label && link.url);
    if (!title || links.length === 0) return;

    setSavingActivation(true);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-activation-guides'), {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyKey,
          title,
          description,
          links,
          sort_order: activationGuides.length
        })
      });
      if (!res.ok) throw new Error('Errore creazione guida');
      setNewActivation({ title: '', description: '', links: [{ label: '', url: '' }] });
      await loadActivationGuides(companyKey);
    } catch (err) {
      console.error('Errore creazione guida attivazione:', err);
      setActivationError('Impossibile creare la guida');
    } finally {
      setSavingActivation(false);
    }
  };

  const handleSaveActivationGuide = async (id) => {
    if (!isTecnico || !companyKey || !id) return;
    const title = editingActivation.title.trim();
    const description = editingActivation.description.trim();
    const links = (editingActivation.links || [])
      .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
      .filter((link) => link.label && link.url);
    if (!title || links.length === 0) return;

    setSavingActivation(true);
    try {
      const target = activationGuides.find((guide) => guide.id === id);
      const res = await fetch(buildApiUrl(`/api/keepass/office-activation-guides/${id}`), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          links,
          sort_order: target?.sort_order ?? 0
        })
      });
      if (!res.ok) throw new Error('Errore aggiornamento guida');
      setEditingActivationId(null);
      setEditingActivation({ title: '', description: '', links: [{ label: '', url: '' }] });
      await loadActivationGuides(companyKey);
    } catch (err) {
      console.error('Errore salvataggio guida attivazione:', err);
      setActivationError('Impossibile aggiornare la guida');
    } finally {
      setSavingActivation(false);
    }
  };

  const handleDeleteActivationGuide = async (id) => {
    if (!isTecnico || !companyKey || !id || savingActivation) return;
    setSavingActivation(true);
    try {
      const res = await fetch(buildApiUrl(`/api/keepass/office-activation-guides/${id}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Errore eliminazione guida');
      if (editingActivationId === id) {
        setEditingActivationId(null);
        setEditingActivation({ title: '', description: '', links: [{ label: '', url: '' }] });
      }
      await loadActivationGuides(companyKey);
    } catch (err) {
      console.error('Errore eliminazione guida attivazione:', err);
      setActivationError('Impossibile eliminare la guida');
    } finally {
      setSavingActivation(false);
    }
  };

  const updateNewActivationLinkField = (index, field, value) => {
    setNewActivation((prev) => {
      const nextLinks = [...(prev.links || [])];
      nextLinks[index] = { ...(nextLinks[index] || { label: '', url: '' }), [field]: value };
      return { ...prev, links: nextLinks };
    });
  };

  const addNewActivationLinkRow = () => {
    setNewActivation((prev) => ({ ...prev, links: [...(prev.links || []), { label: '', url: '' }] }));
  };

  const removeNewActivationLinkRow = (index) => {
    setNewActivation((prev) => {
      const current = prev.links || [];
      if (current.length <= 1) return prev;
      return { ...prev, links: current.filter((_, idx) => idx !== index) };
    });
  };

  const updateEditingActivationLinkField = (index, field, value) => {
    setEditingActivation((prev) => {
      const nextLinks = [...(prev.links || [])];
      nextLinks[index] = { ...(nextLinks[index] || { label: '', url: '' }), [field]: value };
      return { ...prev, links: nextLinks };
    });
  };

  const addEditingActivationLinkRow = () => {
    setEditingActivation((prev) => ({ ...prev, links: [...(prev.links || []), { label: '', url: '' }] }));
  };

  const removeEditingActivationLinkRow = (index) => {
    setEditingActivation((prev) => {
      const current = prev.links || [];
      if (current.length <= 1) return prev;
      return { ...prev, links: current.filter((_, idx) => idx !== index) };
    });
  };

  const persistActivationOrder = async (reordered) => {
    if (!isTecnico || !companyKey || savingActivation) return;
    setSavingActivation(true);
    setActivationError(null);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-activation-guides-reorder'), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyKey,
          ordered_ids: reordered.map((item) => item.id)
        })
      });
      if (!res.ok) throw new Error('Errore riordino guide');
      setActivationGuides(reordered.map((item, idx) => ({ ...item, sort_order: idx })));
    } catch (err) {
      console.error('Errore riordino guide attivazione:', err);
      setActivationError('Impossibile riordinare le guide');
      await loadActivationGuides(companyKey);
    } finally {
      setSavingActivation(false);
    }
  };

  const handleActivationDrop = async (targetId) => {
    if (!isTecnico || !draggingActivationId || draggingActivationId === targetId) {
      setDraggingActivationId(null);
      setDragOverActivationId(null);
      return;
    }
    const fromIndex = activationGuides.findIndex((item) => item.id === draggingActivationId);
    const toIndex = activationGuides.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingActivationId(null);
      setDragOverActivationId(null);
      return;
    }
    const reordered = [...activationGuides];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setDraggingActivationId(null);
    setDragOverActivationId(null);
    await persistActivationOrder(reordered);
  };

  const handleCreateUsefulGuideline = async () => {
    if (!isTecnico || !companyKey || savingUsefulGuideline) return;
    const title = newUsefulGuideline.title.trim();
    const description = newUsefulGuideline.description.trim();
    const links = (newUsefulGuideline.links || [])
      .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
      .filter((link) => link.label && link.url);
    if (!title) return;

    setSavingUsefulGuideline(true);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-useful-guidelines'), {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyKey,
          title,
          description,
          links,
          sort_order: usefulGuidelines.length
        })
      });
      if (!res.ok) throw new Error('Errore creazione linea guida');
      setNewUsefulGuideline({ title: '', description: '', links: [{ label: '', url: '' }] });
      await loadUsefulGuidelines(companyKey);
    } catch (err) {
      console.error('Errore creazione linea guida utile:', err);
      setUsefulGuidelinesError('Impossibile creare la linea guida');
    } finally {
      setSavingUsefulGuideline(false);
    }
  };

  const handleSaveUsefulGuideline = async (id) => {
    if (!isTecnico || !companyKey || !id) return;
    const title = editingUsefulGuideline.title.trim();
    const description = editingUsefulGuideline.description.trim();
    const links = (editingUsefulGuideline.links || [])
      .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
      .filter((link) => link.label && link.url);
    if (!title) return;

    setSavingUsefulGuideline(true);
    try {
      const target = usefulGuidelines.find((g) => g.id === id);
      const res = await fetch(buildApiUrl(`/api/keepass/office-useful-guidelines/${id}`), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          links,
          sort_order: target?.sort_order ?? 0
        })
      });
      if (!res.ok) throw new Error('Errore aggiornamento linea guida');
      setEditingUsefulGuidelineId(null);
      setEditingUsefulGuideline({ title: '', description: '', links: [{ label: '', url: '' }] });
      await loadUsefulGuidelines(companyKey);
    } catch (err) {
      console.error('Errore salvataggio linea guida utile:', err);
      setUsefulGuidelinesError('Impossibile aggiornare la linea guida');
    } finally {
      setSavingUsefulGuideline(false);
    }
  };

  const handleDeleteUsefulGuideline = async (id) => {
    if (!isTecnico || !companyKey || !id || savingUsefulGuideline) return;
    setSavingUsefulGuideline(true);
    try {
      const res = await fetch(buildApiUrl(`/api/keepass/office-useful-guidelines/${id}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Errore eliminazione linea guida');
      if (editingUsefulGuidelineId === id) {
        setEditingUsefulGuidelineId(null);
        setEditingUsefulGuideline({ title: '', description: '', links: [{ label: '', url: '' }] });
      }
      await loadUsefulGuidelines(companyKey);
    } catch (err) {
      console.error('Errore eliminazione linea guida utile:', err);
      setUsefulGuidelinesError('Impossibile eliminare la linea guida');
    } finally {
      setSavingUsefulGuideline(false);
    }
  };

  const updateNewUsefulGuidelineLinkField = (index, field, value) => {
    setNewUsefulGuideline((prev) => {
      const nextLinks = [...(prev.links || [])];
      nextLinks[index] = { ...(nextLinks[index] || { label: '', url: '' }), [field]: value };
      return { ...prev, links: nextLinks };
    });
  };

  const addNewUsefulGuidelineLinkRow = () => {
    setNewUsefulGuideline((prev) => ({ ...prev, links: [...(prev.links || []), { label: '', url: '' }] }));
  };

  const removeNewUsefulGuidelineLinkRow = (index) => {
    setNewUsefulGuideline((prev) => {
      const current = prev.links || [];
      if (current.length <= 1) return prev;
      return { ...prev, links: current.filter((_, idx) => idx !== index) };
    });
  };

  const updateEditingUsefulGuidelineLinkField = (index, field, value) => {
    setEditingUsefulGuideline((prev) => {
      const nextLinks = [...(prev.links || [])];
      nextLinks[index] = { ...(nextLinks[index] || { label: '', url: '' }), [field]: value };
      return { ...prev, links: nextLinks };
    });
  };

  const addEditingUsefulGuidelineLinkRow = () => {
    setEditingUsefulGuideline((prev) => ({ ...prev, links: [...(prev.links || []), { label: '', url: '' }] }));
  };

  const removeEditingUsefulGuidelineLinkRow = (index) => {
    setEditingUsefulGuideline((prev) => {
      const current = prev.links || [];
      if (current.length <= 1) return prev;
      return { ...prev, links: current.filter((_, idx) => idx !== index) };
    });
  };

  const persistUsefulGuidelinesOrder = async (reordered) => {
    if (!isTecnico || !companyKey || savingUsefulGuideline) return;
    setSavingUsefulGuideline(true);
    setUsefulGuidelinesError(null);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-useful-guidelines-reorder'), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyKey,
          ordered_ids: reordered.map((item) => item.id)
        })
      });
      if (!res.ok) throw new Error('Errore riordino linee guida');
      setUsefulGuidelines(reordered.map((item, idx) => ({ ...item, sort_order: idx })));
    } catch (err) {
      console.error('Errore riordino linee guida utili:', err);
      setUsefulGuidelinesError('Impossibile riordinare le linee guida');
      await loadUsefulGuidelines(companyKey);
    } finally {
      setSavingUsefulGuideline(false);
    }
  };

  const handleUsefulGuidelineDrop = async (targetId) => {
    if (!isTecnico || !draggingUsefulGuidelineId || draggingUsefulGuidelineId === targetId) {
      setDraggingUsefulGuidelineId(null);
      setDragOverUsefulGuidelineId(null);
      return;
    }
    const fromIndex = usefulGuidelines.findIndex((item) => item.id === draggingUsefulGuidelineId);
    const toIndex = usefulGuidelines.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingUsefulGuidelineId(null);
      setDragOverUsefulGuidelineId(null);
      return;
    }
    const reordered = [...usefulGuidelines];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setDraggingUsefulGuidelineId(null);
    setDragOverUsefulGuidelineId(null);
    await persistUsefulGuidelinesOrder(reordered);
  };

  const loadOfficeData = async (companyIdOverride = null) => {
    const companyIdToUse = companyIdOverride || selectedCompanyId;
    const gen = ++officeLoadGen.current;

    if (!companyIdToUse || !getAuthHeader) {
      setError('Azienda non selezionata');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Usa l'azienda già caricata dalla lista companies
      const company = companies.find(c => String(c.id) === String(companyIdToUse));
      
      if (!company) {
        throw new Error('Azienda non trovata');
      }

      const aziendaNameRaw = String(company.azienda || '').trim();
      console.log('🔍 Caricamento Office per azienda:', aziendaNameRaw, 'ID:', company.id);
      
      // Pulisci il nome dell'azienda da eventuali caratteri strani o ID
      const cleanAziendaName = aziendaNameRaw.includes(':') ? aziendaNameRaw.split(':')[0].trim() : aziendaNameRaw;
      console.log('🔍 Nome azienda pulito:', cleanAziendaName);

      if (gen !== officeLoadGen.current) return;
      setCompanyName(cleanAziendaName);
      setCompanyKey(aziendaNameRaw || cleanAziendaName);

      // Ora recupera i dati Office da Keepass
      const tryNames = Array.from(
        new Set([aziendaNameRaw, cleanAziendaName].map((s) => String(s || '').trim()).filter(Boolean))
      );
      let response = null;
      let usedKey = '';
      for (const name of tryNames) {
        const apiUrl = buildApiUrl(`/api/keepass/office/${encodeURIComponent(name)}`);
        console.log('🔍 URL API chiamato:', apiUrl);
        const r = await fetch(apiUrl, { headers: getAuthHeader(), cache: 'no-store' });
        response = r;
        usedKey = name;
        if (r.ok || r.status !== 404) break;
      }

      if (gen !== officeLoadGen.current) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          if (gen !== officeLoadGen.current) return;
          setError('Office non trovato in Keepass per questa azienda');
        } else {
          throw new Error(errorData.error || 'Errore nel caricamento dei dati Office');
        }
        return;
      }

      const data = await response.json();
      if (gen !== officeLoadGen.current) return;
      console.log('📦 Dati Office ricevuti dal backend:', data);
      console.log('📦 customFields:', data.customFields);
      console.log('📦 Tipo customFields:', typeof data.customFields);
      console.log('📦 È array?', Array.isArray(data.customFields));
      console.log('📦 Chiavi customFields:', data.customFields ? Object.keys(data.customFields) : 'null');
      console.log('📦 Valori customFields:', data.customFields ? Object.entries(data.customFields).map(([k, v]) => `${k}: "${v}"`).join(', ') : 'null');
      setOfficeData(data);
      setCompanyKey(usedKey || aziendaNameRaw || cleanAziendaName);
      // Carica stati scaduta/nota per le card di questa azienda
      await loadCardStatuses(usedKey || aziendaNameRaw || cleanAziendaName);
    } catch (err) {
      if (gen !== officeLoadGen.current) return;
      console.error('Errore caricamento Office:', err);
      setError(err.message || 'Errore nel caricamento dei dati Office');
    } finally {
      if (gen === officeLoadGen.current) setLoading(false);
    }
  };

  // Chiave univoca per ogni card
  const cardKey = (file) => `${file.title || ''}||${file.username || ''}`;

  // Carica stati card dal backend
  const loadCardStatuses = useCallback(async (azienda) => {
    if (!azienda || !getAuthHeader) return;
    try {
      const resp = await fetch(buildApiUrl(`/api/keepass/office-card-status/${encodeURIComponent(azienda)}`), { headers: getAuthHeader() });
      if (resp.ok) {
        const rows = await resp.json();
        const map = {};
        for (const r of rows) {
          map[`${r.card_title || ''}||${r.card_username || ''}`] = { note: r.note || '' };
        }
        setCardStatuses(map);
      }
    } catch (e) { console.warn('Errore caricamento card status:', e); }
  }, [getAuthHeader]);

  // Salva stato card (con debounce per la nota)
  const saveCardStatus = useCallback(async (file, fields) => {
    if (!companyKey || !getAuthHeader || !isTecnico) return;
    const key = cardKey(file);
    const current = cardStatuses[key] || { note: '' };
    const merged = { ...current, ...fields };
    setCardStatuses(prev => ({ ...prev, [key]: merged }));
    try {
      await fetch(buildApiUrl('/api/keepass/office-card-status'), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyKey,
          card_title: file.title || '',
          card_username: file.username || '',
          is_expired: false,
          note: merged.note
        })
      });
    } catch (e) { console.warn('Errore salvataggio card status:', e); }
  }, [companyKey, getAuthHeader, isTecnico, cardStatuses]);

  // Salva nota con debounce (evita troppe chiamate durante la digitazione)
  const saveNoteDebounced = useCallback((file, note) => {
    const key = cardKey(file);
    setCardStatuses(prev => ({ ...prev, [key]: { ...(prev[key] || { note: '' }), note } }));
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      saveCardStatus(file, { note });
    }, 800);
  }, [saveCardStatus]);

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const onEmbeddedBack = () => {
    if (typeof closeEmbedded === 'function') closeEmbedded();
    else if (typeof onClose === 'function') onClose();
  };

  const rootClassName = embedded
    ? 'flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)] font-sans'
    : 'fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden';

  const rootEmbeddedStyle = useMemo(
    () => (embedded ? hubEmbeddedRootInlineStyle(accent) : undefined),
    [embedded, accent]
  );

  const embeddedBackBtnStyle = useMemo(() => hubEmbeddedBackBtnInlineStyle(), []);

  const selectClsOffice = embedded
    ? 'rounded-md border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-900 outline-none [color-scheme:light] focus:ring-2 focus:ring-blue-500/80'
    : 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  const refreshOfficeBtnCls = embedded
    ? 'inline-flex items-center gap-1 rounded-md border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--hub-chrome-text-secondary)] transition-colors hover:bg-[color:var(--hub-chrome-hover)] disabled:opacity-50'
    : 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50';

  const ox = getOfficeContentTheme(embedded);

  return (
    <div className={rootClassName} style={rootEmbeddedStyle}>
      {/* Header */}
      <div
        className={
          embedded
            ? 'flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[color:var(--hub-chrome-border-soft)] px-4 py-3 z-10 shadow-none'
            : 'bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10'
        }
        style={embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined}
      >
        <div className={`flex min-w-0 items-center ${embedded ? 'gap-3' : 'gap-4'}`}>
          {embedded ? (
            <button type="button" onClick={onEmbeddedBack} style={embeddedBackBtnStyle}>
              <ArrowLeft size={18} aria-hidden />
              Panoramica Hub
            </button>
          ) : (
            <SectionNavMenu
              currentPage="office"
              onNavigateHome={onNavigateHome || onClose}
              onNavigateOffice={null}
              onNavigateEmail={onNavigateEmail}
              onNavigateAntiVirus={onNavigateAntiVirus}
              onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
              onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
              onNavigateMappatura={onNavigateMappatura}
              onNavigateSpeedTest={onNavigateSpeedTest}
              onNavigateVpn={onNavigateVpn}
              currentUser={currentUser}
              selectedCompanyId={selectedCompanyId}
            />
          )}
          <div className="min-w-0">
            <h1
              className={`font-bold truncate ${embedded ? 'text-lg text-[color:var(--hub-chrome-text)]' : 'text-xl text-gray-900'}`}
            >
              Office
            </h1>
            <p className={`truncate ${embedded ? 'text-xs text-[color:var(--hub-chrome-text-muted)]' : 'text-sm text-gray-600'}`}>
              {companyName || 'Seleziona un\'azienda'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!loadingCompanies && (isCliente ? !!selectedCompanyId : true) && (
            <div className="flex items-center gap-2">
              <select
                className={selectClsOffice}
                value={selectedCompanyId || ''}
                onChange={async (e) => {
                  const newCompanyId = e.target.value;
                  setSelectedCompanyId(newCompanyId);
                  if (onCompanyChange) onCompanyChange(newCompanyId);
                  setError(null);
                  setOfficeData(null);
                  setCompanyName('');
                  setCompanyKey('');
                  
                  // Carica i dati solo se è stata selezionata un'azienda
                  if (newCompanyId) {
                    await loadOfficeData(newCompanyId);
                  }
                }}
              >
                <option value="">Seleziona Azienda...</option>
                {companies.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.azienda}</option>
                ))}
              </select>
              {selectedCompanyValid && (
                <button
                  type="button"
                  onClick={refreshOfficeData}
                  disabled={loading}
                  className={refreshOfficeBtnCls}
                  title="Ricarica dati Office da KeePass"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  Aggiorna
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={embedded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'flex-1 overflow-y-auto p-6'}>
        <div
          className={embedded ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-4 md:px-5' : 'h-full'}
          style={embedded ? { backgroundColor: 'var(--hub-chrome-page)' } : undefined}
        >
        {loadingCompanies && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader size={32} className={ox.loadSpin} />
              <p className={ox.loadTxt}>Caricamento aziende...</p>
            </div>
          </div>
        )}

        {showIntro && (
          <div className="max-w-4xl mx-auto w-full">
            <OfficeIntroCard
              embedded={embedded}
              hubSurfaceMode={hubSurfaceModeProp}
              companies={companies}
              value={selectedCompanyValid ? selectedCompanyId : ''}
              onChange={(companyId) => {
                const newCompanyId = companyId || null;
                setSelectedCompanyId(newCompanyId);
                if (onCompanyChange) onCompanyChange(newCompanyId);
                setError(null);
                setOfficeData(null);
                setCompanyName('');
                setCompanyKey('');
                if (newCompanyId) {
                  const company = companies.find(c => String(c.id) === String(newCompanyId));
                  if (company) {
                    const raw = String(company.azienda || '').trim();
                    setCompanyName(raw.includes(':') ? raw.split(':')[0].trim() : raw);
                    setCompanyKey(raw);
                  }
                }
              }}
            />
          </div>
        )}

        {loading && selectedCompanyId && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader size={32} className={ox.loadSpin} />
              <p className={ox.loadTxt}>Caricamento dati Office da Keepass...</p>
            </div>
          </div>
        )}

        {!loading && !loadingCompanies && error && !showIntro && selectedCompanyId && (
          <div className={ox.errBoxOuter}>
            <div className={ox.errBoxInner}>
              <X size={20} className={ox.errIcon} />
              <div>
                <h3 className={ox.errTitle}>Errore</h3>
                <p className={ox.errMsg}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && officeData && activeView === 'licenses' && (
          <div className="max-w-7xl mx-auto">
            <div className={ox.rowBanner}>
              <p className={ox.textSingle}>Download Office</p>
              <div className="flex items-center gap-2">
                {isTecnico && (
                  <button
                    type="button"
                    onClick={() => openCloneModal('downloads')}
                    className={ox.btnGhostSm}
                    title="Copia personalizzazione Download su altre aziende"
                  >
                    <Copy size={13} />
                    Copia su…
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveView('downloads')}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                >
                  Apri download
                </button>
              </div>
            </div>
            <div className={ox.rowBanner}>
              <p className={ox.textSingle}>Attivazione licenza Office</p>
              <div className="flex items-center gap-2">
                {isTecnico && (
                  <button
                    type="button"
                    onClick={() => openCloneModal('activations')}
                    className={ox.btnGhostSm}
                    title="Copia personalizzazione Attivazioni su altre aziende"
                  >
                    <Copy size={13} />
                    Copia su…
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveView('activations')}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                >
                  Apri attivazioni
                </button>
              </div>
            </div>
            <div className={ox.rowBanner}>
              <p className={ox.textSingle}>Linee guida utili Office</p>
              <div className="flex items-center gap-2">
                {isTecnico && (
                  <button
                    type="button"
                    onClick={() => openCloneModal('useful-guidelines')}
                    className={ox.btnGhostSm}
                    title="Copia personalizzazione Linee guida su altre aziende"
                  >
                    <Copy size={13} />
                    Copia su…
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveView('useful-guidelines')}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                >
                  Apri linee guida
                </button>
              </div>
            </div>
            {/* Lista di tutti i file trovati */}
            {officeData.files && officeData.files.length > 0 ? (
              <div className="columns-1 md:columns-2 gap-4">
                {officeData.files.map((file, index) => {
                const status = cardStatuses[cardKey(file)] || { note: '' };
                const expiryDate = file.expires ? new Date(file.expires) : null;
                const keepassExpired = expiryDate ? expiryDate.getTime() < Date.now() : false;
                const daysToExpiry = (() => {
                  if (!expiryDate) return null;
                  const t = expiryDate.getTime();
                  if (!Number.isFinite(t)) return null;
                  const ms = t - Date.now();
                  return Math.ceil(ms / (24 * 60 * 60 * 1000));
                })();
                const expiringSoon =
                  typeof daysToExpiry === 'number' && Number.isFinite(daysToExpiry) && daysToExpiry >= 0 && daysToExpiry <= 30;
                const isExpired = keepassExpired;
                const hasUsername = !!(file.username && file.username.trim() !== '');
                const hasPassword = !!file.hasPassword;
                const canShowPassword = showPasswordColumn && hasPassword;
                const showCredentialsRow = hasUsername || canShowPassword;
                const licenseValue = file.license ? String(file.license).trim() : '';
                return (
                <div key={index} className={ox.fileCardOuter(isExpired)}>
                  {/* Titolo */}
                  <div className={ox.borderBHdr}>
                    <h3 className={ox.fileTitle}>{file.title || `File ${index + 1}`}</h3>
                    {/* Nome utente e Password sulla stessa riga */}
                    {showCredentialsRow && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-12 gap-y-2">
                      {hasUsername && (
                        <div className="flex items-center gap-2">
                          <p className={ox.labelUpperSm}>Nome utente</p>
                          <p className={ox.valMonoXs}>{file.username}</p>
                        </div>
                      )}
                      {canShowPassword && (
                        <div className="flex items-center gap-2">
                          <p className={ox.labelUpperSm}>Password</p>
                          {visiblePasswords[officeEntryKey(file)] !== undefined ? (
                            <div className="flex items-center gap-1">
                              <span className={ox.pwdChip}>{visiblePasswords[officeEntryKey(file)]}</span>
                              <button
                                type="button"
                                onClick={() => hidePassword(file)}
                                className={ox.eyeBtn}
                                title="Nascondi password"
                              >
                                <EyeOff size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fetchPassword(file)}
                              disabled={loadingPasswords[officeEntryKey(file)]}
                              className={ox.btnGhostSm}
                              title="Mostra password"
                            >
                              {loadingPasswords[officeEntryKey(file)] ? <Loader size={12} className="animate-spin" /> : <Eye size={14} />}
                              {loadingPasswords[officeEntryKey(file)] ? '...' : 'Mostra'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    )}
                    {licenseValue && (
                      <div className="mt-2 flex items-center gap-2">
                        <p className={ox.labelUpperSm}>Licenza</p>
                        <p className={ox.valXs}>{licenseValue}</p>
                      </div>
                    )}
                  </div>

                  {/* Campi personalizzati del file */}
                  <div className="mb-2">
                    <h4 className={ox.hAttivo}>Attivo su:</h4>
                    
                    {file.customFields && Object.keys(file.customFields).length > 0 ? (() => {
                      const entries = Object.entries(file.customFields || {})
                        .map(([k, v]) => ({ k: String(k || '').trim(), v }))
                        .filter((x) => x.k && String(x.v ?? '').trim() !== '');

                      if (entries.length === 0) {
                        return null;
                      }

                      const numeric = [];
                      const other = [];
                      for (const e of entries) {
                        const m = e.k.match(/^(?:custom)?(\d+)$/i);
                        if (m) numeric.push({ n: parseInt(m[1], 10), k: e.k, v: e.v });
                        else other.push(e);
                      }
                      numeric.sort((a, b) => (a.n || 0) - (b.n || 0));
                      other.sort((a, b) => a.k.localeCompare(b.k, 'it-IT'));

                      const getBorderColor = (num) => {
                        const colorBySlot = {
                          1: 'border-blue-500',
                          2: 'border-green-500',
                          3: 'border-yellow-500',
                          4: 'border-purple-500',
                          5: 'border-red-500'
                        };
                        return colorBySlot[num] || 'border-gray-400';
                      };

                      return (
                        <div className="space-y-0.5">
                          {numeric.map((row) => (
                            <div key={`custom-${row.n}`} className={`border-l-4 ${getBorderColor(row.n)} pl-3 py-1`}>
                              <p className={ox.pBodySm}>
                                <span className="font-semibold">{row.n}.</span> {String(row.v).trim()}
                              </p>
                            </div>
                          ))}
                          {other.map((row) => (
                            <div key={`custom-${row.k}`} className="border-l-4 border-gray-400 pl-3 py-1">
                              <p className={ox.pBodySm}>
                                <span className="font-semibold">{row.k}:</span> {String(row.v).trim()}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })() : (
                      null
                    )}
                  </div>

                  {/* Scadenza + Nota (automatica da KeePass) */}
                  {file.expires && (
                    <div className={ox.rowBorderT(isExpired)}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className={ox.calendarIcon(keepassExpired || expiringSoon)} />
                          <p className={ox.expLabelXs}>
                            Scadenza:{' '}
                            <span className={ox.expDateStrong(keepassExpired || expiringSoon)}>
                              {formatDate(file.expires)}
                              {keepassExpired ? ' (scaduta)' : ''}
                            </span>
                            {!keepassExpired && expiringSoon && typeof daysToExpiry === 'number' && (
                              <span className="ml-2 font-semibold text-red-600">
                                (mancano {daysToExpiry} giorni)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:max-w-xs">
                          <span className={`${ox.expLabelXs} shrink-0`}>Nota:</span>
                          {isTecnico ? (
                            <input
                              type="text"
                              value={status.note}
                              onChange={(e) => saveNoteDebounced(file, e.target.value)}
                              placeholder="Aggiungi nota..."
                              className={ox.noteInput(isExpired)}
                            />
                          ) : (
                            <span className={ox.readNote}>{status.note || '-'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Apri ticket */}
                  {typeof onOpenTicket === 'function' && (
                    <div className={ox.footerTicketRow}>
                      <p className={ox.ticketFootText}>Hai un dubbio o un problema tecnico? Apri una richiesta di supporto</p>
                      <button
                        type="button"
                        onClick={() => onOpenTicket({
                          titolo: `Supporto Office - ${file.title || 'Licenza Office'}`,
                          descrizione: [
                            `Richiesta di supporto relativa a: ${file.title || 'Licenza Office'}.`,
                            file.username ? `\nAccount: ${file.username}` : '',
                            '\n\nDescrivi qui il problema o la richiesta:'
                          ].join('')
                        })}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                      >
                        Apri ticket
                      </button>
                    </div>
                  )}
                </div>
                );
                })}
              </div>
            ) : (
              <div className={ox.inlineErr}>
                <p className={ox.inlineEmptyMsg}>Nessun file trovato nel gruppo Office</p>
              </div>
            )}
          </div>
        )}

        {cloneOpen && isTecnico && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    Copia personalizzazione ·{' '}
                    {cloneSection === 'downloads'
                      ? 'Download'
                      : cloneSection === 'activations'
                        ? 'Attivazioni'
                        : 'Linee guida'}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500 truncate">
                    Sorgente: {companyName || companyKey || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (cloneBusy) return;
                    setCloneOpen(false);
                  }}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  Chiudi
                </button>
              </div>

              <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <Search size={14} className="text-gray-500" />
                <input
                  value={cloneQuery}
                  onChange={(e) => setCloneQuery(e.target.value)}
                  placeholder="Cerca azienda…"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-gray-200">
                {(companiesForClone || []).map((c) => {
                  const raw = String(c.azienda || '');
                  const clean = raw.split(':')[0].trim();
                  const disabled = clean.toLowerCase() === String(companyKey || companyName || '').split(':')[0].trim().toLowerCase();
                  const checked = cloneTargets.includes(clean);
                  return (
                    <label
                      key={String(c.id)}
                      className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm ${
                        disabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={disabled || cloneBusy}
                        checked={checked}
                        onChange={() => toggleCloneTarget(clean)}
                      />
                      <span className="min-w-0 flex-1 truncate text-gray-800">{clean || raw || `ID ${c.id}`}</span>
                    </label>
                  );
                })}
              </div>

              {cloneError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{cloneError}</div>}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-gray-500">Selezionate: {cloneTargets.length}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCloneTargets([])}
                    disabled={cloneBusy}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Svuota
                  </button>
                  <button
                    type="button"
                    onClick={submitClone}
                    disabled={cloneBusy}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {cloneBusy ? 'Copia in corso…' : 'Copia su aziende'}
                  </button>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                Nota: per le aziende selezionate verrà <strong>sovrascritta</strong> solo questa sezione (download/attivazioni/linee guida), non il resto della pagina.
              </div>
            </div>
          </div>
        )}

        {!loading && !error && officeData && activeView === 'downloads' && (
          <div className="max-w-5xl mx-auto">
            <div className={ox.rowBanner}>
              <div>
                <p className={ox.hSmBold}>Download Office</p>
                <p className={ox.textMutedXs}>I tecnici possono creare e aggiornare i link. Gli utenti possono solo aprirli.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('licenses')}
                className={ox.btnGhostNav}
              >
                <ArrowLeft size={13} />
                Torna a Office
              </button>
            </div>

            {loadingDownloadLinks ? (
              <div className={ox.panelLoading}>
                <Loader size={24} className={ox.spinSm} />
                <p className={ox.msgLoadingSm}>Caricamento link download...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {downloadError && (
                  <div className={ox.errStrip}>
                    {downloadError}
                  </div>
                )}
                {downloadLinks.length === 0 && !downloadError && (
                  <div className={ox.inlineErr}>
                    <p className={ox.inlineEmptyMsg}>Nessun link download configurato per questa azienda</p>
                  </div>
                )}
                {downloadLinks.map((link) => {
                  const isEditing = editingDownloadId === link.id;
                  const isDragOver = dragOverDownloadId === link.id;
                  return (
                    <div
                      key={link.id}
                      className={ox.listCardDrag(isDragOver)}
                      draggable={isTecnico && !isEditing}
                      onDragStart={() => {
                        if (!isTecnico || isEditing) return;
                        setDraggingDownloadId(link.id);
                        setDragOverDownloadId(link.id);
                      }}
                      onDragOver={(e) => {
                        if (!isTecnico || !draggingDownloadId || isEditing) return;
                        e.preventDefault();
                        setDragOverDownloadId(link.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDownloadDrop(link.id);
                      }}
                      onDragEnd={() => {
                        setDraggingDownloadId(null);
                        setDragOverDownloadId(null);
                      }}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingDownload.title}
                            onChange={(e) => setEditingDownload((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Titolo"
                            className={ox.inp}
                          />
                          <input
                            type="text"
                            value={editingDownload.description}
                            onChange={(e) => setEditingDownload((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Descrizione"
                            className={ox.inp}
                          />
                          {(editingDownload.links || []).map((editLink, idx) => (
                            <div key={`edit-link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                              <input
                                type="text"
                                value={editLink.label}
                                onChange={(e) => updateEditingLinkField(idx, 'label', e.target.value)}
                                placeholder="Etichetta link"
                                className={ox.inp}
                              />
                              <input
                                type="url"
                                value={editLink.url}
                                onChange={(e) => updateEditingLinkField(idx, 'url', e.target.value)}
                                placeholder="https://..."
                                className={ox.inp}
                              />
                              <button
                                type="button"
                                onClick={() => removeEditingLinkRow(idx)}
                                disabled={(editingDownload.links || []).length <= 1}
                                className={ox.btnRedGhost}
                              >
                                Rimuovi
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addEditingLinkRow}
                            className={ox.btnGhostWFit}
                          >
                            Aggiungi link
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className={ox.titleLink}>{link.title}</p>
                          {link.description ? <p className={ox.descLink}>{link.description}</p> : null}
                          <div className="mt-1 space-y-1">
                            {(link.links || []).map((item, idx) => (
                              <div key={`${link.id}-item-${idx}`} className="flex items-center justify-between gap-3">
                                <span className={ox.lblLinkRow}>{item.label}</span>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={ox.linkOpenPill}
                                >
                                  Apri
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        {isTecnico && !isEditing && (
                          <div className={ox.dragBadge} title="Trascina per riordinare">
                            <GripVertical size={12} />
                            Trascina
                          </div>
                        )}
                        <a
                          href={isEditing ? (editingDownload.links?.[0]?.url || '#') : (link.links?.[0]?.url || '#')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                        >
                          Apri primo link
                        </a>
                        {isTecnico && !isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDownloadId(link.id);
                              setEditingDownload({
                                title: link.title || '',
                                description: link.description || '',
                                links: (link.links && link.links.length > 0)
                                  ? link.links.map((item) => ({ label: item.label || '', url: item.url || '' }))
                                  : [{ label: '', url: '' }]
                              });
                            }}
                            className={ox.btnGhostMd}
                          >
                            Modifica
                          </button>
                        )}
                        {isTecnico && isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveDownloadLink(link.id)}
                              disabled={savingDownload || !editingDownload.title.trim()}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Salva
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDownloadId(null);
                                setEditingDownload({ title: '', description: '', links: [{ label: '', url: '' }] });
                              }}
                              className={ox.btnGhostMd}
                            >
                              Annulla
                            </button>
                          </>
                        )}
                        {isTecnico && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDownloadLink(link.id)}
                            disabled={savingDownload}
                            className={ox.btnDelDanger}
                          >
                            <Trash2 size={12} />
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isTecnico && (
              <div className={ox.panelWhite}>
                <h3 className={ox.panelHeading}>Nuovo blocco download</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={newDownload.title}
                    onChange={(e) => setNewDownload((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Titolo (es. Office 2024)"
                    className={ox.inp}
                  />
                  <input
                    type="text"
                    value={newDownload.description}
                    onChange={(e) => setNewDownload((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrizione (opzionale)"
                    className={ox.inp}
                  />
                </div>
                <div className="space-y-2">
                  {(newDownload.links || []).map((link, idx) => (
                    <div key={`new-link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateNewLinkField(idx, 'label', e.target.value)}
                        placeholder="Etichetta link (es. Download 64bit)"
                        className={ox.inp}
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateNewLinkField(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className={ox.inp}
                      />
                      <button
                        type="button"
                        onClick={() => removeNewLinkRow(idx)}
                        disabled={(newDownload.links || []).length <= 1}
                        className={ox.btnRedGhost}
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={addNewLinkRow}
                    className={`mr-2 ${ox.btnGhostMd}`}
                  >
                    Aggiungi link
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateDownloadLink}
                    disabled={savingDownload || !newDownload.title.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Plus size={13} />
                    Aggiungi blocco
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && officeData && activeView === 'activations' && (
          <div className="max-w-5xl mx-auto">
            <div className={ox.rowBanner}>
              <div>
                <p className={ox.hSmBold}>Guide attivazione Office</p>
                <p className={ox.textMutedXs}>I tecnici possono creare e aggiornare le guide. Gli utenti possono solo aprire i link.</p>
              </div>
              <button type="button" onClick={() => setActiveView('licenses')} className={ox.btnGhostNav}>
                <ArrowLeft size={13} />
                Torna a Office
              </button>
            </div>

            {loadingActivationGuides ? (
              <div className={ox.panelLoading}>
                <Loader size={24} className={ox.spinSm} />
                <p className={ox.msgLoadingSm}>Caricamento guide attivazione...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activationError && <div className={ox.errStrip}>{activationError}</div>}
                {activationGuides.length === 0 && !activationError && (
                  <div className={ox.inlineErr}>
                    <p className={ox.inlineEmptyMsg}>Nessuna guida attivazione configurata per questa azienda</p>
                  </div>
                )}
                {activationGuides.map((guide) => {
                  const isEditing = editingActivationId === guide.id;
                  const isDragOver = dragOverActivationId === guide.id;
                  return (
                    <div
                      key={guide.id}
                      className={ox.listCardDrag(isDragOver)}
                      draggable={isTecnico && !isEditing}
                      onDragStart={() => {
                        if (!isTecnico || isEditing) return;
                        setDraggingActivationId(guide.id);
                        setDragOverActivationId(guide.id);
                      }}
                      onDragOver={(e) => {
                        if (!isTecnico || !draggingActivationId || isEditing) return;
                        e.preventDefault();
                        setDragOverActivationId(guide.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleActivationDrop(guide.id);
                      }}
                      onDragEnd={() => {
                        setDraggingActivationId(null);
                        setDragOverActivationId(null);
                      }}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingActivation.title}
                            onChange={(e) => setEditingActivation((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Titolo"
                            className={ox.inp}
                          />
                          <input
                            type="text"
                            value={editingActivation.description}
                            onChange={(e) => setEditingActivation((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Descrizione"
                            className={ox.inp}
                          />
                          {(editingActivation.links || []).map((editLink, idx) => (
                            <div key={`edit-activation-link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                              <input
                                type="text"
                                value={editLink.label}
                                onChange={(e) => updateEditingActivationLinkField(idx, 'label', e.target.value)}
                                placeholder="Etichetta link"
                                className={ox.inp}
                              />
                              <input
                                type="url"
                                value={editLink.url}
                                onChange={(e) => updateEditingActivationLinkField(idx, 'url', e.target.value)}
                                placeholder="https://..."
                                className={ox.inp}
                              />
                              <button
                                type="button"
                                onClick={() => removeEditingActivationLinkRow(idx)}
                                disabled={(editingActivation.links || []).length <= 1}
                                className={ox.btnRedGhost}
                              >
                                Rimuovi
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={addEditingActivationLinkRow} className={ox.btnGhostWFit}>
                            Aggiungi link
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className={ox.titleLink}>{guide.title}</p>
                          {guide.description ? <p className={ox.descLink}>{guide.description}</p> : null}
                          <div className="mt-1 space-y-1">
                            {(guide.links || []).map((item, idx) => (
                              <div key={`${guide.id}-activation-item-${idx}`} className="flex items-center justify-between gap-3">
                                <span className={ox.lblLinkRow}>{item.label}</span>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={ox.linkOpenPill}
                                >
                                  Apri
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        {isTecnico && !isEditing && (
                          <div className={ox.dragBadge} title="Trascina per riordinare">
                            <GripVertical size={12} />
                            Trascina
                          </div>
                        )}
                        <a
                          href={isEditing ? (editingActivation.links?.[0]?.url || '#') : (guide.links?.[0]?.url || '#')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                        >
                          Apri primo link
                        </a>
                        {isTecnico && !isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingActivationId(guide.id);
                              setEditingActivation({
                                title: guide.title || '',
                                description: guide.description || '',
                                links: (guide.links && guide.links.length > 0)
                                  ? guide.links.map((item) => ({ label: item.label || '', url: item.url || '' }))
                                  : [{ label: '', url: '' }]
                              });
                            }}
                            className={ox.btnGhostMd}
                          >
                            Modifica
                          </button>
                        )}
                        {isTecnico && isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveActivationGuide(guide.id)}
                              disabled={savingActivation || !editingActivation.title.trim()}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Salva
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingActivationId(null);
                                setEditingActivation({ title: '', description: '', links: [{ label: '', url: '' }] });
                              }}
                              className={ox.btnGhostMd}
                            >
                              Annulla
                            </button>
                          </>
                        )}
                        {isTecnico && (
                          <button
                            type="button"
                            onClick={() => handleDeleteActivationGuide(guide.id)}
                            disabled={savingActivation}
                            className={ox.btnDelDanger}
                          >
                            <Trash2 size={12} />
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isTecnico && (
              <div className={ox.panelWhite}>
                <h3 className={ox.panelHeading}>Nuova guida attivazione</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={newActivation.title}
                    onChange={(e) => setNewActivation((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Titolo (es. Office 2024 Pro Plus)"
                    className={ox.inp}
                  />
                  <input
                    type="text"
                    value={newActivation.description}
                    onChange={(e) => setNewActivation((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrizione (opzionale)"
                    className={ox.inp}
                  />
                </div>
                <div className="space-y-2">
                  {(newActivation.links || []).map((link, idx) => (
                    <div key={`new-activation-link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateNewActivationLinkField(idx, 'label', e.target.value)}
                        placeholder="Etichetta link"
                        className={ox.inp}
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateNewActivationLinkField(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className={ox.inp}
                      />
                      <button
                        type="button"
                        onClick={() => removeNewActivationLinkRow(idx)}
                        disabled={(newActivation.links || []).length <= 1}
                        className={ox.btnRedGhost}
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <button type="button" onClick={addNewActivationLinkRow} className={`mr-2 ${ox.btnGhostMd}`}>
                    Aggiungi link
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateActivationGuide}
                    disabled={savingActivation || !newActivation.title.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Plus size={13} />
                    Aggiungi guida
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && officeData && activeView === 'useful-guidelines' && (
          <div className="max-w-5xl mx-auto">
            <div className={ox.rowBanner}>
              <div>
                <p className={ox.hSmBold}>Linee guida utili Office</p>
                <p className={ox.textMutedXs}>I tecnici possono creare e aggiornare le linee guida. Gli utenti possono solo aprire i link.</p>
              </div>
              <button type="button" onClick={() => setActiveView('licenses')} className={ox.btnGhostNav}>
                <ArrowLeft size={13} />
                Torna a Office
              </button>
            </div>

            {loadingUsefulGuidelines ? (
              <div className={ox.panelLoading}>
                <Loader size={24} className={ox.spinSm} />
                <p className={ox.msgLoadingSm}>Caricamento linee guida...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {usefulGuidelinesError && <div className={ox.errStrip}>{usefulGuidelinesError}</div>}
                {usefulGuidelines.length === 0 && !usefulGuidelinesError && (
                  <div className={ox.inlineErr}>
                    <p className={ox.inlineEmptyMsg}>Nessuna linea guida configurata per questa azienda</p>
                  </div>
                )}
                {usefulGuidelines.map((g) => {
                  const isEditing = editingUsefulGuidelineId === g.id;
                  const isDragOver = dragOverUsefulGuidelineId === g.id;
                  return (
                    <div
                      key={g.id}
                      className={ox.listCardDrag(isDragOver)}
                      draggable={isTecnico && !isEditing}
                      onDragStart={() => {
                        if (!isTecnico || isEditing) return;
                        setDraggingUsefulGuidelineId(g.id);
                        setDragOverUsefulGuidelineId(g.id);
                      }}
                      onDragOver={(e) => {
                        if (!isTecnico || !draggingUsefulGuidelineId || isEditing) return;
                        e.preventDefault();
                        setDragOverUsefulGuidelineId(g.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleUsefulGuidelineDrop(g.id);
                      }}
                      onDragEnd={() => {
                        setDraggingUsefulGuidelineId(null);
                        setDragOverUsefulGuidelineId(null);
                      }}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingUsefulGuideline.title}
                            onChange={(e) => setEditingUsefulGuideline((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Titolo"
                            className={ox.inp}
                          />
                          <textarea
                            value={editingUsefulGuideline.description}
                            onChange={(e) => setEditingUsefulGuideline((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Descrizione"
                            className={`${ox.inp} min-h-[12rem] resize-y`}
                          />
                          {(editingUsefulGuideline.links || []).map((editLink, idx) => (
                            <div key={`edit-useful-link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                              <input
                                type="text"
                                value={editLink.label}
                                onChange={(e) => updateEditingUsefulGuidelineLinkField(idx, 'label', e.target.value)}
                                placeholder="Etichetta link"
                                className={ox.inp}
                              />
                              <input
                                type="url"
                                value={editLink.url}
                                onChange={(e) => updateEditingUsefulGuidelineLinkField(idx, 'url', e.target.value)}
                                placeholder="https://..."
                                className={ox.inp}
                              />
                              <button
                                type="button"
                                onClick={() => removeEditingUsefulGuidelineLinkRow(idx)}
                                disabled={(editingUsefulGuideline.links || []).length <= 1}
                                className={ox.btnRedGhost}
                              >
                                Rimuovi
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={addEditingUsefulGuidelineLinkRow} className={ox.btnGhostWFit}>
                            Aggiungi link
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className={ox.titleLink}>{g.title}</p>
                          {g.description ? (
                            <p className={ox.descLink} style={{ whiteSpace: 'pre-wrap' }}>
                              {g.description}
                            </p>
                          ) : null}
                          <div className="mt-1 space-y-1">
                            {(g.links || []).map((item, idx) => (
                              <div key={`${g.id}-useful-item-${idx}`} className="flex items-center justify-between gap-3">
                                <span className={ox.lblLinkRow}>{item.label}</span>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={ox.linkOpenPill}
                                >
                                  Apri
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        {isTecnico && !isEditing && (
                          <div className={ox.dragBadge} title="Trascina per riordinare">
                            <GripVertical size={12} />
                            Trascina
                          </div>
                        )}
                        <a
                          href={isEditing ? (editingUsefulGuideline.links?.[0]?.url || '#') : (g.links?.[0]?.url || '#')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                        >
                          Apri primo link
                        </a>
                        {isTecnico && !isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUsefulGuidelineId(g.id);
                              setEditingUsefulGuideline({
                                title: g.title || '',
                                description: g.description || '',
                                links: (g.links && g.links.length > 0)
                                  ? g.links.map((item) => ({ label: item.label || '', url: item.url || '' }))
                                  : [{ label: '', url: '' }]
                              });
                            }}
                            className={ox.btnGhostMd}
                          >
                            Modifica
                          </button>
                        )}
                        {isTecnico && isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveUsefulGuideline(g.id)}
                              disabled={savingUsefulGuideline || !editingUsefulGuideline.title.trim()}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Salva
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUsefulGuidelineId(null);
                                setEditingUsefulGuideline({ title: '', description: '', links: [{ label: '', url: '' }] });
                              }}
                              className={ox.btnGhostMd}
                            >
                              Annulla
                            </button>
                          </>
                        )}
                        {isTecnico && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUsefulGuideline(g.id)}
                            disabled={savingUsefulGuideline}
                            className={ox.btnDelDanger}
                          >
                            <Trash2 size={12} />
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isTecnico && (
              <div className={ox.panelWhite}>
                <h3 className={ox.panelHeading}>Nuova linea guida</h3>
                <div className="space-y-3 mb-3">
                  <input
                    type="text"
                    value={newUsefulGuideline.title}
                    onChange={(e) => setNewUsefulGuideline((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Titolo (es. Best practice attivazione)"
                    className={ox.inp}
                  />
                  <textarea
                    value={newUsefulGuideline.description}
                    onChange={(e) => setNewUsefulGuideline((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrizione (anche lunga)…"
                    className={`${ox.inp} min-h-[12rem] resize-y`}
                  />
                </div>
                <div className="space-y-2">
                  {(newUsefulGuideline.links || []).map((link, idx) => (
                    <div key={`new-useful-link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateNewUsefulGuidelineLinkField(idx, 'label', e.target.value)}
                        placeholder="Etichetta link"
                        className={ox.inp}
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateNewUsefulGuidelineLinkField(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className={ox.inp}
                      />
                      <button
                        type="button"
                        onClick={() => removeNewUsefulGuidelineLinkRow(idx)}
                        disabled={(newUsefulGuideline.links || []).length <= 1}
                        className={ox.btnRedGhost}
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <button type="button" onClick={addNewUsefulGuidelineLinkRow} className={`mr-2 ${ox.btnGhostMd}`}>
                    Aggiungi link
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateUsefulGuideline}
                    disabled={savingUsefulGuideline || !newUsefulGuideline.title.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Plus size={13} />
                    Aggiungi linea guida
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default OfficePage;
