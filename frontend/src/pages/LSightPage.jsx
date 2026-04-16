import React, { useState, useEffect } from 'react';
import { Eye, Shield, Cpu, Activity, Search, X, MonitorPlay, Zap, Server, ShieldCheck, ChevronRight } from 'lucide-react';

const LSightPage = ({ onClose, onNavigateHome, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    // Simula una scansione iniziale della rete L-Sight
    const timer = setTimeout(() => setIsScanning(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0E17] text-slate-300 flex flex-col font-sans overflow-hidden">
      {/* Header Premium */}
      <header className="flex-none bg-[#0D131F] border-b border-indigo-900/30 px-6 py-4 flex items-center justify-between shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-full bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative flex items-center justify-center w-12 h-12 bg-indigo-950 rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Eye className="text-indigo-400 w-6 h-6" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-950 animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              L-Sight <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] uppercase font-black tracking-widest border border-indigo-500/20">Remote Core</span>
            </h1>
            <p className="text-xs text-indigo-300/70 uppercase tracking-widest font-semibold mt-0.5">Zero-Trust Remote Access Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <button 
            onClick={onNavigateHome || onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-sm font-medium"
          >
            <X size={18} />
            Chiudi Modulo
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10 space-y-8">
          
          {/* Status Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/20 overflow-hidden flex items-stretch">
            <div className="w-1.5 bg-indigo-500" />
            <div className="p-6 flex-1 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="text-indigo-400" size={20} />
                  Infrastruttura L-Sight Operativa
                </h2>
                <p className="text-slate-400 text-sm mt-1">Connessioni crittografate end-to-end senza VPN abilitate. Attesa assegnazione Agent.</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Latenza Rete</div>
                  <div className="text-emerald-400 font-mono text-lg font-bold">12ms</div>
                </div>
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Agent Attivi</div>
                  <div className="text-indigo-400 font-mono text-lg font-bold">0</div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Cerca dispositivo o dipendente..." 
                className="w-full bg-[#111827] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {currentUser?.ruolo === 'tecnico' && (
              <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all">
                <Zap size={18} />
                Gestisci Assegnazioni L-Sight
              </button>
            )}
          </div>

          {/* Devices Grid Placeholder */}
          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
               <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                  <Eye className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={24} />
               </div>
               <div className="text-sm font-mono text-indigo-400 animate-pulse tracking-widest">SCANSIONE RETI AZIENDALI IN CORSO...</div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-slate-800 rounded-2xl bg-[#0D131F]/50">
              <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6 border border-slate-700/50 shadow-inner">
                <MonitorPlay size={32} className="text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Nessun dispositivo assegnato</h3>
              <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed mb-6">
                 Attualmente non ci sono macchine collegate al tuo profilo L-Sight. L'amministratore di sistema deve prima abilitare e assegnare l'Agent video al tuo account.
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-800">
                <ShieldCheck size={14} className="text-emerald-500" />
                RICHIESTA AUTORIZZAZIONE PENDENTE
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default LSightPage;
