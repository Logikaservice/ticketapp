import React, { useState, useEffect, useRef } from 'react';
import { Calendar, User, FileText, CheckCircle, Upload, Plus, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  HubModalBackdrop,
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalPrimaryButton,
  HubModalSecondaryButton,
} from './HubModalChrome';
import { HUB_MODAL_FIELD_CLS } from '../../utils/techHubAccent';

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
        duration: '1' // 1, 2, 3 anni o 'custom'
    });
    const [contractFiles, setContractFiles] = useState([]);
    const fileInputRef = useRef(null);

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

            // 2. Upload PDF files if present
            if (contractFiles && contractFiles.length > 0) {
                try {
                    const formDataUpload = new FormData();
                    contractFiles.forEach((file, index) => {
                        formDataUpload.append('contractPdf', file);
                    });

                    const uploadRes = await fetch(buildApiUrl(`/api/contracts/${contractId}/upload`), {
                        method: 'POST',
                        headers: {
                            ...getAuthHeader(),
                            // No Content-Type for FormData, browser sets it
                        },
                        body: formDataUpload
                    });

                    if (!uploadRes.ok) {
                        throw new Error('Errore durante il caricamento dei file');
                    }
                } catch (uploadErr) {
                    console.error('Upload PDF error:', uploadErr);
                    notify('Contratto creato ma errore nel caricamento dei file: ' + uploadErr.message, 'warning');
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
        <HubModalBackdrop zClass="z-[100]" className="backdrop-blur-sm">
            <HubModalInnerCard maxWidthClass="max-w-4xl" className="flex max-h-[90vh] flex-col overflow-y-auto">
                <HubModalChromeHeader
                  icon={FileText}
                  title="Nuovo Contratto"
                  subtitle="Gestione ricorrenze e documenti"
                  onClose={onClose}
                />

                <HubModalBody className="flex-1">
                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Client Selector */}
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-white/75">Cliente *</label>
                                    <select
                                        className={HUB_MODAL_FIELD_CLS}
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
                                    <label className="mb-1 block text-sm font-medium text-white/75">Titolo Contratto *</label>
                                    <input
                                        type="text"
                                        className={HUB_MODAL_FIELD_CLS}
                                        placeholder="es. Manutenzione Server 2024"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-white/75">Data Prima Fattura *</label>
                                    <input
                                        type="date"
                                        className={HUB_MODAL_FIELD_CLS}
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-white/75">Durata Contratto</label>
                                    <select
                                        className={HUB_MODAL_FIELD_CLS}
                                        value={formData.duration}
                                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                    >
                                        <option value="1">1 Anno</option>
                                        <option value="2">2 Anni</option>
                                        <option value="3">3 Anni</option>
                                        <option value="custom">Personalizzata</option>
                                    </select>
                                    <p className="text-xs text-white/50 mt-1">La data di rinnovo verrà calcolata automaticamente</p>
                                </div>

                                {/* Billing */}
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-white/75">Frequenza Fatturazione</label>
                                    <select
                                        className={HUB_MODAL_FIELD_CLS}
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
                                    <label className="mb-1 block text-sm font-medium text-white/75">Importo Mensile (€) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={HUB_MODAL_FIELD_CLS}
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                    <p className="text-xs text-white/50 mt-1">L'importo per fattura verrà calcolato in base alla frequenza selezionata</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* PDF Upload */}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-white/75">
                                    Allegato al contratto
                                </label>
                                <div className="border-2 border-dashed border-white/15 rounded-xl p-8 text-center hover:bg-white/[0.04] transition">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        id="contract-pdf"
                                        accept=".pdf"
                                        multiple
                                        onChange={(e) => {
                                            const newFiles = Array.from(e.target.files || []);
                                            if (newFiles.length === 0) return;

                                            // Verifica dimensione per file singolo (massimo 20MB per file)
                                            const maxFileSize = 20 * 1024 * 1024; // 20MB in bytes
                                            const oversizedFiles = newFiles.filter(file => file.size > maxFileSize);
                                            
                                            if (oversizedFiles.length > 0) {
                                                const fileNames = oversizedFiles.map(f => `${f.name} (${(f.size / (1024 * 1024)).toFixed(2)}MB)`).join(', ');
                                                notify(`I seguenti file superano il limite di 20MB per file:\n${fileNames}`, 'warning');
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value = '';
                                                }
                                                return;
                                            }
                                            
                                            // Combina i file esistenti con i nuovi file
                                            const existingFiles = contractFiles || [];
                                            const allFiles = [...existingFiles, ...newFiles];
                                            
                                            // Evita duplicati basandosi sul nome, dimensione e data di modifica
                                            const uniqueFiles = [];
                                            const fileKeys = new Set();
                                            
                                            allFiles.forEach(file => {
                                                const key = `${file.name}-${file.size}-${file.lastModified}`;
                                                if (!fileKeys.has(key)) {
                                                    fileKeys.add(key);
                                                    uniqueFiles.push(file);
                                                }
                                            });
                                            
                                            setContractFiles(uniqueFiles);
                                            
                                            // Reset input per permettere di selezionare gli stessi file di nuovo se necessario
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }}
                                    />
                                    <label htmlFor="contract-pdf" className="cursor-pointer flex flex-col items-center">
                                        <Upload size={48} className="text-white/40 mb-2" />
                                        <span className="font-semibold text-white/80">
                                            {contractFiles.length > 0 
                                                ? `${contractFiles.length} file selezionati` 
                                                : 'Carica il Contratto Firmato (PDF)'}
                                        </span>
                                        <span className="text-sm text-white/45 mt-1">Clicca o trascina qui</span>
                                    </label>
                                </div>
                                {contractFiles.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {contractFiles.map((file, index) => (
                                            <div key={index} className="flex items-center gap-2 p-2 bg-black/25 rounded-lg border border-white/10">
                                                <FileText size={16} className="text-white/55" />
                                                <span className="text-sm text-white/85 flex-1 truncate">{file.name}</span>
                                                <span className="text-xs text-white/50">
                                                    ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newFiles = contractFiles.filter((_, i) => i !== index);
                                                        setContractFiles(newFiles);
                                                    }}
                                                    className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                                                >
                                                    <Trash2 size={14} />
                                                    Rimuovi
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Schedule Preview */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        <Calendar size={18} />
                                        Piano Scadenze Generato
                                    </h3>
                                    <button
                                        className="text-sm text-[color:var(--hub-accent)] hover:underline flex items-center gap-1"
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

                                <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
                                    <table className="w-full text-sm text-left text-white">
                                        <thead className="bg-black/30 text-white/65">
                                            <tr>
                                                <th className="p-3">Data</th>
                                                <th className="p-3">Descrizione</th>
                                                <th className="p-3">Importo</th>
                                                <th className="p-3">Azioni</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {generatedEvents.map((ev, idx) => (
                                                <tr key={idx} className="border-t border-white/10 hover:bg-white/[0.04] transition">
                                                    <td className="p-3">
                                                        <input
                                                            type="date"
                                                            value={ev.date}
                                                            className="bg-transparent border-b border-white/25 focus:border-[color:var(--hub-accent)] outline-none w-32 text-white"
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
                                                            className="bg-transparent border-b border-white/25 focus:border-[color:var(--hub-accent)] outline-none w-full text-white"
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
                                                            className="bg-transparent border-b border-white/25 focus:border-[color:var(--hub-accent)] outline-none w-20 text-white"
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
                                        <div className="p-6 text-center text-white/45 italic">Nessuna scadenza generata</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </HubModalBody>

                <HubModalChromeFooter className="justify-between gap-2">
                    {step === 2 && (
                        <HubModalSecondaryButton onClick={() => setStep(1)}>
                            Indietro
                        </HubModalSecondaryButton>
                    )}
                    <div className="ml-auto flex flex-wrap gap-3">
                        <HubModalSecondaryButton onClick={onClose}>
                            Annulla
                        </HubModalSecondaryButton>
                        {step === 1 ? (
                            <HubModalPrimaryButton onClick={handleNext}>
                                Prosegui
                            </HubModalPrimaryButton>
                        ) : (
                            <HubModalPrimaryButton onClick={handleSubmit} disabled={loading}>
                                {loading ? 'Salvataggio...' : (
                                  <span className="flex items-center gap-2">
                                    <CheckCircle size={18} />
                                    Salva Contratto
                                  </span>
                                )}
                            </HubModalPrimaryButton>
                        )}
                    </div>
                </HubModalChromeFooter>
            </HubModalInnerCard>
        </HubModalBackdrop>
    );
};

export default ManageContractsModal;
