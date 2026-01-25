import React, { useEffect, useState, useRef } from 'react';
import { Terminal, PauseCircle, PlayCircle, X, Download, AlertTriangle } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

// Pagina Standalone per il Ping Terminal
// Viene aperta in una nuova finestra (popup)
const PingTerminalPage = () => {
    const [ip, setIp] = useState('');
    const [lines, setLines] = useState([]);
    const [status, setStatus] = useState('idle');
    const bottomRef = useRef(null);
    const abortControllerRef = useRef(null);

    useEffect(() => {
        // Estrai IP dall'URL
        // URL atteso: /tools/ping-terminal?ip=1.2.3.4
        const params = new URLSearchParams(window.location.search);
        const targetIp = params.get('ip');
        if (targetIp) {
            setIp(targetIp);
            startPing(targetIp);
        } else {
            setLines(['> Errore: Nessun IP specificato nell\'URL.']);
        }

        return () => stopPing();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Scroll automatico
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [lines]);

    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    const startPing = async (targetIp) => {
        if (status === 'running') return;

        stopPing();

        setLines(prev => [
            ...prev,
            `> Inizializzazione sessione ping verso ${targetIp}...`,
            `> Server: VPS Remota`,
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
                if (response.status === 401) {
                    throw new Error("Sessione scaduta. Effettua nuovamente il login.");
                }
                throw new Error(`Errore server: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const newLines = chunk.split('\n');

                const cleanLines = [];
                for (let line of newLines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        cleanLines.push(line.substring(6));
                    } else if (!line.startsWith(':')) {
                        cleanLines.push(line);
                    }
                }

                if (cleanLines.length > 0) {
                    setLines(prev => [...prev, ...cleanLines]);
                }
            }
            setStatus('stopped');
            setLines(prev => [...prev, `> Sessione terminata dal server.`]);
        } catch (err) {
            if (err.name === 'AbortError') {
                setLines(prev => [...prev, `> Sessione interrotta dall'utente.`]);
                setStatus('stopped');
            } else {
                console.error("Ping error:", err);
                setLines(prev => [...prev, `> Errore: ${err.message}`]);
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

    // Protocol handler setup generator
    const downloadLocalSetup = () => {
        const regContent = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\pingtool]
@="URL:PingTool Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\pingtool\\shell]

[HKEY_CLASSES_ROOT\\pingtool\\shell\\open]

[HKEY_CLASSES_ROOT\\pingtool\\shell\\open\\command]
@="powershell -NoProfile -WindowStyle Hidden -Command \\"$ip = '%1'.Replace('pingtool:', '').Replace('/', ''); Start-Process cmd -ArgumentList \\"/k ping $ip -t -w 1000\\"\\""
`;
        const blob = new Blob([regContent], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SetupPingLocale_v2.reg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("1. Esegui il file 'SetupPingLocale_v2.reg' scaricato.\n2. Conferma l'inserimento nel registro.\n3. Ora puoi usare 'Ping da Locale'!");
    };

    const launchLocalPing = () => {
        if (!ip) return;
        // Launch custom protocol
        window.location.href = `pingtool:${ip}`;
        setLines(prev => [...prev, `> Lanciato ping locale verso ${ip}...`]);
    };

    return (
        <div className="h-screen w-screen bg-gray-900 text-gray-300 font-mono flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 shadow-md">
                <div className="flex items-center gap-3">
                    <Terminal size={18} className="text-green-400" />
                    <span className="font-bold text-gray-100">Ping Terminal: {ip}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => status === 'running' ? stopPing() : startPing(ip)}
                        className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition ${status === 'running'
                            ? 'bg-red-900/50 text-red-400 hover:bg-red-900/80'
                            : 'bg-green-900/50 text-green-400 hover:bg-green-900/80'
                            }`}
                    >
                        {status === 'running' ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                        {status === 'running' ? 'STOP VPS' : 'START VPS'}
                    </button>

                    <div className="h-6 w-px bg-gray-600 mx-2"></div>

                    <button
                        onClick={launchLocalPing}
                        className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded flex items-center gap-2 text-xs transition"
                        title="Apri terminale CMD locale (richiede setup)"
                    >
                        <Terminal size={16} />
                        DA LOCALE
                    </button>

                    <button
                        onClick={downloadLocalSetup}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded"
                        title="Scarica setup per Ping Locale"
                    >
                        <Download size={16} />
                    </button>
                </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-black scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {/* Intro Info */}
                <div className="mb-4 text-xs text-gray-500 border-b border-gray-800 pb-2">
                    <div className="flex items-start gap-2 mb-1">
                        <AlertTriangle size={12} className="mt-0.5" />
                        <p>
                            Questo terminale mostra il ping eseguito dalla <strong>VPS Remota</strong>.
                            Se l'IP è privato (es. 192.168.x.x) e la VPS non ha VPN, fallirà.
                        </p>
                    </div>
                    <div className="flex items-start gap-2">
                        <Terminal size={12} className="mt-0.5" />
                        <p>
                            Usa il tasto <strong>"DA LOCALE"</strong> in alto per aprire un vero CMD sul tuo PC (richiede setup una tantum).
                        </p>
                    </div>
                </div>

                {lines.map((line, i) => (
                    <div key={i} className="break-all whitespace-pre-wrap leading-relaxed font-mono text-sm">
                        {line.startsWith('> ') ? (
                            <span className="text-yellow-500">{line}</span>
                        ) : line.includes('Reply from') || line.includes('risposta da') || line.includes('bytes from') ? (
                            <span className="text-green-400">{line}</span>
                        ) : line.includes('Request timed out') || line.includes('Richiesta scaduta') || line.includes('Unreachable') ? (
                            <span className="text-red-400">{line}</span>
                        ) : line.includes('Error') ? (
                            <span className="text-red-500 font-bold">{line}</span>
                        ) : (
                            <span>{line}</span>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default PingTerminalPage;
