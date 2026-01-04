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
        billing_frequency: 'monthly',
        amount: '',
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
        if (!formData.start_date || !formData.amount) return;

        const events = [];
        const inputDate = new Date(formData.start_date);
        
        // Normalizza la data al primo del mese appropriato in base alla frequenza
        let firstInvoiceDate = new Date(inputDate);
        firstInvoiceDate.setDate(1); // Sempre primo del mese
        
        // Per frequenze specifiche, arrotonda al primo del periodo appropriato
        if (formData.billing_frequency === 'quarterly') {
            // Trimestrale: gennaio, aprile, luglio, ottobre (mesi 0, 3, 6, 9)
            const month = firstInvoiceDate.getMonth();
            if (month >= 0 && month < 3) {
                firstInvoiceDate.setMonth(0); // Gennaio
            } else if (month >= 3 && month < 6) {
                firstInvoiceDate.setMonth(3); // Aprile
            } else if (month >= 6 && month < 9) {
                firstInvoiceDate.setMonth(6); // Luglio
            } else {
                firstInvoiceDate.setMonth(9); // Ottobre
            }
        } else if (formData.billing_frequency === 'semiannual') {
            // Semestrale: gennaio (0) o luglio (6)
            const month = firstInvoiceDate.getMonth();
            if (month >= 0 && month < 6) {
                firstInvoiceDate.setMonth(0); // Gennaio
            } else {
                firstInvoiceDate.setMonth(6); // Luglio
            }
        } else if (formData.billing_frequency === 'annual') {
            // Annuale: sempre gennaio
            firstInvoiceDate.setMonth(0); // Gennaio
        }
        // Mensile: già normalizzato al primo del mese

        const endDate = new Date(firstInvoiceDate);
        endDate.setFullYear(endDate.getFullYear() + 1); // Un anno dopo la prima fattura

        // Calcola il numero di fatture nell'anno in base alla frequenza
        let numberOfInvoices = 0;
        let incrementMonths = 0;
        switch (formData.billing_frequency) {
            case 'monthly':
                numberOfInvoices = 12;
                incrementMonths = 1;
                break;
            case 'quarterly':
                numberOfInvoices = 4;
                incrementMonths = 3;
                break;
            case 'semiannual':
                numberOfInvoices = 2;
                incrementMonths = 6;
                break;
            case 'annual':
                numberOfInvoices = 1;
                incrementMonths = 12;
                break;
            default:
                numberOfInvoices = 12;
                incrementMonths = 1;
        }

        // Calcola l'importo per fattura (importo totale diviso per il numero di fatture)
        const totalAmount = parseFloat(formData.amount) || 0;
        const amountPerInvoice = totalAmount / numberOfInvoices;

        // Genera le fatture per esattamente un anno partendo dalla data normalizzata
        let current = new Date(firstInvoiceDate);
        for (let i = 0; i < numberOfInvoices; i++) {
            events.push({
                date: new Date(current).toISOString().split('T')[0],
                type: 'invoice',
                title: 'Fattura Periodica',
                description: `Fatturazione ${formData.billing_frequency}`,
                amount: amountPerInvoice.toFixed(2)
            });

            if (i < numberOfInvoices - 1) { // Non incrementare dopo l'ultima fattura
                current.setMonth(current.getMonth() + incrementMonths);
            }
        }

        setGeneratedEvents(events);
    };

    const handleNext = () => {
        // Validazione campi obbligatori
        if (!formData.user_id) {
            notify('Seleziona un cliente', 'warning');
            return;
        }
        if (!formData.title || formData.title.trim().length === 0) {
            notify('Inserisci un titolo per il contratto', 'warning');
            return;
        }
        if (formData.title.trim().length < 3) {
            notify('Il titolo deve contenere almeno 3 caratteri', 'warning');
            return;
        }
        if (!formData.start_date) {
            notify('Seleziona una data di inizio', 'warning');
            return;
        }

        // Validazione importo (obbligatorio e deve essere positivo)
        if (!formData.amount || formData.amount.trim() === '') {
            notify('Inserisci l\'importo totale del contratto', 'warning');
            return;
        }

        if (parseFloat(formData.amount) <= 0) {
            notify('L\'importo deve essere maggiore di zero', 'warning');
            return;
        }

        generatePreview();
        setStep(2);
    };

    const handleSubmit = async () => {
        // Validazione finale degli eventi
        if (generatedEvents.length === 0) {
            notify('Aggiungi almeno una scadenza al contratto', 'warning');
            return;
        }

        // Validazione che tutti gli eventi abbiano una data valida
        const invalidEvents = generatedEvents.filter(ev => !ev.date || !ev.description || !ev.amount);
        if (invalidEvents.length > 0) {
            notify('Alcune scadenze non sono complete. Completa tutti i campi obbligatori', 'warning');
            return;
        }

        setLoading(true);
        try {
            // Calcola la data di fine automaticamente (un anno dopo la data di inizio)
            const startDate = new Date(formData.start_date);
            const endDate = new Date(startDate);
            endDate.setFullYear(endDate.getFullYear() + 1);

            // 1. Create Contract & Events
            const payload = {
                ...formData,
                end_date: endDate.toISOString().split('T')[0],
                amount: formData.amount ? parseFloat(formData.amount) : null,
                notes: null, // Notes rimosso
                client_name: users.find(u => u.id === parseInt(formData.user_id))?.azienda || 'Cliente',
                events: generatedEvents.map(ev => ({
                    ...ev,
                    amount: ev.amount ? parseFloat(ev.amount) : null
                }))
            };

            const res = await fetch(buildApiUrl('/api/contracts'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorMessage = errorData.error || 'Errore durante la creazione del contratto';
                throw new Error(errorMessage);
            }

            const { contractId } = await res.json();

            // 2. Upload PDF if present
            if (formData.contractPdf) {
                try {
                    const formDataUpload = new FormData();
                    formDataUpload.append('contractPdf', formData.contractPdf);

                    const uploadRes = await fetch(buildApiUrl(`/api/contracts/${contractId}/upload`), {
                        method: 'POST',
                        headers: {
                            ...getAuthHeader(),
                            // No Content-Type for FormData, browser sets it
                        },
                        body: formDataUpload
                    });

                    if (!uploadRes.ok) {
                        throw new Error('Errore durante il caricamento del PDF');
                    }
                } catch (uploadErr) {
                    console.error('Upload PDF error:', uploadErr);
                    notify('Contratto creato ma errore nel caricamento del PDF: ' + uploadErr.message, 'warning');
                }
            }

            notify('Contratto creato con successo!', 'success');
            
            // Dispatch evento personalizzato per refresh automatico
            window.dispatchEvent(new CustomEvent('contractCreated', { detail: { contractId } }));
            
            onSuccess();
            onClose();

        } catch (err) {
            console.error('Error creating contract:', err);
            const errorMessage = err.message || 'Errore durante il salvataggio del contratto. Riprova.';
            notify(errorMessage, 'error');
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

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data Prima Fattura *</label>
                                    <input
                                        type="date"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">La data di fine sarà calcolata automaticamente (un anno dopo)</p>
                                </div>
                                <div></div>

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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Importo Totale Annuo (€) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">L'importo verrà suddiviso in base alla frequenza selezionata</p>
                                </div>
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
