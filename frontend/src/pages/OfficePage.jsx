// frontend/src/pages/OfficePage.jsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader, Calendar, X, Eye, EyeOff, RefreshCw, ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import SectionNavMenu from '../components/SectionNavMenu';
import { buildApiUrl } from '../utils/apiConfig';
import OfficeIntroCard from '../components/OfficeIntroCard';
import {
  HUB_PAGE_BG,
  HUB_SURFACE,
  hexToRgba,
  normalizeHex,
  getStoredTechHubAccent
} from '../utils/techHubAccent';

const OfficePage = ({
  onClose,
  getAuthHeader,
  selectedCompanyId: initialCompanyId,
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
  accentHex: accentHexProp
}) => {
  const accent = useMemo(() => normalizeHex(accentHexProp) || getStoredTechHubAccent(), [accentHexProp]);
  const isCliente = currentUser?.ruolo === 'cliente';
  const isTecnico = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const showPasswordColumn = isTecnico || (currentUser?.ruolo === 'cliente' && currentUser?.admin_companies && currentUser.admin_companies.length > 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [officeData, setOfficeData] = useState(null);
  const [companyName, setCompanyName] = useState('');
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
    }
    setVisiblePasswords({});
    setLoadingPasswords({});
  }, [selectedCompanyId, companies, loadingCompanies, selectedCompanyValid]);

  const officeEntryKey = (file) => `${file.title || ''}|${file.username || ''}`;

  const fetchPassword = async (file) => {
    if (!showPasswordColumn || !companyName || !getAuthHeader) return;
    const key = officeEntryKey(file);
    setLoadingPasswords(p => ({ ...p, [key]: true }));
    try {
      const params = new URLSearchParams({ aziendaName: companyName, title: file.title || '', username: file.username || '' });
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

  const refreshOfficeData = async () => {
    if (!selectedCompanyValid) return;
    setVisiblePasswords({});
    setLoadingPasswords({});
    await loadOfficeData(selectedCompanyId);
  };

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

  useEffect(() => {
    if (!selectedCompanyValid || !companyName) {
      setDownloadLinks([]);
      setDownloadError(null);
      setActivationGuides([]);
      setActivationError(null);
      setActiveView('licenses');
      return;
    }
    loadDownloadLinks(companyName);
    loadActivationGuides(companyName);
  }, [selectedCompanyValid, companyName, loadDownloadLinks, loadActivationGuides]);

  const handleCreateDownloadLink = async () => {
    if (!isTecnico || !companyName || savingDownload) return;
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
          azienda_name: companyName,
          title,
          description,
          links,
          sort_order: downloadLinks.length
        })
      });
      if (!res.ok) throw new Error('Errore creazione link');
      setNewDownload({ title: '', description: '', links: [{ label: '', url: '' }] });
      await loadDownloadLinks(companyName);
    } catch (err) {
      console.error('Errore creazione link download:', err);
      setDownloadError('Impossibile creare il link');
    } finally {
      setSavingDownload(false);
    }
  };

  const handleSaveDownloadLink = async (id) => {
    if (!isTecnico || !companyName || !id) return;
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
      await loadDownloadLinks(companyName);
    } catch (err) {
      console.error('Errore salvataggio link download:', err);
      setDownloadError('Impossibile aggiornare il link');
    } finally {
      setSavingDownload(false);
    }
  };

  const handleDeleteDownloadLink = async (id) => {
    if (!isTecnico || !companyName || !id || savingDownload) return;
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
      await loadDownloadLinks(companyName);
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
    if (!isTecnico || !companyName || savingDownload) return;
    setSavingDownload(true);
    setDownloadError(null);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-download-links-reorder'), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyName,
          ordered_ids: reordered.map((item) => item.id)
        })
      });
      if (!res.ok) throw new Error('Errore riordino link');
      setDownloadLinks(reordered.map((item, idx) => ({ ...item, sort_order: idx })));
    } catch (err) {
      console.error('Errore riordino link download:', err);
      setDownloadError('Impossibile riordinare i link');
      await loadDownloadLinks(companyName);
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
    if (!isTecnico || !companyName || savingActivation) return;
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
          azienda_name: companyName,
          title,
          description,
          links,
          sort_order: activationGuides.length
        })
      });
      if (!res.ok) throw new Error('Errore creazione guida');
      setNewActivation({ title: '', description: '', links: [{ label: '', url: '' }] });
      await loadActivationGuides(companyName);
    } catch (err) {
      console.error('Errore creazione guida attivazione:', err);
      setActivationError('Impossibile creare la guida');
    } finally {
      setSavingActivation(false);
    }
  };

  const handleSaveActivationGuide = async (id) => {
    if (!isTecnico || !companyName || !id) return;
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
      await loadActivationGuides(companyName);
    } catch (err) {
      console.error('Errore salvataggio guida attivazione:', err);
      setActivationError('Impossibile aggiornare la guida');
    } finally {
      setSavingActivation(false);
    }
  };

  const handleDeleteActivationGuide = async (id) => {
    if (!isTecnico || !companyName || !id || savingActivation) return;
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
      await loadActivationGuides(companyName);
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
    if (!isTecnico || !companyName || savingActivation) return;
    setSavingActivation(true);
    setActivationError(null);
    try {
      const res = await fetch(buildApiUrl('/api/keepass/office-activation-guides-reorder'), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyName,
          ordered_ids: reordered.map((item) => item.id)
        })
      });
      if (!res.ok) throw new Error('Errore riordino guide');
      setActivationGuides(reordered.map((item, idx) => ({ ...item, sort_order: idx })));
    } catch (err) {
      console.error('Errore riordino guide attivazione:', err);
      setActivationError('Impossibile riordinare le guide');
      await loadActivationGuides(companyName);
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

  const loadOfficeData = async (companyIdOverride = null) => {
    const companyIdToUse = companyIdOverride || selectedCompanyId;
    
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

      const aziendaName = company.azienda || '';
      console.log('🔍 Caricamento Office per azienda:', aziendaName, 'ID:', company.id);
      
      // Pulisci il nome dell'azienda da eventuali caratteri strani o ID
      const cleanAziendaName = aziendaName.split(':')[0].trim();
      console.log('🔍 Nome azienda pulito:', cleanAziendaName);
      
      setCompanyName(cleanAziendaName);

      // Ora recupera i dati Office da Keepass
      const apiUrl = buildApiUrl(`/api/keepass/office/${encodeURIComponent(cleanAziendaName)}`);
      console.log('🔍 URL API chiamato:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: getAuthHeader(),
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setError('Office non trovato in Keepass per questa azienda');
        } else {
          throw new Error(errorData.error || 'Errore nel caricamento dei dati Office');
        }
        return;
      }

      const data = await response.json();
      console.log('📦 Dati Office ricevuti dal backend:', data);
      console.log('📦 customFields:', data.customFields);
      console.log('📦 Tipo customFields:', typeof data.customFields);
      console.log('📦 È array?', Array.isArray(data.customFields));
      console.log('📦 Chiavi customFields:', data.customFields ? Object.keys(data.customFields) : 'null');
      console.log('📦 Valori customFields:', data.customFields ? Object.entries(data.customFields).map(([k, v]) => `${k}: "${v}"`).join(', ') : 'null');
      setOfficeData(data);
      // Carica stati scaduta/nota per le card di questa azienda
      await loadCardStatuses(cleanAziendaName);
    } catch (err) {
      console.error('Errore caricamento Office:', err);
      setError(err.message || 'Errore nel caricamento dei dati Office');
    } finally {
      setLoading(false);
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
    if (!companyName || !getAuthHeader || !isTecnico) return;
    const key = cardKey(file);
    const current = cardStatuses[key] || { note: '' };
    const merged = { ...current, ...fields };
    setCardStatuses(prev => ({ ...prev, [key]: merged }));
    try {
      await fetch(buildApiUrl('/api/keepass/office-card-status'), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyName,
          card_title: file.title || '',
          card_username: file.username || '',
          is_expired: false,
          note: merged.note
        })
      });
    } catch (e) { console.warn('Errore salvataggio card status:', e); }
  }, [companyName, getAuthHeader, isTecnico, cardStatuses]);

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
    ? 'flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] font-sans'
    : 'fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden';

  const rootEmbeddedStyle = useMemo(
    () =>
      embedded
        ? {
            backgroundColor: HUB_PAGE_BG,
            ['--hub-accent']: accent,
            ['--hub-accent-border']: hexToRgba(accent, 0.48)
          }
        : undefined,
    [embedded, accent]
  );

  const embeddedBackBtnStyle = useMemo(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(0,0,0,0.28)',
      color: 'rgba(255,255,255,0.82)',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      flexShrink: 0
    }),
    []
  );

  const selectClsOffice = embedded
    ? 'rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none [color-scheme:light] focus:ring-2 focus:ring-blue-500/80'
    : 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  const refreshOfficeBtnCls = embedded
    ? 'inline-flex items-center gap-1 rounded-md border border-white/14 bg-black/35 px-2.5 py-1.5 text-xs font-medium text-white/88 transition-colors hover:bg-white/[0.08] disabled:opacity-50'
    : 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50';

  return (
    <div className={rootClassName} style={rootEmbeddedStyle}>
      {/* Header */}
      <div
        className={
          embedded
            ? 'flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 z-10 shadow-none'
            : 'bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10'
        }
        style={embedded ? { backgroundColor: HUB_SURFACE } : undefined}
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
            <h1 className={`font-bold truncate ${embedded ? 'text-lg text-white' : 'text-xl text-gray-900'}`}>Office</h1>
            <p className={`truncate ${embedded ? 'text-xs text-white/55' : 'text-sm text-gray-600'}`}>
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
          className={embedded ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-6 md:px-5' : 'h-full'}
          style={embedded ? { backgroundColor: HUB_PAGE_BG } : undefined}
        >
        {loadingCompanies && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Caricamento aziende...</p>
            </div>
          </div>
        )}

        {showIntro && (
          <div className="max-w-4xl mx-auto w-full">
            <OfficeIntroCard
              companies={companies}
              value={selectedCompanyValid ? selectedCompanyId : ''}
              onChange={(companyId) => {
                const newCompanyId = companyId || null;
                setSelectedCompanyId(newCompanyId);
                if (onCompanyChange) onCompanyChange(newCompanyId);
                setError(null);
                setOfficeData(null);
                setCompanyName('');
                if (newCompanyId) {
                  const company = companies.find(c => String(c.id) === String(newCompanyId));
                  if (company) setCompanyName((company.azienda || '').split(':')[0].trim());
                }
              }}
            />
          </div>
        )}

        {loading && selectedCompanyId && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Caricamento dati Office da Keepass...</p>
            </div>
          </div>
        )}

        {!loading && !loadingCompanies && error && !showIntro && selectedCompanyId && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <X size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 mb-1">Errore</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && officeData && activeView === 'licenses' && (
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-700">Download Office</p>
              <button
                type="button"
                onClick={() => setActiveView('downloads')}
                className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Apri download
              </button>
            </div>
            <div className="mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-700">Attivazione licenza Office</p>
              <button
                type="button"
                onClick={() => setActiveView('activations')}
                className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Apri attivazioni
              </button>
            </div>
            {/* Lista di tutti i file trovati */}
            {officeData.files && officeData.files.length > 0 ? (
              <div className="columns-1 md:columns-2 gap-4">
                {officeData.files.map((file, index) => {
                const status = cardStatuses[cardKey(file)] || { note: '' };
                const keepassExpired = file.expires ? new Date(file.expires) < new Date() : false;
                const isExpired = keepassExpired;
                const hasUsername = !!(file.username && file.username.trim() !== '');
                const hasPassword = !!file.hasPassword;
                const canShowPassword = showPasswordColumn && hasPassword;
                const showCredentialsRow = hasUsername || canShowPassword;
                const licenseValue = file.license ? String(file.license).trim() : '';
                return (
                <div key={index} className={`break-inside-avoid mb-4 bg-white rounded-lg shadow-sm border-2 px-4 py-3 transition-colors ${isExpired ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                  {/* Titolo */}
                  <div className="mb-2 pb-2 border-b border-gray-200">
                    <h3 className="text-base font-bold text-gray-900 truncate">{file.title || `File ${index + 1}`}</h3>
                    {/* Nome utente e Password sulla stessa riga */}
                    {showCredentialsRow && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-12 gap-y-2">
                      {hasUsername && (
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide shrink-0">Nome utente</p>
                          <p className="text-xs text-gray-900 font-mono">{file.username}</p>
                        </div>
                      )}
                      {canShowPassword && (
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide shrink-0">Password</p>
                          {visiblePasswords[officeEntryKey(file)] !== undefined ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-gray-800 bg-gray-50 px-2 py-0.5 rounded text-xs">{visiblePasswords[officeEntryKey(file)]}</span>
                              <button
                                type="button"
                                onClick={() => hidePassword(file)}
                                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
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
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors whitespace-nowrap disabled:opacity-50"
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
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide shrink-0">Licenza</p>
                        <p className="text-xs text-gray-900">{licenseValue}</p>
                      </div>
                    )}
                  </div>

                  {/* Campi personalizzati del file */}
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 mb-1">Attivo su:</h4>
                    
                    {file.customFields && Object.keys(file.customFields).length > 0 ? (() => {
                      const numericFieldMap = new Map();
                      Object.entries(file.customFields).forEach(([rawKey, rawValue]) => {
                        const match = String(rawKey).match(/^(?:custom)?(\d+)$/i);
                        if (!match) return;
                        const fieldNumber = parseInt(match[1], 10);
                        if (!Number.isFinite(fieldNumber) || fieldNumber < 1) return;
                        numericFieldMap.set(fieldNumber, rawValue);
                      });

                      if (numericFieldMap.size === 0) {
                        return <p className="text-xs text-gray-500 italic">Nessun campo personalizzato numerico trovato</p>;
                      }

                      const maxFieldNumber = Math.max(...numericFieldMap.keys());
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
                          {Array.from({ length: maxFieldNumber }, (_, idx) => {
                            const fieldNumber = idx + 1;
                            const value = numericFieldMap.get(fieldNumber);
                            const valueStr = value ? String(value).trim() : '';

                            return (
                              <div key={`custom-${fieldNumber}`} className={`border-l-4 ${getBorderColor(fieldNumber)} pl-3 py-1`}>
                                {valueStr ? (
                                  <p className="text-sm text-gray-900">
                                    <span className="font-semibold">{fieldNumber}.</span> {valueStr}
                                  </p>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">
                                    <span className="font-semibold">{fieldNumber}.</span> (vuoto)
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })() : (
                      <p className="text-xs text-gray-500 italic">Nessun campo personalizzato trovato</p>
                    )}
                  </div>

                  {/* Scadenza + Nota (automatica da KeePass) */}
                  {file.expires && (
                    <div className={`pt-2 border-t ${isExpired ? 'border-red-300' : 'border-gray-200'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className={keepassExpired ? 'text-red-600' : 'text-gray-600'} />
                          <p className="text-xs text-gray-500">
                            Scadenza:{' '}
                            <span className={`font-medium ${keepassExpired ? 'text-red-700' : 'text-gray-900'}`}>
                              {formatDate(file.expires)}
                              {keepassExpired ? ' (scaduta)' : ''}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 sm:max-w-xs">
                          <span className="text-xs text-gray-500 shrink-0">Nota:</span>
                          {isTecnico ? (
                            <input
                              type="text"
                              value={status.note}
                              onChange={(e) => saveNoteDebounced(file, e.target.value)}
                              placeholder="Aggiungi nota..."
                              className={`flex-1 min-w-0 text-xs border rounded px-2 py-1 outline-none focus:ring-1 ${isExpired ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-400'}`}
                            />
                          ) : (
                            <span className="text-xs text-gray-700 truncate">{status.note || '-'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Apri ticket */}
                  {typeof onOpenTicket === 'function' && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between gap-3 flex-nowrap">
                      <p className="text-xs text-gray-600 truncate min-w-0 flex-1">Hai un dubbio o un problema tecnico? Apri una richiesta di supporto</p>
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
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <p className="text-gray-500 italic">Nessun file trovato nel gruppo Office</p>
              </div>
            )}
          </div>
        )}

        {!loading && !error && officeData && activeView === 'downloads' && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Download Office</p>
                <p className="text-xs text-gray-500">I tecnici possono creare e aggiornare i link. Gli utenti possono solo aprirli.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('licenses')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft size={13} />
                Torna a Office
              </button>
            </div>

            {isTecnico && (
              <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Nuovo blocco download</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={newDownload.title}
                    onChange={(e) => setNewDownload((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Titolo (es. Office 2024)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newDownload.description}
                    onChange={(e) => setNewDownload((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrizione (opzionale)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateNewLinkField(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewLinkRow(idx)}
                        disabled={(newDownload.links || []).length <= 1}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
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
                    className="mr-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
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

            {loadingDownloadLinks ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                <Loader size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Caricamento link download...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {downloadError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {downloadError}
                  </div>
                )}
                {downloadLinks.length === 0 && !downloadError && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500 italic">
                    Nessun link download configurato per questa azienda
                  </div>
                )}
                {downloadLinks.map((link) => {
                  const isEditing = editingDownloadId === link.id;
                  const isDragOver = dragOverDownloadId === link.id;
                  return (
                    <div
                      key={link.id}
                      className={`bg-white border rounded-lg p-4 transition-colors ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
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
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={editingDownload.description}
                            onChange={(e) => setEditingDownload((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Descrizione"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {(editingDownload.links || []).map((editLink, idx) => (
                            <div key={`edit-link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                              <input
                                type="text"
                                value={editLink.label}
                                onChange={(e) => updateEditingLinkField(idx, 'label', e.target.value)}
                                placeholder="Etichetta link"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="url"
                                value={editLink.url}
                                onChange={(e) => updateEditingLinkField(idx, 'url', e.target.value)}
                                placeholder="https://..."
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => removeEditingLinkRow(idx)}
                                disabled={(editingDownload.links || []).length <= 1}
                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                Rimuovi
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addEditingLinkRow}
                            className="w-fit px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
                          >
                            Aggiungi link
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-semibold text-gray-900">{link.title}</p>
                          {link.description ? <p className="text-xs text-gray-600">{link.description}</p> : null}
                          <div className="mt-1 space-y-1">
                            {(link.links || []).map((item, idx) => (
                              <div key={`${link.id}-item-${idx}`} className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-700 truncate">{item.label}</span>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
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
                          <div
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded"
                            title="Trascina per riordinare"
                          >
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
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
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
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
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
          </div>
        )}

        {!loading && !error && officeData && activeView === 'activations' && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Guide attivazione Office</p>
                <p className="text-xs text-gray-500">I tecnici possono creare e aggiornare le guide. Gli utenti possono solo aprire i link.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('licenses')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft size={13} />
                Torna a Office
              </button>
            </div>

            {isTecnico && (
              <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Nuova guida attivazione</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={newActivation.title}
                    onChange={(e) => setNewActivation((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Titolo (es. Office 2024 Pro Plus)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newActivation.description}
                    onChange={(e) => setNewActivation((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrizione (opzionale)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateNewActivationLinkField(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewActivationLinkRow(idx)}
                        disabled={(newActivation.links || []).length <= 1}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={addNewActivationLinkRow}
                    className="mr-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
                  >
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

            {loadingActivationGuides ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                <Loader size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Caricamento guide attivazione...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activationError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {activationError}
                  </div>
                )}
                {activationGuides.length === 0 && !activationError && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500 italic">
                    Nessuna guida attivazione configurata per questa azienda
                  </div>
                )}
                {activationGuides.map((guide) => {
                  const isEditing = editingActivationId === guide.id;
                  const isDragOver = dragOverActivationId === guide.id;
                  return (
                    <div
                      key={guide.id}
                      className={`bg-white border rounded-lg p-4 transition-colors ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
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
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={editingActivation.description}
                            onChange={(e) => setEditingActivation((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Descrizione"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {(editingActivation.links || []).map((editLink, idx) => (
                            <div key={`edit-activation-link-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                              <input
                                type="text"
                                value={editLink.label}
                                onChange={(e) => updateEditingActivationLinkField(idx, 'label', e.target.value)}
                                placeholder="Etichetta link"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="url"
                                value={editLink.url}
                                onChange={(e) => updateEditingActivationLinkField(idx, 'url', e.target.value)}
                                placeholder="https://..."
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => removeEditingActivationLinkRow(idx)}
                                disabled={(editingActivation.links || []).length <= 1}
                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                Rimuovi
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addEditingActivationLinkRow}
                            className="w-fit px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
                          >
                            Aggiungi link
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-semibold text-gray-900">{guide.title}</p>
                          {guide.description ? <p className="text-xs text-gray-600">{guide.description}</p> : null}
                          <div className="mt-1 space-y-1">
                            {(guide.links || []).map((item, idx) => (
                              <div key={`${guide.id}-activation-item-${idx}`} className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-700 truncate">{item.label}</span>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
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
                          <div
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded"
                            title="Trascina per riordinare"
                          >
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
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
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
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
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
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default OfficePage;
