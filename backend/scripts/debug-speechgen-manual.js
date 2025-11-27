const apiKey = 'f1d5e882-e8ab-49c0-ac47-2df3a6a30090';
const email = 'logikaserivce@gmail.com';

const endpoints = [
    `https://speechgen.io/index.php?r=api/voices`,
    `https://speechgen.io/index.php?r=api/voices&email=${encodeURIComponent(email)}&token=${apiKey}`,
    `https://api.speechgen.io/api/voices`,
    `https://api.speechgen.io/api/v1/speakers`
];

async function testEndpoints() {
    let fetchFn = globalThis.fetch;
    if (!fetchFn) {
        try {
            const module = await import('node-fetch');
            fetchFn = module.default;
        } catch (e) {
            console.error("Cannot load fetch", e);
            return;
        }
    }

    console.log('--- Inizio Test SpeechGen ---');
    console.log(`API Key: ${apiKey}`);
    console.log(`Email: ${email}`);

    for (const url of endpoints) {
        console.log(`\nTesting: ${url}`);
        try {
            const response = await fetchFn(url, {
                method: 'GET',
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log(`Status: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log(`Response: ${text.substring(0, 500)}...`);

            try {
                const json = JSON.parse(text);
                console.log(`JSON Parse: OK. Is Array? ${Array.isArray(json)}`);
                if (json.error) console.log(`API Error: ${json.error}`);
            } catch (e) {
                console.log('JSON Parse: FAIL');
            }

        } catch (error) {
            console.log(`ERROR: ${error.message}`);
            if (error.cause) console.log(`Cause: ${error.cause}`);
        }
    }
    console.log('\n--- Fine Test ---');
}

testEndpoints();
