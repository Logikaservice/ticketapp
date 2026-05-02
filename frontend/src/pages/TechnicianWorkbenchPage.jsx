import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Search,
  Building2,
  Mail,
  Shield,
  Eye,
  Monitor,
  Gauge,
  Wifi,
  MapPin,
  Bell,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Moon,
  RefreshCw,
  Globe,
  Settings,
  Palette,
  LogOut,
  Calendar,
  Volume2,
  Layers
} from 'lucide-react';

const SURFACE = '#1E1E1E';
const DEFAULT_ACCENT = '#C1FF72';
const PAGE_BG = '#121212';
const STORAGE_KEY_ACCENT = 'techHubAccent';

/** Palette colori brillanti (accento Hub tecnico). */
const TECH_HUB_ACCENT_PALETTE = [
  { id: 'lime', label: 'Lime', hex: '#C1FF72' },
  { id: 'chartreuse', label: 'Chartreuse', hex: '#D4FF47' },
  { id: 'spring', label: 'Primavera', hex: '#00FF9F' },
  { id: 'cyan', label: 'Ciano', hex: '#22D3EE' },
  { id: 'sky', label: 'Cielo', hex: '#38BDF8' },
  { id: 'blue', label: 'Blu elettrico', hex: '#60A5FA' },
  { id: 'violet', label: 'Violetto', hex: '#A78BFA' },
  { id: 'fuchsia', label: 'Fucsia', hex: '#E879F9' },
  { id: 'pink', label: 'Rosa', hex: '#FB7185' },
  { id: 'coral', label: 'Corallo', hex: '#FF6B6B' },
  { id: 'amber', label: 'Ambra', hex: '#FBBF24' },
  { id: 'orange', label: 'Arancione', hex: '#FB923C' }
];

function normalizeHex(hex) {
  const h = (hex || '').trim();
  const re = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
  const m = h.match(re);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) {
    s = s.split('').map((c) => c + c).join('');
  }
  return `#${s}`;
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHex(hex);
  if (!normalized) return `rgba(255,255,255,${alpha})`;
  const h = normalized.slice(1);
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Testo leggibile sulla pill colore avatar (sfondi accesi vs scuri). */
function readableOnAccent(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return '#111111';
  const h = normalized.slice(1);
  const n = parseInt(h, 16);
  const R = ((n >> 16) & 255) / 255;
  const G = ((n >> 8) & 255) / 255;
  const Bl = (n & 255) / 255;
  const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * Bl;
  return luminance > 0.62 ? '#121212' : '#fafafa';
}

function loadStoredAccent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCENT);
    const n = normalizeHex(raw);
    if (!n) return DEFAULT_ACCENT;
    const known = TECH_HUB_ACCENT_PALETTE.some((p) => p.hex.toLowerCase() === n.toLowerCase());
    return known ? n : DEFAULT_ACCENT;
  } catch (_) {
    /* ignore */
  }
  return DEFAULT_ACCENT;
}

/** Incrociabile: modulo card cliccabile (stesso pattern per tasselli e griglia centrale). */
function ModuleLaunchCard({ icon: Icon, label, subtitle, accent, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border border-white/[0.08] p-4 text-left transition hover:bg-white/[0.04] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] ${className}`}
      style={{ backgroundColor: SURFACE }}
    >
      <div className="mb-3 inline-flex rounded-xl p-2.5" style={{ backgroundColor: hexToRgba(accent, 0.12) }}>
        <Icon size={22} style={{ color: accent }} className="shrink-0" />
      </div>
      <div className="text-sm font-semibold text-white">{label}</div>
      {subtitle && <div className="mt-1 text-xs text-white/45">{subtitle}</div>}
    </button>
  );
}

function NavGroup({ title, open, onToggle, children }) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/40 transition hover:bg-white/[0.04] hover:text-[color:var(--hub-accent)]"
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="space-y-0.5 pl-1">{children}</div>}
    </div>
  );
}

function SidebarLink({ icon: Icon, label, onClick, nested }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/[0.05] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)] ${
        nested ? 'pl-6 text-[13px] text-white/70' : ''
      }`}
    >
      <Icon
        size={nested ? 16 : 18}
        className="shrink-0 text-white/45 transition group-hover:text-[color:var(--hub-accent)]"
      />
      {label}
    </button>
  );
}

function RightPanel({ title, children }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] p-4"
      style={{ backgroundColor: SURFACE }}
    >
      <h3 className="mb-3 shrink-0 text-xs font-bold uppercase tracking-widest text-white/40">{title}</h3>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function DummyRow({ dot, title, meta, accent }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 transition hover:[border-color:var(--hub-accent-border)]">
      <div
        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot || accent }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/85">{title}</p>
        <p className="mt-0.5 text-xs text-white/40">{meta}</p>
      </div>
    </div>
  );
}

export default function TechnicianWorkbenchPage({
  currentUser,
  onNavigateHome,
  onLogout,
  onOpenSettings,
  nav
}) {
  const [accentHex, setAccentHex] = useState(loadStoredAccent);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [navToolsOpen, setNavToolsOpen] = useState(true);
  const [navProjectsOpen, setNavProjectsOpen] = useState(true);
  const userMenuRef = useRef(null);
  const accentPickerRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCENT, accentHex);
    } catch (_) {
      /* ignore */
    }
  }, [accentHex]);

  useEffect(() => {
    const onDoc = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (accentPickerRef.current && !accentPickerRef.current.contains(e.target)) setAccentPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const displayName = useMemo(() => {
    const n = `${currentUser?.nome || ''} ${currentUser?.cognome || ''}`.trim();
    return n || currentUser?.email || 'Utente';
  }, [currentUser]);

  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0] || '?').slice(0, 2).toUpperCase();
  }, [displayName]);

  const accentStyle = useMemo(
    () => ({
      backgroundColor: PAGE_BG,
      color: '#fafafa',
      ['--hub-accent']: accentHex,
      ['--hub-accent-border']: hexToRgba(accentHex, 0.52),
      ['--hub-accent-glow']: hexToRgba(accentHex, 0.32)
    }),
    [accentHex]
  );

  const hubHoverIconBtn =
    'rounded-xl border border-transparent text-white/45 transition hover:bg-white/[0.06] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)]';

  return (
    <div className="fixed inset-0 z-[70] flex min-h-0 flex-col md:flex-row" style={accentStyle}>
      {/* Colonna sinistra */}
      <aside
        className="flex w-full shrink-0 flex-col border-white/[0.06] px-5 py-5 md:h-full md:w-[280px] md:border-r lg:w-[292px]"
        style={{ backgroundColor: '#171717' }}
      >
        <div ref={userMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-2 text-left transition hover:bg-white/[0.05] hover:[border-color:var(--hub-accent-border)]"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: accentHex, color: readableOnAccent(accentHex) }}
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{displayName}</div>
              <div className="truncate text-xs text-white/45">{currentUser?.email || ''}</div>
            </div>
            <ChevronDown size={18} className={`shrink-0 text-white/40 transition ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {userMenuOpen && (
            <div
              className="absolute left-0 right-0 top-full z-10 mt-2 space-y-0.5 rounded-2xl border border-white/[0.1] p-2 shadow-2xl"
              style={{ backgroundColor: SURFACE }}
            >
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenSettings?.();
                }}
                className="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/[0.05] hover:text-[color:var(--hub-accent)]"
              >
                <Settings size={18} className="text-white/50 transition group-hover:text-[color:var(--hub-accent)]" />
                Impostazioni account
              </button>
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/35"
                title="In preparazione"
              >
                <Palette size={18} className="text-white/30" />
                Personalizzazione Hub
                <span className="ml-auto text-[10px] uppercase tracking-wide text-white/25">Beta</span>
              </button>
              <div className="my-1 border-t border-white/[0.06]" />
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout?.();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-300/90 hover:bg-red-500/10"
              >
                <LogOut size={18} />
                Esci
              </button>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div
            className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] px-3 py-2.5 transition hover:[border-color:var(--hub-accent-border)]"
            style={{ backgroundColor: SURFACE }}
          >
            <Search size={18} className="shrink-0 text-white/35 transition group-hover:text-[color:var(--hub-accent)]" aria-hidden />
            <input
              type="search"
              readOnly
              tabIndex={-1}
              placeholder="Cerca…"
              className="min-w-0 flex-1 cursor-default bg-transparent text-sm text-white/80 outline-none placeholder:text-white/30"
              aria-label="Campo ricerca (in preparazione)"
            />
          </div>
        </div>

        <nav className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pb-6 pr-1">
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">Strumenti</p>
            <NavGroup title="Comunicazioni" open={navToolsOpen} onToggle={() => setNavToolsOpen((o) => !o)}>
              <SidebarLink
                nested
                icon={Monitor}
                label="Agent comunicazioni"
                onClick={() => nav?.onOpenCommAgentManager?.()}
              />
              <SidebarLink nested icon={Bell} label="Invia comunicazione" onClick={() => nav?.onOpenCommAgent?.()} />
            </NavGroup>
          </div>
          <div className="space-y-1">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">Moduli</p>
            <SidebarLink icon={Building2} label="Office" onClick={() => nav?.onOpenOffice?.()} />
            <SidebarLink icon={Mail} label="Email" onClick={() => nav?.onOpenEmail?.()} />
            <SidebarLink icon={Shield} label="Anti-Virus" onClick={() => nav?.onOpenAntiVirus?.()} />
            <SidebarLink icon={Eye} label="L-Sight" onClick={() => nav?.onOpenLSight?.()} />
            <SidebarLink icon={Monitor} label="Dispositivi aziendali" onClick={() => nav?.onOpenDispositivi?.()} />
            <SidebarLink icon={Gauge} label="Speed Test" onClick={() => nav?.onOpenSpeedTest?.()} />
            <SidebarLink icon={Wifi} label="Monitoraggio rete" onClick={() => nav?.onOpenNetwork?.()} />
            <SidebarLink icon={MapPin} label="Mappatura" onClick={() => nav?.onOpenMappatura?.()} />
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">Progetti</p>
            <NavGroup title="Altri progetti" open={navProjectsOpen} onToggle={() => setNavProjectsOpen((o) => !o)}>
              <SidebarLink nested icon={Calendar} label="Orari e Turni" onClick={() => nav?.onOpenOrari?.()} />
              <SidebarLink nested icon={Volume2} label="Vivaldi" onClick={() => nav?.onOpenVivaldi?.()} />
              <SidebarLink nested icon={Monitor} label="PackVision" onClick={() => nav?.onOpenPackVision?.()} />
              <SidebarLink nested icon={Layers} label="VPN" onClick={() => nav?.onOpenVpn?.()} />
            </NavGroup>
          </div>
        </nav>

        <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4">
          <div className="flex items-center gap-2 opacity-70">
            <LayoutGrid size={20} style={{ color: accentHex }} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Ticket</span>
          </div>
          <button
            type="button"
            onClick={onNavigateHome}
            className="rounded-xl border border-transparent px-3 py-1.5 text-xs font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)]"
          >
            Dashboard ticket →
          </button>
        </div>
      </aside>

      {/* Centro + destra */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header
            className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4"
            style={{ backgroundColor: PAGE_BG }}
          >
            <div className="flex min-w-0 items-center gap-3 text-sm text-white/45">
              <button
                type="button"
                className={`rounded-lg p-2 ${hubHoverIconBtn}`}
                aria-label="Navigazione"
              >
                <Layers size={20} />
              </button>
              <span className="hidden sm:inline text-white/25">/</span>
              <div className="min-w-0 truncate">
                <span className="text-white/45">Hub tecnico</span>
                <span className="text-white/25"> / </span>
                <span className="font-medium text-white/90">Panoramica</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div ref={accentPickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccentPickerOpen((o) => !o)}
                  className={`p-2.5 ${hubHoverIconBtn}`}
                  title="Colore tema Hub"
                  aria-expanded={accentPickerOpen}
                  aria-haspopup="dialog"
                >
                  <Moon size={20} />
                </button>
                {accentPickerOpen && (
                  <div
                    className="absolute right-0 top-full z-[80] mt-2 w-[17.5rem] rounded-2xl border border-white/[0.12] p-3 shadow-2xl"
                    style={{ backgroundColor: SURFACE }}
                    role="dialog"
                    aria-label="Scegli colore accento"
                  >
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/42">
                      <Palette size={14} style={{ color: accentHex }} />
                      Colore accento
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {TECH_HUB_ACCENT_PALETTE.map((c) => {
                        const active = accentHex.toLowerCase() === c.hex.toLowerCase();
                        return (
                          <button
                            key={c.id}
                            type="button"
                            title={c.label}
                            onClick={() => {
                              setAccentHex(c.hex);
                              setAccentPickerOpen(false);
                            }}
                            className={`relative aspect-square rounded-xl transition hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-white/50 ${
                              active ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e1e1e]' : 'border border-white/15'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[11px] leading-snug text-white/38">
                      Salvato in questo browser; icone e bordi in evidenza seguono il colore che scegli.
                    </p>
                  </div>
                )}
              </div>
              <button type="button" className={`p-2.5 ${hubHoverIconBtn}`} title="Aggiorna (decorativo)">
                <RefreshCw size={20} />
              </button>
              <button type="button" className={`p-2.5 ${hubHoverIconBtn}`} title="Notifiche (decorativo)">
                <Bell size={20} />
              </button>
              <button type="button" className={`p-2.5 ${hubHoverIconBtn}`} title="Lingua (decorativo)">
                <Globe size={20} />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
            <p className="mb-3 text-xs text-white/40">
              Area modulare: griglia a 12 colonne per comporre tasselli, grafici e riassunti. Esempio sotto (placeholder).
            </p>
            <div
              className="grid auto-rows-[minmax(112px,auto)] grid-cols-12 gap-3"
              style={{ minHeight: 'min(70vh, 640px)' }}
            >
              {/* Quattro tasselli piccoli = una fascia unificata */}
              <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-4">
                <ModuleLaunchCard
                  icon={Mail}
                  label="Email"
                  subtitle="Apri modulo"
                  accent={accentHex}
                  onClick={() => nav?.onOpenEmail?.()}
                  className="col-span-1"
                />
                <ModuleLaunchCard
                  icon={Wifi}
                  label="Monitoraggio"
                  subtitle="Stato rete"
                  accent={accentHex}
                  onClick={() => nav?.onOpenNetwork?.()}
                  className="col-span-1"
                />
                <ModuleLaunchCard
                  icon={Bell}
                  label="Comunicazioni"
                  subtitle="Messaggi broadcast"
                  accent={accentHex}
                  onClick={() => nav?.onOpenCommAgent?.()}
                  className="col-span-1"
                />
                <ModuleLaunchCard
                  icon={Shield}
                  label="Anti-Virus"
                  subtitle="Sicurezza"
                  accent={accentHex}
                  onClick={() => nav?.onOpenAntiVirus?.()}
                  className="col-span-1"
                />
              </div>

              {/* Blocco grafico più ampio */}
              <div
                className="col-span-12 flex flex-col rounded-2xl border border-white/[0.08] p-5 md:col-span-7 md:row-span-3"
                style={{ backgroundColor: SURFACE }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">Grafico (placeholder)</h2>
                  <span className="text-xs text-white/35">Aggiorna con dati reali</span>
                </div>
                <div className="relative flex flex-1 min-h-[200px] items-center justify-center">
                  {/* Donut semplice CSS */}
                  <div
                    className="relative h-44 w-44 rounded-full"
                    style={{
                      background: `conic-gradient(${accentHex} 0deg 210deg, ${hexToRgba(
                        accentHex,
                        0.28
                      )} 210deg 300deg, rgba(255,255,255,0.06) 300deg 360deg)`
                    }}
                  >
                    <div
                      className="absolute inset-[18%] flex items-center justify-center rounded-full text-center"
                      style={{ backgroundColor: PAGE_BG }}
                    >
                      <div>
                        <div className="text-2xl font-bold tabular-nums text-white">68%</div>
                        <div className="mt-1 text-[11px] text-white/40">Placeholder</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-center">
                  <div>
                    <div className="text-lg font-semibold tabular-nums text-white">12</div>
                    <div className="text-[10px] uppercase tracking-wide text-white/35">Ieri</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums" style={{ color: accentHex }}>
                      48
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-white/35">Oggi</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums text-white">5</div>
                    <div className="text-[10px] uppercase tracking-wide text-white/35">In attesa</div>
                  </div>
                </div>
              </div>

              {/* Stack destro */}
              <div
                className="col-span-12 flex flex-col gap-3 md:col-span-5 md:row-span-2"
              >
                <div
                  className="rounded-2xl border border-white/[0.08] p-4 flex-1"
                  style={{ backgroundColor: SURFACE }}
                >
                  <h3 className="text-sm font-semibold text-white">Riepilogo rapido</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    Qui potrai inserire KPI o testo che riassume ticket, agent o avvisi. Struttura pronta per contenuti
                    dinamici.
                  </p>
                </div>
                <ModuleLaunchCard
                  icon={MapPin}
                  label="Mappatura"
                  subtitle="Topologia e dispositivi"
                  accent={accentHex}
                  onClick={() => nav?.onOpenMappatura?.()}
                  className="flex-1"
                />
              </div>

              {/* Riga bassa: due tasselli affiancati */}
              <div
                className="col-span-12 rounded-2xl border border-dashed border-white/[0.12] p-4 transition hover:[border-color:var(--hub-accent-border)] md:col-span-6"
                style={{ backgroundColor: 'rgba(30,30,30,0.55)' }}
              >
                <p className="text-xs font-medium text-white/55">Slot libero — metà larghezza</p>
                <p className="mt-2 text-xs text-white/35">Può diventare tabella avvisi interni, grafico a barre o feed.</p>
              </div>
              <div
                className="col-span-12 rounded-2xl border border-dashed border-white/[0.12] p-4 transition hover:[border-color:var(--hub-accent-border)] md:col-span-6"
                style={{ backgroundColor: 'rgba(30,30,30,0.55)' }}
              >
                <p className="text-xs font-medium text-white/55">Slot libero — metà larghezza</p>
                <p className="mt-2 text-xs text-white/35">Combinazione con sopra forma una riga responsive a tutta griglia.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Colonna destra */}
        <aside
          className="flex shrink-0 flex-col gap-3 border-white/[0.06] px-4 py-5 lg:h-full lg:w-[300px] lg:border-l xl:w-[320px]"
          style={{ backgroundColor: PAGE_BG }}
        >
          <RightPanel title="Avvisi importanti">
            <DummyRow accent={accentHex} title="Finestra di manutenzione programmata" meta="Dummy · testo dimostrativo" />
            <DummyRow accent={accentHex} dot="#f87171" title="Cliente X: SLA in scadenza" meta="Dummy · sarà collegato a ticket" />
            <DummyRow accent={accentHex} title="Nuova versione agent disponibile" meta="Dummy · suggerisce aggiornamento" />
          </RightPanel>

          <RightPanel title="Ultimi eventi di rete">
            <DummyRow accent={accentHex} title={'SNMP: uptime switch core > 99.9%'} meta="Dummy · timeline eventi agent" />
            <DummyRow accent={accentHex} title="Ping medio ufficio: 14 ms" meta="Dummy · ultimo campionamento" />
            <DummyRow accent={accentHex} title="Nuovo device rilevato in VLAN 20" meta="Dummy · log monitoraggio" />
          </RightPanel>

          <RightPanel title="Comunicazioni">
            <DummyRow accent={accentHex} title="Broadcast «Avviso backup» consegnato" meta="Dummy · dettaglio invii" />
            <DummyRow accent={accentHex} title="2 messaggi in coda sugli agent" meta="Dummy · stato coda" />
          </RightPanel>
        </aside>
      </div>
    </div>
  );
}
