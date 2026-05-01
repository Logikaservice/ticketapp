import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ShieldCheck, X, RefreshCcw, Circle, Clock, KeyRound, Plug } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const LSightSessionPage = ({ sessionId, getAuthHeader, onClose, onNavigateLSight }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const canLoad = useMemo(() => !!sessionId && !Number.isNaN(Number(sessionId)), [sessionId]);

  const fetchSession = async () => {
    if (!canLoad) return;
    setError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/lsight-rdp/sessions/${Number(sessionId)}`), { headers: getAuthHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data?.error || 'Errore nel recupero sessione');
        setSession(null);
        return;
      }
      setSession(data.session || null);
    } catch (e) {
      console.error('Errore fetch sessione L-Sight RDP:', e);
      setError('Errore di rete');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadRdp = async () => {
    if (!canLoad || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/lsight-rdp/sessions/${Number(sessionId)}/rdp-file`), { headers: getAuthHeader() });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        alert(txt || 'Errore download file RDP');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lsight-${Number(sessionId)}.rdp`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Errore di rete durante il download RDP');
    } finally {
      setDownloading(false);
    }
  };

  const closeSession = async () => {
    if (!canLoad || closing) return;
    setClosing(true);
    try {
      const res = await fetch(buildApiUrl(`/api/lsight-rdp/sessions/${Number(sessionId)}/close`), {
        method: 'POST',
        headers: getAuthHeader()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        alert(data?.error || 'Errore chiusura sessione');
        return;
      }
      setSession(data.session || null);
    } catch (e) {
      alert('Errore di rete durante la chiusura sessione');
    } finally {
      setClosing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSession();
    // Poll stato sessione (tunnel pronto)
    const t = setInterval(fetchSession, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const statusColor = (st) => {
    switch (st) {
      case 'active':
        return 'text-emerald-400';
      case 'connecting':
        return 'text-indigo-300';
      case 'ready':
        return 'text-emerald-400';
      case 'expired':
        return 'text-amber-400';
      case 'closed':
        return 'text-slate-500';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#0A0E17] text-slate-200 flex flex-col overflow-hidden">
      <header className="flex-none bg-[#0D131F] border-b border-indigo-900/30 px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-950 rounded-xl border border-indigo-500/30 flex items-center justify-center">
            <ShieldCheck className="text-indigo-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">L-Sight Session</h1>
            <p className="text-xs text-indigo-300/70 uppercase tracking-widest font-semibold mt-0.5">
              Control-plane · RDP Gateway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateLSight}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-sm font-medium"
          >
            <ArrowLeft size={18} />
            Torna a L-Sight
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-sm font-medium"
          >
            <X size={18} />
            Chiudi
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="rounded-2xl bg-[#0D131F] border border-slate-800 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Sessione</div>
                <div className="text-white font-black text-2xl mt-1">
                  {sessionId ? `#${sessionId}` : '—'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadRdp}
                  disabled={downloading || (session?.status && session.status !== 'ready' && session.status !== 'active' && session.status !== 'connecting')}
                  className="px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-60 border border-indigo-500/30 text-sm font-black flex items-center gap-2"
                  title="Scarica il file .rdp e aprilo con il nuovo Desktop Remoto (Windows App)"
                >
                  <Plug size={16} />
                  Apri Desktop Remoto
                </button>
                <button
                  onClick={fetchSession}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-bold flex items-center gap-2"
                >
                  <RefreshCcw size={16} />
                  Aggiorna
                </button>
                <button
                  onClick={closeSession}
                  disabled={closing}
                  className="px-4 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 border border-rose-500/30 text-sm font-black"
                >
                  Chiudi sessione
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#0D131F] border border-slate-800 p-5">
              <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-widest font-bold">
                <Circle size={14} />
                Stato
              </div>
              <div className={`mt-2 text-xl font-black ${statusColor(session?.status)}`}>
                {loading ? 'Caricamento...' : (error ? 'Errore' : (session?.status || '—'))}
              </div>
              {error && <div className="mt-2 text-sm text-rose-400">{error}</div>}
              <div className="mt-2 text-xs text-slate-500">
                {session?.status === 'created' ? 'Sessione creata: in attesa tunnel...' :
                  session?.status === 'tunneling' ? 'Tunnel in avvio...' :
                    session?.status === 'ready' ? 'Tunnel pronto: puoi aprire il nuovo Desktop Remoto.' :
                      ''}
              </div>
            </div>

            <div className="rounded-2xl bg-[#0D131F] border border-slate-800 p-5">
              <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-widest font-bold">
                <Clock size={14} />
                Scadenza
              </div>
              <div className="mt-2 text-xl font-black text-white">
                {session?.expires_at ? new Date(session.expires_at).toLocaleString() : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono">TTL server-side (auto-expire)</div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0D131F] border border-slate-800 p-5">
            <div className="text-slate-400 text-xs uppercase tracking-widest font-bold">
              Desktop Remoto (RDP)
            </div>
            <div className="mt-2 text-white font-black">
              {session?.status === 'ready' ? 'pronto' : 'in preparazione...'}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Clicca <span className="font-semibold">Apri Desktop Remoto</span> per scaricare il file <span className="font-mono">.rdp</span>.
              Aprilo con <span className="font-semibold">Windows App (nuovo Desktop Remoto)</span>; se non disponibile, funziona anche con il client classico.
              La connessione passa dal tuo RD Gateway (senza VPN).
            </div>
          </div>

          <div className="rounded-2xl bg-[#0D131F] border border-slate-800 p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-widest font-bold">
              <KeyRound size={14} />
              Token sessione
            </div>
            <div className="mt-3 font-mono text-xs text-slate-300 break-all bg-black/30 border border-white/5 rounded-xl p-3">
              {session?.session_token || '—'}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Questo token identifica la sessione lato server (TTL breve).
            </div>
          </div>

          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5">
            <div className="text-amber-300 font-black text-sm">Nota</div>
            <div className="text-slate-300 text-sm mt-1">
              Questo flusso usa <span className="font-semibold">RDP vero</span> (clipboard, drive mapping, stampanti) tramite <span className="font-semibold">RD Gateway</span>.
              Ti consigliamo il <span className="font-semibold">nuovo Desktop Remoto (Windows App)</span> come client predefinito.
              Non serve OpenVPN sul PC del tecnico.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LSightSessionPage;

