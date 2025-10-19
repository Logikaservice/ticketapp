import React, { useState } from 'react';
import { X, Clock, Check, Plus, Copy, Trash2, Users, Eye, Edit, Save } from 'lucide-react';
import { calculateDurationHours } from '../../utils/helpers';

const TimeLoggerModal = ({
  selectedTicket,
  timeLogs,
  setTimeLogs,
  handleTimeLogChange,
  handleAddTimeLog,
  handleRemoveTimeLog,
  handleDuplicateTimeLog,
  handleMaterialChange,
  handleAddMaterial,
  handleRemoveMaterial,
  handleConfirmTimeLogs,
  handleSaveTimeLogs,
  closeModal,
  readOnly = false,
  currentUser
}) => {
  // Stato locale per gestire la modalità editing
  const [isEditing, setIsEditing] = useState(false);
  
  // console.debug: rimosso per evitare rumore in console
  
  // Determina se i campi sono modificabili
  const fieldsDisabled = readOnly && !isEditing;
  
  return (
    <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6 border-b pb-3">
        <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
          {readOnly ? (
            isEditing ? <Edit size={24} /> : <Eye size={24} />
          ) : (
            <Clock size={24} />
          )}
          {readOnly ? (isEditing ? 'Modifica Intervento' : 'Visualizza Intervento') : 'Registra Intervento'}
        </h2>
        <button onClick={closeModal} className="text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 p-3 rounded-lg text-sm">
          Ticket: {selectedTicket.numero} - {selectedTicket.titolo}
        </div>

        {timeLogs.map((log, index) => {
          const hours = parseFloat(log.oreIntervento) || 0;
          const costPerHour = parseFloat(log.costoUnitario) || 0;
          const discount = parseFloat(log.sconto) || 0;
          const total = (costPerHour * (1 - (discount / 100))) * hours;

          return (
            <div key={log.id} className="p-4 border rounded-lg bg-white relative">
              <h3 className="mb-3 flex justify-between">
                Intervento #{index + 1}
                {!fieldsDisabled && (
                  <div className="flex gap-2">
                    {timeLogs.length > 1 && (
                      <button
                        onClick={() => handleRemoveTimeLog(log.id)}
                        className="text-red-500 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicateTimeLog(log)}
                      className="text-blue-500 p-1"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                )}
              </h3>

              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs mb-1">Modalità</label>
                  <select
                    value={log.modalita}
                    onChange={(e) => handleTimeLogChange(log.id, 'modalita', e.target.value)}
                    disabled={fieldsDisabled}
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option>Telefonica</option>
                    <option>Teleassistenza</option>
                    <option>Presso il Cliente</option>
                    <option>In laboratorio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs mb-1">Data</label>
                  <input
                    type="date"
                    value={log.data}
                    onChange={(e) => handleTimeLogChange(log.id, 'data', e.target.value)}
                    disabled={fieldsDisabled}
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1">Ora Inizio</label>
                  <input
                    type="time"
                    value={log.oraInizio}
                    step="900"
                    onChange={(e) => {
                      const start = e.target.value;
                      const duration = calculateDurationHours(start, log.oraFine);
                      setTimeLogs(p => p.map(l => l.id === log.id ? { ...l, oraInizio: start, oreIntervento: duration.toFixed(2) } : l));
                    }}
                    disabled={fieldsDisabled}
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1">Ora Fine</label>
                  <input
                    type="time"
                    value={log.oraFine}
                    step="900"
                    onChange={(e) => {
                      const end = e.target.value;
                      const duration = calculateDurationHours(log.oraInizio, end);
                      setTimeLogs(p => p.map(l => l.id === log.id ? { ...l, oraFine: end, oreIntervento: duration.toFixed(2) } : l));
                    }}
                    disabled={fieldsDisabled}
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <input
                type="text"
                value={log.descrizione}
                onChange={(e) => handleTimeLogChange(log.id, 'descrizione', e.target.value)}
                placeholder="Descrizione"
                disabled={fieldsDisabled}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />

              <div className="mt-5 border-t pt-4">
                <h4 className="text-sm font-bold mb-3">Costo Manodopera</h4>
                <div className="grid sm:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-xs mb-1">Ore</label>
                    <input
                      type="number"
                      step="0.25"
                      value={log.oreIntervento}
                      onChange={(e) => handleTimeLogChange(log.id, 'oreIntervento', e.target.value)}
                      disabled={fieldsDisabled}
                      className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Costo Unit.(€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={log.costoUnitario}
                      onChange={(e) => handleTimeLogChange(log.id, 'costoUnitario', e.target.value)}
                      disabled={fieldsDisabled}
                      className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Sconto(%)</label>
                    <input
                      type="number"
                      value={log.sconto}
                      onChange={(e) => handleTimeLogChange(log.id, 'sconto', e.target.value)}
                      disabled={fieldsDisabled}
                      className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Costo Scontato</label>
                    <div className="p-2.5 bg-gray-100 rounded-lg font-bold">
                      {(costPerHour * (1 - (discount / 100))).toFixed(2)}€
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs mb-1">Totale</label>
                    <div className="p-2.5 bg-blue-100 rounded-lg font-bold text-blue-800">
                      {total.toFixed(2)}€
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t pt-4">
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Users size={16} />
                  Materiali
                </h4>
                <div className="space-y-3">
                  {log.materials && log.materials.map(m => (
                    <div key={m.id} className="grid grid-cols-6 gap-3 items-center p-2 bg-gray-50 rounded-lg border">
                      <div className="col-span-2">
                        <label className="block text-xs mb-1">Materiale</label>
                        <input
                          type="text"
                          value={m.nome}
                          onChange={(e) => handleMaterialChange(log.id, m.id, 'nome', e.target.value)}
                          disabled={fieldsDisabled}
                          className="w-full px-2 py-1 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="block text-xs mb-1">Qta</label>
                        <input
                          type="number"
                          min="1"
                          value={m.quantita}
                          onChange={(e) => handleMaterialChange(log.id, m.id, 'quantita', e.target.value)}
                          disabled={fieldsDisabled}
                          className="w-full px-2 py-1 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs mb-1">Costo (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={m.costo.toFixed(2)}
                          onChange={(e) => handleMaterialChange(log.id, m.id, 'costo', e.target.value)}
                          disabled={fieldsDisabled}
                          className="w-full px-2 py-1 border rounded-lg text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="col-span-1 pt-4 text-right">
                        {!fieldsDisabled && log.materials.length > 1 && (
                          <button
                            onClick={() => handleRemoveMaterial(log.id, m.id)}
                            className="text-red-500 p-1"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {!fieldsDisabled && (
                    <button
                      onClick={() => handleAddMaterial(log.id)}
                      className="w-full text-blue-500 text-xs font-medium flex items-center justify-center gap-1 mt-2 p-1"
                    >
                      <Plus size={14} />
                      Aggiungi Materiale
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!fieldsDisabled && (
          <button
            onClick={handleAddTimeLog}
            className="w-full px-4 py-2 border border-blue-500 text-blue-600 rounded-lg flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Aggiungi Intervallo
          </button>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <button onClick={closeModal} className="flex-1 px-4 py-3 border rounded-lg">
            {readOnly && !isEditing ? 'Chiudi' : 'Annulla'}
          </button>
          
          {/* Pulsante Modifica - Solo per TECNICO in modalità readOnly */}
          {readOnly && !isEditing && currentUser?.ruolo === 'tecnico' && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <Edit size={18} />
              Modifica
            </button>
          )}
          
          {/* Pulsante Salva - Quando in modalità editing */}
          {readOnly && isEditing && (
            <button
              onClick={() => {
                handleSaveTimeLogs();
                setIsEditing(false);
              }}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Salva Modifiche
            </button>
          )}
          
          {/* Pulsante Conferma e Risolvi - Solo quando NON è readOnly */}
          {!readOnly && (
            <button
              onClick={handleConfirmTimeLogs}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Conferma e Risolvi
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeLoggerModal;
