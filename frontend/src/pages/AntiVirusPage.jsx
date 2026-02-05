import React, { useState, useEffect } from 'react';
import { Shield, Search, Save, X, Check, Calendar, AlertTriangle, Monitor } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const AntiVirusPage = ({ onClose, getAuthHeader }) => {
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        is_active: false,
        product_name: '',
        expiration_date: ''
    });

    // Fetch companies
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await fetch(buildApiUrl('/api/network-monitoring/clients'), { headers: getAuthHeader() });
                if (res.ok) {
                    const data = await res.json();
                    setCompanies(data);
                }
            } catch (e) {
                console.error('Error fetching companies:', e);
            }
        };
        fetchCompanies();
    }, [getAuthHeader]);

    // Fetch devices when company selected
    useEffect(() => {
        if (!selectedCompanyId) {
            setDevices([]);
            setSelectedDevice(null);
            return;
        }

        const fetchDevices = async () => {
            setLoading(true);
            try {
                const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/antivirus-devices`), {
                    headers: getAuthHeader()
                });
                if (res.ok) {
                    const data = await res.json();
                    setDevices(data);
                }
            } catch (e) {
                console.error('Error fetching devices:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchDevices();
    }, [selectedCompanyId, getAuthHeader]);

    // Update form when device selected
    useEffect(() => {
        if (selectedDevice) {
            setFormData({
                is_active: selectedDevice.is_active || false,
                product_name: selectedDevice.product_name || '',
                expiration_date: selectedDevice.expiration_date ? selectedDevice.expiration_date.split('T')[0] : ''
            });
        }
    }, [selectedDevice]);

    const filteredDevices = devices.filter(d =>
        d.ip_address.includes(searchTerm) ||
        (d.hostname && d.hostname.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSave = async () => {
        if (!selectedDevice) return;
        setIsSaving(true);
        try {
            const res = await fetch(buildApiUrl(`/api/network-monitoring/antivirus/${selectedDevice.device_id}`), {
                method: 'PUT',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                // Update local list
                setDevices(prev => prev.map(d =>
                    d.device_id === selectedDevice.device_id
                        ? { ...d, ...formData }
                        : d
                ));
                // Update selected device locally to reflect changes in list immediately if needed
                setSelectedDevice(prev => ({ ...prev, ...formData }));
            }
        } catch (e) {
            console.error('Error saving antivirus info:', e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                        <Shield size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-800">Gestione Anti-Virus</h1>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        className="border rounded-lg px-3 py-2 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="">Seleziona Cliente...</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.azienda || c.nome + ' ' + c.cognome}</option>
                        ))}
                    </select>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500" title="Chiudi">
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Device List */}
                <div className="w-1/3 bg-white border-r flex flex-col max-w-md">
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Cerca IP o Hostname..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {!selectedCompanyId ? (
                            <div className="p-8 text-center text-gray-500">Seleziona un cliente per visualizzare i dispositivi</div>
                        ) : loading ? (
                            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                                <span className="animate-spin text-2xl mb-2">⌛</span>
                                Caricamento...
                            </div>
                        ) : filteredDevices.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Nessun dispositivo trovato</div>
                        ) : (
                            <div className="divide-y">
                                {filteredDevices.map(dev => (
                                    <div
                                        key={dev.device_id}
                                        onClick={() => setSelectedDevice(dev)}
                                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedDevice?.device_id === dev.device_id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-mono font-medium text-gray-800">{dev.ip_address}</span>
                                            {dev.is_active ? (
                                                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Check size={12} /> Attivo
                                                </span>
                                            ) : (
                                                <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Non Attivo</span>
                                            )}
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span className="truncate max-w-[120px]" title={dev.hostname}>{dev.hostname || 'N/A'}</span>
                                            <span className="font-mono">{dev.product_name || '-'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Details */}
                <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
                    {selectedDevice ? (
                        <div className="bg-white rounded-xl shadow-sm border p-6 max-w-2xl mx-auto">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                                <Monitor className="text-gray-400" size={32} />
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">{selectedDevice.ip_address}</h2>
                                    <p className="text-sm text-gray-500">{selectedDevice.hostname} • {selectedDevice.mac_address}</p>
                                </div>
                                {selectedDevice.status === 'online' ? (
                                    <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Online</span>
                                ) : (
                                    <span className="ml-auto bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">Offline</span>
                                )}
                            </div>

                            <div className="space-y-6">
                                {/* Active Switch */}
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                                    <div>
                                        <h3 className="font-medium text-gray-900">Stato Anti-Virus</h3>
                                        <p className="text-sm text-gray-500">Indica se è presente un antivirus gestito</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                {/* Product Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prodotto Installato</label>
                                    <div className="relative">
                                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Es. Kaspersky Endpoint Security"
                                            value={formData.product_name}
                                            onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Expiration Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Scadenza</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="date"
                                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.expiration_date}
                                            onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                                        />
                                    </div>
                                    {formData.expiration_date && new Date(formData.expiration_date) < new Date() && (
                                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                                            <AlertTriangle size={14} /> Scaduto o in scadenza
                                        </p>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                                    >
                                        {isSaving ? <span className="animate-spin">⌛</span> : <Save size={18} />}
                                        Salva Modifiche
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="bg-gray-100 p-6 rounded-full mb-4">
                                <Shield size={48} className="text-gray-300" />
                            </div>
                            <p className="text-lg font-medium">Seleziona un IP dalla lista</p>
                            <p className="text-sm">Visualizza e modifica i dettagli dell'Anti-Virus</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AntiVirusPage;
