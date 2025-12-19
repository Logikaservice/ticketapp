#!/bin/bash
cd /var/www/ticketapp/backend
export NODE_PATH=/var/www/ticketapp/backend/node_modules
node << 'ENDOFNODE'
require('dotenv').config({ path: '/var/www/ticketapp/backend/.env' });
const cryptoDb = require('./crypto_db');

cryptoDb.dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1")
    .then(r => {
        if (r && r.setting_value) {
            console.log(r.setting_value.trim());
            process.exit(0);
        } else {
            console.error('ERROR: not found');
            process.exit(1);
        }
    })
    .catch(e => {
        console.error('ERROR:', e.message);
        process.exit(1);
    });
ENDOFNODE




