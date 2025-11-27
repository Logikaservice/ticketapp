const API_KEY = 'f1d5e882-e8ab-49c0-ac47-2df3a6a30890';
const EMAIL = 'logikaservice@gmail.com';

async function testEndpoints() {
    const { default: fetch } = await import('node-fetch');
    console.log('Testing SpeechGen Endpoints for Balance...');

    // 1. Test /api/voices
    try {
        console.log('\n--- Testing /api/voices ---');
        const response = await fetch(`https://speechgen.io/index.php?r=api/voices&token=${API_KEY}&email=${EMAIL}`);
        const data = await response.json();
        console.log('Keys in /api/voices response:', Object.keys(data));
        if (data.balans) console.log('FOUND balans in voices:', data.balans);
    } catch (e) {
        console.error('Error /api/voices:', e.message);
    }

    // 2. Test /api/v1/generate (Empty text)
    try {
        console.log('\n--- Testing /api/v1/generate (Empty) ---');
        const response = await fetch(`https://api.speechgen.io/api/v1/generate`, {
            method: 'POST',
            headers: {
                'X-API-Key': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: ' ',
                voice: 'Giulia',
                email: EMAIL
            })
        });
        const data = await response.json();
        console.log('Response /api/v1/generate:', data);
    } catch (e) {
        console.error('Error /api/v1/generate:', e.message);
    }
}

testEndpoints();
