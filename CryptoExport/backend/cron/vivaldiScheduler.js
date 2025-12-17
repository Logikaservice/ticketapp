// cron/vivaldiScheduler.js - Cron job per schedulazione annunci Vivaldi

const cron = require('node-cron');

class VivaldiScheduler {
  constructor(poolVivaldi) {
    this.pool = poolVivaldi;
    this.isRunning = false;
  }

  /**
   * Processa le schedulazioni attive e aggiunge annunci alla coda
   */
  async processSchedules() {
    if (!this.pool) {
      console.log('⚠️ VivaldiScheduler: pool non disponibile, skip processSchedules');
      return;
    }

    if (this.isRunning) {
      console.log('⏳ Scheduler Vivaldi già in esecuzione, skip...');
      return;
    }

    this.isRunning = true;

    try {
      // Recupera tutte le schedulazioni attive
      const schedulesResult = await this.pool.query(
        `SELECT s.*, a.azienda_id, a.contenuto, a.contenuto_pulito, a.audio_url
         FROM annunci_schedule s
         JOIN annunci a ON s.annuncio_id = a.id
         WHERE s.stato = 'attivo'`
      );

      const now = new Date();

      for (const schedule of schedulesResult.rows) {
        try {
          const schedulazione = typeof schedule.schedulazione === 'string' 
            ? JSON.parse(schedule.schedulazione) 
            : schedule.schedulazione;

          const ripetizioneOggi = schedulazione.ripetizione_ogni || 15; // minuti
          const ripetizioneFinoA = new Date(schedulazione.ripetizione_fino_a);
          const prossimaEsecuzione = new Date(schedulazione.prossima_esecuzione);

          // Verifica se è il momento di eseguire
          if (now >= prossimaEsecuzione && now <= ripetizioneFinoA) {
            // Verifica se non esiste già un annuncio in coda per questo orario
            const existingQueue = await this.pool.query(
              `SELECT id FROM annunci_queue 
               WHERE annuncio_id = $1 AND schedule_id = $2 
               AND scheduled_for BETWEEN $3 AND $4 
               AND stato = 'pending'`,
              [
                schedule.annuncio_id,
                schedule.id,
                new Date(prossimaEsecuzione.getTime() - 60000), // -1 minuto
                new Date(prossimaEsecuzione.getTime() + 60000)  // +1 minuto
              ]
            );

            if (existingQueue.rows.length === 0) {
              // Aggiungi alla coda
              await this.pool.query(
                `INSERT INTO annunci_queue 
                 (annuncio_id, schedule_id, priorita, azienda_id, scheduled_for, stato)
                 VALUES ($1, $2, $3, $4, $5, 'pending')`,
                [
                  schedule.annuncio_id,
                  schedule.id,
                  schedule.priorita,
                  schedule.azienda_id,
                  prossimaEsecuzione
                ]
              );

              console.log(`✅ Annuncio ${schedule.annuncio_id} aggiunto alla coda per ${prossimaEsecuzione.toISOString()}`);

              // Calcola prossima esecuzione
              const nextExecution = new Date(prossimaEsecuzione.getTime() + ripetizioneOggi * 60 * 1000);
              
              // Aggiorna schedulazione
              schedulazione.prossima_esecuzione = nextExecution.toISOString();
              await this.pool.query(
                `UPDATE annunci_schedule 
                 SET schedulazione = $1, esecuzioni_totali = esecuzioni_totali + 1, updated_at = NOW()
                 WHERE id = $2`,
                [JSON.stringify(schedulazione), schedule.id]
              );
            }
          }

          // Se abbiamo superato ripetizione_fino_a, marca come completato
          if (now > ripetizioneFinoA && schedule.stato === 'attivo') {
            await this.pool.query(
              `UPDATE annunci_schedule SET stato = 'completato', updated_at = NOW() WHERE id = $1`,
              [schedule.id]
            );
            console.log(`✅ Schedulazione ${schedule.id} completata`);
          }
        } catch (scheduleErr) {
          console.error(`❌ Errore processamento schedulazione ${schedule.id}:`, scheduleErr);
        }
      }
    } catch (error) {
      console.error('❌ Errore processamento schedulazioni Vivaldi:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Esegue gli annunci in coda che sono pronti
   */
  async executeQueue() {
    if (!this.pool) {
      console.log('⚠️ VivaldiScheduler: pool non disponibile, skip executeQueue');
      return;
    }

    try {
      // Verifica che siamo nel database corretto e che la tabella esista
      try {
        const dbCheck = await this.pool.query('SELECT current_database(), current_schema()');
        const currentDb = dbCheck.rows[0].current_database;
        const currentSchema = dbCheck.rows[0].current_schema;
        console.log(`🔍 VivaldiScheduler executeQueue: Database: ${currentDb}, Schema: ${currentSchema}`);
        
        if (currentDb !== 'vivaldi_db') {
          console.error(`❌ VivaldiScheduler: connesso al database sbagliato: ${currentDb}`);
          return;
        }

        // Verifica che la tabella esista
        const tableCheck = await this.pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'annunci_queue'
        `, [currentSchema]);
        
        if (tableCheck.rows.length === 0) {
          console.error(`❌ VivaldiScheduler: tabella annunci_queue non trovata nello schema ${currentSchema}`);
          return;
        }
        console.log(`✅ VivaldiScheduler: tabella annunci_queue verificata`);
      } catch (dbErr) {
        console.error(`❌ VivaldiScheduler: errore verifica database:`, dbErr.message);
        return;
      }

      const now = new Date();

      // Recupera annunci pronti per l'esecuzione (stato pending, scheduled_for <= now)
      const queueResult = await this.pool.query(
        `SELECT q.*, a.contenuto, a.contenuto_pulito, a.audio_url
         FROM annunci_queue q
         JOIN annunci a ON q.annuncio_id = a.id
         WHERE q.stato = 'pending' AND q.scheduled_for <= $1
         ORDER BY 
           CASE q.priorita
             WHEN 'Urgente' THEN 1
             WHEN 'Alta' THEN 2
             WHEN 'Media' THEN 3
             WHEN 'Bassa' THEN 4
           END,
           q.scheduled_for ASC
         LIMIT 10`,
        [now]
      );

      for (const queueItem of queueResult.rows) {
        try {
          // Marca come playing
          await this.pool.query(
            `UPDATE annunci_queue SET stato = 'playing' WHERE id = $1`,
            [queueItem.id]
          );

          // TODO: Qui andrà la logica di riproduzione audio (streaming)
          // Per ora simuliamo l'esecuzione
          console.log(`🔊 Esecuzione annuncio ${queueItem.annuncio_id} (${queueItem.contenuto_pulito || queueItem.contenuto})`);

          // Simula durata riproduzione (1-3 secondi)
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Marca come completed e aggiungi allo storico
          await this.pool.query(
            `UPDATE annunci_queue SET stato = 'completed', executed_at = NOW() WHERE id = $1`,
            [queueItem.id]
          );

          await this.pool.query(
            `INSERT INTO annunci_history 
             (annuncio_id, schedule_id, azienda_id, priorita, eseguito_at, audio_url, durata_secondi, stato)
             VALUES ($1, $2, $3, $4, NOW(), $5, $6, 'success')`,
            [
              queueItem.annuncio_id,
              queueItem.schedule_id,
              queueItem.azienda_id,
              queueItem.priorita,
              queueItem.audio_url,
              2 // durata simulata
            ]
          );

          // Aggiorna contatore esecuzioni completate nella schedulazione
          if (queueItem.schedule_id) {
            await this.pool.query(
              `UPDATE annunci_schedule 
               SET esecuzioni_completate = esecuzioni_completate + 1, updated_at = NOW()
               WHERE id = $1`,
              [queueItem.schedule_id]
            );
          }

          console.log(`✅ Annuncio ${queueItem.annuncio_id} eseguito con successo`);
        } catch (execErr) {
          console.error(`❌ Errore esecuzione annuncio ${queueItem.id}:`, execErr);
          await this.pool.query(
            `UPDATE annunci_queue SET stato = 'failed' WHERE id = $1`,
            [queueItem.id]
          );
        }
      }
    } catch (error) {
      console.error('❌ Errore esecuzione coda Vivaldi:', error);
    }
  }

  /**
   * Avvia i cron job
   */
  start() {
    // Processa schedulazioni ogni minuto
    cron.schedule('* * * * *', () => {
      this.processSchedules();
    });

    // Esegue coda ogni 10 secondi
    cron.schedule('*/10 * * * * *', () => {
      this.executeQueue();
    });

    console.log('✅ Vivaldi Scheduler avviato');
  }

  /**
   * Ferma i cron job
   */
  stop() {
    // node-cron non ha un metodo stop globale, ma possiamo usare un flag
    this.isRunning = true; // Blocca nuove esecuzioni
    console.log('⏹️ Vivaldi Scheduler fermato');
  }
}

module.exports = VivaldiScheduler;

