import React from 'react';
import { X, Users } from 'lucide-react';

const NewClientModal = ({ newClientData, setNewClientData, handleCreateClient, closeModal }) => {
  return (
    <div className="bg-white rounded-xl max-w-2xl w-full p-6">
      <div className="flex items-center justify-between mb-6 border-b pb-3">
        <h2 className="text-2xl font-bold text-green-700 flex items-center gap-2">
          <Users size={24} />
          Nuovo Cliente
        </h2>
        <button onClick={closeModal} className="text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Azienda</label>
          <input
            type="text"
            value={newClientData.azienda}
            onChange={(e) => setNewClientData({ ...newClientData, azienda: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={newClientData.email}
            onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={newClientData.password}
              onChange={(e) => setNewClientData({ ...newClientData, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Telefono</label>
            <input
              type="tel"
              value={newClientData.telefono}
              onChange={(e) => setNewClientData({ ...newClientData, telefono: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={closeModal} className="flex-1 px-4 py-3 border rounded-lg">
            Annulla
          </button>
          <button onClick={handleCreateClient} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold">
            Crea
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewClientModal;