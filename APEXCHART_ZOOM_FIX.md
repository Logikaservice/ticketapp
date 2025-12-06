# 🔧 FIX APEXCHART ZOOM RESET

## 🔴 PROBLEMA
ApexChart si resetta ogni volta che i dati vengono aggiornati (ogni 5 secondi) perdendo lo zoom.

## ✅ SOLUZIONE

### 1. Aggiungi ref per salvare lo zoom (dopo linea 18):
```jsx
const zoomStateRef = useRef(null); // Salva lo stato dello zoom
```

### 2. Salva lo zoom prima dell'update (dopo linea 51):
```jsx
// Salva lo stato dello zoom prima di aggiornare
useEffect(() => {
    if (chartRef.current && chartRef.current.chart) {
        const chart = chartRef.current.chart;
        // Salva il range corrente dello zoom
        if (chart.w && chart.w.globals) {
            zoomStateRef.current = {
                minX: chart.w.globals.minX,
                maxX: chart.w.globals.maxX
            };
        }
    }
});
```

### 3. Modifica le opzioni del chart (linea 131-157):
```jsx
const options = {
    chart: {
        type: 'candlestick',
        height: 500,
        toolbar: {
            show: true,
            tools: {
                download: true,
                selection: true,
                zoom: true,
                zoomin: true,
                zoomout: true,
                pan: true,
                reset: true,
            },
        },
        animations: {
            enabled: false, // ❌ DISABILITA animazioni per evitare reset
        },
        zoom: {
            enabled: true,
            type: 'x',
            autoScaleYaxis: true,
            preserveZoom: true, // ✅ PRESERVA lo zoom
        },
        events: {
            // Salva lo zoom quando l'utente zooma
            zoomed: function(chartContext, { xaxis, yaxis }) {
                zoomStateRef.current = {
                    minX: xaxis.min,
                    maxX: xaxis.max
                };
            }
        }
    },
    // ... resto delle opzioni
```

### 4. Ripristina lo zoom dopo l'update (dopo linea 220):
```jsx
setChartOptions(options);
setChartSeries([{
    name: 'Bitcoin/EUR',
    data: candlestickData,
}]);

// Ripristina lo zoom dopo l'update
if (zoomStateRef.current && chartRef.current && chartRef.current.chart) {
    setTimeout(() => {
        chartRef.current.chart.zoomX(
            zoomStateRef.current.minX,
            zoomStateRef.current.maxX
        );
    }, 100);
}
```

---

## 🎯 ALTERNATIVA PIÙ SEMPLICE

Invece di modificare tutto, puoi semplicemente:

### Cambia la dipendenza dell'useEffect (linea 225):
```jsx
// PRIMA (si resetta sempre):
}, [priceHistory, currentPrice, currentInterval, openPositions]);

// DOPO (si resetta solo quando cambi interval):
}, [priceHistory, currentInterval, openPositions]);
// ❌ Rimosso currentPrice per evitare re-render continui
```

E aggiorna solo l'ultima candela senza ricreare tutto:
```jsx
// Aggiungi un useEffect separato per currentPrice
useEffect(() => {
    if (!chartRef.current || !chartRef.current.chart || !currentPrice) return;
    
    // Aggiorna solo l'ultima candela senza ricreare il grafico
    const chart = chartRef.current.chart;
    const series = chart.w.config.series[0].data;
    
    if (series && series.length > 0) {
        const lastCandle = series[series.length - 1];
        lastCandle.y[1] = Math.max(lastCandle.y[1], currentPrice); // High
        lastCandle.y[2] = Math.min(lastCandle.y[2], currentPrice); // Low
        lastCandle.y[3] = currentPrice; // Close
        
        chart.updateSeries([{
            data: series
        }], false); // false = non animare
    }
}, [currentPrice]);
```

---

## 🚀 QUALE SOLUZIONE PREFERISCI?

1. **Soluzione Completa** (preserva zoom con eventi)
2. **Soluzione Semplice** (rimuovi currentPrice dalle dipendenze)
3. **Entrambe** (massima stabilità)

Dimmi quale preferisci e la implemento! 🎯
