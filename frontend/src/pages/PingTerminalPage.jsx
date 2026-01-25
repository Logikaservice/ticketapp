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
        const params = new URLSearchParams(window.location.search);
        const targetIp = params.get('ip');
        if (targetIp) {
            setIp(targetIp);
            // Avvio automatico ping locale dopo breve delay per caricamento UI
            setTimeout(() => {
                launchLocalPing(targetIp);
            }, 800);
        } else {
            setLines(['> Errore: Nessun IP specificato nell\'URL.']);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Scroll automatico
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [lines]);

    // VPS Ping functions removed as requested

    // Protocol handler setup generator
    const downloadLocalSetup = () => {
        const regContent = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\pingtool]
@="URL:PingTool Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\pingtool\\shell]

[HKEY_CLASSES_ROOT\\pingtool\\shell\\open]

[HKEY_CLASSES_ROOT\\pingtool\\shell\\open\\command]
@="cmd /V:ON /C \\"set \\"url=%1\\" & set \\"url=!url:pingtool:=!\\" & set \\"url=!url:/=!\\" & start \\"Ping Locale\\" cmd /k \\"color 0A & title Ping Locale !url! & echo Ping in corso verso !url!... & ping !url! -t\\"\\""
`;
        const blob = new Blob([regContent], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SetupPingLocale_v4.reg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("1. Esegui il file 'SetupPingLocale_v4.reg' scaricato.\n2. Conferma l'inserimento nel registro.\n3. Ora puoi usare 'Ping da Locale'!");
    };

    const launchLocalPing = (targetIp) => {
        const ipToPing = targetIp || ip;
        if (!ipToPing) return;

        setLines(prev => [...prev, `> Tentativo avvio ping locale verso ${ipToPing}...`]);

        // Timeout per rilevare se il protocollo non è gestito (best effort)
        const timeoutId = setTimeout(() => {
            setLines(prev => [
                ...prev,
                `> ATTENZIONE: Sembra che il comando locale non sia partito.`,
                `> Assicurati di aver scaricato ed eseguito il file di setup.`
            ]);
        }, 3000);

        // Listener per rilevare se la pagina perde il focus (segno che il protocollo ha funzionato)
        const onBlur = () => {
            clearTimeout(timeoutId);
            setLines(prev => [...prev, `> Comando inviato al sistema con successo.`]);
            window.removeEventListener('blur', onBlur);
        };
        window.addEventListener('blur', onBlur);

        // Launch custom protocol
        window.location.href = `pingtool:${ipToPing}`;
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
                        onClick={() => launchLocalPing(ip)}
                        className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded flex items-center gap-2 text-xs transition"
                        title="Riapri terminale CMD locale"
                    >
                        <Terminal size={16} />
                        Rilancia DA LOCALE
                    </button>

                    <button
                        onClick={downloadLocalSetup}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded"
                        title="Scarica setup se il comando non funziona"
                    >
                        <Download size={16} />
                    </button>
                </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-black scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
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
