import React from 'react';
import { X, FileText, Copy } from 'lucide-react';

const ReportModal = ({ title, content, color, closeModal, showNotification }) => {
  return (
    <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6 border-b pb-3">
        <h2 className={'text-2xl font-bold flex items-center gap-2 ' + color}>
          <FileText size={24} />
          {title}
        </h2>
        <button onClick={closeModal} className="text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="mb-4">
        <textarea
          readOnly
          value={content}
          rows={20}
          className="w-full p-4 border rounded-lg font-mono text-xs bg-gray-50"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            navigator.clipboard.writeText(content);
            showNotification('Copiato!', 'success');
          }}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
        >
          <Copy size={18} />
          Copia
        </button>
      </div>
    </div>
  );
};

export default ReportModal;