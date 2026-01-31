// Script per pulire i duplicati dell'agent Theorica (ID: 11)
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const THEORICA_AGENT_ID = 11;

function normalizeMac(mac) {
    if (!mac) return null;
    return mac.trim().toUpperCase().replace(/[:\-\s.]/g, '');
}

function normalizeIp(ip) {
    if (!ip) return null;
    return ip.trim().replace(/[{}"]/g, '');
}

async function cleanAgent() {
    console.log(`\n🧹 === PULIZIA DUPLICATI AGENT ID ${THEORICA_AGENT_ID} (Theorica) ===\n`);

    try {
        // Trova tutti i dispositivi dell'agent
        const devicesResult = await pool.query(`
      SELECT id, agent_id, ip_address, mac_address, hostname, vendor, 
             device_type, device_path, status, last_seen,
             is_static, is_manual_type, notes, parent_device_id, port,
             additional_ips, is_new_device
      FROM network_devices 
      WHERE agent_id = $1
      ORDER BY mac_address, ip_address, last_seen DESC NULLS LAST
    `, [THEORICA_AGENT_ID]);

        console.log(`📊 Trovati ${devicesResult.rows.length} dispositivi totali\n`);

        // Raggruppa per MAC normalizzato
        const devicesByMac = new Map();

        for (const device of devicesResult.rows) {
            const normalizedMac = normalizeMac(device.mac_address);

            if (normalizedMac && normalizedMac.length >= 12) {
                if (!devicesByMac.has(normalizedMac)) {
                    devicesByMac.set(normalizedMac, []);
                }
                devicesByMac.get(normalizedMac).push(device);
            }
        }

        let totalRemoved = 0;
        let totalMerged = 0;

        // Processa duplicati per MAC
        console.log('🔍 === DEDUPLICAZIONE PER MAC ===\n');
        for (const [mac, devices] of devicesByMac.entries()) {
            if (devices.length <= 1) continue;

            console.log(`\n🔄 Trovati ${devices.length} duplicati per MAC ${mac}`);

            const mainDevice = devices[0];
            const duplicates = devices.slice(1);

            console.log(`   ✅ Mantengo: ID=${mainDevice.id}, IP=${mainDevice.ip_address}, Hostname=${mainDevice.hostname || 'N/A'}`);

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

            let mergedHostname = mainDevice.hostname;
            let mergedVendor = mainDevice.vendor;
            let mergedDeviceType = mainDevice.device_type;
            let mergedDevicePath = mainDevice.device_path;
            let mergedNotes = mainDevice.notes;

            for (const dup of duplicates) {
                console.log(`   ❌ Rimuovo: ID=${dup.id}, IP=${dup.ip_address}, Hostname=${dup.hostname || 'N/A'}`);

                if (dup.ip_address && normalizeIp(dup.ip_address) !== normalizeIp(mainDevice.ip_address)) {
                    allAdditionalIps.add(normalizeIp(dup.ip_address));
                }

                if (dup.additional_ips) {
                    try {
                        const dupIps = JSON.parse(dup.additional_ips);
                        if (Array.isArray(dupIps)) {
                            dupIps.forEach(ip => allAdditionalIps.add(normalizeIp(ip)));
                        }
                    } catch (e) { }
                }

                if (!mergedHostname && dup.hostname) mergedHostname = dup.hostname;
                if (!mergedVendor && dup.vendor) mergedVendor = dup.vendor;
                if (!mergedDeviceType && dup.device_type) mergedDeviceType = dup.device_type;
                if (!mergedDevicePath && dup.device_path) mergedDevicePath = dup.device_path;
                if (!mergedNotes && dup.notes) mergedNotes = dup.notes;

                await pool.query(
                    'UPDATE network_devices SET parent_device_id = $1 WHERE parent_device_id = $2',
                    [mainDevice.id, dup.id]
                );

                await pool.query('DELETE FROM network_devices WHERE id = $1', [dup.id]);
                totalRemoved++;
            }

            allAdditionalIps.delete(normalizeIp(mainDevice.ip_address));
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

        console.log(`\n\n✅ === PULIZIA COMPLETATA ===`);
        console.log(`📊 Totale duplicati rimossi: ${totalRemoved}`);
        console.log(`📊 Totale gruppi merged: ${totalMerged}\n`);

        const finalCount = await pool.query(`
      SELECT COUNT(*) FROM network_devices WHERE agent_id = $1
    `, [THEORICA_AGENT_ID]);

        console.log(`📌 Dispositivi rimanenti: ${finalCount.rows[0].count}\n`);

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await pool.end();
    }
}

cleanAgent();
