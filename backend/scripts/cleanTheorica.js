// Script per pulire i duplicati di Theorica
// Questo script rimuove TUTTI i duplicati per l'azienda Theorica

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

async function cleanTheorica() {
    console.log('\n🧹 === PULIZIA DUPLICATI THEORICA ===\n');

    try {
        // Trova l'ID dell'azienda Theorica
        const aziendaResult = await pool.query(`
      SELECT id, azienda FROM users WHERE LOWER(azienda) LIKE '%theorica%' LIMIT 1
    `);

        if (aziendaResult.rows.length === 0) {
            console.log('❌ Azienda Theorica non trovata');
            return;
        }

        const aziendaId = aziendaResult.rows[0].id;
        const aziendaName = aziendaResult.rows[0].azienda;
        console.log(`📌 Trovata azienda: ${aziendaName} (ID: ${aziendaId})`);

        // Trova gli agent di Theorica
        const agentsResult = await pool.query(`
      SELECT id, agent_name FROM network_agents 
      WHERE azienda_id = $1 AND deleted_at IS NULL
    `, [aziendaId]);

        console.log(`📌 Trovati ${agentsResult.rows.length} agent per Theorica`);

        if (agentsResult.rows.length === 0) {
            console.log('❌ Nessun agent trovato per Theorica');
            return;
        }

        const agentIds = agentsResult.rows.map(a => a.id);
        console.log(`📌 Agent IDs: ${agentIds.join(', ')}\n`);

        // Trova tutti i dispositivi di Theorica
        const devicesResult = await pool.query(`
      SELECT id, agent_id, ip_address, mac_address, hostname, vendor, 
             device_type, device_path, status, last_seen,
             is_static, is_manual_type, notes, parent_device_id, port,
             additional_ips, is_new_device
      FROM network_devices 
      WHERE agent_id = ANY($1::int[])
      ORDER BY mac_address, ip_address, last_seen DESC NULLS LAST
    `, [agentIds]);

        console.log(`📊 Trovati ${devicesResult.rows.length} dispositivi totali per Theorica\n`);

        // Raggruppa per MAC normalizzato
        const devicesByMac = new Map();
        const devicesByIp = new Map();
        const devicesWithoutMac = [];

        for (const device of devicesResult.rows) {
            const normalizedMac = normalizeMac(device.mac_address);
            const normalizedIp = normalizeIp(device.ip_address);

            if (normalizedMac && normalizedMac.length >= 12) {
                if (!devicesByMac.has(normalizedMac)) {
                    devicesByMac.set(normalizedMac, []);
                }
                devicesByMac.get(normalizedMac).push(device);
            } else if (normalizedIp) {
                if (!devicesByIp.has(normalizedIp)) {
                    devicesByIp.set(normalizedIp, []);
                }
                devicesByIp.get(normalizedIp).push(device);
            } else {
                devicesWithoutMac.push(device);
            }
        }

        let totalRemoved = 0;
        let totalMerged = 0;

        // Processa duplicati per MAC
        console.log('🔍 === DEDUPLICAZIONE PER MAC ===\n');
        for (const [mac, devices] of devicesByMac.entries()) {
            if (devices.length <= 1) continue;

            console.log(`\n🔄 Trovati ${devices.length} duplicati per MAC ${mac}`);

            // Mantieni il primo (più recente per last_seen)
            const mainDevice = devices[0];
            const duplicates = devices.slice(1);

            console.log(`   ✅ Mantengo: ID=${mainDevice.id}, IP=${mainDevice.ip_address}, MAC=${mainDevice.mac_address}, Hostname=${mainDevice.hostname || 'N/A'}`);

            // Raccogli tutti gli IP aggiuntivi
            const allAdditionalIps = new Set();

            if (mainDevice.additional_ips) {
                try {
                    const existingIps = JSON.parse(mainDevice.additional_ips);
                    if (Array.isArray(existingIps)) {
                        existingIps.forEach(ip => allAdditionalIps.add(normalizeIp(ip)));
                    }
                } catch (e) { }
            }

            if (mainDevice.ip_address) {
                allAdditionalIps.add(normalizeIp(mainDevice.ip_address));
            }

            // Merge dati dai duplicati
            let mergedHostname = mainDevice.hostname;
            let mergedVendor = mainDevice.vendor;
            let mergedDeviceType = mainDevice.device_type;
            let mergedDevicePath = mainDevice.device_path;
            let mergedNotes = mainDevice.notes;

            for (const dup of duplicates) {
                console.log(`   ❌ Rimuovo: ID=${dup.id}, IP=${dup.ip_address}, MAC=${dup.mac_address}, Hostname=${dup.hostname || 'N/A'}`);

                // Aggiungi IP agli additional_ips
                if (dup.ip_address && normalizeIp(dup.ip_address) !== normalizeIp(mainDevice.ip_address)) {
                    allAdditionalIps.add(normalizeIp(dup.ip_address));
                }

                // Aggiungi additional_ips del duplicato
                if (dup.additional_ips) {
                    try {
                        const dupIps = JSON.parse(dup.additional_ips);
                        if (Array.isArray(dupIps)) {
                            dupIps.forEach(ip => allAdditionalIps.add(normalizeIp(ip)));
                        }
                    } catch (e) { }
                }

                // Merge campi
                if (!mergedHostname && dup.hostname) mergedHostname = dup.hostname;
                if (!mergedVendor && dup.vendor) mergedVendor = dup.vendor;
                if (!mergedDeviceType && dup.device_type) mergedDeviceType = dup.device_type;
                if (!mergedDevicePath && dup.device_path) mergedDevicePath = dup.device_path;
                if (!mergedNotes && dup.notes) mergedNotes = dup.notes;

                // Aggiorna riferimenti parent_device_id
                await pool.query(
                    'UPDATE network_devices SET parent_device_id = $1 WHERE parent_device_id = $2',
                    [mainDevice.id, dup.id]
                );

                // Elimina il duplicato
                await pool.query('DELETE FROM network_devices WHERE id = $1', [dup.id]);
                totalRemoved++;
            }

            // Rimuovi IP principale dalla lista additional_ips
            allAdditionalIps.delete(normalizeIp(mainDevice.ip_address));

            // Aggiorna dispositivo principale
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

        // Processa duplicati per IP (dispositivi senza MAC)
        console.log('\n\n🔍 === DEDUPLICAZIONE PER IP (senza MAC) ===\n');
        for (const [ip, devices] of devicesByIp.entries()) {
            if (devices.length <= 1) continue;

            console.log(`\n🔄 Trovati ${devices.length} duplicati per IP ${ip}`);

            const mainDevice = devices[0];
            const duplicates = devices.slice(1);

            console.log(`   ✅ Mantengo: ID=${mainDevice.id}, IP=${mainDevice.ip_address}, Hostname=${mainDevice.hostname || 'N/A'}`);

            let mergedHostname = mainDevice.hostname;
            let mergedVendor = mainDevice.vendor;
            let mergedDeviceType = mainDevice.device_type;
            let mergedDevicePath = mainDevice.device_path;
            let mergedNotes = mainDevice.notes;
            let mergedMac = mainDevice.mac_address;

            for (const dup of duplicates) {
                console.log(`   ❌ Rimuovo: ID=${dup.id}, IP=${dup.ip_address}, Hostname=${dup.hostname || 'N/A'}`);

                if (!mergedHostname && dup.hostname) mergedHostname = dup.hostname;
                if (!mergedVendor && dup.vendor) mergedVendor = dup.vendor;
                if (!mergedDeviceType && dup.device_type) mergedDeviceType = dup.device_type;
                if (!mergedDevicePath && dup.device_path) mergedDevicePath = dup.device_path;
                if (!mergedNotes && dup.notes) mergedNotes = dup.notes;
                if (!mergedMac && dup.mac_address) mergedMac = dup.mac_address;

                await pool.query(
                    'UPDATE network_devices SET parent_device_id = $1 WHERE parent_device_id = $2',
                    [mainDevice.id, dup.id]
                );

                await pool.query('DELETE FROM network_devices WHERE id = $1', [dup.id]);
                totalRemoved++;
            }

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

        console.log(`\n\n✅ === PULIZIA COMPLETATA ===`);
        console.log(`📊 Totale duplicati rimossi: ${totalRemoved}`);
        console.log(`📊 Totale gruppi merged: ${totalMerged}\n`);

        // Statistiche finali
        const finalCount = await pool.query(`
      SELECT COUNT(*) FROM network_devices WHERE agent_id = ANY($1::int[])
    `, [agentIds]);

        console.log(`📌 Dispositivi rimanenti per Theorica: ${finalCount.rows[0].count}\n`);

    } catch (error) {
        console.error('❌ Errore durante pulizia Theorica:', error);
    }
}

async function main() {
    console.log('🚀 === AVVIO PULIZIA THEORICA ===\n');

    try {
        await cleanTheorica();
    } catch (error) {
        console.error('❌ Errore fatale:', error);
    } finally {
        await pool.end();
    }
}

// Esegui lo script
main();
