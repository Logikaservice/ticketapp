#!/bin/bash
export PGPASSWORD='TicketApp2025!Secure'
psql -h localhost -U postgres -d crypto_db -t -A -c "SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance' LIMIT 1;"

