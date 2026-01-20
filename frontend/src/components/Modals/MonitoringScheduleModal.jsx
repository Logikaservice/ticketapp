import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const MonitoringScheduleModal = ({ device, onClose, onSave, getAuthHeader, buildApiUrl }) => {
  const [mode, setMode] = useState('always'); // 'always' o 'scheduled'
  const [days, setDays] = useState([1, 2, 3, 4, 5]); // Lun-Ven di default
  const [expectedTime, setExpectedTime] = useState('02:00');
  const [graceMinutes, setGraceMinutes] = useState(120);
  const [loading, setLoading] = useState(false);

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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">⚙️ Configurazione Notifiche</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold leading-none"
              title="Chiudi"
            >
              ×
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-1">
            Dispositivo: {device.hostname || device.ip_address || 'Sconosciuto'}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Modalità */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Modalità Notifiche:
            </label>
            <div className="space-y-2">
              <label className="flex items-start cursor-pointer hover:bg-gray-50 p-3 rounded-lg border border-gray-200">
                <input
                  type="radio"
                  name="mode"
                  value="always"
                  checked={mode === 'always'}
                  onChange={() => setMode('always')}
                  className="mt-0.5 mr-3 w-4 h-4 text-blue-600"
                />
                <div>
                  <span className="font-medium text-gray-900">Sempre</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Notifica per ogni evento (accensione, spegnimento, cambio IP/MAC)
                  </p>
                </div>
              </label>

              <label className="flex items-start cursor-pointer hover:bg-gray-50 p-3 rounded-lg border border-gray-200">
                <input
                  type="radio"
                  name="mode"
                  value="scheduled"
                  checked={mode === 'scheduled'}
                  onChange={() => setMode('scheduled')}
                  className="mt-0.5 mr-3 w-4 h-4 text-blue-600"
                />
                <div>
                  <span className="font-medium text-gray-900">Solo in orari specifici</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Notifica solo se manca nell'orario previsto o cambio IP/MAC durante backup
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Configurazione Schedulata */}
          {mode === 'scheduled' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              {/* Giorni */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Giorni di monitoraggio:
                </label>
                <div className="flex gap-2 flex-wrap">
                  {dayLabels.map((label, index) => (
                    <button
                      key={index}
                      onClick={() => toggleDay(index)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                        days.includes(index)
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {days.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">⚠️ Seleziona almeno un giorno</p>
                )}
              </div>

              {/* Orario */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Orario previsto accensione:
                </label>
                <input
                  type="time"
                  value={expectedTime}
                  onChange={(e) => setExpectedTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Orario in cui il dispositivo dovrebbe accendersi
                </p>
              </div>

              {/* Tolleranza */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tolleranza (minuti):
                </label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tempo di attesa prima di inviare notifica se dispositivo non rilevato
                </p>
              </div>

              {/* Info */}
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  💡 <strong>Il sistema controllerà:</strong> Se il dispositivo si accende alle <strong>{expectedTime}</strong> nei giorni selezionati. 
                  Se non viene rilevato entro <strong>{graceMinutes} minuti</strong>, riceverai una notifica Telegram.
                </p>
              </div>
            </div>
          )}

          {mode === 'always' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-800">
                ✅ <strong>Modalità attiva:</strong> Riceverai notifiche per ogni cambio di stato (online, offline, cambio IP, cambio MAC)
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
            disabled={loading}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={loading || (mode === 'scheduled' && days.length === 0)}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvataggio...' : 'Salva Configurazione'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MonitoringScheduleModal;
