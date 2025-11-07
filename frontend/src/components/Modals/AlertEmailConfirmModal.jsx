import React from 'react';
import { Mail, Users, Crown, X, Building } from 'lucide-react';

const AlertEmailConfirmModal = ({ onConfirm, onCancel, users = [] }) => {
  const [selectedOption, setSelectedOption] = React.useState('all');
  const [selectedCompanies, setSelectedCompanies] = React.useState(new Set());

  // Estrai lista aziende uniche dai clienti
  const companies = React.useMemo(() => {
    const clienti = users.filter(u => u.ruolo === 'cliente');
    const aziendeSet = new Set();
    clienti.forEach(c => {
      if (c.azienda && c.azienda.trim() !== '') {
        aziendeSet.add(c.azienda);
      }
    });
    return Array.from(aziendeSet).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const handleToggleCompany = (azienda) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(azienda)) {
        next.delete(azienda);
      } else {
        next.add(azienda);
      }
      return next;
    });
  };

  const handleSelectAllCompanies = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(companies));
    }
  };

  const handleConfirm = () => {
    if (selectedOption === 'company') {
      if (selectedCompanies.size === 0) {
        alert('Seleziona almeno un\'azienda');
        return;
      }
      onConfirm({ option: 'company', companies: Array.from(selectedCompanies) });
    } else {
      onConfirm(selectedOption);
    }
  };

  return (
    <div className="bg-white rounded-xl max-w-md w-full p-6">
      <div className="text-center mb-4">
        <Mail size={48} className="text-purple-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Invio Email Avviso</h2>
      </div>

      <div className="text-sm mb-6 p-3 border border-purple-200 bg-purple-50 rounded-lg">
        <p className="font-semibold text-purple-800">Scegli i destinatari:</p>
        <p className="mt-1 text-purple-700">
          Seleziona a chi inviare l'email per questo avviso.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {/* Opzione 1: Invia a tutti */}
        <button
          type="button"
          onClick={() => {
            setSelectedOption('all');
            setSelectedCompanies(new Set());
          }}
          className={`w-full px-4 py-3 border-2 rounded-lg text-left transition flex items-center gap-3 ${
            selectedOption === 'all'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
          }`}
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selectedOption === 'all'
              ? 'border-purple-500 bg-purple-500'
              : 'border-gray-300'
          }`}>
            {selectedOption === 'all' && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <Users size={20} className="text-purple-600" />
          <div className="flex-1">
            <div className="font-semibold text-gray-900">Invia a tutti</div>
            <div className="text-xs text-gray-600">Amministratori e clienti</div>
          </div>
        </button>

        {/* Opzione 2: Solo amministratori */}
        <button
          type="button"
          onClick={() => {
            setSelectedOption('admins');
            setSelectedCompanies(new Set());
          }}
          className={`w-full px-4 py-3 border-2 rounded-lg text-left transition flex items-center gap-3 ${
            selectedOption === 'admins'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
          }`}
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selectedOption === 'admins'
              ? 'border-purple-500 bg-purple-500'
              : 'border-gray-300'
          }`}>
            {selectedOption === 'admins' && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <Crown size={20} className="text-purple-600" />
          <div className="flex-1">
            <div className="font-semibold text-gray-900">Solo amministratori</div>
            <div className="text-xs text-gray-600">Solo clienti amministratori</div>
          </div>
        </button>

        {/* Opzione 3: Per azienda */}
        <button
          type="button"
          onClick={() => setSelectedOption('company')}
          className={`w-full px-4 py-3 border-2 rounded-lg text-left transition flex items-center gap-3 ${
            selectedOption === 'company'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
          }`}
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selectedOption === 'company'
              ? 'border-purple-500 bg-purple-500'
              : 'border-gray-300'
          }`}>
            {selectedOption === 'company' && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <Building size={20} className="text-purple-600" />
          <div className="flex-1">
            <div className="font-semibold text-gray-900">Per azienda</div>
            <div className="text-xs text-gray-600">Seleziona una o più aziende specifiche</div>
          </div>
        </button>

        {/* Lista checkbox aziende (mostrata solo se "Per azienda" è selezionato) */}
        {selectedOption === 'company' && (
          <div className="ml-8 mt-2 mb-4 max-h-60 overflow-y-auto border border-purple-200 rounded-lg p-3 bg-purple-50">
            {companies.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={handleSelectAllCompanies}
                  className="w-full text-left px-2 py-1 mb-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 rounded transition"
                >
                  {selectedCompanies.size === companies.length ? 'Deseleziona tutte' : 'Seleziona tutte'}
                </button>
                <div className="space-y-2">
                  {companies.map(azienda => (
                    <label
                      key={azienda}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-purple-100 rounded cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompanies.has(azienda)}
                        onChange={() => handleToggleCompany(azienda)}
                        className="w-4 h-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{azienda}</span>
                    </label>
                  ))}
                </div>
                {selectedCompanies.size > 0 && (
                  <div className="mt-2 pt-2 border-t border-purple-300 text-xs text-purple-700 font-semibold">
                    {selectedCompanies.size} azienda{selectedCompanies.size > 1 ? 'e' : ''} selezionata{selectedCompanies.size > 1 ? 'e' : ''}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500 text-center py-2">
                Nessuna azienda disponibile
              </div>
            )}
          </div>
        )}

        {/* Opzione 4: Non inviare */}
        <button
          type="button"
          onClick={() => {
            setSelectedOption('none');
            setSelectedCompanies(new Set());
          }}
          className={`w-full px-4 py-3 border-2 rounded-lg text-left transition flex items-center gap-3 ${
            selectedOption === 'none'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
          }`}
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selectedOption === 'none'
              ? 'border-purple-500 bg-purple-500'
              : 'border-gray-300'
          }`}>
            {selectedOption === 'none' && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
          <X size={20} className="text-gray-600" />
          <div className="flex-1">
            <div className="font-semibold text-gray-900">Non inviare</div>
            <div className="text-xs text-gray-600">Nessuna email verrà inviata</div>
          </div>
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50 transition"
        >
          Annulla
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition"
        >
          <Mail size={18} />
          Conferma
        </button>
      </div>
    </div>
  );
};

export default AlertEmailConfirmModal;

