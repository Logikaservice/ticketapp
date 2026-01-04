import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, User, FileText, CheckCircle, Upload, Plus, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const ManageContractsModal = ({ onClose, onSuccess, notify, getAuthHeader }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Details, 2: Schedule/Upload

    const [formData, setFormData] = useState({
        user_id: '',
        title: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        billing_frequency: 'monthly',
        amount: '',
        notes: '',
        contractPdf: null
    });

    const [generatedEvents, setGeneratedEvents] = useState([]);

    const loadedRef = useRef(false);

    // Fetch users on mount
    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;

        const fetchUsers = async () => {
            try {
                const res = await fetch(buildApiUrl('/api/users'), { headers: getAuthHeader() });
                const data = await res.json();
                // Filter for clients only? Or all? Usually contracts are clients.
                // Controllo se il componente è ancora montato prima di settare lo stato
                setUsers(data.filter(u => u.ruolo === 'cliente'));
            } catch (err) {
                // Silenzia l'errore per evitare spam in console se il componente viene smontato/rimontato rapidamente
                // console.error('Failed to load users', err);
                notify('Errore caricamento utenti', 'error');
            }
        };
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Generate events preview
    const generatePreview = () => {
        if (!formData.start_date) return;

        const events = [];
        let current = new Date(formData.start_date);
        const end = formData.end_date ? new Date(formData.end_date) : new Date(new Date().setFullYear(current.getFullYear() + 3));

        // Safety break
        let limit = 0;
        while (current <= end && limit < 50) {
            events.push({
                date: current.toISOString().split('T')[0],
                type: 'invoice',
                title: 'Fattura Periodica',
                description: `Fatturazione ${formData.billing_frequency}`,
                amount: formData.amount
            });

            if (formData.billing_frequency === 'monthly') current.setMonth(current.getMonth() + 1);
            else if (formData.billing_frequency === 'quarterly') current.setMonth(current.getMonth() + 3);
            else if (formData.billing_frequency === 'semiannual') current.setMonth(current.getMonth() + 6);
            else if (formData.billing_frequency === 'annual') current.setFullYear(current.getFullYear() + 1);
            else break; // Custom implies manual add only?

            limit++;
        }
        setGeneratedEvents(events);
    };

    const handleNext = () => {
        if (!formData.user_id || !formData.title || !formData.start_date) {
            notify('Compila i campi obbligatori', 'warning');
            return;
        }
        generatePreview();
        setStep(2);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // 1. Create Contract & Events
            const payload = {
                ...formData,
                client_name: users.find(u => u.id === parseInt(formData.user_id))?.azienda || 'Cliente',
                events: generatedEvents
            };

            const res = await fetch(buildApiUrl('/api/contracts'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to create contract');

            const { contractId } = await res.json();

            // 2. Upload PDF if present
            if (formData.contractPdf) {
                const formDataUpload = new FormData();
                formDataUpload.append('contractPdf', formData.contractPdf);

                await fetch(buildApiUrl(`/api/contracts/${contractId}/upload`), {
                    method: 'POST',
                    headers: {
                        ...getAuthHeader(),
                        // No Content-Type for FormData, browser sets it
                    },
                    body: formDataUpload
                });
            }

            notify('Contratto creato con successo!', 'success');
            onSuccess();
            onClose();

        } catch (err) {
            console.error(err);
            notify('Errore salvataggio contratto', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Nuovo Contratto</h2>
                        <p className="text-sm text-slate-500">Gestione ricorrenze e documenti</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Client Selector */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
                                    <select
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={formData.user_id}
                                        onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                                    >
                                        <option value="">Seleziona Cliente...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.azienda || `${u.nome} ${u.cognome}`}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Contract Title */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Titolo Contratto *</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        placeholder="es. Manutenzione Server 2024"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>

                                {/* Dates */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data Inizio *</label>
                                    <input
                                        type="date"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data Fine (Opzionale)</label>
                                    <input
                                        type="date"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        value={formData.end_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                    />
                                </div>

                                {/* Billing */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Frequenza Fatturazione</label>
                                    <select
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        value={formData.billing_frequency}
                                        onChange={e => setFormData({ ...formData, billing_frequency: e.target.value })}
                                    >
                                        <option value="monthly">Mensile</option>
                                        <option value="quarterly">Trimestrale</option>
                                        <option value="semiannual">Semestrale</option>
                                        <option value="annual">Annuale</option>
                                        <option value="custom">Personalizzata</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Importo (€)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Note (Visibile al cliente)</label>
                                <textarea
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg h-24"
                                    placeholder="Dettagli aggiuntivi..."
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                ></textarea>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* PDF Upload */}
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition">
                                <input
                                    type="file"
                                    className="hidden"
                                    id="contract-pdf"
                                    accept=".pdf"
                                    onChange={e => setFormData({ ...formData, contractPdf: e.target.files[0] })}
                                />
                                <label htmlFor="contract-pdf" className="cursor-pointer flex flex-col items-center">
                                    <Upload size={48} className="text-slate-400 mb-2" />
                                    <span className="font-semibold text-slate-600">
                                        {formData.contractPdf ? formData.contractPdf.name : 'Carica il Contratto Firmato (PDF)'}
                                    </span>
                                    <span className="text-sm text-slate-400 mt-1">Clicca o trascina qui</span>
                                </label>
                            </div>

                            {/* Schedule Preview */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                        <Calendar size={18} />
                                        Piano Scadenze Generato
                                    </h3>
                                    <button
                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                        onClick={() => {
                                            setGeneratedEvents([...generatedEvents, {
                                                date: new Date().toISOString().split('T')[0],
                                                type: 'invoice',
                                                description: 'Nuova Scadenza',
                                                amount: formData.amount
                                            }]);
                                        }}
                                    >
                                        <Plus size={14} /> Aggiungi Scadenza
                                    </button>
                                </div>

                                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 text-slate-600">
                                            <tr>
                                                <th className="p-3">Data</th>
                                                <th className="p-3">Descrizione</th>
                                                <th className="p-3">Importo</th>
                                                <th className="p-3">Azioni</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {generatedEvents.map((ev, idx) => (
                                                <tr key={idx} className="border-t border-slate-200 hover:bg-white transition">
                                                    <td className="p-3">
                                                        <input
                                                            type="date"
                                                            value={ev.date}
                                                            className="bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none w-32"
                                                            onChange={(e) => {
                                                                const newEvents = [...generatedEvents];
                                                                newEvents[idx].date = e.target.value;
                                                                setGeneratedEvents(newEvents);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <input
                                                            type="text"
                                                            value={ev.description}
                                                            className="bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none w-full"
                                                            onChange={(e) => {
                                                                const newEvents = [...generatedEvents];
                                                                newEvents[idx].description = e.target.value;
                                                                setGeneratedEvents(newEvents);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        € <input
                                                            type="number"
                                                            value={ev.amount}
                                                            className="bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none w-20"
                                                            onChange={(e) => {
                                                                const newEvents = [...generatedEvents];
                                                                newEvents[idx].amount = e.target.value;
                                                                setGeneratedEvents(newEvents);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <button
                                                            className="text-red-400 hover:text-red-600"
                                                            onClick={() => {
                                                                const newEvents = [...generatedEvents];
                                                                newEvents.splice(idx, 1);
                                                                setGeneratedEvents(newEvents);
                                                            }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {generatedEvents.length === 0 && (
                                        <div className="p-6 text-center text-slate-400 italic">Nessuna scadenza generata</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-between">
                    {step === 2 && (
                        <button
                            onClick={() => setStep(1)}
                            className="px-6 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition"
                        >
                            Indietro
                        </button>
                    )}
                    <div className="ml-auto flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-slate-500 font-semibold hover:text-slate-700 transition"
                        >
                            Annulla
                        </button>
                        {step === 1 ? (
                            <button
                                onClick={handleNext}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                            >
                                Prosegui
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                {loading ? 'Salvataggio...' : <><CheckCircle size={18} /> Salva Contratto</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageContractsModal;
