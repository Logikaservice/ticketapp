#!/bin/bash
# Script per aggiornare PostgreSQL client alla versione più recente

echo "🔄 Aggiornamento PostgreSQL client..."

# Aggiungi repository PostgreSQL ufficiale
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Aggiorna e installa PostgreSQL 17 client
sudo apt-get update
sudo apt-get install -y postgresql-client-17

echo "✅ PostgreSQL client aggiornato!"
echo "📊 Versione installata:"
pg_dump --version









