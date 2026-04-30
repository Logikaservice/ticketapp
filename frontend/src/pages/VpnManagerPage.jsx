import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Download, Trash2, RefreshCw } from 'lucide-react';

const EMPTY_TARGET = { name: '', ip: '' };

const DEFAULT_INSTALLER_URL = 'https://openvpn.net/community-downloads/';

const createEmptyForm = () => ({
  id: null,
  profile_name: '',
  customer_name: '',
  installer_url: DEFAULT_INSTALLER_URL,
  ovpn_filename: 'client.ovpn',
  ovpn_content: '',
  rdp_targets: [{ ...EMPTY_TARGET }]
});

const VpnManagerPage = ({ getAuthHeader, onNavigateHome }) => {
  const [loading, setLoading] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [form, setForm] = useState(createEmptyForm());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isEditing = useMemo(() => !!form.id, [form.id]);
  const filteredProfiles = useMemo(() => {
    if (!companyFilter) return profiles;
    const target = companyFilter.trim().toLowerCase();
    return profiles.filter((p) => String(p.customer_name || '').trim().toLowerCase() === target);
  }, [profiles, companyFilter]);

  const fetchProfiles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/vpn/profiles', { headers: getAuthHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Errore caricamento profili');
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Errore caricamento profili');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch('/api/users', { headers: getAuthHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Errore caricamento aziende');
      const uniqueCompanies = [...new Set(
        (Array.isArray(data) ? data : [])
          .filter((u) => u?.ruolo === 'cliente' && u?.azienda)
          .map((u) => String(u.azienda).trim())
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b));
      setCompanies(uniqueCompanies);
    } catch (_) {
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const setTargetField = (index, field, value) => {
    setForm((prev) => {
      const nextTargets = [...prev.rdp_targets];
      nextTargets[index] = { ...nextTargets[index], [field]: value };
      return { ...prev, rdp_targets: nextTargets };
    });
  };

  const addTarget = () => {
    setForm((prev) => ({ ...prev, rdp_targets: [...prev.rdp_targets, { ...EMPTY_TARGET }] }));
  };

  const removeTarget = (index) => {
    setForm((prev) => {
      const nextTargets = prev.rdp_targets.filter((_, i) => i !== index);
      return { ...prev, rdp_targets: nextTargets.length ? nextTargets : [{ ...EMPTY_TARGET }] };
    });
  };

  const selectProfile = async (id) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/vpn/profiles/${id}`, { headers: getAuthHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Errore caricamento profilo');
      setForm({
        id: data.id,
        profile_name: data.profile_name || '',
        customer_name: data.customer_name || '',
        installer_url: data.installer_url || DEFAULT_INSTALLER_URL,
        ovpn_filename: data.ovpn_filename || 'client.ovpn',
        ovpn_content: data.ovpn_content || '',
        rdp_targets: Array.isArray(data.rdp_targets) && data.rdp_targets.length ? data.rdp_targets : [{ ...EMPTY_TARGET }]
      });
    } catch (err) {
      setError(err.message || 'Errore caricamento profilo');
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `/api/vpn/profiles/${form.id}` : '/api/vpn/profiles';
      const res = await fetch(url, {
        method,
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Errore salvataggio profilo');
      setMessage(isEditing ? 'Profilo aggiornato.' : 'Profilo creato.');
      setForm({
        id: data.id,
        profile_name: data.profile_name || '',
        customer_name: data.customer_name || '',
        installer_url: data.installer_url || DEFAULT_INSTALLER_URL,
        ovpn_filename: data.ovpn_filename || 'client.ovpn',
        ovpn_content: data.ovpn_content || '',
        rdp_targets: Array.isArray(data.rdp_targets) && data.rdp_targets.length ? data.rdp_targets : [{ ...EMPTY_TARGET }]
      });
      await fetchProfiles();
    } catch (err) {
      setError(err.message || 'Errore salvataggio profilo');
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async () => {
    if (!form.id) return;
    if (!window.confirm('Confermi eliminazione profilo VPN?')) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/vpn/profiles/${form.id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Errore eliminazione profilo');
      setMessage('Profilo eliminato.');
      setForm(createEmptyForm());
      await fetchProfiles();
    } catch (err) {
      setError(err.message || 'Errore eliminazione profilo');
    }
  };

  const downloadPackage = async () => {
    if (!form.id) {
      setError('Prima salva il profilo, poi scarica il pacchetto.');
      return;
    }
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/vpn/profiles/${form.id}/package`, {
        headers: getAuthHeader()
      });
      if (!res.ok) {
        const maybeJson = await res.json().catch(() => ({}));
        throw new Error(maybeJson?.error || 'Errore generazione pacchetto');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vpn-package-${form.profile_name || 'cliente'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMessage('Pacchetto scaricato.');
    } catch (err) {
      setError(err.message || 'Errore download pacchetto');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">VPN - Menù Progetti</h1>
            <p className="text-sm text-gray-600 mt-1">
              Crea pacchetti personalizzati per installare OpenVPN Community, copiare il file OVPN e preparare i collegamenti RDP.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onNavigateHome} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">Dashboard</button>
            <button onClick={fetchProfiles} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 inline-flex items-center gap-2">
              <RefreshCw size={16} /> Aggiorna
            </button>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Profili esistenti</h2>
            {(loading || loadingCompanies) && <span className="text-xs text-gray-500">caricamento...</span>}
          </div>
          <label className="block text-sm mb-3">
            <span className="block text-gray-700 mb-1">Filtra per azienda</span>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="">Tutte le aziende</option>
              {companies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="space-y-2 max-h-[500px] overflow-auto">
            {filteredProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProfile(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition ${form.id === p.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="font-medium text-sm text-gray-900">{p.profile_name}</div>
                <div className="text-xs text-gray-500">{p.customer_name || 'Cliente non indicato'}</div>
              </button>
            ))}
            {!filteredProfiles.length && !loading && (
              <p className="text-sm text-gray-500">Nessun profilo salvato.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Nome profilo *</span>
              <input className="w-full border rounded-lg px-3 py-2" value={form.profile_name} onChange={(e) => setForm((f) => ({ ...f, profile_name: e.target.value }))} />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Cliente</span>
              <input
                list="vpn-company-list"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Seleziona da elenco o scrivi manualmente"
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
              <datalist id="vpn-company-list">
                {companies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-gray-700 mb-1">URL installer OpenVPN *</span>
              <input className="w-full border rounded-lg px-3 py-2" value={form.installer_url} onChange={(e) => setForm((f) => ({ ...f, installer_url: e.target.value }))} />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-gray-700 mb-1">Nome file OVPN *</span>
              <input className="w-full border rounded-lg px-3 py-2" value={form.ovpn_filename} onChange={(e) => setForm((f) => ({ ...f, ovpn_filename: e.target.value }))} />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-gray-700 mb-1">Contenuto file .ovpn *</span>
              <textarea className="w-full border rounded-lg px-3 py-2 font-mono text-xs" rows={10} value={form.ovpn_content} onChange={(e) => setForm((f) => ({ ...f, ovpn_content: e.target.value }))} />
            </label>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Desktop remoti (RDP)</h3>
              <button onClick={addTarget} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 inline-flex items-center gap-2 text-sm">
                <Plus size={16} /> Aggiungi
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {form.rdp_targets.map((t, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                  <label className="md:col-span-5 text-sm">
                    <span className="block text-gray-700 mb-1">Nome file/connessione RDP</span>
                    <input className="w-full border rounded-lg px-3 py-2" value={t.name} onChange={(e) => setTargetField(idx, 'name', e.target.value)} />
                  </label>
                  <label className="md:col-span-5 text-sm">
                    <span className="block text-gray-700 mb-1">IP</span>
                    <input className="w-full border rounded-lg px-3 py-2" value={t.ip} onChange={(e) => setTargetField(idx, 'ip', e.target.value)} />
                  </label>
                  <button onClick={() => removeTarget(idx)} className="md:col-span-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 inline-flex items-center justify-center gap-2 text-sm">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button disabled={saving} onClick={() => { setForm(createEmptyForm()); setMessage(''); setError(''); }} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
              Nuovo profilo
            </button>
            <button disabled={saving} onClick={saveProfile} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-2">
              <Save size={16} /> {saving ? 'Salvataggio...' : isEditing ? 'Aggiorna profilo' : 'Crea profilo'}
            </button>
            <button disabled={saving || !form.id} onClick={downloadPackage} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-2">
              <Download size={16} /> Scarica pacchetto ZIP
            </button>
            <button disabled={saving || !form.id} onClick={deleteProfile} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-2">
              <Trash2 size={16} /> Elimina
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VpnManagerPage;
