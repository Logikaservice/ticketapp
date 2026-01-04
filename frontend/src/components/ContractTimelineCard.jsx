import React from 'react';
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
    const startDate = new Date(contract.start_date).getTime();
    // Calcola la fine del primo anno (sempre 1 anno dalla data di inizio)
    const firstYearEndDate = new Date(contract.start_date);
    firstYearEndDate.setFullYear(firstYearEndDate.getFullYear() + 1);
    const endDate = firstYearEndDate.getTime(); // Sempre 1 anno
    const today = new Date().getTime();

    // Se c'è un prossimo evento nel primo anno, calcola il progresso dall'inizio fino a quel punto
    // Altrimenti usa la fine del primo anno come riferimento
    let targetDate = endDate;
    if (nextEvent && nextEvent.event_date) {
        const nextEventDate = new Date(nextEvent.event_date).getTime();
        // Usa il prossimo evento solo se è entro il primo anno
        if (nextEventDate <= endDate) {
            targetDate = nextEventDate;
        }
    }

    let progress = 0;
    if (targetDate > startDate) {
        // Calcola quanto siamo vicini alla prossima fatturazione (o alla fine del primo anno)
        progress = ((today - startDate) / (targetDate - startDate)) * 100;
    }
    // Limita il progresso al 100% (non oltre la fine del primo anno)
    progress = Math.max(0, Math.min(100, progress));

    // Find the first non-processed event for yellow color
    const firstNonProcessedIndex = events.findIndex(e => !e.is_processed);

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
            <div className="relative py-8 mb-5 px-12">
                {/* Line */}
                <div className="absolute top-1/2 left-12 right-12 h-1 bg-gray-200 rounded-full -translate-y-1/2"></div>
                <div className="absolute top-1/2 left-12 h-1 bg-teal-400 rounded-full -translate-y-1/2 transition-all duration-1000" style={{ width: `calc((100% - 96px) * ${progress / 100})` }}></div>

                {/* Current Point (Today) */}
                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(48px + ((100% - 96px) * ${progress / 100}))` }}>
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
                            style={{ left: `calc(48px + ((100% - 96px) * ${eventPercent / 100}))` }}
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
