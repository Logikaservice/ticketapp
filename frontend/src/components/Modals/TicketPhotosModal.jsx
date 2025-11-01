import React, { useState, useRef } from 'react';
import { X, Printer, Trash2, Image as ImageIcon, Download, Upload, Camera } from 'lucide-react';

const TicketPhotosModal = ({ ticket, photos, onClose, onDeletePhoto, onUploadPhotos, getAuthHeader, currentUser }) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [localPhotos, setLocalPhotos] = useState(photos || []);

  const canManagePhotos = ticket?.stato && ['aperto', 'in_lavorazione', 'risolto'].includes(ticket.stato);

  if (!localPhotos || localPhotos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
          <div className="text-center py-8">
            <ImageIcon size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-4">Nessuna foto disponibile per questo ticket</p>
            
            {canManagePhotos && onUploadPhotos && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 mx-auto"
                >
                  <Camera size={18} />
                  {isUploading ? 'Caricamento...' : 'Carica Foto'}
                </button>
              </>
            )}
            
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentPhoto = localPhotos[currentPhotoIndex];
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const handleDelete = async () => {
    if (!window.confirm('Sei sicuro di voler eliminare questa foto?')) return;
    
    setIsDeleting(true);
    try {
      // Elimina e aggiorna la lista locale
      const updatedPhotos = await onDeletePhoto(currentPhoto.filename);
      setLocalPhotos(updatedPhotos);
      
      // Se era l'ultima foto, chiudi il modal
      if (updatedPhotos.length === 0) {
        onClose();
        return;
      }
      
      // Altrimenti vai alla foto precedente o successiva
      if (currentPhotoIndex >= updatedPhotos.length) {
        setCurrentPhotoIndex(Math.max(0, updatedPhotos.length - 1));
      }
    } catch (error) {
      console.error('Errore eliminazione foto:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && currentPhoto) {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Foto Ticket ${ticket?.numero || ''}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
              }
              .header {
                margin-bottom: 20px;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
              }
              .header h1 {
                margin: 0;
                font-size: 24px;
                color: #333;
              }
              .photo-container {
                text-align: center;
                margin: 20px 0;
              }
              .photo-container img {
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
              }
              .photo-info {
                margin-top: 10px;
                font-size: 12px;
                color: #666;
              }
              @media print {
                body { padding: 0; }
                .header { page-break-after: avoid; }
                .photo-container { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Ticket ${ticket?.numero || ''} - ${ticket?.titolo || ''}</h1>
              <p>Foto ${currentPhotoIndex + 1} di ${localPhotos.length}</p>
            </div>
            <div class="photo-container">
              <img src="${apiUrl}${currentPhoto.path}" alt="${currentPhoto.originalName}" />
              <div class="photo-info">
                <p><strong>Nome file:</strong> ${currentPhoto.originalName}</p>
                <p><strong>Data caricamento:</strong> ${new Date(currentPhoto.uploadedAt).toLocaleString('it-IT')}</p>
              </div>
            </div>
          </body>
        </html>
      `;
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Aspetta che l'immagine si carichi prima di aprire la stampa
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
  };

  const handleDownload = () => {
    if (currentPhoto) {
      const link = document.createElement('a');
      link.href = `${apiUrl}${currentPhoto.path}`;
      link.download = currentPhoto.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Verifica che siano tutte immagini
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      alert('Solo file immagine sono permessi');
      return;
    }

    setIsUploading(true);
    try {
      const uploadedPhotos = await onUploadPhotos(ticket.id, imageFiles);
      setLocalPhotos(uploadedPhotos);
      
      // Vai all'ultima foto caricata
      if (uploadedPhotos.length > localPhotos.length) {
        setCurrentPhotoIndex(uploadedPhotos.length - 1);
      }
    } catch (error) {
      console.error('Errore upload:', error);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Aggiorna localPhotos quando photos cambia da props
  React.useEffect(() => {
    setLocalPhotos(photos || []);
  }, [photos]);

  const canDelete = currentUser?.ruolo === 'tecnico' || 
                   (ticket?.stato && ['aperto', 'in_lavorazione', 'risolto'].includes(ticket.stato));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ImageIcon size={24} />
                Foto Ticket {ticket?.numero || ''}
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                {currentPhotoIndex + 1} di {localPhotos.length}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Foto principale */}
          <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
            {currentPhoto && (
              <img
                src={`${apiUrl}${currentPhoto.path}`}
                alt={currentPhoto.originalName}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5FcnJvcmUgY2FyaWNhbWVudG88L3RleHQ+PC9zdmc+';
                }}
              />
            )}
          </div>

          {/* Sidebar con miniatures */}
          {localPhotos.length > 1 && (
            <div className="w-32 border-l bg-gray-50 overflow-y-auto p-2">
              <div className="space-y-2">
                {localPhotos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition ${
                      index === currentPhotoIndex
                        ? 'border-blue-500 ring-2 ring-blue-300'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={`${apiUrl}${photo.path}`}
                      alt={photo.originalName}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer con controlli */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                <strong>File:</strong> {currentPhoto?.originalName}
              </span>
              {currentPhoto?.uploadedAt && (
                <span className="text-xs text-gray-500">
                  ({new Date(currentPhoto.uploadedAt).toLocaleDateString('it-IT')})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Upload foto (solo per stati consentiti) */}
              {canManagePhotos && onUploadPhotos && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    <Camera size={18} />
                    {isUploading ? 'Caricamento...' : 'Carica'}
                  </button>
                </>
              )}

              {/* Navigazione */}
              {localPhotos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1))}
                    disabled={currentPhotoIndex === 0}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setCurrentPhotoIndex(Math.min(localPhotos.length - 1, currentPhotoIndex + 1))}
                    disabled={currentPhotoIndex === localPhotos.length - 1}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    →
                  </button>
                </>
              )}

              {/* Download */}
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Download size={18} />
                Scarica
              </button>

              {/* Stampa */}
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Printer size={18} />
                Stampa
              </button>

              {/* Elimina (solo per tecnici e stati consentiti) */}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  <Trash2 size={18} />
                  {isDeleting ? 'Eliminazione...' : 'Elimina'}
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketPhotosModal;

