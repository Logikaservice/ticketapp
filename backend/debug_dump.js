require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = `
SELECT 
    id as d_id, ip_address, mac_address as db_mac, hostname 
FROM network_devices 
WHERE ip_address IN ('192.168.100.2', '192.168.100.20', '192.168.100.200');

SELECT 
    mac as c_mac, ip_addresses as c_ips, device_name as c_name, antivirus_name, primary_ip
FROM comm_device_info;

SELECT * FROM antivirus_info WHERE device_id IN (
    SELECT id FROM network_devices WHERE ip_address IN ('192.168.100.2', '192.168.100.20', '192.168.100.200')
);
`;
pool.query(query).then(r => res = r).catch(console.error).finally(async () => {
    const fs = require('fs');
    fs.writeFileSync('debug_dump.json', JSON.stringify({
        nd: res[0].rows,
        cdi: res[1].rows,
        avi: res[2].rows
    }, null, 2));
    await pool.end();
});
