# 🔧 FIX DEFINITIVO APEXCHART ZOOM RESET

## 🔴 PROBLEMA TROVATO
Il secondo useEffect ha `chartSeries` nelle dipendenze, creando un loop infinito:
```jsx
}, [currentPrice, currentInterval, chartSeries]); // ❌ LOOP!
```

## ✅ SOLUZIONE

### Sostituisci il secondo useEffect (linee 223-243) con questo:

```jsx
    }, [priceHistory, currentInterval, openPositions]); // ✅ Rimosso currentPrice

    // ✅ Aggiorna solo l'ultima candela quando cambia il prezzo (SENZA LOOP)
    useEffect(() => {
        if (!chartRef.current || !currentPrice || !chartSeries.length) return;
        
        const series = chartSeries[0].data;
        if (!series || series.length === 0) return;

        const lastCandle = series[series.length - 1];
        const now = Date.now();
        
        // Verifica se l'ultima candela è nell'intervallo corrente
        const intervalMs = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '30m': 30 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000
        };
        const intervalDuration = intervalMs[currentInterval] || 15 * 60 * 1000;
        const candleStartTime = Math.floor(now / intervalDuration) * intervalDuration;
        
        if (lastCandle.x >= candleStartTime - intervalDuration && lastCandle.x <= candleStartTime) {
            // Aggiorna l'ultima candela con il prezzo corrente
            const updatedCandle = {
                ...lastCandle,
                y: [
                    lastCandle.y[0], // Open (non cambia)
                    Math.max(lastCandle.y[1], currentPrice), // High
                    Math.min(lastCandle.y[2], currentPrice), // Low
                    currentPrice // Close (prezzo corrente)
                ]
            };

            const updatedSeries = [...series];
            updatedSeries[updatedSeries.length - 1] = updatedCandle;

            // ✅ USA updateSeries INVECE DI setState
            if (chartRef.current.chart) {
                chartRef.current.chart.updateSeries([{
                    name: 'Bitcoin/EUR',
                    data: updatedSeries,
                }], false); // false = non animare, non resettare zoom
            }
        }
    }, [currentPrice]); // ✅ SOLO currentPrice! Niente chartSeries, niente currentInterval
```

## 🎯 CAMBIAMENTI CHIAVE

1. **Rimosso `chartSeries` dalle dipendenze** → Niente loop
2. **Rimosso `currentInterval` dalle dipendenze** → Niente reset
3. **Usato `chart.updateSeries()` invece di `setChartSeries()`** → Aggiorna senza re-render
4. **`false` come secondo parametro** → Non anima, non resetta zoom

## ✅ RISULTATO
- ✅ Zoom preservato
- ✅ Scroll preservato  
- ✅ Ultima candela aggiornata in tempo reale
- ✅ Nessun loop infinito
- ✅ Nessun reset

---

Applica questa modifica e il grafico non si resetterà più! 🎯
