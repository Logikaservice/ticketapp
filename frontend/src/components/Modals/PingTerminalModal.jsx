import React, { useEffect, useState, useRef } from 'react';
import { X, Terminal, PauseCircle, PlayCircle, AlertTriangle } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const PingTerminalModal = ({ isOpen, onClose, targetIp, getAuthHeader }) => {
    const [lines, setLines] = useState([]);
    const [status, setStatus] = useState('idle'); // idle, running, stopped, error
    const bottomRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Scroll automatico
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [lines]);

    // Avvio al mount
    useEffect(() => {
        if (isOpen && targetIp) {
            setLines([]);
            startPing();
        }
        return () => stopPing();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, targetIp]);

    const startPing = async () => {
        if (status === 'running') return;

        stopPing(); // Assicura pulizia precedente

        setLines(prev => [
            ...prev,
            `> Inizializzazione sessione ping verso ${targetIp}...`,
            `> ATTENZIONE: Il comando viene eseguito dal SERVER VPS.`,
            `> Se l'IP è privato (es. 192.168.x.x) e il server è in Cloud/VPS esterno, il ping fallirà (Timeout).`,
            `> ----------------------------------------------------------------`
        ]);
        setStatus('running');

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            const url = new URL(buildApiUrl('/api/network-monitoring/tools/ping'));
            url.searchParams.append('target', targetIp);

            const response = await fetch(url.toString(), {
                headers: getAuthHeader(),
                signal
            });

            if (!response.ok) {
                throw new Error(`Errore server: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const newLines = chunk.split('\n');

                // Filtra e pulisce le righe SSE 'data: ...'
                const cleanLines = [];
                for (let line of newLines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        cleanLines.push(line.substring(6));
                    } else if (!line.startsWith(':')) {
                        // Ignora commenti SSE che iniziano con :
                        cleanLines.push(line);
                    }
                }

                if (cleanLines.length > 0) {
                    setLines(prev => [...prev, ...cleanLines]);
                }
            }
            setStatus('stopped');
            setLines(prev => [...prev, `> Sessione terminata.`]);
        } catch (err) {
            if (err.name === 'AbortError') {
                setLines(prev => [...prev, `> Sessione interrotta dall'utente.`]);
                setStatus('stopped');
            } else {
                console.error("Ping error:", err);
                setLines(prev => [...prev, `> Errore connessione: ${err.message}`]);
                setStatus('error');
            }
        }
    };

    const stopPing = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (status === 'running') {
            setStatus('stopped');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-gray-900 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col border border-gray-700 h-[80vh]">
                {/* Header terminale style */}
                <div className="bg-gray-800 px-4 py-3 rounded-t-xl flex items-center justify-between border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300 ml-2 font-mono text-sm">
                            <Terminal size={16} />
                            <span>root@vps: ping {targetIp}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {status === 'running' ? (
                            <button
                                onClick={stopPing}
                                className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition"
                                title="Ferma"
                            >
                                <PauseCircle size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={startPing}
                                className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition"
                                title="Riavvia"
                            >
                                <PlayCircle size={18} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition ml-2"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Terminal Body */}
                <div className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-black text-gray-300 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {lines.map((line, i) => (
                        <div key={i} className="break-all whitespace-pre-wrap leading-relaxed">
                            {line.startsWith('> ') ? (
                                <span className="text-yellow-500">{line}</span>
                            ) : line.includes('Reply from') || line.includes('risposta da') || line.includes('bytes from') ? (
                                <span className="text-green-400">{line}</span>
                            ) : line.includes('Request timed out') || line.includes('Richiesta scaduta') || line.includes('Unreachable') ? (
                                <span className="text-red-400">{line}</span>
                            ) : (
                                <span>{line}</span>
                            )}
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Footer status */}
                <div className="px-4 py-2 bg-gray-800 text-xs text-gray-500 flex justify-between rounded-b-xl border-t border-gray-700">
                    <div className="flex items-center gap-2">
                        {status === 'running' ? (
                            <span className="flex items-center gap-2 text-green-400">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                Esecuzione in corso...
                            </span>
                        ) : (
                            <span className="text-gray-400">Sessione terminata</span>
                        )}
                    </div>
                    <div>
                        TicketApp Network Monitor
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PingTerminalModal;
