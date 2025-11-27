// utils/speechgen.js - Integrazione SpeechGen.io API

// Usa fetch globale (Node.js 18+) o import dinamico di node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  // Node.js 18+ ha fetch globale
  fetch = globalThis.fetch;
} else {
  // Fallback per versioni precedenti
  fetch = require('node-fetch');
}

class SpeechGenClient {
  constructor(apiKey, email) {
    this.apiKey = apiKey || process.env.SPEECHGEN_API_KEY;
    this.email = email || process.env.SPEECHGEN_EMAIL;
    // Prova diversi URL base per SpeechGen
    this.baseUrl = 'https://api.speechgen.io';
    this.alternativeUrls = [
      'https://speechgen.io/api',
      'https://api.speechgen.io/api',
      'https://speechgen.io'
    ];
  }

  /**
   * Ottiene la lista dei speaker disponibili
   */
  async getSpeakers() {
    if (!this.apiKey) {
      throw new Error('API Key SpeechGen non configurata');
    }

    // Costruisci query string con credenziali per endpoint che le richiedono
    const queryParams = new URLSearchParams();
    if (this.email) queryParams.append('email', this.email);
    if (this.apiKey) queryParams.append('token', this.apiKey);
    const queryString = queryParams.toString();

    const endpoints = [
      { url: `https://speechgen.io/index.php?r=api/voices&${queryString}`, name: 'speechgen.io/index.php?r=api/voices (with auth)' },
      { url: `https://speechgen.io/index.php?r=api/voices`, name: 'speechgen.io/index.php?r=api/voices (no auth)' },
      { url: `${this.baseUrl}/api/voices`, name: '/api/voices' },
      { url: `${this.baseUrl}/api/v1/speakers`, name: '/api/v1/speakers' }
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          // Timeout di 10 secondi
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          const speakers = this._processSpeakersResponse(data);

          if (speakers && speakers.length > 0) {
            return speakers;
          }

          console.warn(`⚠️ Endpoint ${endpoint.name} ha risposto OK ma 0 speaker. Provo il prossimo...`);
          lastError = new Error(`Endpoint ${endpoint.name} returned 0 speakers. Data: ${JSON.stringify(data).substring(0, 100)}...`);
        } else {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        lastError = error;
        // Continua con il prossimo endpoint
        continue;
      }
    }

    // Se tutti gli endpoint falliscono, lancia l'ultimo errore
    throw new Error(`Impossibile recuperare speaker. Ultimo errore: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Processa la risposta dell'API per estrarre gli speaker
   */
  _processSpeakersResponse(data) {
    // Gestisci diverse strutture di risposta
    let speakers = [];

    if (Array.isArray(data)) {
      // Se la risposta è direttamente un array
      speakers = data;
    } else if (data.speakers && Array.isArray(data.speakers)) {
      // Se la risposta ha un campo speakers
      speakers = data.speakers;
    } else if (data.voices && Array.isArray(data.voices)) {
      // Se la risposta ha un campo voices
      speakers = data.voices;
    } else if (data.data && Array.isArray(data.data)) {
      // Se la risposta ha un campo data
      speakers = data.data;
    } else if (typeof data === 'object' && data !== null) {
      // Caso: Risposta raggruppata per lingua {"English": [...], "Italian": [...]}
      // Filtriamo solo le chiavi che contengono "Italian"
      Object.keys(data).forEach(lang => {
        if (lang.toLowerCase().includes('italian')) {
          const group = data[lang];
          if (Array.isArray(group)) {
            speakers = speakers.concat(group);
          }
        }
      });

      // Se non abbiamo trovato nulla con "Italian", proviamo a restituire tutto (fallback)
      // o lasciamo vuoto se vogliamo essere stretti.
      // Per ora, se vuoto, logghiamo un warning.
      if (speakers.length === 0) {
        console.warn('⚠️ Nessuno speaker italiano trovato nella risposta API.');
      }
    } else {
      console.warn('⚠️ Struttura risposta SpeechGen non riconosciuta:', data);
      speakers = [];
    }

    // Normalizza gli speaker per avere sempre name/id e flag isPlus
    speakers = speakers.map((speaker, index) => {
      let id, name, isPlus = false;

      if (typeof speaker === 'string') {
        id = speaker;
        name = speaker;
      } else if (speaker.voice) {
        // Formato visto nel debug: {"voice":"Amelia", "pro":"1", ...}
        id = speaker.voice;
        name = speaker.voice;
        isPlus = speaker.pro === '1' || speaker.pro === 1;
      } else if (speaker.name) {
        id = speaker.id || speaker.name;
        name = speaker.name;
        isPlus = speaker.pro === '1' || speaker.pro === 1;
      } else if (speaker.id) {
        id = speaker.id;
        name = speaker.id;
        isPlus = speaker.pro === '1' || speaker.pro === 1;
      } else {
        id = `speaker_${index}`;
        name = JSON.stringify(speaker);
      }

      return { id, name, isPlus };
    });

    return speakers;
  }
  /**
   * Genera audio da testo
   * @param {string} text - Testo da convertire in audio
   * @param {string} speaker - ID speaker (es. 'Giulia')
   * @param {number} speed - Velocità (0.5 - 2.0, default 1.0)
   * @param {number} pitch - Tono (-12 - 12, default 0)
   * @returns {Promise<{audioUrl: string, duration: number}>}
   */
  async generateAudio(text, speaker = 'Giulia', speed = 1.0, pitch = 0) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          speaker: speaker,
          speed: speed,
          pitch: pitch,
          format: 'mp3' // o 'wav'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SpeechGen API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        audioUrl: data.url || data.audio_url,
        duration: data.duration || 0,
        format: data.format || 'mp3'
      };
    } catch (error) {
      console.error('❌ Errore generazione audio da SpeechGen:', error);
      throw error;
    }
  }

  /**
   * Verifica lo stato di una richiesta di generazione
   */
  async checkStatus(taskId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/status/${taskId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`SpeechGen API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Errore verifica stato SpeechGen:', error);
      throw error;
    }
  }
}

module.exports = SpeechGenClient;

