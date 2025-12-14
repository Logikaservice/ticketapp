// Aggiungi questo snippet nella console del browser per filtrare gli errori delle estensioni:

const originalError = console.error;
console.error = function(...args) {
    const msg = args.join(' ');
    // Filtra errori delle estensioni
    if (msg.includes('runtime.lastError') || 
        msg.includes('message port closed') ||
        msg.includes('Extension context invalidated')) {
        return; // Ignora
    }
    originalError.apply(console, args);
};

console.log('✅ Filtro errori estensioni attivato');
