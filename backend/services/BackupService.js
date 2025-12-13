/**
 * 📦 BACKUP SERVICE
 * 
 * Gestisce e monitora i backup del database
 */

const fs = require('fs');
const path = require('path');

class BackupService {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.maxBackupAgeHours = 24; // Backup deve essere più recente di 24 ore
    }

    /**
     * Ottiene stato backup
     */
    getBackupStatus() {
        try {
            // Verifica se la cartella backup esiste
            if (!fs.existsSync(this.backupDir)) {
                return {
                    healthy: false,
                    active: false,
                    message: 'Cartella backup non trovata',
                    lastBackup: null
                };
            }

            // Trova file di backup più recenti
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.endsWith('.sql') || f.endsWith('.dump'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    mtime: fs.statSync(path.join(this.backupDir, f)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            if (files.length === 0) {
                return {
                    healthy: false,
                    active: false,
                    message: 'Nessun backup trovato',
                    lastBackup: null
                };
            }

            const lastBackup = files[0];
            const hoursSinceBackup = (Date.now() - lastBackup.mtime.getTime()) / (1000 * 60 * 60);
            const isRecent = hoursSinceBackup < this.maxBackupAgeHours;

            return {
                healthy: isRecent,
                active: true,
                lastBackup: lastBackup.mtime.toISOString(),
                hoursAgo: hoursSinceBackup.toFixed(1),
                message: isRecent 
                    ? `Backup recente (${hoursSinceBackup.toFixed(1)}h fa)` 
                    : `Backup vecchio (${hoursSinceBackup.toFixed(1)}h fa)`
            };

        } catch (error) {
            console.error('❌ [BACKUP] Errore verifica stato:', error.message);
            return {
                healthy: false,
                active: false,
                error: error.message,
                message: 'Errore verifica backup'
            };
        }
    }

    /**
     * Crea backup del database (placeholder - da implementare)
     */
    async createBackup() {
        try {
            console.log('📦 [BACKUP] Creazione backup non ancora implementata');
            return { success: false, message: 'Funzionalità non implementata' };
        } catch (error) {
            console.error('❌ [BACKUP] Errore creazione:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new BackupService();
