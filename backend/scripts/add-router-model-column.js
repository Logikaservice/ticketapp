#!/usr/bin/env node
// Script per aggiungere la colonna router_model a network_devices
// Usa le stesse variabili d'ambiente dell'app (DATABASE_URL dal .env)
// Eseguire dalla root del progetto: node backend/scripts/add-router-model-column.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

async function run() {
  let poolConfig = {};
  if (process.env.DATABASE_URL) {
    const match = process.env.DATABASE_URL.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (match) {
      poolConfig = {
        user: decodeURIComponent(match[1]),
        password: decodeURIComponent(match[2]),
        host: match[3],
        port: parseInt(match[4]),
        database: match[5],
        ssl: match[3] === 'localhost' || match[3] === '127.0.0.1' ? false : { rejectUnauthorized: false }
      };
    }
  }
  if (!poolConfig.host) {
    console.error('DATABASE_URL non configurata in .env');
    process.exit(1);
  }
  const pool = new Pool(poolConfig);
  try {
    await pool.query('ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS router_model VARCHAR(100);');
    console.log('OK: colonna router_model aggiunta (o già esistente)');
  } catch (err) {
    console.error('Errore:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
run();
