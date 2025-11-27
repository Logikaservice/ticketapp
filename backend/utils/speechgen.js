// utils/speechgen.js - Integrazione SpeechGen.io API

const fetch = require('node-fetch');

class SpeechGenClient {
  constructor(apiKey, email) {
    this.apiKey = apiKey || process.env.SPEECHGEN_API_KEY;
    this.email = email || process.env.SPEECHGEN_EMAIL;
    this.baseUrl = 'https://api.speechgen.io';
  }

  /**
   * Ottiene la lista dei speaker disponibili
   */
  async getSpeakers() {
    try {
      // Prova prima con l'endpoint /api/voices (endpoint standard SpeechGen)
      let response = await fetch(`${this.baseUrl}/api/voices`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      // Se fallisce, prova con /api/v1/speakers
      if (!response.ok) {
        console.log('⚠️ Tentativo endpoint /api/voices fallito, provo /api/v1/speakers');
        response = await fetch(`${this.baseUrl}/api/v1/speakers`, {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ SpeechGen API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`SpeechGen API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📢 Risposta SpeechGen API:', JSON.stringify(data, null, 2));

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
      } else {
        console.warn('⚠️ Struttura risposta SpeechGen non riconosciuta:', data);
        speakers = [];
      }

      // Normalizza gli speaker per avere sempre name/id
      speakers = speakers.map((speaker, index) => {
        if (typeof speaker === 'string') {
          return { id: speaker, name: speaker };
        } else if (speaker.name) {
          return { id: speaker.id || speaker.name, name: speaker.name };
        } else if (speaker.id) {
          return { id: speaker.id, name: speaker.id };
        } else {
          return { id: `speaker_${index}`, name: JSON.stringify(speaker) };
        }
      });

      console.log(`✅ Trovati ${speakers.length} speaker:`, speakers.map(s => s.name).join(', '));
      return speakers;
    } catch (error) {
      console.error('❌ Errore recupero speaker da SpeechGen:', error);
      throw error;
    }
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

