/**
 * Helper per accedere al database tramite API
 * Usa questo quando devi controllare o modificare valori nel database
 */

const API_BASE_URLS = [
    process.env.API_BASE_URL || '',
    'http://localhost:3001',
    'https://your-domain.com' // Sostituisci con il tuo dominio
].filter(Boolean);

/**
 * Chiama l'API per eseguire un comando predefinito
 */
async function executeCommand(command, apiBase = null) {
    const urls = apiBase ? [apiBase] : API_BASE_URLS;
    
    for (const baseUrl of urls) {
        try {
            const url = `${baseUrl}/api/crypto/debug/execute?command=${command}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data.data, url };
            }
        } catch (error) {
            // Prova il prossimo URL
            continue;
        }
    }
    
    throw new Error('Nessun server raggiungibile');
}

/**
 * Modifica un valore nel database
 */
async function updateValue(field, value, apiBase = null) {
    const urls = apiBase ? [apiBase] : API_BASE_URLS;
    
    for (const baseUrl of urls) {
        try {
            const url = `${baseUrl}/api/crypto/debug/update`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ field, value })
            });
            
            if (response.ok) {
                const data = await response.json();
                return { success: true, data, url };
            }
        } catch (error) {
            // Prova il prossimo URL
            continue;
        }
    }
    
    throw new Error('Nessun server raggiungibile');
}

/**
 * Controlla il Total Balance nel database
 */
async function checkTotalBalance(apiBase = null) {
    return await executeCommand('total-balance', apiBase);
}

/**
 * Modifica il Total Balance
 */
async function updateTotalBalance(value, apiBase = null) {
    return await updateValue('total_balance', value, apiBase);
}

/**
 * Ottiene un riepilogo completo
 */
async function getSummary(apiBase = null) {
    return await executeCommand('summary', apiBase);
}

module.exports = {
    executeCommand,
    updateValue,
    checkTotalBalance,
    updateTotalBalance,
    getSummary
};

