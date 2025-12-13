// Test salvataggio min_volume_24h via API
const http = require('http');

const NEW_VALUE = 900000;

async function testSave() {
    console.log(`🔧 Test salvataggio min_volume_24h = ${NEW_VALUE}\n`);
    
    // Prepara i dati da inviare
    const data = JSON.stringify({
        min_volume_24h: NEW_VALUE
    });
    
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/crypto/bot/parameters',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                console.log('📥 Risposta API:');
                console.log(`   Status: ${res.statusCode}`);
                try {
                    const parsed = JSON.parse(responseData);
                    console.log(`   Success: ${parsed.success}`);
                    console.log(`   Message: ${parsed.message || 'N/A'}`);
                    
                    if (parsed.success) {
                        console.log('\n✅ Salvataggioconfermato dall\'API');
                        
                        // Ora verifica nel database
                        setTimeout(() => {
                            verificaDatabase();
                        }, 1000);
                    } else {
                        console.log(`\n❌ Salvataggio fallito: ${parsed.error || 'Unknown error'}`);
                        process.exit(1);
                    }
                } catch (e) {
                    console.error('❌ Errore parsing risposta:', e.message);
                    console.error('   Risposta raw:', responseData);
                    reject(e);
                }
            });
        });
        
        req.on('error', (e) => {
            console.error(`❌ Errore richiesta: ${e.message}`);
            reject(e);
        });
        
        req.write(data);
        req.end();
    });
}

async function verificaDatabase() {
    console.log('\n🔍 Verifica nel database...');
    
    const cryptoDb = require('../crypto_db');
    const { dbGet } = cryptoDb;
    
    try {
        const result = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'",
            []
        );
        
        if (!result) {
            console.log('❌ Record global non trovato nel database!');
            process.exit(1);
        }
        
        const params = typeof result.parameters === 'string'
            ? JSON.parse(result.parameters)
            : result.parameters;
        
        console.log(`\n📊 min_volume_24h nel DB: ${params.min_volume_24h}`);
        console.log(`📊 Valore atteso: ${NEW_VALUE}`);
        
        if (params.min_volume_24h === NEW_VALUE) {
            console.log('\n✅ SUCCESSO! Il valore è stato salvato correttamente!');
        } else {
            console.log(`\n❌ ERRORE! Il valore nel DB (${params.min_volume_24h}) non corrisponde a quello inviato (${NEW_VALUE})`);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Errore verifica database:', error.message);
        process.exit(1);
    }
}

testSave().catch(console.error);
