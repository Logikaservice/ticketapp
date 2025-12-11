# 🔧 Comandi SSH per Fix AVAX_USDT sulla VPS

Esegui questi comandi sulla VPS per risolvere i problemi con AVAX_USDT.

## 📋 Passo 1: Pull delle ultime modifiche

```bash
cd /var/www/ticketapp/backend
git pull origin main
```

## 📋 Passo 2: Configurare bot per AVAX_USDT

Se il bot non è configurato per AVAX_USDT, esegui:

```bash
cd /var/www/ticketapp/backend
node -e "
const { dbRun } = require('./crypto_db');
(async () => {
  try {
    await dbRun(
      \`INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters)
       VALUES ('RSI_Strategy', 'avax_usdt', 1, 
         '{
           \"rsi_period\": 14,
           \"rsi_oversold\": 30,
           \"rsi_overbought\": 70,
           \"stop_loss_pct\": 2.5,
           \"take_profit_pct\": 4.0,
           \"trade_size_usdt\": 50,
           \"trailing_stop_enabled\": false,
           \"trailing_stop_distance_pct\": 1.0,
           \"partial_close_enabled\": true,
           \"take_profit_1_pct\": 2.5,
           \"take_profit_2_pct\": 5.0,
           \"min_signal_strength\": 70,
           \"min_confirmations_long\": 3,
           \"min_confirmations_short\": 4,
           \"market_scanner_min_strength\": 30
         }')
       ON CONFLICT (strategy_name, symbol) DO UPDATE
       SET is_active = 1, parameters = EXCLUDED.parameters\`,
      []
    );
    console.log('✅ Bot configurato per avax_usdt');
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
})();
"
```

## 📋 Passo 3: Scaricare klines per AVAX_USDT

```bash
cd /var/www/ticketapp/backend
node download_klines.js avax_usdt AVAXUSDT
```

## 📋 Passo 4: Verificare che tutto sia corretto

```bash
cd /var/www/ticketapp/backend
node verify_all_symbols.js | grep -A 10 "AVAX_USDT"
```

## 📋 Passo 5: (Opzionale) Scaricare klines per altri simboli con problemi

Se ci sono altri simboli con klines insufficienti:

```bash
cd /var/www/ticketapp/backend
node download_klines.js all
```

## 📋 Passo 6: Riavviare il backend (se necessario)

```bash
cd /var/www/ticketapp
pm2 restart backend
# oppure
systemctl restart ticketapp-backend
```

---

## 🚀 Comando Completo (Copia e Incolla)

Esegui tutto in una volta:

```bash
cd /var/www/ticketapp/backend && \
git pull origin main && \
node -e "
const { dbRun } = require('./crypto_db');
(async () => {
  try {
    await dbRun(
      \`INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters)
       VALUES ('RSI_Strategy', 'avax_usdt', 1, 
         '{
           \"rsi_period\": 14,
           \"rsi_oversold\": 30,
           \"rsi_overbought\": 70,
           \"stop_loss_pct\": 2.5,
           \"take_profit_pct\": 4.0,
           \"trade_size_usdt\": 50,
           \"trailing_stop_enabled\": false,
           \"trailing_stop_distance_pct\": 1.0,
           \"partial_close_enabled\": true,
           \"take_profit_1_pct\": 2.5,
           \"take_profit_2_pct\": 5.0,
           \"min_signal_strength\": 70,
           \"min_confirmations_long\": 3,
           \"min_confirmations_short\": 4,
           \"market_scanner_min_strength\": 30
         }')
       ON CONFLICT (strategy_name, symbol) DO UPDATE
       SET is_active = 1, parameters = EXCLUDED.parameters\`,
      []
    );
    console.log('✅ Bot configurato per avax_usdt');
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
})();
" && \
node download_klines.js avax_usdt AVAXUSDT && \
node verify_all_symbols.js | grep -A 10 "AVAX_USDT"
```

---

## 📝 Note

- **"global" non è un simbolo valido**: Se vedi errori con "global", ignora - non è un simbolo reale su Binance
- **Volume 24h basso**: I warning per volume basso (es. coppie EUR) non sono critici, il bot potrebbe semplicemente non aprire posizioni per quei simboli
- **Variazioni simbolo**: I warning su "variazioni simbolo" (es. `bitcoin` vs `bitcoin_usdt`) sono normali - sono solo varianti dello stesso asset

