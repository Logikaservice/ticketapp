import React from 'react';
import { X, FileText, Copy, Printer } from 'lucide-react';

const ReportModal = ({ title, content, color, closeModal, showNotification }) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              font-size: 12px;
              line-height: 1.5;
            }
            @media print {
              body {
                padding: 10px;
              }
            }
          </style>
        </head>
        <body>
          <pre>${content}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

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
        
        <button
          onClick={handlePrint}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
        >
          <Printer size={18} />
          Stampa
        </button>
      </div>
    </div>
  );
};

export default ReportModal;
