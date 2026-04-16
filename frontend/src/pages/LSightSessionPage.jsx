import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ShieldCheck, X, RefreshCcw, Circle, Clock, KeyRound, PlugZap } from 'lucide-react';

const LSightSessionPage = ({ sessionId, getAuthHeader, onClose, onNavigateLSight }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(false);
  const [rtcStatus, setRtcStatus] = useState('idle'); // idle | offering | waiting-answer | connected | failed | agent-ready
  const [rtcError, setRtcError] = useState(null);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);

  const pcRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const lastAgentSignalIdRef = useRef(0);
  const pollTimerRef = useRef(null);
  const offerSentRef = useRef(false);

  const canLoad = useMemo(() => !!sessionId && !Number.isNaN(Number(sessionId)), [sessionId]);

  const fetchSession = async () => {
    if (!canLoad) return;
    setError(null);
    try {
      const res = await fetch(`/api/lsight-rtc/sessions/${Number(sessionId)}`, { headers: getAuthHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data?.error || 'Errore nel recupero sessione');
        setSession(null);
        return;
      }
      setSession(data.session || null);
    } catch (e) {
      console.error('Errore fetch sessione L-Sight RTC:', e);
      setError('Errore di rete');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const sendViewerSignal = async (type, payload) => {
    const res = await fetch(`/api/lsight-rtc/sessions/${Number(sessionId)}/signal`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type, payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data?.error || 'Errore signaling');
    }
    return data;
  };

  const pollAgentSignals = async () => {
    if (!sessionId) return;
    const after = lastAgentSignalIdRef.current || 0;
    const res = await fetch(`/api/lsight-rtc/sessions/${Number(sessionId)}/signals?after=${after}&limit=50`, {
      headers: getAuthHeader()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return;
    }
    const signals = Array.isArray(data.signals) ? data.signals : [];
    if (signals.length) {
      lastAgentSignalIdRef.current = signals[signals.length - 1].id;
    }
    const pc = pcRef.current;
    if (!pc) return;

    for (const s of signals) {
      if (s.type === 'answer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(s.payload));
          setRtcStatus('connected');
          setRtcError(null);
        } catch (e) {
          setRtcStatus('failed');
          setRtcError(`Errore setRemoteDescription(answer): ${e.message}`);
        }
      } else if (s.type === 'agent-ready') {
        // Segnale leggero per confermare che l'agent pilota vede la sessione.
        if (rtcStatus !== 'connected') setRtcStatus('agent-ready');
      } else if (s.type === 'ice') {
        try {
          await pc.addIceCandidate(s.payload);
        } catch (_) {
          // alcuni browser lanciano errori se arriva ICE prima della remoteDescription; ignoriamo e riproveremo con i successivi
        }
      }
    }
  };

  const stopRtc = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    offerSentRef.current = false;
    lastAgentSignalIdRef.current = 0;
    try {
      pcRef.current?.close?.();
    } catch (_) {
      // ignore
    }
    pcRef.current = null;
    try {
      remoteStreamRef.current?.getTracks?.().forEach(t => t.stop());
    } catch (_) {
      // ignore
    }
    remoteStreamRef.current = null;
    setRemoteVideoReady(false);
    setRtcStatus('idle');
    setRtcError(null);
  };

  const startRtc = async () => {
    if (!canLoad) return;
    if (offerSentRef.current) return;
    setRtcError(null);
    setRtcStatus('offering');

    // Prepara stream remoto (solo ricezione)
    remoteStreamRef.current = new MediaStream();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      sendViewerSignal('ice', ev.candidate).catch(() => {});
    };

    pc.ontrack = (ev) => {
      try {
        ev.streams?.[0]?.getTracks?.().forEach(t => remoteStreamRef.current.addTrack(t));
        setRemoteVideoReady(true);
      } catch (_) {
        // ignore
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') setRtcStatus('connected');
      if (st === 'failed' || st === 'disconnected') setRtcStatus('failed');
    };

    try {
      // “viewer”: vogliamo SOLO ricevere video (e in futuro datachannel per input).
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendViewerSignal('offer', pc.localDescription);
      offerSentRef.current = true;
      setRtcStatus('waiting-answer');

      // Polling segnali agent (answer/ice)
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(pollAgentSignals, 700);
    } catch (e) {
      setRtcStatus('failed');
      setRtcError(e.message || 'Errore WebRTC');
      stopRtc();
    }
  };

  const closeSession = async () => {
    if (!canLoad || closing) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/lsight-rtc/sessions/${Number(sessionId)}/close`, {
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
    // Poll leggero: per ora solo per vedere lo stato cambiare
    const t = setInterval(fetchSession, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    // Cleanup RTC quando si esce pagina o cambia sessione
    return () => stopRtc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const statusColor = (st) => {
    switch (st) {
      case 'active':
        return 'text-emerald-400';
      case 'connecting':
        return 'text-indigo-300';
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
              Control-plane · RTC Engine
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
                  onClick={startRtc}
                  className="px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/30 text-sm font-black flex items-center gap-2"
                  title="Avvia handshake WebRTC (offer/answer/ICE)"
                >
                  <PlugZap size={16} />
                  Connetti (RTC)
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
              WebRTC
            </div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <div className="text-white font-black">
                {rtcStatus === 'idle' ? 'pronto' :
                  rtcStatus === 'offering' ? 'creo offer...' :
                    rtcStatus === 'waiting-answer' ? 'in attesa di answer...' :
                      rtcStatus === 'agent-ready' ? 'agent pronto (pilot)' :
                      rtcStatus === 'connected' ? 'connesso' :
                        'errore'}
              </div>
              {rtcError && <div className="text-rose-400 text-sm">{rtcError}</div>}
            </div>

            <div className="mt-4 rounded-xl bg-black/30 border border-white/5 overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-[280px] object-contain bg-black/40"
                onCanPlay={() => setRemoteVideoReady(true)}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              In questo step facciamo solo signaling (offer/answer/ICE). Il video apparirà quando l’agent invierà un track.
              {remoteVideoReady ? '' : ' (per ora nessun frame)'}
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
              Questo token verrà usato nei prossimi step per handshake/signaling WebRTC.
            </div>
          </div>

          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5">
            <div className="text-amber-300 font-black text-sm">Nota</div>
            <div className="text-slate-300 text-sm mt-1">
              In questa fase abbiamo aggiunto il <span className="font-semibold">signaling WebRTC</span> (offer/answer/ICE). Il motore video/input completo
              verrà aggiunto nei prossimi step.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LSightSessionPage;

