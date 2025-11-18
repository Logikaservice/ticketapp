#!/bin/bash
# Script per verificare il provider VPS e le sue restrizioni

echo "🔍 VERIFICA PROVIDER VPS E RESTRIZIONI"
echo "======================================"
echo ""

# IP pubblico
PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com)
echo "📍 IP Pubblico VPS: $PUBLIC_IP"
echo ""

# Verifica provider tramite IP
echo "🌐 Verifica provider tramite IP..."
if command -v whois &> /dev/null; then
  echo "Provider (tramite whois):"
  whois $PUBLIC_IP | grep -iE "(org|netname|descr)" | head -n 5
else
  echo "⚠️  whois non installato. Installa con: apt-get install whois"
fi
echo ""

# Verifica se è Hetzner
if echo "$PUBLIC_IP" | grep -qE "^159\.|^5\.|^46\.|^49\.|^78\.|^88\.|^95\.|^116\.|^138\.|^148\.|^157\.|^176\.|^178\.|^185\.|^188\.|^213\."; then
  echo "🔍 Provider rilevato: HETZNER"
  echo ""
  echo "ℹ️  HETZNER BLOCCA LE PORTE SMTP (25, 587, 465) PER DEFAULT"
  echo ""
  echo "✅ SOLUZIONI:"
  echo "1. Richiedi sblocco porte SMTP tramite ticket supporto Hetzner"
  echo "   - Vai su: https://console.hetzner.cloud/"
  echo "   - Apri un ticket di supporto"
  echo "   - Richiedi: 'Unblock SMTP ports 25, 587, 465 for server $PUBLIC_IP'"
  echo "   - Spiega che è per un'applicazione legittima (sistema ticket)"
  echo ""
  echo "2. Usa un relay SMTP esterno (già implementato)"
  echo "   - SendGrid, Mailgun, AWS SES, etc."
  echo ""
  echo "3. Usa un server SMTP su una porta non bloccata (improbabile)"
  echo ""
elif echo "$PUBLIC_IP" | grep -qE "^134\.|^140\.|^147\.|^161\.|^162\.|^163\.|^164\.|^165\.|^167\.|^168\.|^169\.|^170\.|^171\.|^172\.|^173\.|^174\.|^175\.|^176\.|^177\.|^178\.|^179\.|^180\.|^181\.|^182\.|^183\.|^184\.|^185\.|^186\.|^187\.|^188\.|^189\.|^190\.|^191\.|^192\.|^193\.|^194\.|^195\.|^196\.|^197\.|^198\.|^199\.|^200\.|^201\.|^202\.|^203\.|^204\.|^205\.|^206\.|^207\.|^208\.|^209\.|^210\.|^211\.|^212\.|^213\.|^214\.|^215\.|^216\.|^217\.|^218\.|^219\.|^220\.|^221\.|^222\.|^223\.|^224\.|^225\.|^226\.|^227\.|^228\.|^229\.|^230\.|^231\.|^232\.|^233\.|^234\.|^235\.|^236\.|^237\.|^238\.|^239\.|^240\.|^241\.|^242\.|^243\.|^244\.|^245\.|^246\.|^247\.|^248\.|^249\.|^250\.|^251\.|^252\.|^253\.|^254\.|^255\."; then
  echo "🔍 Provider rilevato: DIGITALOCEAN"
  echo ""
  echo "ℹ️  DIGITALOCEAN BLOCCA LA PORTA 25 PER DEFAULT"
  echo "   Le porte 587 e 465 potrebbero funzionare"
  echo ""
  echo "✅ SOLUZIONI:"
  echo "1. Richiedi sblocco porta 25 tramite ticket supporto DigitalOcean"
  echo "2. Usa porte 587 o 465 (potrebbero funzionare)"
  echo "3. Usa un relay SMTP esterno"
  echo ""
else
  echo "🔍 Provider non identificato automaticamente"
  echo ""
  echo "ℹ️  Molti provider VPS bloccano le porte SMTP per prevenire spam"
  echo ""
  echo "✅ SOLUZIONI:"
  echo "1. Contatta il supporto del tuo provider VPS"
  echo "2. Richiedi sblocco porte SMTP (25, 587, 465)"
  echo "3. Usa un relay SMTP esterno (già implementato)"
  echo ""
fi

echo ""
echo "📋 INFORMAZIONI UTILI PER IL SUPPORTO:"
echo "-------------------------------------"
echo "IP Server: $PUBLIC_IP"
echo "Porte richieste: 25, 587, 465 (SMTP)"
echo "Motivo: Sistema di gestione ticket legittimo"
echo "Email mittente: info@logikaservice.it (Aruba)"
echo ""

echo "✅ Verifica completata!"




