import React, { useState } from 'react';
import { X, Settings, Bell, BellOff, Mail } from 'lucide-react';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';

const SettingsModal = ({ settingsData, setSettingsData, handleUpdateSettings, closeModal }) => {
  const [calendarNotificationsDisabled, setCalendarNotificationsDisabled] = useState(false);
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const { disableCalendarNotifications, loading: calendarLoading } = useGoogleCalendar();

  const handleDisableCalendarNotifications = async () => {
    try {
      const result = await disableCalendarNotifications(settingsData.email);
      if (result) {
        setCalendarNotificationsDisabled(true);
        alert('Notifiche calendario disabilitate con successo!');
      }
    } catch (error) {
      console.error('Errore disabilitazione notifiche:', error);
      alert('Errore durante la disabilitazione delle notifiche');
    }
  };

  const handleTestEmailNotifications = async () => {
    try {
      setEmailTestLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/email/test-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testEmail: settingsData.email })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Test email inviato con successo!\n\nMessage ID: ${result.messageId}\nProvider: ${result.details.provider}`);
      } else {
        const error = await response.json();
        alert(`❌ Errore invio test email: ${error.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      console.error('Errore test email:', error);
      alert('❌ Errore durante il test delle notifiche email');
    } finally {
      setEmailTestLoading(false);
    }
  };

  const handleCheckSystemStatus = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/email/status`);
      if (response.ok) {
        const status = await response.json();
        setSystemStatus(status);
        
        const statusMessage = `
📧 STATO SISTEMA NOTIFICHE:

✅ Email configurata: ${status.emailConfigured ? 'SÌ' : 'NO'}
📧 Provider: ${status.emailProvider}
📧 Account: ${status.emailUser}
🗓️ Google Calendar: ${status.googleCalendarDisabled ? 'DISABILITATO' : 'ATTIVO'}

${status.emailConfigured ? 
  '✅ Le notifiche email dovrebbero funzionare correttamente!' : 
  '❌ Email non configurata - le notifiche non funzioneranno!'
}`;
        
        alert(statusMessage);
      } else {
        alert('❌ Errore nel controllo dello stato del sistema');
      }
    } catch (error) {
      console.error('Errore controllo stato:', error);
      alert('❌ Errore durante il controllo dello stato');
    }
  };

  return (
    <div className="bg-white rounded-xl max-w-md w-full p-6">
      <div className="flex items-center justify-between mb-6 border-b pb-3">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings size={24} />
          Impostazioni
        </h2>
        <button onClick={closeModal} className="text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Nome</label>
          <input
            type="text"
            value={settingsData.nome}
            onChange={(e) => setSettingsData({ ...settingsData, nome: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={settingsData.email}
            onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-bold mb-3">Cambia Password</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Vecchia</label>
              <input
                type="password"
                value={settingsData.vecchiaPassword}
                onChange={(e) => setSettingsData({ ...settingsData, vecchiaPassword: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Nuova</label>
              <input
                type="password"
                value={settingsData.nuovaPassword}
                onChange={(e) => setSettingsData({ ...settingsData, nuovaPassword: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Conferma</label>
              <input
                type="password"
                value={settingsData.confermaNuovaPassword}
                onChange={(e) => setSettingsData({ ...settingsData, confermaNuovaPassword: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-bold mb-3">Notifiche Calendario</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
            <p className="text-sm text-yellow-800">
              <strong>Nota:</strong> Se ricevi troppe email da Google Calendar quando vengono creati i ticket, 
              puoi disabilitare queste notifiche cliccando il pulsante qui sotto.
            </p>
          </div>
          <button 
            onClick={handleDisableCalendarNotifications}
            disabled={calendarLoading || calendarNotificationsDisabled}
            className={`w-full px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
              calendarNotificationsDisabled 
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {calendarLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Disabilitazione...
              </>
            ) : calendarNotificationsDisabled ? (
              <>
                <BellOff size={20} />
                Notifiche Disabilitate
              </>
            ) : (
              <>
                <Bell size={20} />
                Disabilita Notifiche Calendario
              </>
            )}
          </button>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-bold mb-3">Test Notifiche Email</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            <p className="text-sm text-blue-800">
              <strong>Test:</strong> Clicca il pulsante qui sotto per inviare un'email di test e verificare 
              che le notifiche per i ticket funzionino correttamente.
            </p>
          </div>
          <button 
            onClick={handleTestEmailNotifications}
            disabled={emailTestLoading}
            className={`w-full px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
              emailTestLoading 
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {emailTestLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Invio Test...
              </>
            ) : (
              <>
                <Mail size={20} />
                Test Notifiche Email
              </>
            )}
          </button>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-bold mb-3">Diagnostica Sistema</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
            <p className="text-sm text-gray-700">
              <strong>Controllo:</strong> Verifica lo stato del sistema di notifiche per diagnosticare eventuali problemi.
            </p>
          </div>
          <button 
            onClick={handleCheckSystemStatus}
            className="w-full px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 bg-gray-600 text-white hover:bg-gray-700"
          >
            <Settings size={20} />
            Controlla Stato Sistema
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={closeModal} className="flex-1 px-4 py-3 border rounded-lg">
            Annulla
          </button>
          <button onClick={handleUpdateSettings} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold">
            Salva
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;