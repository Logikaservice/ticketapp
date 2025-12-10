/**
 * Utility per formattare i prezzi delle criptovalute in modo uniforme
 * Usa sempre il punto come separatore decimale (formato standard internazionale per crypto)
 */

/**
 * Formatta un prezzo con il numero di decimali appropriato
 * @param {number} price - Il prezzo da formattare
 * @param {number} decimals - Numero di decimali (default: auto-calcolato in base al valore)
 * @returns {string} Prezzo formattato con punto come separatore decimale
 */
export const formatPrice = (price, decimals = null) => {
    if (price == null || isNaN(price) || price === 0) {
        return '0.00';
    }

    // Se non specificato, calcola automaticamente il numero di decimali in base al valore
    // ✅ Allineato ESATTAMENTE con formato TradingView
    if (decimals === null) {
        if (price < 0.0001) {
            decimals = 8; // Per valori molto piccoli (< 0.0001), mostra 8 decimali (es. 0.00001234)
        } else if (price < 0.01) {
            decimals = 6; // Per valori piccoli (< 0.01), mostra 6 decimali (es. 0.000123)
        } else if (price < 1) {
            decimals = 5; // Per valori < 1, mostra 5 decimali (es. 0.12345)
        } else if (price < 10) {
            decimals = 3; // ✅ Per valori tra 1 e 10 (es. DOT/USDT ~2.165), mostra 3 decimali come TradingView
        } else if (price < 100) {
            decimals = 2; // Per valori tra 10 e 100, mostra 2 decimali
        } else {
            decimals = 2; // Per valori >= 100 (es. BTC ~43250.25), mostra 2 decimali
        }
    }

    // Usa toFixed e sostituisci eventuali virgole con punti (per sicurezza)
    return price.toFixed(decimals).replace(',', '.');
};

/**
 * Formatta un prezzo con simbolo $ e il numero di decimali appropriato
 * @param {number} price - Il prezzo da formattare
 * @param {number} decimals - Numero di decimali (default: auto-calcolato)
 * @returns {string} Prezzo formattato con simbolo $ (es: "$2.21")
 */
export const formatPriceWithSymbol = (price, decimals = null) => {
    return `$${formatPrice(price, decimals)}`;
};

/**
 * Formatta un prezzo per visualizzazione nel grafico
 * Usa sempre 2 decimali per coerenza visiva
 * @param {number} price - Il prezzo da formattare
 * @returns {string} Prezzo formattato con 2 decimali
 */
export const formatPriceForChart = (price) => {
    return formatPrice(price, 2);
};

/**
 * Formatta un prezzo per visualizzazione nel tooltip del grafico
 * @param {number} price - Il prezzo da formattare
 * @returns {string} Prezzo formattato con simbolo $ e 2 decimali
 */
export const formatPriceForTooltip = (price) => {
    return formatPriceWithSymbol(price, 2);
};

/**
 * Formatta un volume (sempre con 4 decimali)
 * @param {number} volume - Il volume da formattare
 * @returns {string} Volume formattato con 4 decimali
 */
export const formatVolume = (volume) => {
    if (volume == null || isNaN(volume) || volume === 0) {
        return '0.0000';
    }
    return volume.toFixed(4).replace(',', '.');
};

/**
 * Formatta una percentuale
 * @param {number} percent - La percentuale da formattare
 * @param {number} decimals - Numero di decimali (default: 2)
 * @returns {string} Percentuale formattata con simbolo %
 */
export const formatPercent = (percent, decimals = 2) => {
    if (percent == null || isNaN(percent)) {
        return '0.00%';
    }
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(decimals)}%`;
};

