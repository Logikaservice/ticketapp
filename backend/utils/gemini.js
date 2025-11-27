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
      let text = response.text();

      // Rimuovi markdown code blocks se presenti
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      // Estrai JSON dalla risposta (potrebbe contenere testo prima/dopo)
      let jsonMatch = text.match(/\{[\s\S]*\}/);
      
      // Se non trova JSON, prova a cercare in modo più flessibile
      if (!jsonMatch) {
        // Prova a trovare JSON anche se c'è testo prima
        const lines = text.split('\n');
        let jsonStart = -1;
        let jsonEnd = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('{')) {
            jsonStart = i;
            break;
          }
        }
        if (jsonStart >= 0) {
          // Cerca la fine del JSON
          let braceCount = 0;
          let foundStart = false;
          for (let i = jsonStart; i < lines.length; i++) {
            const line = lines[i];
            for (const char of line) {
              if (char === '{') {
                braceCount++;
                foundStart = true;
              } else if (char === '}') {
                braceCount--;
                if (foundStart && braceCount === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }
            if (jsonEnd >= 0) break;
          }
          if (jsonEnd >= 0) {
            jsonMatch = [lines.slice(jsonStart, jsonEnd + 1).join('\n')];
          }
        }
      }

      if (!jsonMatch || !jsonMatch[0]) {
        console.error('❌ Risposta Gemini non contiene JSON valido:', text.substring(0, 200));
        throw new Error('Risposta Gemini non contiene JSON valido');
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('❌ Errore parsing JSON da Gemini:', parseError);
        console.error('❌ Testo ricevuto:', jsonMatch[0].substring(0, 500));
        throw new Error('Errore parsing JSON: ' + parseError.message);
      }

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

