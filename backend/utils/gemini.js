// utils/gemini.js - Integrazione Google Gemini API

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY non configurata');
    }
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  /**
   * Analizza un comando vocale/testuale e estrae informazioni per creare annuncio
   * @param {string} userMessage - Messaggio dell'utente
   * @returns {Promise<{contenuto: string, priorita: string, ripetizione: object}>}
   */
  async parseAnnouncementCommand(userMessage) {
    if (!this.genAI) {
      throw new Error('Gemini API non configurata. Imposta GEMINI_API_KEY.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `Sei un assistente per un sistema di annunci vocali in un supermercato.
Analizza il seguente messaggio dell'utente e estrai:
1. Il contenuto dell'annuncio (testo pulito e professionale)
2. La priorità (Bassa, Media, Alta, Urgente) basata sul contesto
3. Le informazioni di schedulazione (ripetizione ogni X minuti, fino a quando)

Messaggio utente: "${userMessage}"

Rispondi SOLO con un JSON valido in questo formato:
{
  "contenuto": "Testo pulito dell'annuncio",
  "contenuto_pulito": "Versione più formale e professionale",
  "priorita": "Media",
  "ripetizione_ogni": 15,
  "ripetizione_fino_a": null,
  "intento": "descrizione breve dell'intento"
}

Regole:
- Priorità Urgente: chiusure, emergenze, ritrovamenti importanti → ripetizione ogni 7 minuti
- Priorità Alta: promozioni importanti, chiamate reparto urgenti → ripetizione ogni 10 minuti  
- Priorità Media: annunci generici, promozioni normali → ripetizione ogni 15 minuti
- Priorità Bassa: annunci informativi, promozioni secondarie → ripetizione ogni 30 minuti
- Se non specificato, usa Media (15 minuti)
- Se l'utente dice "subito" o "immediato", usa Urgente (7 minuti)
- Se l'utente dice "per la prossima ora", calcola ripetizione_fino_a = ora attuale + 1 ora
- Se l'utente dice "per X minuti", calcola ripetizione_fino_a = ora attuale + X minuti`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Estrai JSON dalla risposta (potrebbe contenere markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Risposta Gemini non contiene JSON valido');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Valida e normalizza i dati
      const priorita = ['Bassa', 'Media', 'Alta', 'Urgente'].includes(parsed.priorita)
        ? parsed.priorita
        : 'Media';

      const ripetizioneOggi = parsed.ripetizione_ogni || this.getDefaultRepetition(priorita);

      // Calcola ripetizione_fino_a se specificato
      let ripetizioneFinoA = parsed.ripetizione_fino_a;
      if (ripetizioneFinoA && typeof ripetizioneFinoA === 'string') {
        // Se è una stringa, prova a parsarla come timestamp
        ripetizioneFinoA = new Date(ripetizioneFinoA);
      } else if (!ripetizioneFinoA) {
        // Default: 2 ore se non specificato
        ripetizioneFinoA = new Date(Date.now() + 2 * 60 * 60 * 1000);
      }

      return {
        contenuto: parsed.contenuto || userMessage,
        contenuto_pulito: parsed.contenuto_pulito || parsed.contenuto || userMessage,
        priorita: priorita,
        ripetizione_ogni: ripetizioneOggi,
        ripetizione_fino_a: ripetizioneFinoA,
        intento: parsed.intento || 'Annuncio generico'
      };
    } catch (error) {
      console.error('❌ Errore parsing comando Gemini:', error);
      // Fallback: restituisci valori di default
      return {
        contenuto: userMessage,
        contenuto_pulito: userMessage,
        priorita: 'Media',
        ripetizione_ogni: 15,
        ripetizione_fino_a: new Date(Date.now() + 2 * 60 * 60 * 1000),
        intento: 'Annuncio generico'
      };
    }
  }

  /**
   * Ottiene il valore di ripetizione di default per una priorità
   */
  getDefaultRepetition(priorita) {
    const defaults = {
      'Urgente': 7,
      'Alta': 10,
      'Media': 15,
      'Bassa': 30
    };
    return defaults[priorita] || 15;
  }
}

module.exports = GeminiClient;

