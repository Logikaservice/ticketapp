import React, { useMemo } from 'react';
import { Download, FileText, Clock, AlertCircle, CheckCircle, Edit } from 'lucide-react';

const ContractTimelineCard = ({ contract, currentUser, getAuthHeader, onEdit }) => {
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

    // Calculate progress for the timeline bar: la barra rappresenta SEMPRE 1 anno
    // Calcola startDate e endDate una volta per usarli in tutto il componente
    const startDate = new Date(contract.start_date).getTime();
    // Calcola la fine del primo anno (sempre 1 anno dalla data di inizio)
    const firstYearEndDate = new Date(contract.start_date);
    firstYearEndDate.setFullYear(firstYearEndDate.getFullYear() + 1);
    const endDate = firstYearEndDate.getTime(); // Sempre 1 anno
    
    // Usa useMemo per evitare ricalcoli quando solo gli eventi cambiano (non start_date)
    const progress = useMemo(() => {
        const today = new Date().getTime();

        // Calcola il progresso basato sulla data di oggi rispetto al primo anno (sempre 1 anno)
        // Il punto "OGGI" deve sempre essere posizionato in base alla data corrente, indipendentemente dagli eventi
        let calculatedProgress = 0;
        if (endDate > startDate) {
            // Calcola la percentuale di avanzamento dell'anno (da startDate a endDate)
            calculatedProgress = ((today - startDate) / (endDate - startDate)) * 100;
        }
        // Limita il progresso tra 0% e 100% (sempre entro il primo anno)
        return Math.max(0, Math.min(100, calculatedProgress));
    }, [contract.start_date, startDate, endDate]); // Solo ricalcola se start_date cambia

    // Filtra eventi del primo anno per la timeline (includi rinnovo solo se è nel primo anno)
    const firstYearEnd = new Date(contract.start_date);
    firstYearEnd.setFullYear(firstYearEnd.getFullYear() + 1);
    const visibleEvents = events.filter(event => {
        const eventDate = new Date(event.event_date);
        const isRenewal = event.event_type === 'renewal' || event.type === 'renewal';
        // Mostra eventi del primo anno (includi rinnovo se è entro il primo anno)
        if (isRenewal) {
            // Mostra rinnovo solo se è entro il primo anno (durata = 1 anno)
            return eventDate <= firstYearEnd;
        }
        // Mostra tutti gli altri eventi del primo anno
        return eventDate <= firstYearEnd;
    });
    
    // Find the first non-processed event for yellow color (solo tra gli eventi visibili)
    const firstNonProcessedIndex = visibleEvents.findIndex(e => !e.is_processed);

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 relative">
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{contract.title}</h3>
                    {contract.client_name && (
                        <p className="text-gray-400 text-xs mt-1">Cliente: {contract.client_name}</p>
                    )}
                </div>
                <div className="text-right">
                    <div className="bg-teal-50 border border-teal-200 text-teal-700 px-3 py-1 rounded-full text-xs font-medium inline-block mb-2">
                        {contract.billing_frequency === 'monthly' ? 'Mensile' :
                            contract.billing_frequency === 'quarterly' ? 'Trimestrale' :
                                contract.billing_frequency === 'semiannual' ? 'Semestrale' :
                                contract.billing_frequency === 'annual' ? 'Annuale' : 'Personalizzata'}
                    </div>
                    {contract.amount && (
                        <div className="font-semibold text-base text-gray-800">€ {parseFloat(contract.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    )}
                </div>
            </div>

            {/* Timeline Visual */}
            <div className="relative py-8 mb-5 px-6">
                {/* Line */}
                <div className="absolute top-1/2 left-6 right-6 h-1 bg-gray-200 rounded-full -translate-y-1/2"></div>
                
                {/* Progress bar - parte dalla posizione di inizio contratto (primo evento) */}
                {visibleEvents.length > 0 && progress > 0 && (() => {
                    const firstEventDate = new Date(visibleEvents[0].event_date).getTime();
                    const firstEventPercent = ((firstEventDate - startDate) / (endDate - startDate)) * 100;
                    const progressStartPercent = Math.max(0, Math.min(100, firstEventPercent));
                    // La larghezza è la differenza tra progress e progressStartPercent, ma solo se progress > progressStartPercent
                    const progressWidthPercent = progress > progressStartPercent 
                        ? Math.max(0, Math.min(100 - progressStartPercent, progress - progressStartPercent))
                        : 0;
                    
                    if (progressWidthPercent <= 0) return null;
                    
                    return (
                        <div 
                            className="absolute top-1/2 h-1 bg-teal-400 rounded-full -translate-y-1/2 transition-all duration-1000" 
                            style={{ 
                                left: `calc(24px + ((100% - 48px) * ${progressStartPercent / 100}))`,
                                width: `calc((100% - 48px) * ${progressWidthPercent / 100})`
                            }}
                        ></div>
                    );
                })()}

                {/* Current Point (Today) */}
                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(24px + ((100% - 48px) * ${progress / 100}))` }}>
                    <div className="relative -ml-1.5">
                        <div className="w-3 h-3 rounded-full bg-teal-500 border-2 border-white z-10 relative"></div>
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap">
                            OGGI
                        </div>
                    </div>
                </div>

                {/* All Event Points - mostra solo eventi del primo anno */}
                {visibleEvents.map((event, index) => {
                    const eventDate = new Date(event.event_date).getTime();
                    const eventPercent = ((eventDate - startDate) / (endDate - startDate)) * 100;
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

                    return (
                        <div 
                            key={event.id || index} 
                            className="absolute top-1/2 -translate-y-1/2" 
                            style={{ left: `calc(24px + ((100% - 48px) * ${eventPercent / 100}))` }}
                        >
                            <div className={`w-5 h-5 rounded-full ${bgColor} border-2 ${borderColor} flex items-center justify-center -ml-2.5 z-0`}>
                                {isRenewal ? (
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                ) : isProcessed ? (
                                    <CheckCircle size={12} className={iconColor} />
                                ) : (
                                    <AlertCircle size={12} className={iconColor} />
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
                    {/* Edit button (only for technicians) */}
                    {currentUser?.ruolo === 'tecnico' && onEdit && (
                        <button
                            onClick={() => onEdit(contract)}
                            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg transition-colors text-sm border border-blue-300"
                        >
                            <Edit size={16} />
                            Modifica
                        </button>
                    )}

                    {contract.contract_file_path && (
                        <button
                            onClick={() => window.open(contract.contract_file_path.startsWith('http') ? contract.contract_file_path : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${contract.contract_file_path}`, '_blank')}
                            className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg transition-colors text-sm border border-gray-300"
                        >
                            <Download size={16} />
                            Scarica Contratto
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContractTimelineCard;
