import React, { useState, useRef, useEffect } from 'react';
import { X, Printer, Trash2, Image as ImageIcon, Download, Paperclip, File } from 'lucide-react';
import { getApiBase } from '../../utils/apiConfig';

const TicketPhotosModal = ({ ticket, photos, onClose, onDeletePhoto, onUploadPhotos, getAuthHeader, currentUser }) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [localPhotos, setLocalPhotos] = useState(photos || []);

  const canManagePhotos = ticket?.stato && ['aperto', 'in_lavorazione', 'risolto'].includes(ticket.stato);
  const apiUrl = getApiBase() || '';

  // Aggiorna localPhotos quando photos cambia da props
  // IMPORTANTE: Questo hook deve essere chiamato PRIMA di qualsiasi return condizionale
  useEffect(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        setLocalPhotos(photos || []);
      }, 0);
    });
  }, [photos]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Verifica dimensione totale (massimo 10MB totali)
    const maxTotalSize = 10 * 1024 * 1024; // 10MB in bytes
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (totalSize > maxTotalSize) {
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      alert(`La dimensione totale dei file selezionati (${totalSizeMB}MB) supera il limite di 10MB.\n\nDimensione massima consentita: 10MB totali per tutti i file.\n\nRimuovi alcuni file o seleziona file più piccoli.`);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (!onUploadPhotos) {
      console.error('onUploadPhotos non è disponibile');
      alert('Errore: funzione di upload non disponibile');
      return;
    }

    if (!ticket || !ticket.id) {
      console.error('Ticket ID non disponibile');
      alert('Errore: ticket non valido');
      return;
    }

    // Usa requestAnimationFrame + setTimeout per deferire completamente l'aggiornamento di stato
    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsUploading(true);

        // Avvia l'upload in modo asincrono
        (async () => {
          try {
            console.log('🔄 Caricamento file...', files.length, 'file');
            const uploadedPhotos = await onUploadPhotos(ticket.id, files);
            console.log('✅ File caricati:', uploadedPhotos);

            // NON aggiornare localPhotos qui - verrà aggiornato automaticamente tramite useEffect quando photos prop cambia
            // Usa requestAnimationFrame + setTimeout multipli per deferire completamente
            requestAnimationFrame(() => {
              setTimeout(() => {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    setIsUploading(false);
                    // Reset input
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }

                    // Aggiorna l'indice solo se necessario, dopo che le props si sono aggiornate
                    setTimeout(() => {
                      if (uploadedPhotos.length > localPhotos.length) {
                        setCurrentPhotoIndex(uploadedPhotos.length - 1);
                      }
                    }, 100);
                  }, 10);
                });
              }, 10);
            });
          } catch (error) {
            console.error('❌ Errore upload:', error);
            // Usa requestAnimationFrame + setTimeout per evitare aggiornamenti di stato durante il render
            requestAnimationFrame(() => {
              setTimeout(() => {
                setIsUploading(false);
                // Reset input
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }, 10);
            });
          }
        })();
      }, 0);
    });
  };

  if (!localPhotos || localPhotos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
          <div className="text-center py-8">
            <File size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-4">Nessun file disponibile per questo ticket</p>

            {canManagePhotos && onUploadPhotos && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 mx-auto"
                >
                  <Paperclip size={18} />
                  {isUploading ? 'Caricamento...' : 'Carica File'}
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

  const handleDelete = async () => {
    if (!window.confirm('Sei sicuro di voler eliminare questo file?')) return;

    setIsDeleting(true);
    try {
      // Elimina e aggiorna la lista locale
      const updatedPhotos = await onDeletePhoto(currentPhoto.filename);
      setLocalPhotos(updatedPhotos);

      // Se era l'ultimo file, chiudi il modal
      if (updatedPhotos.length === 0) {
        onClose();
        return;
      }

      // Altrimenti vai al file precedente o successivo
      if (currentPhotoIndex >= updatedPhotos.length) {
        setCurrentPhotoIndex(Math.max(0, updatedPhotos.length - 1));
      }
    } catch (error) {
      console.error('Errore eliminazione file:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = () => {
    if (!currentPhoto) return;

    // Verifica se è un'immagine
    const isImage = currentPhoto.originalName?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i) ||
      currentPhoto.path?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);

    // Costruisci URL assoluto
    let baseUrl = apiUrl;
    if (!baseUrl) {
      const origin = window.location.origin;
      if (origin.includes('159.69.121.162') || origin.includes('localhost')) {
        baseUrl = 'https://ticket.logikaservice.it';
      } else {
        baseUrl = origin;
      }
    }
    const fileUrl = `${baseUrl}${currentPhoto.path}`;

    if (isImage) {
      // Per immagini: apri in nuova finestra e stampa
      const printWindow = window.open('about:blank', '_blank', 'noopener,noreferrer');
      if (printWindow) {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>File Ticket ${ticket?.numero || ''}</title>
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
                <p>File ${currentPhotoIndex + 1} di ${localPhotos.length}</p>
              </div>
              <div class="photo-container">
                <img src="${fileUrl}" alt="${currentPhoto.originalName}" onload="window.print()" onerror="alert('Errore nel caricamento dell\'immagine'); window.close();" />
                <div class="photo-info">
                  <p><strong>Nome file:</strong> ${currentPhoto.originalName}</p>
                  <p><strong>Data caricamento:</strong> ${new Date(currentPhoto.uploadedAt || Date.now()).toLocaleString('it-IT')}</p>
                </div>
              </div>
            </body>
          </html>
        `;
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } else {
      // Per PDF e altri file: apri direttamente il file in una nuova scheda
      // Il browser gestirà la stampa del PDF
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      // Mostra messaggio informativo
      alert('Il file PDF è stato aperto in una nuova scheda. Usa il pulsante Stampa del browser per stampare il PDF.');
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

  // Il cliente può eliminare solo i file che ha caricato lui stesso
  // Il tecnico può eliminare sempre (se lo stato lo permette)
  const canDelete = currentUser?.ruolo === 'tecnico'
    ? (ticket?.stato && ['aperto', 'in_lavorazione', 'risolto'].includes(ticket.stato))
    : (currentUser?.ruolo === 'cliente' &&
      currentPhoto?.uploadedById === currentUser?.id &&
      ticket?.stato && ['aperto', 'in_lavorazione', 'risolto'].includes(ticket.stato));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <File size={24} />
                File Ticket {ticket?.numero || ''}
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
          {/* File principale */}
          <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
            {currentPhoto && (() => {
              // Verifica se è un'immagine basandosi sull'estensione o sul path
              const isImage = currentPhoto.originalName?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i) ||
                currentPhoto.path?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);

              // Verifica se è un PDF
              const isPdf = currentPhoto.originalName?.match(/\.pdf$/i) ||
                currentPhoto.path?.match(/\.pdf$/i);

              // Costruisci URL assoluto - usa sempre HTTPS e il dominio corretto
              let baseUrl = apiUrl;
              if (!baseUrl) {
                // Se apiUrl è vuoto, usa il dominio corrente con HTTPS
                const origin = window.location.origin;
                // Se è un IP, usa il dominio configurato
                if (origin.includes('159.69.121.162') || origin.includes('localhost')) {
                  baseUrl = 'https://ticket.logikaservice.it';
                } else {
                  baseUrl = origin;
                }
              }
              const fileUrl = `${baseUrl}${currentPhoto.path}`;

              if (isImage) {
                return (
                  <img
                    src={fileUrl}
                    alt={currentPhoto.originalName}
                    className="max-w-full max-h-full object-contain"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error('❌ Errore caricamento immagine:', {
                        url: fileUrl,
                        error: e.target.error,
                        status: e.target.naturalWidth === 0 ? 'Failed to load' : 'Unknown error',
                        filename: currentPhoto.originalName
                      });
                      // Mostra placeholder con messaggio più chiaro
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNDUlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtd2VpZ2h0PSJib2xkIj5GaWxlIG5vbiBkaXNwb25pYmlsZTwvdGV4dD48dGV4dCB4PSI1MCUiIHk9IjU1JSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWEzYWZiIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbCBmaWxlIGFsbGVnYXRvIMOpIHN0YXRvIGVsaW1pbmF0byBvIG5vbiDDqSBkaXNwb25pYmlsZTwvdGV4dD48L3N2Zz4=';
                      e.target.onerror = null; // Previeni loop infinito
                    }}
                  />
                );
              } else if (isPdf) {
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-lg">
                    <iframe
                      src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                      title={currentPhoto.originalName}
                      className="w-full h-full rounded-lg bg-white"
                      style={{ border: 'none' }}
                      onError={(e) => {
                        console.error('❌ Errore caricamento PDF:', fileUrl);
                        // Nascondi iframe e mostra messaggio
                        e.target.style.display = 'none';
                        const container = e.target.parentElement;
                        if (container) {
                          container.innerHTML = `
                            <div class="flex flex-col items-center justify-center text-gray-600 p-8">
                              <svg class="w-24 h-24 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              <p class="text-lg font-semibold mb-2">File non disponibile</p>
                              <p class="text-sm text-gray-500">Il file allegato è stato eliminato o non è disponibile</p>
                            </div>
                          `;
                        }
                      }}
                    />
                  </div>
                );
              } else {
                // Per file non immagine/PDF, mostra un'icona
                return (
                  <div className="flex flex-col items-center justify-center text-white">
                    <File size={120} className="mb-4 text-gray-400" />
                    <p className="text-lg font-semibold mb-2">{currentPhoto.originalName}</p>
                    <p className="text-sm text-gray-400">File non visualizzabile</p>
                  </div>
                );
              }
            })()}
          </div>

          {/* Sidebar con miniatures */}
          {localPhotos.length > 1 && (
            <div className="w-32 border-l bg-gray-50 overflow-y-auto p-2">
              <div className="space-y-2">
                {localPhotos.map((photo, index) => {
                  const isImage = photo.originalName?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i) ||
                    photo.path?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);

                  return (
                    <button
                      key={index}
                      onClick={() => setCurrentPhotoIndex(index)}
                      className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition flex items-center justify-center ${index === currentPhotoIndex
                          ? 'border-blue-500 ring-2 ring-blue-300'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      {isImage ? (() => {
                        let baseUrl = apiUrl;
                        if (!baseUrl) {
                          const origin = window.location.origin;
                          if (origin.includes('159.69.121.162') || origin.includes('localhost')) {
                            baseUrl = 'https://ticket.logikaservice.it';
                          } else {
                            baseUrl = origin;
                          }
                        }
                        return (
                          <img
                            src={`${baseUrl}${photo.path}`}
                            alt={photo.originalName}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              // Se la miniatura fallisce, mostra un'icona
                              e.target.style.display = 'none';
                              const parent = e.target.parentElement;
                              if (parent && !parent.querySelector('.file-icon')) {
                                const icon = document.createElement('div');
                                icon.className = 'file-icon flex items-center justify-center w-full h-full bg-gray-100';
                                icon.innerHTML = '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                                parent.appendChild(icon);
                              }
                            }}
                          />
                        );
                      })() : (
                        <File size={32} className="text-gray-400" />
                      )}
                    </button>
                  );
                })}
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
              {/* Upload file (solo per stati consentiti) */}
              {canManagePhotos && onUploadPhotos && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    <Paperclip size={18} />
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

              {/* Elimina file (solo per tecnici e stati consentiti) */}
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

