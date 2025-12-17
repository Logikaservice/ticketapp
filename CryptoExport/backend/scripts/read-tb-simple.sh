#!/bin/bash
# Script semplice per leggere total_balance dalla VPS

cd /var/www/ticketapp/backend
export PGPASSWORD='TicketApp2025!Secure'
psql -U postgres -d crypto_db -t -A -c "SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1;"


