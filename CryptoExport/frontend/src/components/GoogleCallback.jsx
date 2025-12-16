import React, { useEffect } from 'react';

const GoogleCallback = () => {
  useEffect(() => {
    // Estrai il codice di autorizzazione dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      console.error('Errore OAuth:', error);
      // Reindirizza alla dashboard con messaggio di errore
      window.location.href = '/?error=oauth_error';
      return;
    }

    if (code) {
      console.log('Codice OAuth ricevuto:', code);
      
      // Qui puoi gestire il codice OAuth
      // Per ora, reindirizziamo alla dashboard
      window.location.href = '/?success=google_connected';
    } else {
      // Nessun codice ricevuto, reindirizza alla dashboard
      window.location.href = '/';
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completamento autenticazione Google...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
