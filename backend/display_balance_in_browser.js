
const https = require('https');
const fs = require('fs');
const path = require('path');

const fetchJson = (url, headers = {}) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) { reject(e); }
                } else {
                    resolve({ error: true, code: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
};

const displayBalanceInBrowser = async () => {
    console.log('🌍 initiating Brute Force Balance Check...');

    const attempts = [
        { name: "Public Endpoint (No Auth)", url: "https://ticket.logikaservice.it/api/crypto/public-balance-check", headers: {} },
        { name: "AI DB Execute (No Auth)", url: "https://ticket.logikaservice.it/api/ai-db/execute?command=summary", headers: {} },
        { name: "Crypto Debug (Token Param)", url: "https://ticket.logikaservice.it/api/crypto/debug/execute?token=gemini&command=portfolio", headers: {} },
        { name: "Crypto Debug (Bearer)", url: "https://ticket.logikaservice.it/api/crypto/debug/execute?command=portfolio", headers: { "Authorization": "Bearer gemini" } },
        { name: "Crypto Debug (Raw Token)", url: "https://ticket.logikaservice.it/api/crypto/debug/execute?command=portfolio", headers: { "Authorization": "gemini" } },
        { name: "Direct DB Debug", url: "https://ticket.logikaservice.it/api/crypto/debug/db?token=gemini", headers: {} }
    ];

    let portfolioData = null;
    let logs = [];

    for (const attempt of attempts) {
        console.log(`Trying: ${attempt.name} - ${attempt.url}`);
        try {
            const res = await fetchJson(attempt.url, attempt.headers);
            if (res.error) {
                console.log(`❌ ${attempt.name} failed: ${res.code} ${res.body}`);
                logs.push(`${attempt.name}: Failed (${res.code})`);
            } else {
                // Check if valid data
                let valid = false;
                let extracted = {};

                if (res.success && res.data) {
                    extracted = res.data;
                    valid = true;
                } else if (res.balance_usd !== undefined) {
                    extracted = res;
                    valid = true;
                } else if (res.data?.portfolio?.balance_usd) {
                    extracted = res.data.portfolio;
                    valid = true;
                }

                if (valid) {
                    console.log(`✅ SUCCESS with ${attempt.name}!`);
                    logs.push(`${attempt.name}: SUCCESS`);
                    portfolioData = {
                        balance_usd: parseFloat(extracted.balance_usd || extracted.cash || 0),
                        balance_eur: parseFloat(extracted.balance_eur || 0),
                        total_equity: parseFloat(extracted.total_equity || extracted.totalBalance || extracted.balance_usd || 0),
                        updated_at: extracted.updated_at || new Date().toISOString()
                    };
                    break; // Stop on first success
                } else {
                    console.log(`⚠️ ${attempt.name} returned valid JSON but missing data.`);
                }
            }
        } catch (e) {
            console.log(`❌ ${attempt.name} error: ${e.message}`);
            logs.push(`${attempt.name}: Error ${e.message}`);
        }
    }

    if (portfolioData) {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio Balance (REAL DATA)</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1e1e1e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background-color: #2d2d2d; padding: 2rem; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); width: 400px; text-align: center; border: 1px solid #3d3d3d; position: relative; }
        h1 { color: #4CAF50; margin-bottom: 0.5rem; font-size: 24px; }
        .source-tag { position: absolute; top: 10px; right: 10px; background: #673AB7; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }
        .balance-item { margin: 15px 0; font-size: 1.2rem; display: flex; justify-content: space-between; border-bottom: 1px solid #3d3d3d; padding-bottom: 10px; }
        .label { color: #aaa; }
        .value { font-weight: bold; font-family: 'Consolas', monospace; }
        .timestamp { font-size: 0.8rem; color: #666; margin-top: 20px; }
        .value.usd { color: #81C784; }
        .value.eur { color: #64B5F6; }
    </style>
</head>
<body>
    <div class="card">
        <div class="source-tag">LIVE DATA</div>
        <h1>💰 Total Balance</h1>
        
        <div class="balance-item">
            <span class="label">Balance USD:</span>
            <span class="value usd">$${parseFloat(portfolioData.balance_usd).toFixed(2)}</span>
        </div>
        <div class="balance-item">
            <span class="label">Balance EUR:</span>
            <span class="value eur">€${parseFloat(portfolioData.balance_eur).toFixed(2)}</span>
        </div>
        <div class="balance-item">
            <span class="label">Total Equity:</span>
            <span class="value">$${parseFloat(portfolioData.total_equity).toFixed(2)}</span>
        </div>
        
        <div class="timestamp">Updated: ${portfolioData.updated_at ? new Date(portfolioData.updated_at).toLocaleString() : 'N/A'}</div>
    </div>
</body>
</html>`;

        const outputPath = path.join(__dirname, 'balance_output.html');
        fs.writeFileSync(outputPath, htmlContent);
        console.log(`✅ File created: ${outputPath}`);
    } else {
        const errorHtml = `
<html><body>
    <h1 style="color:red">All Attempts Failed</h1>
    <pre>${logs.join('\n')}</pre>
</body></html>`;
        fs.writeFileSync(path.join(__dirname, 'balance_output.html'), errorHtml);
    }
};

displayBalanceInBrowser();
