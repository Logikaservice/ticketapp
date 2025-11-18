import React, { useState, useEffect } from 'react';
import { X, Monitor, Eye, EyeOff, Download, Loader2 } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const SupremoModal = ({ closeModal, getAuthHeader }) => {
  const [supremoId, setSupremoId] = useState('');
  const [supremoPassword, setSupremoPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState(false);

  const SUPREMO_DOWNLOAD_URL = 'https://www.supremocontrol.com/download-supremo/windows/';

  useEffect(() => {
    fetchSupremoCredentials();
  }, []);

  const fetchSupremoCredentials = async () => {
    try {
      setLoading(true);
      const authHeader = getAuthHeader();
      const response = await fetch(buildApiUrl('/api/supremo/credentials'), {
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel recupero delle credenziali Supremo');
      }

      const data = await response.json();
      
      if (data.installed && data.id) {
        setInstalled(true);
        setSupremoId(data.id);
        setSupremoPassword(data.password || '');
      } else {
        setInstalled(false);
      }
    } catch (error) {
      console.error('Errore fetch Supremo:', error);
      setInstalled(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Monitor size={28} />
                Credenziali Supremo
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Informazioni per assistenza remota
              </p>
            </div>
            <button
              onClick={closeModal}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Contenuto */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={32} />
              <p className="text-sm text-gray-600">Verifica installazione Supremo...</p>
            </div>
          ) : installed ? (
            <>
              {/* Mostra ID e Password se Supremo è installato */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Supremo
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={supremoId}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => handleCopy(supremoId)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                  >
                    Copia
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password Supremo
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={supremoPassword}
                      readOnly
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {supremoPassword && (
                    <button
                      onClick={() => handleCopy(supremoPassword)}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                    >
                      Copia
                    </button>
                  )}
                </div>
              </div>

              {/* Pulsante Mostra/Nascondi */}
              {supremoPassword && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff size={18} />
                        Nascondi Password
                      </>
                    ) : (
                      <>
                        <Eye size={18} />
                        Mostra Password
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Informazioni */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Nota:</strong> Questi dati vengono utilizzati solo per la visualizzazione e non vengono memorizzati nel sistema.
                </p>
              </div>
            </>
          ) : (
            /* Se Supremo non è installato */
            <div className="text-center py-6">
              <Monitor size={64} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Supremo non installato
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Per utilizzare l'assistenza remota, è necessario installare Supremo sul tuo computer.
              </p>
              <a
                href={SUPREMO_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Download size={20} />
                Scarica Supremo
              </a>
              <p className="text-xs text-gray-500 mt-4">
                Dopo l'installazione, riapri questa finestra per vedere le credenziali.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={closeModal}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupremoModal;

