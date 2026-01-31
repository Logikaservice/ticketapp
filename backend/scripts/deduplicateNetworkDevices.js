// Script per deduplicare i dispositivi di rete
// Rimuove duplicati basati su MAC address (priorità) e IP address
// Mantiene il record più recente e completo

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ticketapp'
});

// Normalizza MAC address per confronto
function normalizeMac(mac) {
    if (!mac) return null;
    return mac.trim().toUpperCase().replace(/[:\-\s.]/g, '');
}

// Normalizza IP address per confronto
function normalizeIp(ip) {
    if (!ip) return null;
    return ip.trim().replace(/[{}"]/g, '');
}

async function deduplicateByMac() {
    console.log('\n🔍 === DEDUPLICAZIONE PER MAC ADDRESS ===\n');

    try {
        // Trova tutti i dispositivi con MAC address
        const devicesResult = await pool.query(`
      SELECT id, agent_id, ip_address, mac_address, hostname, vendor, 
             device_type, device_path, status, last_seen,
             is_static_ip, is_manual_type, notes, parent_device_id, port,
             additional_ips, is_new_device
      FROM network_devices 
      WHERE mac_address IS NOT NULL 
        AND mac_address != ''
      ORDER BY agent_id, mac_address, last_seen DESC NULLS LAST
    `);

        console.log(`📊 Trovati ${devicesResult.rows.length} dispositivi con MAC address`);

        // Raggruppa per agent_id e MAC normalizzato
        const devicesByAgentAndMac = new Map();

        for (const device of devicesResult.rows) {
            const normalizedMac = normalizeMac(device.mac_address);
            if (!normalizedMac || normalizedMac.length < 12) continue;

            const key = `${device.agent_id}:${normalizedMac}`;

            if (!devicesByAgentAndMac.has(key)) {
                devicesByAgentAndMac.set(key, []);
            }
            devicesByAgentAndMac.get(key).push(device);
        }

        let totalDuplicates = 0;
        let totalMerged = 0;

        // Processa ogni gruppo di duplicati
        for (const [key, devices] of devicesByAgentAndMac.entries()) {
            if (devices.length <= 1) continue; // Nessun duplicato

            totalDuplicates += devices.length - 1;

            const [agentId, mac] = key.split(':');
            console.log(`\n🔄 Trovati ${devices.length} duplicati per MAC ${mac} (Agent ${agentId})`);

            // Il primo dispositivo è quello più recente (per ORDER BY last_seen DESC, created_at DESC)
            const mainDevice = devices[0];
            const duplicates = devices.slice(1);

            console.log(`   ✅ Mantengo: ID=${mainDevice.id}, IP=${mainDevice.ip_address}, Hostname=${mainDevice.hostname || 'N/A'}`);

            // Raccogli tutti gli IP aggiuntivi dai duplicati
            const allAdditionalIps = new Set();

            // Aggiungi gli IP aggiuntivi già presenti nel dispositivo principale
            if (mainDevice.additional_ips) {
                try {
                    const existingIps = JSON.parse(mainDevice.additional_ips);
                    if (Array.isArray(existingIps)) {
                        existingIps.forEach(ip => allAdditionalIps.add(normalizeIp(ip)));
                    }
                } catch (e) {
                    // Ignora errori di parsing
                }
            }

            // Aggiungi l'IP principale del dispositivo principale
            if (mainDevice.ip_address) {
                allAdditionalIps.add(normalizeIp(mainDevice.ip_address));
            }

            // Merge dei dati dai duplicati
            let mergedHostname = mainDevice.hostname;
            let mergedVendor = mainDevice.vendor;
            let mergedDeviceType = mainDevice.device_type;
            let mergedDevicePath = mainDevice.device_path;
            let mergedNotes = mainDevice.notes;

            for (const dup of duplicates) {
                console.log(`   ❌ Rimuovo: ID=${dup.id}, IP=${dup.ip_address}, Hostname=${dup.hostname || 'N/A'}`);

                // Aggiungi IP del duplicato agli additional_ips
                if (dup.ip_address && normalizeIp(dup.ip_address) !== normalizeIp(mainDevice.ip_address)) {
                    allAdditionalIps.add(normalizeIp(dup.ip_address));
                }

                // Aggiungi gli additional_ips del duplicato
                if (dup.additional_ips) {
                    try {
                        const dupIps = JSON.parse(dup.additional_ips);
                        if (Array.isArray(dupIps)) {
                            dupIps.forEach(ip => allAdditionalIps.add(normalizeIp(ip)));
                        }
                    } catch (e) {
                        // Ignora errori di parsing
                    }
                }

                // Merge dei campi se il principale non li ha
                if (!mergedHostname && dup.hostname) mergedHostname = dup.hostname;
                if (!mergedVendor && dup.vendor) mergedVendor = dup.vendor;
                if (!mergedDeviceType && dup.device_type) mergedDeviceType = dup.device_type;
                if (!mergedDevicePath && dup.device_path) mergedDevicePath = dup.device_path;
                if (!mergedNotes && dup.notes) mergedNotes = dup.notes;

                // Aggiorna i riferimenti parent_device_id di altri dispositivi che puntano a questo duplicato
                await pool.query(
                    'UPDATE network_devices SET parent_device_id = $1 WHERE parent_device_id = $2',
                    [mainDevice.id, dup.id]
                );

                // Elimina il duplicato
                await pool.query('DELETE FROM network_devices WHERE id = $1', [dup.id]);
            }

            // Rimuovi l'IP principale dalla lista degli additional_ips
            allAdditionalIps.delete(normalizeIp(mainDevice.ip_address));

            // Aggiorna il dispositivo principale con i dati merged
            const additionalIpsArray = Array.from(allAdditionalIps).filter(ip => ip);

            await pool.query(`
        UPDATE network_devices 
        SET hostname = COALESCE($1, hostname),
            vendor = COALESCE($2, vendor),
            device_type = COALESCE($3, device_type),
            device_path = COALESCE($4, device_path),
            notes = COALESCE($5, notes),
            additional_ips = $6
        WHERE id = $7
      `, [mergedHostname, mergedVendor, mergedDeviceType, mergedDevicePath, mergedNotes, JSON.stringify(additionalIpsArray), mainDevice.id]);

            totalMerged++;
            console.log(`   ✅ Merged completato. Additional IPs: ${additionalIpsArray.join(', ') || 'Nessuno'}`);
        }

        console.log(`\n✅ Deduplicazione MAC completata: ${totalDuplicates} duplicati rimossi, ${totalMerged} gruppi merged\n`);
    } catch (error) {
        console.error('❌ Errore durante deduplicazione per MAC:', error);
    }
}

async function deduplicateByIp() {
    console.log('\n🔍 === DEDUPLICAZIONE PER IP ADDRESS (dispositivi senza MAC) ===\n');

    try {
        // Trova tutti i dispositivi senza MAC ma con IP duplicati
        const devicesResult = await pool.query(`
      SELECT id, agent_id, ip_address, mac_address, hostname, vendor, 
             device_type, device_path, status, last_seen,
             is_static_ip, is_manual_type, notes, parent_device_id, port
      FROM network_devices 
      WHERE (mac_address IS NULL OR mac_address = '')
        AND ip_address IS NOT NULL
        AND ip_address != ''
      ORDER BY agent_id, ip_address, last_seen DESC NULLS LAST
    `);

        console.log(`📊 Trovati ${devicesResult.rows.length} dispositivi senza MAC`);

        // Raggruppa per agent_id e IP normalizzato
        const devicesByAgentAndIp = new Map();

        for (const device of devicesResult.rows) {
            const normalizedIp = normalizeIp(device.ip_address);
            if (!normalizedIp) continue;

            const key = `${device.agent_id}:${normalizedIp}`;

            if (!devicesByAgentAndIp.has(key)) {
                devicesByAgentAndIp.set(key, []);
            }
            devicesByAgentAndIp.get(key).push(device);
        }

        let totalDuplicates = 0;
        let totalMerged = 0;

        // Processa ogni gruppo di duplicati
        for (const [key, devices] of devicesByAgentAndIp.entries()) {
            if (devices.length <= 1) continue; // Nessun duplicato

            totalDuplicates += devices.length - 1;

            const [agentId, ip] = key.split(':');
            console.log(`\n🔄 Trovati ${devices.length} duplicati per IP ${ip} (Agent ${agentId})`);

            // Il primo dispositivo è quello più recente
            const mainDevice = devices[0];
            const duplicates = devices.slice(1);

            console.log(`   ✅ Mantengo: ID=${mainDevice.id}, Hostname=${mainDevice.hostname || 'N/A'}`);

            // Merge dei dati dai duplicati
            let mergedHostname = mainDevice.hostname;
            let mergedVendor = mainDevice.vendor;
            let mergedDeviceType = mainDevice.device_type;
            let mergedDevicePath = mainDevice.device_path;
            let mergedNotes = mainDevice.notes;
            let mergedMac = mainDevice.mac_address;

            for (const dup of duplicates) {
                console.log(`   ❌ Rimuovo: ID=${dup.id}, Hostname=${dup.hostname || 'N/A'}`);

                // Merge dei campi
                if (!mergedHostname && dup.hostname) mergedHostname = dup.hostname;
                if (!mergedVendor && dup.vendor) mergedVendor = dup.vendor;
                if (!mergedDeviceType && dup.device_type) mergedDeviceType = dup.device_type;
                if (!mergedDevicePath && dup.device_path) mergedDevicePath = dup.device_path;
                if (!mergedNotes && dup.notes) mergedNotes = dup.notes;
                if (!mergedMac && dup.mac_address) mergedMac = dup.mac_address;

                // Aggiorna i riferimenti parent_device_id
                await pool.query(
                    'UPDATE network_devices SET parent_device_id = $1 WHERE parent_device_id = $2',
                    [mainDevice.id, dup.id]
                );

                // Elimina il duplicato
                await pool.query('DELETE FROM network_devices WHERE id = $1', [dup.id]);
            }

            // Aggiorna il dispositivo principale
            await pool.query(`
        UPDATE network_devices 
        SET hostname = COALESCE($1, hostname),
            vendor = COALESCE($2, vendor),
            device_type = COALESCE($3, device_type),
            device_path = COALESCE($4, device_path),
            notes = COALESCE($5, notes),
            mac_address = COALESCE($6, mac_address)
        WHERE id = $7
      `, [mergedHostname, mergedVendor, mergedDeviceType, mergedDevicePath, mergedNotes, mergedMac, mainDevice.id]);

            totalMerged++;
        }

        console.log(`\n✅ Deduplicazione IP completata: ${totalDuplicates} duplicati rimossi, ${totalMerged} gruppi merged\n`);
    } catch (error) {
        console.error('❌ Errore durante deduplicazione per IP:', error);
    }
}

async function showStatistics() {
    console.log('\n📊 === STATISTICHE FINALI ===\n');

    try {
        // Conta dispositivi totali
        const totalResult = await pool.query('SELECT COUNT(*) FROM network_devices');
        console.log(`📌 Dispositivi totali: ${totalResult.rows[0].count}`);

        // Conta dispositivi con MAC
        const withMacResult = await pool.query('SELECT COUNT(*) FROM network_devices WHERE mac_address IS NOT NULL AND mac_address != \'\'');
        console.log(`📌 Dispositivi con MAC: ${withMacResult.rows[0].count}`);

        // Conta dispositivi senza MAC
        const withoutMacResult = await pool.query('SELECT COUNT(*) FROM network_devices WHERE mac_address IS NULL OR mac_address = \'\'');
        console.log(`📌 Dispositivi senza MAC: ${withoutMacResult.rows[0].count}`);

        // Conta possibili duplicati rimanenti per MAC
        const dupMacResult = await pool.query(`
      SELECT COUNT(*) FROM (
        SELECT agent_id, REPLACE(REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', ''), ' ', '') as normalized_mac
        FROM network_devices
        WHERE mac_address IS NOT NULL AND mac_address != ''
        GROUP BY agent_id, normalized_mac
        HAVING COUNT(*) > 1
      ) AS dups
    `);
        console.log(`⚠️  Possibili duplicati MAC rimanenti: ${dupMacResult.rows[0].count}`);

        // Conta possibili duplicati rimanenti per IP
        const dupIpResult = await pool.query(`
      SELECT COUNT(*) FROM (
        SELECT agent_id, TRIM(REPLACE(REPLACE(REPLACE(ip_address, '{', ''), '}', ''), '"', '')) as normalized_ip
        FROM network_devices
        WHERE (mac_address IS NULL OR mac_address = '')
          AND ip_address IS NOT NULL AND ip_address != ''
        GROUP BY agent_id, normalized_ip
        HAVING COUNT(*) > 1
      ) AS dups
    `);
        console.log(`⚠️  Possibili duplicati IP rimanenti: ${dupIpResult.rows[0].count}\n`);

    } catch (error) {
        console.error('❌ Errore durante calcolo statistiche:', error);
    }
}

async function main() {
    console.log('🚀 === AVVIO DEDUPLICAZIONE DISPOSITIVI DI RETE ===\n');

    try {
        // Mostra statistiche iniziali
        await showStatistics();

        // Deduplicazione per MAC (priorità)
        await deduplicateByMac();

        // Deduplicazione per IP (solo dispositivi senza MAC)
        await deduplicateByIp();

        // Mostra statistiche finali
        await showStatistics();

        console.log('✅ === DEDUPLICAZIONE COMPLETATA ===\n');
    } catch (error) {
        console.error('❌ Errore fatale:', error);
    } finally {
        await pool.end();
    }
}

// Esegui lo script
main();
