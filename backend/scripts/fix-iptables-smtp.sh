#!/bin/bash
# Script per verificare e rimuovere regole iptables che bloccano SMTP

echo "🔧 VERIFICA E CORREZIONE IPTABLES PER SMTP"
echo "=========================================="
echo ""

# Verifica regole OUTPUT attuali
echo "📋 Regole OUTPUT iptables attuali:"
sudo iptables -L OUTPUT -n --line-numbers
echo ""

# Cerca regole che potrebbero bloccare SMTP
echo "🔍 Ricerca regole che bloccano SMTP (porta 587, 465, 25):"
BLOCKING_RULES=$(sudo iptables -L OUTPUT -n --line-numbers | grep -E "(REJECT|DROP)" | grep -E "(587|465|25|all)" || echo "")

if [ -n "$BLOCKING_RULES" ]; then
  echo "⚠️  Trovate regole che potrebbero bloccare SMTP:"
  echo "$BLOCKING_RULES"
  echo ""
  echo "❓ Vuoi rimuovere queste regole? (s/n)"
  read -r response
  if [ "$response" = "s" ] || [ "$response" = "S" ]; then
    echo "🗑️  Rimozione regole bloccanti..."
    # Qui andrebbero rimosse le regole specifiche, ma è meglio farlo manualmente
    echo "⚠️  Rimozione manuale richiesta. Usa: sudo iptables -D OUTPUT <numero_riga>"
  fi
else
  echo "✅ Nessuna regola esplicita che blocca SMTP trovata"
fi

echo ""

# Aggiungi regole esplicite per permettere SMTP in uscita (se non esistono già)
echo "➕ Aggiunta regole esplicite per SMTP in uscita..."

# Verifica se esistono già
RULE_587=$(sudo iptables -C OUTPUT -p tcp --dport 587 -j ACCEPT 2>&1)
RULE_465=$(sudo iptables -C OUTPUT -p tcp --dport 465 -j ACCEPT 2>&1)
RULE_25=$(sudo iptables -C OUTPUT -p tcp --dport 25 -j ACCEPT 2>&1)

if [ -n "$RULE_587" ]; then
  echo "➕ Aggiunta regola per porta 587..."
  sudo iptables -A OUTPUT -p tcp --dport 587 -j ACCEPT
  echo "✅ Regola aggiunta per porta 587"
else
  echo "✅ Regola per porta 587 già esistente"
fi

if [ -n "$RULE_465" ]; then
  echo "➕ Aggiunta regola per porta 465..."
  sudo iptables -A OUTPUT -p tcp --dport 465 -j ACCEPT
  echo "✅ Regola aggiunta per porta 465"
else
  echo "✅ Regola per porta 465 già esistente"
fi

if [ -n "$RULE_25" ]; then
  echo "➕ Aggiunta regola per porta 25..."
  sudo iptables -A OUTPUT -p tcp --dport 25 -j ACCEPT
  echo "✅ Regola aggiunta per porta 25"
else
  echo "✅ Regola per porta 25 già esistente"
fi

echo ""

# Salva le regole iptables (se disponibile)
if command -v iptables-save &> /dev/null; then
  echo "💾 Salvataggio regole iptables..."
  sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || echo "⚠️  Impossibile salvare (potrebbe richiedere configurazione aggiuntiva)"
fi

echo ""
echo "📋 Regole OUTPUT iptables aggiornate:"
sudo iptables -L OUTPUT -n --line-numbers | head -n 20
echo ""

echo "✅ Configurazione completata!"
echo ""
echo "🧪 Testa ora:"
echo "  node scripts/test-email-smtp.js"





