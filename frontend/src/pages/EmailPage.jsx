// frontend/src/pages/EmailPage.jsx
// Pagina Email - placeholder per integrazione domini/caselle (es. Aruba)

import React from 'react';
import { ArrowLeft, Mail } from 'lucide-react';

const EmailPage = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
            title="Chiudi Email"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Mail size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Email</h1>
              <p className="text-sm text-gray-600">Domini e caselle email</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
            <Mail size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Sezione Email</h2>
            <p className="text-gray-500 text-sm">
              Qui potrai gestire domini e caselle email (integrazione in sviluppo).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailPage;
