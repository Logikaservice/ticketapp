import React, { useMemo, useState } from 'react';
import { Download, FileText, Clock, AlertCircle, CheckCircle, Edit, Paperclip } from 'lucide-react';

const ContractTimelineCard = ({
    contract,
    currentUser,
    getAuthHeader,
    onEdit,
    /** 'light': dashboard chiara • 'hub': superficie scura (--hub-surface) come nell'Hub tecnico */
    variant = 'light',
    /** Layout più stretto (es. lista contratti nel modale Hub) */
    compact = false
}) => {
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

    const timelineEventsSorted = [...visibleEvents].sort(
        (a, b) => new Date(a.event_date) - new Date(b.event_date)
    );

    /** Posizione % sull'anno + lane (cicliche, max 4–5) + nudge orizzontale: evita accavallamenti su contratti mensili */
    const eventPercentsForLabels = timelineEventsSorted.map((event) => {
        const t = new Date(event.event_date).getTime();
        return ((t - yearStartDate) / (yearEndDate - yearStartDate)) * 100;
    });
    const bf = contract.billing_frequency;
    const clusterThresholdPct =
        bf === 'monthly' ? 9.2 : bf === 'quarterly' ? 24 : bf === 'semiannual' ? 48 : bf === 'annual' ? 66 : compact ? 6.5 : 6;
    const labelLaneStridePx = compact ? 24 : 28;
    const labelBaseOffsetPx = compact ? 22 : 30;
    const maxLaneMod = compact ? 4 : 5;

    const labelLanes = [];
    const labelHzNudgePx = [];
    const nEvt = timelineEventsSorted.length;
    for (let i = 0; i < nEvt; i++) {
        const closePrev =
            i > 0 && Math.abs(eventPercentsForLabels[i] - eventPercentsForLabels[i - 1]) < clusterThresholdPct;
        const prevLane = i > 0 ? labelLanes[i - 1] : 0;
        labelLanes.push(closePrev ? (prevLane + 1) % maxLaneMod : 0);

        let nudge = 0;
        if (compact && bf === 'monthly' && nEvt >= 8) {
            nudge = (i % 3 - 1) * 13;
        } else if (compact && nEvt >= 6) {
            nudge = i % 2 === 0 ? -11 : 11;
        }
        labelHzNudgePx.push(nudge);
    }
    const maxLabelLane = labelLanes.length ? Math.max(...labelLanes) : 0;

    const useShortEventLabel = compact && bf === 'monthly' && nEvt > 4;
    const showDeadlineRow = !!(nextEvent && daysToNextEvent <= 30);
    const timelinePadBottomReserve =
        labelBaseOffsetPx +
        maxLabelLane * labelLaneStridePx +
        (compact ? 32 : 36) +
        (showDeadlineRow ? (compact ? 34 : 38) : compact ? 8 : 12);
    
    // Find the first non-processed event for yellow color (solo tra gli eventi visibili)
    const firstNonProcessedIndex = timelineEventsSorted.findIndex(e => !e.is_processed);
    const isHub = variant === 'hub';
    const isCompact = compact;
    const tlPadPx = isCompact ? 16 : 24;
    const tlPadTotal = tlPadPx * 2;

    return (
        <div
            className={
                isHub
                    ? `relative rounded-lg border border-white/10 bg-[color:var(--hub-surface)] ${isCompact ? 'p-3' : 'p-5'}`
                    : `relative rounded-lg border border-gray-200 bg-white ${isCompact ? 'p-3' : 'p-5'}`
            }
        >
            {/* Header */}
            <div className={`flex justify-between items-start ${isCompact ? 'mb-2' : 'mb-5'}`}>
                <div>
                    <h3
                        className={
                            isHub
                                ? `mb-0.5 font-bold text-white/90 ${isCompact ? 'text-base' : 'text-lg'}`
                                : `mb-1 font-bold text-gray-800 ${isCompact ? 'text-base' : 'text-lg'}`
                        }
                    >
                        {contract.title}
                    </h3>
                    {contract.client_name && currentUser?.ruolo === 'tecnico' && (
                        <p className={`text-xs mt-1 ${isHub ? 'text-white/45' : 'text-gray-400'}`}>
                            Cliente: {contract.client_name}
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <div className={`flex flex-wrap items-center justify-end gap-1.5 ${isCompact ? 'mb-0' : 'mb-2'}`}>
                        <div
                            className={
                                isHub
                                    ? `inline-block rounded-full border border-teal-400/35 bg-teal-500/15 font-medium text-teal-100 ${isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`
                                    : `inline-block rounded-full border border-teal-200 bg-teal-50 font-medium text-teal-700 ${isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`
                            }
                        >
                            {contract.billing_frequency === 'monthly' ? 'Mensile' :
                                contract.billing_frequency === 'quarterly' ? 'Trimestrale' :
                                    contract.billing_frequency === 'semiannual' ? 'Semestrale' :
                                    contract.billing_frequency === 'annual' ? 'Annuale' : 'Personalizzata'}
                        </div>
                        {contract.end_date && (
                            <span
                                className={`font-medium ${isHub ? 'text-white/55' : 'text-gray-600'} ${isCompact ? 'text-[11px]' : 'text-xs'}`}
                            >
                                Scadenza: {formatDate(contract.end_date)}
                            </span>
                        )}
                        {/* Edit button (only for technicians) - spostato qui */}
                        {currentUser?.ruolo === 'tecnico' && onEdit && (
                            <button
                                onClick={() => onEdit(contract)}
                                className={
                                    isHub
                                        ? 'rounded p-1.5 text-[color:var(--td-accent)] transition-colors hover:bg-white/10'
                                        : 'rounded p-1.5 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700'
                                }
                                title="Modifica contratto"
                            >
                                <Edit size={isCompact ? 14 : 16} />
                            </button>
                        )}
                        {/* Allegati - spostato qui */}
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
                                        className={
                                            isHub
                                                ? 'relative rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white/85'
                                                : 'relative rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-700'
                                        }
                                        title={`${files.length} allegato${files.length !== 1 ? 'i' : ''}`}
                                    >
                                        <Paperclip size={isCompact ? 14 : 16} />
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
                                            <div
                                                className={
                                                    isHub
                                                        ? 'absolute right-0 top-full z-20 mt-2 min-w-[200px] rounded-lg border border-white/15 bg-[color:var(--hub-surface)] py-1 shadow-lg'
                                                        : 'absolute right-0 top-full z-20 mt-2 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg'
                                                }
                                            >
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
                                                            className={
                                                                isHub
                                                                    ? 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/10'
                                                                    : 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50'
                                                            }
                                                        >
                                                            <Download size={14} className={isHub ? 'text-white/45' : 'text-gray-400'} />
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

            {/* Timeline Visual */}
            <div
                className={
                    (isCompact ? 'relative mb-2 overflow-x-clip px-4 pt-4' : 'relative mb-5 overflow-x-clip px-6 pt-8')
                }
                style={{ paddingBottom: `${timelinePadBottomReserve}px` }}
            >
                {/* Traccia totale anno (past + future): grigio visibile sopra alla card */}
                <div
                    aria-hidden
                    className={
                        isHub
                            ? `pointer-events-none absolute top-1/2 z-0 h-1 -translate-y-1/2 rounded-full bg-zinc-600/65 ${isCompact ? 'left-4 right-4' : 'left-6 right-6'}`
                            : `pointer-events-none absolute top-1/2 z-0 h-1 -translate-y-1/2 rounded-full bg-gray-300 ${isCompact ? 'left-4 right-4' : 'left-6 right-6'}`
                    }
                />
                {/* Parte già percorsa (anno → oggi) */}
                <div
                    aria-hidden
                    className={`pointer-events-none absolute top-1/2 z-[1] h-1 -translate-y-1/2 rounded-full bg-teal-400 transition-all duration-1000 ${isCompact ? 'left-4' : 'left-6'}`}
                    style={{ width: `calc((100% - ${tlPadTotal}px) * ${progress / 100})` }}
                />

                {/* Current Point (Today) */}
                <div
                    className="absolute top-1/2 z-[2] -translate-y-1/2"
                    style={{ left: `calc(${tlPadPx}px + ((100% - ${tlPadTotal}px) * ${progress / 100}))` }}
                >
                    <div className="relative -ml-1.5">
                        <div
                            className={
                                isHub
                                    ? `relative z-10 rounded-full border-2 border-[color:var(--hub-surface)] bg-teal-500 ${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`
                                    : `relative z-10 rounded-full border-2 border-white bg-teal-500 ${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`
                            }
                        ></div>
                        <div
                            className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-teal-500 font-semibold text-white ${isCompact ? '-top-6 px-1.5 py-px text-[9px]' : '-top-8 px-2 py-0.5 text-[10px]'}`}
                        >
                            OGGI
                        </div>
                    </div>
                </div>

                {/* All Event Points - mostra solo eventi dell'anno corrente */}
                {timelineEventsSorted.map((event, index) => {
                    const eventPercent = eventPercentsForLabels[index];
                    const lane = labelLanes[index] ?? 0;
                    const isProcessed = event.is_processed === true;
                    const isFirstNonProcessed = index === firstNonProcessedIndex && !isProcessed;
                    
                    // Color logic: blue (renewal), green (processed), yellow (first non-processed), gray (others)
                    let borderColor = 'border-gray-400';
                    let bgColor = 'bg-white';
                    let textColor = 'text-gray-600';
                    let iconColor = 'text-gray-500';
                    const isRenewal = event.event_type === 'renewal' || event.type === 'renewal';
                    
                    if (isHub) {
                        if (isRenewal) {
                            borderColor = 'border-blue-400';
                            bgColor = 'bg-blue-500/20';
                            textColor = 'text-blue-200';
                            iconColor = 'text-blue-300';
                        } else if (isProcessed) {
                            borderColor = 'border-emerald-400';
                            bgColor = 'bg-emerald-500/18';
                            textColor = 'text-emerald-200';
                            iconColor = 'text-emerald-300';
                        } else if (isFirstNonProcessed) {
                            borderColor = 'border-amber-400';
                            bgColor = 'bg-amber-500/18';
                            textColor = 'text-amber-200';
                            iconColor = 'text-amber-300';
                        } else {
                            borderColor = 'border-white/35';
                            bgColor = 'bg-white/10';
                            textColor = 'text-zinc-300';
                            iconColor = 'text-zinc-400';
                        }
                    } else if (isRenewal) {
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
                            className="absolute top-1/2 z-[2] -translate-y-1/2 group" 
                            style={{ left: `calc(${tlPadPx}px + ((100% - ${tlPadTotal}px) * ${eventPercent / 100}))` }}
                        >
                            <div
                                className={`rounded-full ${bgColor} border-2 ${borderColor} flex items-center justify-center cursor-pointer relative ${isCompact ? 'h-4 w-4 -ml-2' : 'h-5 w-5 -ml-2.5'}`}
                            >
                                {isRenewal ? (
                                    <div className={`rounded-full bg-blue-500 ${isCompact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}></div>
                                ) : isProcessed ? (
                                    <CheckCircle size={isCompact ? 10 : 12} className={iconColor} />
                                ) : (
                                    <AlertCircle size={isCompact ? 10 : 12} className={iconColor} />
                                )}
                                {/* Tooltip con importo (solo per eventi non-rinnovo) */}
                                {!isRenewal && displayAmount && (
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                                        € {displayAmount}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                                    </div>
                                )}
                            </div>
                            <div
                                className={`absolute left-1/2 z-[3] px-1 text-center ${useShortEventLabel ? (isCompact ? 'max-w-[3.75rem]' : 'max-w-[4.25rem]') : isCompact ? 'max-w-[5.75rem]' : 'max-w-[7.25rem]'}`}
                                style={{
                                    top: labelBaseOffsetPx + lane * labelLaneStridePx,
                                    transform: `translateX(calc(-50% + ${labelHzNudgePx[index] ?? 0}px))`
                                }}
                            >
                                {useShortEventLabel ? (
                                    <div
                                        className={`tabular-nums font-semibold leading-tight ${textColor} ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                                        title={`${displayDescription} · ${formatDate(event.event_date)}`}
                                    >
                                        {formatDate(event.event_date)}
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className={`break-words font-semibold leading-snug ${textColor} ${isCompact ? 'text-[10px]' : 'text-xs'}`}
                                        >
                                            {displayDescription}
                                        </div>
                                        <div
                                            className={`mt-0.5 break-words leading-tight tabular-nums ${isHub ? 'text-white/45' : 'text-gray-400'} ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}
                                        >
                                            {formatDate(event.event_date)}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Actions */}
            {showDeadlineRow && (
                <div
                    className={`relative z-[5] flex items-center justify-between ${isCompact ? 'mt-2 pt-2' : 'mt-3 pt-3'}`}
                >
                    <div className={isCompact ? 'flex gap-2' : 'flex gap-4'}>
                        <div
                            className={`flex items-center ${isCompact ? 'gap-1.5 text-xs' : 'gap-2 text-sm'} ${
                                isHub
                                    ? daysToNextEvent <= 7
                                        ? 'font-medium text-red-400'
                                        : 'text-amber-400'
                                    : daysToNextEvent <= 7
                                      ? 'font-medium text-red-600'
                                      : 'text-amber-600'
                            }`}
                        >
                            <Clock size={isCompact ? 14 : 16} />
                            <span>Prossima scadenza tra {daysToNextEvent} {daysToNextEvent === 1 ? 'giorno' : 'giorni'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContractTimelineCard;
