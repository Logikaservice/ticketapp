const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:Logika2024!@185.17.106.2:5432/ticketapp' });

async function run() {
    try {
        const avi = await pool.query(`SELECT * FROM antivirus_info WHERE device_id IN (SELECT id FROM network_devices WHERE ip_address IN ('192.168.100.2', '192.168.100.20'))`);
        console.log("Before deletion:", avi.rows);

        const del = await pool.query(`DELETE FROM antivirus_info WHERE device_id IN (SELECT id FROM network_devices WHERE ip_address IN ('192.168.100.2', '192.168.100.20')) RETURNING *`);
        console.log("Deleted:", del.rows);

        console.log("Cleanup done.");
    } catch (e) { console.error(e); } finally { pool.end(); }
}
run();
