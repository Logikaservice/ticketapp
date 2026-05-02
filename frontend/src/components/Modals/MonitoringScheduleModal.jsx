import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Settings } from 'lucide-react';
import {
  HubModalScaffold,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalPrimaryButton,
  HubModalSecondaryButton
} from './HubModalChrome';
import { HUB_MODAL_LABEL_CLS, HUB_MODAL_FIELD_CLS, HUB_MODAL_NOTICE_INFO, getStoredTechHubAccent } from '../../utils/techHubAccent';

const MonitoringScheduleModal = ({ device, onClose, onSave, getAuthHeader, buildApiUrl }) => {
  const [mode, setMode] = useState('always'); // 'always' o 'scheduled'
  const [days, setDays] = useState([1, 2, 3, 4, 5]); // Lun-Ven di default
  const [expectedTime, setExpectedTime] = useState('02:00');
  const [graceMinutes, setGraceMinutes] = useState(120);
  const [loading, setLoading] = useState(false);
  const accentHex = getStoredTechHubAccent();

  useEffect(() => {
    // Carica configurazione esistente
    if (device.monitoring_schedule && device.monitoring_schedule.enabled) {
      setMode('scheduled');
      setDays(device.monitoring_schedule.days || [1, 2, 3, 4, 5]);
      setExpectedTime(device.monitoring_schedule.expected_time || '02:00');
      setGraceMinutes(device.monitoring_schedule.grace_minutes || 120);
    } else {
      setMode('always');
    }
  }, [device]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const scheduleConfig = mode === 'scheduled' ? {
        enabled: true,
        days: days,
        expected_time: expectedTime,
        grace_minutes: parseInt(graceMinutes)
      } : null;

      const response = await fetch(buildApiUrl(`/api/network-monitoring/devices/${device.id}/static`), {
        method: 'PATCH',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ monitoring_schedule: scheduleConfig })
      });

      if (!response.ok) {
        throw new Error('Errore salvataggio configurazione');
      }

      const updated = await response.json();
      onSave(updated);
      onClose();
    } catch (err) {
      console.error('Errore salvataggio monitoring schedule:', err);
      alert(`Errore: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day) => {
    setDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  return ReactDOM.createPortal(
    <HubModalScaffold onBackdropClick={onClose} maxWidthClass="max-w-2xl" zClass="z-[118]">
      <HubModalChromeHeader
        icon={Settings}
        title="Configurazione notifiche"
        subtitle={`Dispositivo: ${device.hostname || device.ip_address || 'Sconosciuto'}`}
        onClose={onClose}
      />

      <HubModalBody className="space-y-6">
        {/* Modalità */}
        <div>
          <label className={`${HUB_MODAL_LABEL_CLS}`}>
            Modalità Notifiche:
          </label>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start rounded-lg border border-white/10 bg-black/20 p-3 hover:bg-black/28">
              <input
                type="radio"
                name="mode"
                value="always"
                checked={mode === 'always'}
                onChange={() => setMode('always')}
                className="mr-3 mt-0.5 h-4 w-4 border-white/25 bg-black/30 text-[color:var(--hub-accent)] focus:ring-[color:var(--hub-accent)]"
              />
              <div>
                <span className="font-medium text-white">Sempre</span>
                <p className="mt-0.5 text-xs text-white/55">
                  Notifica per ogni evento (accensione, spegnimento, cambio IP/MAC)
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start rounded-lg border border-white/10 bg-black/20 p-3 hover:bg-black/28">
              <input
                type="radio"
                name="mode"
                value="scheduled"
                checked={mode === 'scheduled'}
                onChange={() => setMode('scheduled')}
                className="mr-3 mt-0.5 h-4 w-4 border-white/25 bg-black/30 text-[color:var(--hub-accent)] focus:ring-[color:var(--hub-accent)]"
              />
              <div>
                <span className="font-medium text-white">Solo in orari specifici</span>
                <p className="mt-0.5 text-xs text-white/55">
                  Notifica solo se manca nell&apos;orario previsto o cambio IP/MAC durante backup
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Configurazione Schedulata */}
        {mode === 'scheduled' && (
          <div className={`space-y-4 rounded-lg border border-sky-500/35 bg-sky-500/12 p-4`}>
            {/* Giorni */}
            <div>
              <label className={`${HUB_MODAL_LABEL_CLS}`}>
                Giorni di monitoraggio:
              </label>
              <div className="flex flex-wrap gap-2">
                {dayLabels.map((label, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      days.includes(index)
                        ? 'shadow-md ring-1 ring-white/20 text-[#121212]'
                        : 'border border-white/15 bg-black/25 text-white/75 hover:bg-black/35'
                    }`}
                    style={
                      days.includes(index)
                        ? { backgroundColor: accentHex }
                        : undefined
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {days.length === 0 && (
                <p className="mt-1 text-xs text-red-300">Seleziona almeno un giorno</p>
              )}
            </div>

            {/* Orario */}
            <div>
              <label className={`${HUB_MODAL_LABEL_CLS}`}>
                Orario previsto accensione:
              </label>
              <input
                type="time"
                value={expectedTime}
                onChange={(e) => setExpectedTime(e.target.value)}
                className={HUB_MODAL_FIELD_CLS}
              />
              <p className="mt-1 text-xs text-white/45">
                Orario in cui il dispositivo dovrebbe accendersi
              </p>
            </div>

            {/* Tolleranza */}
            <div>
              <label className={`${HUB_MODAL_LABEL_CLS}`}>
                Tolleranza (minuti):
              </label>
              <input
                type="number"
                min="1"
                max="720"
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(e.target.value)}
                className={HUB_MODAL_FIELD_CLS}
              />
              <p className="mt-1 text-xs text-white/45">
                Tempo di attesa prima di inviare notifica se dispositivo non rilevato
              </p>
            </div>

            {/* Info */}
            <div className={HUB_MODAL_NOTICE_INFO}>
              <p className="text-xs">
                Il sistema controllerà se il dispositivo si accende alle <strong>{expectedTime}</strong> nei giorni selezionati.
                Se non viene rilevato entro <strong>{graceMinutes} minuti</strong>, riceverai una notifica Telegram.
              </p>
            </div>
          </div>
        )}

        {mode === 'always' && (
          <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/12 p-3 text-xs text-emerald-50">
            <strong>Modalità attiva:</strong> Riceverai notifiche per ogni cambio di stato (online, offline, cambio IP, cambio MAC)
          </div>
        )}
      </HubModalBody>

      <HubModalChromeFooter className="justify-end">
        <HubModalSecondaryButton type="button" onClick={onClose} disabled={loading}>
          Annulla
        </HubModalSecondaryButton>
        <HubModalPrimaryButton
          type="button"
          onClick={handleSave}
          disabled={loading || (mode === 'scheduled' && days.length === 0)}
        >
          {loading ? 'Salvataggio...' : 'Salva Configurazione'}
        </HubModalPrimaryButton>
      </HubModalChromeFooter>
    </HubModalScaffold>,
    document.body
  );
};

export default MonitoringScheduleModal;
