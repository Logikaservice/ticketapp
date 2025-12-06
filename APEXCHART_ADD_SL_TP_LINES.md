# 🎯 AGGIUNGI LINEE SL/TP SU APEXCHART

## ✅ ZOOM FUNZIONA! Ora aggiungiamo le linee Stop Loss e Take Profit

### MODIFICA: Sostituisci l'oggetto `annotations` (linee 176-183)

**TROVA** (linee 176-183):
```jsx
annotations: {
    points: markers.map(m => ({
        x: m.x,
        y: m.y,
        marker: m.marker,
        label: m.label,
    })),
},
```

**SOSTITUISCI CON**:
```jsx
annotations: {
    points: markers.map(m => ({
        x: m.x,
        y: m.y,
        marker: m.marker,
        label: m.label,
    })),
    // ✅ Linee orizzontali per Stop Loss e Take Profit
    yaxis: openPositions.flatMap((pos, index) => {
        const lines = [];
        const stopLoss = parseFloat(pos.stop_loss);
        const takeProfit = parseFloat(pos.take_profit);
        
        // Linea Stop Loss (rossa)
        if (stopLoss && stopLoss > 0) {
            lines.push({
                y: stopLoss,
                borderColor: '#ef4444',
                strokeDashArray: 4,
                label: {
                    text: `SL #${index + 1}: €${stopLoss.toFixed(2)}`,
                    style: {
                        color: '#fff',
                        background: '#ef4444',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: {
                            left: 8,
                            right: 8,
                            top: 2,
                            bottom: 2
                        }
                    },
                    position: 'right',
                    offsetX: 0,
                    offsetY: 0
                }
            });
        }
        
        // Linea Take Profit (verde)
        if (takeProfit && takeProfit > 0) {
            lines.push({
                y: takeProfit,
                borderColor: '#10b981',
                strokeDashArray: 4,
                label: {
                    text: `TP #${index + 1}: €${takeProfit.toFixed(2)}`,
                    style: {
                        color: '#fff',
                        background: '#10b981',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: {
                            left: 8,
                            right: 8,
                            top: 2,
                            bottom: 2
                        }
                    },
                    position: 'right',
                    offsetX: 0,
                    offsetY: 0
                }
            });
        }
        
        return lines;
    })
},
```

---

## 🎨 RISULTATO

Vedrai sul grafico:
- 🔴 **Linee rosse tratteggiate** per Stop Loss con label "SL #1: €75000.00"
- 🟢 **Linee verdi tratteggiate** per Take Profit con label "TP #1: €80000.00"
- 📍 **Marker numerati** (1, 2, 3...) per le posizioni aperte

Le linee sono **orizzontali** e attraversano tutto il grafico, rendendo facile vedere dove sono i tuoi SL/TP!

---

## ✅ VANTAGGI

- ✅ Linee sempre visibili
- ✅ Zoom preservato (grazie alla fix precedente)
- ✅ Label con prezzo esatto
- ✅ Colori distintivi (rosso = pericolo, verde = target)
- ✅ Numerate per corrispondere ai marker delle posizioni

---

Applica questa modifica e avrai un grafico professionale con SL/TP! 🎯
