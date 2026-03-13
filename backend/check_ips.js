require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = `
SELECT nd.ip_address, cdi.ip_addresses as cdi_ips, nd.hostname, nd.mac_address as nd_mac, cdi.device_name as cdi_name, cdi.mac as cdi_mac 
FROM network_devices nd 
LEFT JOIN comm_device_info cdi ON (
    (cdi.mac IS NOT NULL AND nd.mac_address IS NOT NULL AND REPLACE(REPLACE(LOWER(cdi.mac), '-', ''), ':', '') = REPLACE(REPLACE(LOWER(nd.mac_address), '-', ''), ':', '')) 
    OR (nd.ip_address IS NOT NULL AND (' ' || REPLACE(cdi.ip_addresses, ',', ' ') || ' ') LIKE '% ' || nd.ip_address || ' %') 
    OR (nd.hostname IS NOT NULL AND TRIM(nd.hostname) <> '' AND LOWER(cdi.device_name) = LOWER(nd.hostname))
) 
WHERE cdi.mac IS NOT NULL AND nd.ip_address IN ('192.168.100.2', '192.168.100.20', '192.168.100.200');
`;
pool.query(query).then(r => console.log(JSON.stringify(r.rows, null, 2))).catch(console.error).finally(() => pool.end());
