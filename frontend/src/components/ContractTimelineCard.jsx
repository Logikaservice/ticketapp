import React from 'react';
import { Download, FileText, Clock, AlertCircle, CheckCircle } from 'lucide-react';

const ContractTimelineCard = ({ contract }) => {
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

    const nextEvent = contract.next_event;
    const daysToNextEvent = nextEvent ? getDaysRemaining(nextEvent.event_date) : 0;
    const daysToEnd = getDaysRemaining(contract.end_date);

    // Calculate progress for the timeline bar
    const startDate = new Date(contract.start_date).getTime();
    const endDate = new Date(contract.end_date || new Date().setFullYear(new Date().getFullYear() + 1)).getTime();
    const today = new Date().getTime();

    let progress = 0;
    if (endDate > startDate) {
        progress = ((today - startDate) / (endDate - startDate)) * 100;
    }
    progress = Math.max(0, Math.min(100, progress));

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-5 relative">
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{contract.title}</h3>
                    {contract.notes && <p className="text-gray-500 text-sm">{contract.notes}</p>}
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

                {/* Start Point */}
                <div className="absolute top-1/2 left-12 -translate-y-1/2 -ml-1.5">
                    <div className="w-3 h-3 rounded-full bg-white border-2 border-teal-500"></div>
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(contract.start_date)}
                    </div>
                </div>

                {/* Current Point (Today) */}
                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(48px + ((100% - 96px) * ${progress / 100}))` }}>
                    <div className="relative -ml-1.5">
                        <div className="w-3 h-3 rounded-full bg-teal-500 border-2 border-white z-10 relative"></div>
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap">
                            OGGI
                        </div>
                    </div>
                </div>

                {/* Next Invoice/Event Point */}
                {nextEvent && (() => {
                    const eventPercent = ((new Date(nextEvent.event_date) - startDate) / (endDate - startDate)) * 100;
                    return (
                        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(48px + ((100% - 96px) * ${eventPercent / 100}))` }}>
                            <div className="w-6 h-6 rounded-full bg-white border-2 border-amber-400 flex items-center justify-center -ml-3 z-0">
                                <AlertCircle size={12} className="text-amber-500" />
                            </div>
                            <div className="absolute top-7 left-1/2 -translate-x-1/2 text-center w-32">
                                <div className="text-xs font-semibold text-amber-600">
                                    {nextEvent.description
                                        .replace(/quarterly/gi, 'trimestrale')
                                        .replace(/monthly/gi, 'mensile')
                                        .replace(/annual/gi, 'annuale')
                                        .replace(/semiannual/gi, 'semestrale')
                                    }
                                </div>
                                <div className="text-[10px] text-gray-400">{formatDate(nextEvent.event_date)}</div>
                            </div>
                        </div>
                    );
                })()}

                {/* End Point */}
                <div className="absolute top-1/2 right-12 -translate-y-1/2 mr-1.5">
                    <div className="w-3 h-3 rounded-full bg-white border-2 border-gray-400"></div>
                    <div className="absolute top-5 right-1/2 translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(contract.end_date)}
                    </div>
                </div>
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
    );
};

export default ContractTimelineCard;
