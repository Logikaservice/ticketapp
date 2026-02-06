// frontend/src/pages/OfficePage.jsx

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader, Calendar, X } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const OfficePage = ({ onClose, getAuthHeader, selectedCompanyId, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [officeData, setOfficeData] = useState(null);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (selectedCompanyId) {
      loadOfficeData();
    } else {
      setError('Seleziona prima un\'azienda');
    }
  }, [selectedCompanyId]);

  const loadOfficeData = async () => {
    if (!selectedCompanyId || !getAuthHeader) {
      setError('Azienda non selezionata');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prima recupera il nome dell'azienda
      const companiesResponse = await fetch(buildApiUrl('/api/network-monitoring/companies'), {
        headers: getAuthHeader()
      });

      if (!companiesResponse.ok) {
        throw new Error('Errore nel caricamento delle aziende');
      }

      const companies = await companiesResponse.json();
      const company = companies.find(c => c.id === parseInt(selectedCompanyId));
      
      if (!company) {
        throw new Error('Azienda non trovata');
      }

      setCompanyName(company.azienda || '');

      // Ora recupera i dati Office da Keepass
      const response = await fetch(buildApiUrl(`/api/keepass/office/${encodeURIComponent(company.azienda)}`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setError('Office non trovato in Keepass per questa azienda');
        } else {
          throw new Error(errorData.error || 'Errore nel caricamento dei dati Office');
        }
        return;
      }

      const data = await response.json();
      setOfficeData(data);
    } catch (err) {
      console.error('Errore caricamento Office:', err);
      setError(err.message || 'Errore nel caricamento dei dati Office');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full" 
            title="Chiudi Office"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Office</h1>
            <p className="text-sm text-gray-600">{companyName || 'Caricamento...'}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Caricamento dati Office da Keepass...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <X size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 mb-1">Errore</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && officeData && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              {/* Titolo Office */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">{officeData.title || 'Office'}</h2>
              </div>

              {/* Campi personalizzati */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Campi personalizzati</h3>
                
                {officeData.customFields?.custom1 && (
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <label className="text-sm font-medium text-gray-500">Campo personalizzato 1</label>
                    <p className="text-gray-900 mt-1">{officeData.customFields.custom1}</p>
                  </div>
                )}

                {officeData.customFields?.custom2 && (
                  <div className="border-l-4 border-green-500 pl-4 py-2">
                    <label className="text-sm font-medium text-gray-500">Campo personalizzato 2</label>
                    <p className="text-gray-900 mt-1">{officeData.customFields.custom2}</p>
                  </div>
                )}

                {officeData.customFields?.custom3 && (
                  <div className="border-l-4 border-yellow-500 pl-4 py-2">
                    <label className="text-sm font-medium text-gray-500">Campo personalizzato 3</label>
                    <p className="text-gray-900 mt-1">{officeData.customFields.custom3}</p>
                  </div>
                )}

                {officeData.customFields?.custom4 && (
                  <div className="border-l-4 border-purple-500 pl-4 py-2">
                    <label className="text-sm font-medium text-gray-500">Campo personalizzato 4</label>
                    <p className="text-gray-900 mt-1">{officeData.customFields.custom4}</p>
                  </div>
                )}

                {officeData.customFields?.custom5 && (
                  <div className="border-l-4 border-red-500 pl-4 py-2">
                    <label className="text-sm font-medium text-gray-500">Campo personalizzato 5</label>
                    <p className="text-gray-900 mt-1">{officeData.customFields.custom5}</p>
                  </div>
                )}

                {(!officeData.customFields?.custom1 && 
                  !officeData.customFields?.custom2 && 
                  !officeData.customFields?.custom3 && 
                  !officeData.customFields?.custom4 && 
                  !officeData.customFields?.custom5) && (
                  <p className="text-gray-500 italic">Nessun campo personalizzato trovato</p>
                )}
              </div>

              {/* Scadenza */}
              {officeData.expires && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <Calendar size={20} className="text-gray-600" />
                    <div>
                      <label className="text-sm font-medium text-gray-500">Scadenza</label>
                      <p className="text-gray-900 mt-1 font-semibold">{formatDate(officeData.expires)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficePage;
