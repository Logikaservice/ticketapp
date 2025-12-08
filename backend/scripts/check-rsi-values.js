/**
 * Script per verificare i valori RSI di BTC/USDT
 */

const http = require('http');

async function checkRSI() {
    try {
        // 1. Market Scanner
        const scannerData = await new Promise((resolve, reject) => {
            http.get('http://localhost:3001/api/crypto/scanner', (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        const btcScanner = scannerData.scan_results?.find(r => r.display === 'BTC/USDT' || r.symbol === 'bitcoin_usdt');
        
        console.log('\n📊 MARKET SCANNER - BTC/USDT:');
        console.log('  RSI:', btcScanner?.rsi);
        console.log('  RSI Deep:', btcScanner?.rsi_deep_analysis);

        // 2. Deep Analysis
        const deepAnalysisData = await new Promise((resolve, reject) => {
            const req = http.get('http://localhost:3001/api/crypto/bot-analysis?symbol=bitcoin_usdt', { timeout: 15000 }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        console.error('Errore parsing deep analysis:', e.message);
                        reject(e);
                    }
                });
            });
            req.on('error', (err) => {
                console.error('Errore connessione deep analysis:', err.message);
                reject(err);
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout deep analysis'));
            });
        });

        console.log('\n📊 DEEP ANALYSIS - BTC/USDT:');
        console.log('  RSI:', deepAnalysisData.rsi);
        console.log('  signal.indicators.rsi:', deepAnalysisData.signal?.indicators?.rsi);

        console.log('\n✅ Confronto:');
        console.log(`  Market Scanner RSI Deep: ${btcScanner?.rsi_deep_analysis}`);
        console.log(`  Deep Analysis RSI: ${deepAnalysisData.rsi}`);
        console.log(`  Sono identici: ${btcScanner?.rsi_deep_analysis === deepAnalysisData.rsi ? '✅ SÌ' : '❌ NO'}`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error('Stack:', error.stack);
    }
}

checkRSI();
