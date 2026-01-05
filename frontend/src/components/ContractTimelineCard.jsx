import React, { useMemo, useState } from 'react';
import { Download, FileText, Clock, AlertCircle, CheckCircle, Edit, Paperclip } from 'lucide-react';

const ContractTimelineCard = ({ contract, currentUser, getAuthHeader, onEdit }) => {
    const [showFilesMenu, setShowFilesMenu] = useState(false);
    
    if (!contract) return null;

    // Helpers
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const getDaysRemaining = (targetDate) => {
        if (!targetDate) return 0;
        const diff = new Date(targetDate) - new Date();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    // Get all events (sorted by date)
    const events = contract.events || [];
    const nextEvent = contract.next_event;
    const daysToNextEvent = nextEvent ? getDaysRemaining(nextEvent.event_date) : 0;

    // Calculate progress for the timeline bar: la barra rappresenta SEMPRE l'anno solare corrente
    // Calcola startDate e endDate per l'anno corrente (sempre 01/01/YYYY - 31/12/YYYY)
    const today = new Date();
    const currentYear = today.getFullYear();
    const yearStartDate = new Date(currentYear, 0, 1).getTime(); // 01/01/YYYY 00:00:00
    const yearEndDate = new Date(currentYear, 11, 31, 23, 59, 59).getTime(); // 31/12/YYYY 23:59:59
    
    // Usa useMemo per evitare ricalcoli quando solo gli eventi cambiano
    const progress = useMemo(() => {
        const now = new Date().getTime();

        // Calcola il progresso basato sulla data di oggi rispetto all'anno corrente (01/01 - 31/12)
        let calculatedProgress = 0;
        if (yearEndDate > yearStartDate) {
            // Calcola la percentuale di avanzamento dell'anno corrente (da 01/01 a oggi)
            calculatedProgress = ((now - yearStartDate) / (yearEndDate - yearStartDate)) * 100;
        }
        // Limita il progresso tra 0% e 100% (sempre entro l'anno corrente)
        return Math.max(0, Math.min(100, calculatedProgress));
    }, [yearStartDate, yearEndDate]); // Ricalcola quando cambia l'anno

    // Filtra eventi dell'anno corrente per la timeline
    const visibleEvents = events.filter(event => {
        const eventDate = new Date(event.event_date);
        const eventYear = eventDate.getFullYear();
        const isRenewal = event.event_type === 'renewal' || event.type === 'renewal';
        
        // Se è un evento di rinnovo, mostra solo se è nell'anno corrente
        // E se l'anno del rinnovo corrisponde all'anno di fine contratto (end_date)
        if (isRenewal) {
            // Mostra il rinnovo solo se è nell'anno corrente
            if (eventYear !== currentYear) return false;
            
            // Se c'è un end_date, mostra il rinnovo solo se è nello stesso anno dell'end_date
            if (contract.end_date) {
                try {
                    const contractEndDate = new Date(contract.end_date);
                    const contractEndYear = contractEndDate.getFullYear();
                    return eventYear === contractEndYear;
                } catch (e) {
                    // Se c'è un errore nel parsing, mostra comunque (per compatibilità)
                    return true;
                }
            }
            // Se non c'è end_date, mostra comunque (per compatibilità)
            return true;
        }
        
        // Per gli altri eventi, mostra solo se sono nell'anno corrente
        return eventYear === currentYear;
    });
    
    // Find the first non-processed event for yellow color (solo tra gli eventi visibili)
    const firstNonProcessedIndex = visibleEvents.findIndex(e => !e.is_processed);

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 relative">
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{contract.title}</h3>
                    {contract.client_name && currentUser?.ruolo === 'tecnico' && (
                        <p className="text-gray-400 text-xs mt-1">Cliente: {contract.client_name}</p>
                    )}
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-teal-50 border border-teal-200 text-teal-700 px-3 py-1 rounded-full text-xs font-medium inline-block">
                            {contract.billing_frequency === 'monthly' ? 'Mensile' :
                                contract.billing_frequency === 'quarterly' ? 'Trimestrale' :
                                    contract.billing_frequency === 'semiannual' ? 'Semestrale' :
                                    contract.billing_frequency === 'annual' ? 'Annuale' : 'Personalizzata'}
                        </div>
                        {contract.end_date && (
                            <span className="text-xs text-gray-600 font-medium">Scadenza: {formatDate(contract.end_date)}</span>
                        )}
                        {/* Edit button (only for technicians) - spostato qui */}
                        {currentUser?.ruolo === 'tecnico' && onEdit && (
                            <button
                                onClick={() => onEdit(contract)}
                                className="p-1.5 hover:bg-blue-50 rounded transition-colors text-blue-600 hover:text-blue-700"
                                title="Modifica contratto"
                            >
                                <Edit size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Timeline Visual */}
            <div className="relative py-8 mb-5 px-6">
                {/* Line */}
                <div className="absolute top-1/2 left-6 right-6 h-1 bg-gray-200 rounded-full -translate-y-1/2"></div>
                <div className="absolute top-1/2 left-6 h-1 bg-teal-400 rounded-full -translate-y-1/2 transition-all duration-1000" style={{ width: `calc((100% - 48px) * ${progress / 100})` }}></div>

                {/* Current Point (Today) */}
                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(24px + ((100% - 48px) * ${progress / 100}))` }}>
                    <div className="relative -ml-1.5">
                        <div className="w-3 h-3 rounded-full bg-teal-500 border-2 border-white z-10 relative"></div>
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap">
                            OGGI
                        </div>
                    </div>
                </div>

                {/* All Event Points - mostra solo eventi dell'anno corrente */}
                {visibleEvents.map((event, index) => {
                    const eventDate = new Date(event.event_date).getTime();
                    const eventPercent = ((eventDate - yearStartDate) / (yearEndDate - yearStartDate)) * 100;
                    const isProcessed = event.is_processed === true;
                    const isFirstNonProcessed = index === firstNonProcessedIndex && !isProcessed;
                    
                    // Color logic: blue (renewal), green (processed), yellow (first non-processed), gray (others)
                    let borderColor = 'border-gray-400';
                    let bgColor = 'bg-white';
                    let textColor = 'text-gray-600';
                    let iconColor = 'text-gray-500';
                    const isRenewal = event.event_type === 'renewal' || event.type === 'renewal';
                    
                    if (isRenewal) {
                        borderColor = 'border-blue-500';
                        bgColor = 'bg-blue-50';
                        textColor = 'text-blue-700';
                        iconColor = 'text-blue-600';
                    } else if (isProcessed) {
                        borderColor = 'border-green-500';
                        bgColor = 'bg-green-50';
                        textColor = 'text-green-700';
                        iconColor = 'text-green-600';
                    } else if (isFirstNonProcessed) {
                        borderColor = 'border-amber-400';
                        bgColor = 'bg-white';
                        textColor = 'text-amber-600';
                        iconColor = 'text-amber-500';
                    } else {
                        borderColor = 'border-gray-400';
                        bgColor = 'bg-white';
                        textColor = 'text-gray-600';
                        iconColor = 'text-gray-400';
                    }

                    // Converti la descrizione dell'evento per rimuovere i numeri progressivi
                    let displayDescription = event.description || 'Fattura';
                    if (isRenewal) {
                        displayDescription = 'Rinnovo';
                    } else if (contract.billing_frequency === 'monthly') {
                        displayDescription = 'Mensile';
                    } else if (contract.billing_frequency === 'quarterly') {
                        displayDescription = 'Trimestre';
                    } else if (contract.billing_frequency === 'semiannual') {
                        displayDescription = 'Semestre';
                    } else if (contract.billing_frequency === 'annual') {
                        displayDescription = 'Annuale';
                    }

                    // Calcola l'importo da mostrare nel tooltip (solo per eventi non-rinnovo)
                    const eventAmount = isRenewal ? null : (event.amount || contract.amount);
                    const displayAmount = eventAmount ? parseFloat(eventAmount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

                    return (
                        <div 
                            key={event.id || index} 
                            className="absolute top-1/2 -translate-y-1/2 group" 
                            style={{ left: `calc(24px + ((100% - 48px) * ${eventPercent / 100}))` }}
                        >
                            <div className={`w-5 h-5 rounded-full ${bgColor} border-2 ${borderColor} flex items-center justify-center -ml-2.5 z-0 cursor-pointer relative`}>
                                {isRenewal ? (
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                ) : isProcessed ? (
                                    <CheckCircle size={12} className={iconColor} />
                                ) : (
                                    <AlertCircle size={12} className={iconColor} />
                                )}
                                {/* Tooltip con importo (solo per eventi non-rinnovo) */}
                                {!isRenewal && displayAmount && (
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                                        € {displayAmount}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                                    </div>
                                )}
                            </div>
                            <div className="absolute top-7 left-1/2 -translate-x-1/2 text-center w-32">
                                <div className={`text-xs font-semibold ${textColor}`}>
                                    {displayDescription}
                                </div>
                                <div className="text-[10px] text-gray-400">{formatDate(event.event_date)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center border-t border-gray-200 pt-4">
                <div className="flex gap-4">
                    {nextEvent && daysToNextEvent <= 30 && (
                        <div className={`flex items-center gap-2 text-sm ${daysToNextEvent <= 7 ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
                            <Clock size={16} />
                            <span>Prossima scadenza tra {daysToNextEvent} {daysToNextEvent === 1 ? 'giorno' : 'giorni'}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {(() => {
                        // Gestisci sia formato vecchio (stringa) che nuovo (array JSON)
                        let files = [];
                        if (contract.contract_file_path) {
                            try {
                                const parsed = JSON.parse(contract.contract_file_path);
                                if (Array.isArray(parsed)) {
                                    files = parsed;
                                } else {
                                    // Retrocompatibilità: stringa singola
                                    files = [{ path: contract.contract_file_path }];
                                }
                            } catch (e) {
                                // Non è JSON, è una stringa singola (retrocompatibilità)
                                files = [{ path: contract.contract_file_path }];
                            }
                        }
                        
                        if (files.length === 0) return null;
                        
                        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
                        
                        return (
                            <div className="relative">
                                <button
                                    onClick={() => setShowFilesMenu(!showFilesMenu)}
                                    className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-700 relative"
                                    title={`${files.length} allegato${files.length !== 1 ? 'i' : ''}`}
                                >
                                    <Paperclip size={18} />
                                    {files.length > 1 && (
                                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                            {files.length}
                                        </span>
                                    )}
                                </button>
                                
                                {showFilesMenu && (
                                    <>
                                        {/* Overlay per chiudere il menu cliccando fuori */}
                                        <div 
                                            className="fixed inset-0 z-10" 
                                            onClick={() => setShowFilesMenu(false)}
                                        ></div>
                                        
                                        {/* Menu dropdown */}
                                        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] py-1">
                                            {files.map((file, index) => {
                                                const filePath = typeof file === 'string' ? file : file.path;
                                                const fileName = typeof file === 'string' 
                                                    ? file.split('/').pop() 
                                                    : (file.filename || file.path?.split('/').pop() || `File ${index + 1}`);
                                                return (
                                                    <button
                                                        key={index}
                                                        onClick={() => {
                                                            window.open(filePath.startsWith('http') ? filePath : `${apiUrl}${filePath}`, '_blank');
                                                            setShowFilesMenu(false);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-left text-sm text-gray-700 transition-colors"
                                                    >
                                                        <Download size={14} className="text-gray-400" />
                                                        <span className="truncate flex-1">{fileName}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default ContractTimelineCard;
