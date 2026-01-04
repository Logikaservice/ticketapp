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
        duration: '1', // 1, 2, 3 anni o 'custom'
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
                // Filter for clients only
                const clientUsers = data.filter(u => u.ruolo === 'cliente');
                
                // Raggruppa per azienda e prendi un rappresentante per azienda
                const aziendaMap = new Map();
                clientUsers.forEach(user => {
                    const azienda = user.azienda || `${user.nome || ''} ${user.cognome || ''}`.trim();
                    if (!azienda) return; // Salta utenti senza azienda e nome
                    
                    if (!aziendaMap.has(azienda)) {
                        // Prendi il primo utente per azienda (preferibilmente admin se esiste)
                        const isAdmin = user.admin_companies && 
                                       Array.isArray(user.admin_companies) && 
                                       user.admin_companies.includes(azienda);
                        aziendaMap.set(azienda, { user, isAdmin });
                    } else {
                        // Se esiste già, preferisci l'admin
                        const existing = aziendaMap.get(azienda);
                        const isAdmin = user.admin_companies && 
                                       Array.isArray(user.admin_companies) && 
                                       user.admin_companies.includes(azienda);
                        if (isAdmin && !existing.isAdmin) {
                            aziendaMap.set(azienda, { user, isAdmin });
                        }
                    }
                });
                
                // Converti in array e ordina alfabeticamente per nome azienda
                const uniqueUsers = Array.from(aziendaMap.values())
                    .map(item => item.user)
                    .sort((a, b) => {
                        const nameA = (a.azienda || `${a.nome || ''} ${a.cognome || ''}`).trim().toLowerCase();
                        const nameB = (b.azienda || `${b.nome || ''} ${b.cognome || ''}`).trim().toLowerCase();
                        return nameA.localeCompare(nameB, 'it');
                    });
                
                setUsers(uniqueUsers);
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
        
        // Calcola la durata del contratto
        const durationYears = formData.duration === 'custom' ? 1 : parseInt(formData.duration, 10);
        
        // Parsa la data manualmente per evitare problemi di fuso orario
        const dateParts = formData.start_date.split('-');
        const startYear = parseInt(dateParts[0], 10);
        const startMonth = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-based
        const startDay = parseInt(dateParts[2], 10);

        // Calcola il numero di fatture nell'anno e il periodo tra le fatture
        let numberOfInvoicesPerYear = 0;
        let incrementMonths = 0;
        switch (formData.billing_frequency) {
            case 'monthly':
                numberOfInvoicesPerYear = 12;
                incrementMonths = 1;
                break;
            case 'quarterly':
                numberOfInvoicesPerYear = 4;
                incrementMonths = 3;
                break;
            case 'semiannual':
                numberOfInvoicesPerYear = 2;
                incrementMonths = 6;
                break;
            case 'annual':
                numberOfInvoicesPerYear = 1;
                incrementMonths = 12;
                break;
            default:
                numberOfInvoicesPerYear = 12;
                incrementMonths = 1;
        }

        // Calcola l'importo per fattura in base all'importo mensile
        const monthlyAmount = parseFloat(formData.amount) || 0;
        let amountPerInvoice = 0;
        switch (formData.billing_frequency) {
            case 'monthly':
                amountPerInvoice = monthlyAmount; // Importo mensile
                break;
            case 'quarterly':
                amountPerInvoice = monthlyAmount * 3; // Importo mensile * 3 mesi
                break;
            case 'semiannual':
                amountPerInvoice = monthlyAmount * 6; // Importo mensile * 6 mesi
                break;
            case 'annual':
                amountPerInvoice = monthlyAmount * 12; // Importo mensile * 12 mesi
                break;
            default:
                amountPerInvoice = monthlyAmount;
        }

        // Genera le fatture per tutti gli anni della durata
        const totalInvoices = numberOfInvoicesPerYear * durationYears;
        
        for (let i = 0; i < totalInvoices; i++) {
            // Calcola la data aggiungendo i mesi usando il costruttore Date (local time)
            const totalMonths = startMonth + (i * incrementMonths);
            const invoiceYear = startYear + Math.floor(totalMonths / 12);
            const invoiceMonth = totalMonths % 12;
            
            // Crea la data in local time (non UTC)
            const invoiceDate = new Date(invoiceYear, invoiceMonth, startDay);
            
            // Formatta la data come YYYY-MM-DD usando i metodi local time
            const year = invoiceDate.getFullYear();
            const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
            const day = String(invoiceDate.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            
            // Genera descrizione in base alla frequenza (semplice, senza numeri progressivi)
            let description = '';
            switch (formData.billing_frequency) {
                case 'monthly':
                    description = 'Mensile';
                    break;
                case 'quarterly':
                    description = 'Trimestre';
                    break;
                case 'semiannual':
                    description = 'Semestre';
                    break;
                case 'annual':
                    description = 'Annuale';
                    break;
                default:
                    description = `Fatturazione ${formData.billing_frequency}`;
            }
            
            events.push({
                date: dateString,
                type: 'invoice',
                title: 'Fattura Periodica',
                description: description,
                amount: amountPerInvoice.toFixed(2)
            });
        }

        // Se la durata non è personalizzata, aggiungi l'evento "Rinnovo" alla fine
        if (formData.duration !== 'custom') {
            const renewalYear = startYear + durationYears;
            const renewalMonth = String(startMonth + 1).padStart(2, '0');
            const renewalDay = String(startDay).padStart(2, '0');
            const renewalDateString = `${renewalYear}-${renewalMonth}-${renewalDay}`;
            
            events.push({
                date: renewalDateString,
                type: 'renewal',
                title: 'Rinnovo',
                description: 'Rinnovo',
                amount: null
            });
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
            notify('Inserisci l\'importo mensile', 'warning');
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
        // Gli eventi di tipo 'renewal' non necessitano di importo
        const invalidEvents = generatedEvents.filter(ev => {
            if (!ev.date || !ev.description) return true;
            // Gli eventi di rinnovo non richiedono importo
            if (ev.type === 'renewal') return false;
            // Gli altri eventi richiedono importo
            return !ev.amount;
        });
        if (invalidEvents.length > 0) {
            notify('Alcune scadenze non sono complete. Completa tutti i campi obbligatori', 'warning');
            return;
        }

        setLoading(true);
        try {
            // Calcola la data di fine/rinnovo in base alla durata
            const startDate = new Date(formData.start_date);
            let endDate = null;
            
            if (formData.duration !== 'custom') {
                const durationYears = parseInt(formData.duration, 10);
                endDate = new Date(startDate);
                endDate.setFullYear(endDate.getFullYear() + durationYears);
            }

            // 1. Create Contract & Events
            const payload = {
                ...formData,
                end_date: endDate ? endDate.toISOString().split('T')[0] : null,
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
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Durata Contratto</label>
                                    <select
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        value={formData.duration}
                                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                    >
                                        <option value="1">1 Anno</option>
                                        <option value="2">2 Anni</option>
                                        <option value="3">3 Anni</option>
                                        <option value="custom">Personalizzata</option>
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">La data di rinnovo verrà calcolata automaticamente</p>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Importo Mensile (€) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">L'importo per fattura verrà calcolato in base alla frequenza selezionata</p>
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
