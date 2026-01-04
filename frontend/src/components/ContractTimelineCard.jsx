import React from 'react';
import { Download, FileText, Clock, AlertCircle, CheckCircle } from 'lucide-react';

const ContractTimelineCard = ({ contract }) => {
    if (!contract) return null;

    // Helpers
    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
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
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xl border border-slate-700 relative overflow-hidden mb-6">
            {/* Glow Effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <h3 className="text-xl font-bold text-cyan-400 mb-1">{contract.title}</h3>
                    <p className="text-slate-400 text-sm">{contract.notes || 'Contratto di servizio attivo'}</p>
                </div>
                <div className="text-right">
                    <div className="bg-slate-800 border border-slate-600 px-3 py-1 rounded-full text-xs font-mono text-cyan-300 inline-block mb-1">
                        {contract.billing_frequency === 'monthly' ? 'Mensile' :
                            contract.billing_frequency === 'quarterly' ? 'Trimestrale' :
                                contract.billing_frequency === 'annual' ? 'Annuale' : 'Custom'}
                    </div>
                    {contract.amount && <div className="font-bold text-lg">€ {contract.amount}</div>}
                </div>
            </div>

            {/* Timeline Visual */}
            <div className="relative py-8 px-2 mb-6">
                {/* Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 rounded-full -translate-y-1/2"></div>
                <div className="absolute top-1/2 left-0 h-1 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] rounded-full -translate-y-1/2 transition-all duration-1000" style={{ width: `${progress}%` }}></div>

                {/* Start Point */}
                <div className="absolute top-1/2 left-0 -translate-y-1/2 -ml-1">
                    <div className="w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-600"></div>
                    <div className="absolute top-6 left-0 -translate-x-1/2 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(contract.start_date)}
                    </div>
                </div>

                {/* Current Point (Today) */}
                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${progress}%` }}>
                    <div className="relative">
                        <div className="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow-[0_0_15px_rgba(6,182,212,0.8)] z-10 relative"></div>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-cyan-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                            OGGI
                        </div>
                    </div>
                </div>

                {/* Next Invoice/Event Point */}
                {nextEvent && (
                    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${((new Date(nextEvent.event_date) - startDate) / (endDate - startDate)) * 100}%` }}>
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center -ml-4 z-0 text-amber-400">
                            <AlertCircle size={14} />
                        </div>
                        <div className="absolute top-8 left-0 -translate-x-1/2 text-center w-32">
                            <div className="text-xs font-bold text-amber-400">
                                {nextEvent.description
                                    .replace(/quarterly/gi, 'trimestrale')
                                    .replace(/monthly/gi, 'mensile')
                                    .replace(/annual/gi, 'annuale')
                                    .replace(/semiannual/gi, 'semestrale')
                                }
                            </div>
                            <div className="text-[10px] text-slate-400">{formatDate(nextEvent.event_date)}</div>
                        </div>
                    </div>
                )}

                {/* End Point */}
                <div className="absolute top-1/2 right-0 -translate-y-1/2 -mr-1">
                    <div className="w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-600"></div>
                    <div className="absolute top-6 right-0 translate-x-1/2 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(contract.end_date)}
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center border-t border-slate-800 pt-4">
                <div className="flex gap-4">
                    {nextEvent && daysToNextEvent <= 30 && (
                        <div className={`flex items-center gap-2 text-sm ${daysToNextEvent <= 7 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                            <Clock size={16} />
                            <span>Prossima scadenza tra {daysToNextEvent} giorni</span>
                        </div>
                    )}
                </div>

                {contract.contract_file_path && (
                    <button
                        onClick={() => window.open(contract.contract_file_path.startsWith('http') ? contract.contract_file_path : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${contract.contract_file_path}`, '_blank')}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors text-sm border border-slate-600 group"
                    >
                        <Download size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                        Scarica Contratto
                    </button>
                )}
            </div>
        </div>
    );
};

export default ContractTimelineCard;
