// src/utils/reportGenerator.js

import { formatDate } from './formatters';

// Funzione helper per formattare date in italiano
const formatDateItalian = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const generateReportHTML = (tickets, reportTitle, reportType, users) => {
  const isInvoice = reportType === 'invoice';
  
  // Calcola totali
  let totalServizi = 0;
  let totalMateriali = 0;
  
  tickets.forEach(ticket => {
    if (ticket.timelogs && ticket.timelogs.length > 0) {
      ticket.timelogs.forEach(log => {
        const costoManodopera = (parseFloat(log.costoUnitario) || 0) * (1 - (parseFloat(log.sconto) || 0) / 100) * (parseFloat(log.oreIntervento) || 0);
        totalServizi += costoManodopera;
        
        if (log.materials && log.materials.length > 0) {
          log.materials.forEach(m => {
            const nomeMateriale = (m.nome || '').trim();
            if (nomeMateriale && nomeMateriale !== '0' && nomeMateriale !== '') {
              totalMateriali += (parseFloat(m.costo) || 0) * (parseInt(m.quantita) || 1);
            }
          });
        }
      });
    }
  });
  
  const totalGenerale = totalServizi + totalMateriali;

  // Genera HTML
  let html = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <style>
        @page { margin: 20mm; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.3;
            color: #000;
            max-width: 800px;
            margin: 0 auto;
            padding: 15px;
            background-color: #fff;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 20pt;
            font-weight: bold;
            letter-spacing: 1px;
        }
        .ticket-block {
            border-bottom: 1px solid #ccc;
            padding: 10px 0;
            margin-bottom: 10px;
            page-break-inside: avoid;
        }
        .ticket-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .ticket-number {
            font-weight: bold;
            font-size: 12pt;
        }
        .ticket-dates {
            text-align: right;
            font-size: 10pt;
        }
        .ticket-title-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
        }
        .ticket-title {
            font-weight: bold;
            font-size: 11pt;
        }
        .ticket-requester {
            text-align: right;
            font-size: 10pt;
            color: #333;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
        }
        table thead {
            background-color: #f5f5f5;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
        }
        table th {
            padding: 6px;
            text-align: left;
            font-weight: bold;
            font-size: 10pt;
        }
        table td {
            padding: 6px;
            border-bottom: 1px solid #ddd;
            font-size: 10pt;
        }
        table th:last-child, table td:last-child {
            text-align: right;
        }
        .description {
            margin: 8px 0;
            padding: 6px;
            background-color: #fafafa;
            border-left: 3px solid #4a90e2;
        }
        .materials {
            margin: 8px 0;
            padding: 6px;
            background-color: #fff9e6;
            border-left: 3px solid #f39c12;
        }
        .ticket-total {
            text-align: right;
            font-size: 12pt;
            font-weight: bold;
            margin-top: 8px;
            padding: 6px;
            background-color: #e8f4f8;
        }
        .summary {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 3px double #000;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 11pt;
        }
        .summary-row.grand-total {
            font-size: 14pt;
            font-weight: bold;
            padding: 10px 0;
            border-top: 2px solid #000;
            border-bottom: 3px double #000;
        }
        .footer {
            margin-top: 15px;
            padding-top: 8px;
            border-top: 1px solid #ccc;
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            color: #666;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${reportTitle.toUpperCase()}</h1>
    </div>
`;

  // Aggiungi ogni ticket
  tickets.forEach((ticket, index) => {
    const cliente = users.find(u => u.id === ticket.clienteid);
    const dataApertura = formatDate(ticket.dataapertura);
    const dataChiusura = ticket.datachiusura ? formatDate(ticket.datachiusura) : 'N/A';
    
    let totaleTicket = 0;

    html += `
    <div class="ticket-block">
        <div class="ticket-header">
            <span class="ticket-number">Ticket: ${ticket.numero}</span>
            <span class="ticket-dates">Data creazione: ${dataApertura}</span>
        </div>
        <div class="ticket-title-row">
            <div class="ticket-title">Titolo: ${ticket.titolo}</div>
            <div class="ticket-requester">Richiedente: ${ticket.nomerichiedente}</div>
        </div>
`;

    // Descrizione del ticket (se presente)
    if (ticket.descrizione && ticket.descrizione.trim()) {
      html += `
        <div class="description" style="margin-top: 8px;">
            <strong>Descrizione:</strong> ${ticket.descrizione}
        </div>
`;
    }

    html += `
`;

    if (ticket.timelogs && ticket.timelogs.length > 0) {
      html += `
        <table>
            <thead>
                <tr>
                    <th>Servizio / Data</th>
                    <th style="text-align: center; width: 60px;">Ore</th>
                    <th style="text-align: center; width: 80px;">Prezzo/h</th>
                    <th style="text-align: center; width: 50px;">Sc.</th>
                    <th style="width: 100px;">Importo</th>
                </tr>
            </thead>
            <tbody>
`;

      ticket.timelogs.forEach((log, logIndex) => {
        const costoManodopera = (parseFloat(log.costoUnitario) || 0) * (1 - (parseFloat(log.sconto) || 0) / 100) * (parseFloat(log.oreIntervento) || 0);
        
        // Calcola costo materiali per questo log specifico
        const costoMaterialiLog = (log.materials || []).reduce((sum, m) => {
          const nomeMateriale = (m.nome || '').trim();
          if (nomeMateriale && nomeMateriale !== '0' && nomeMateriale !== '') {
            return sum + (parseFloat(m.costo) || 0) * (parseInt(m.quantita) || 1);
          }
          return sum;
        }, 0);
        
        totaleTicket += costoManodopera + costoMaterialiLog;

        const dataItaliana = formatDateItalian(log.data);
        const oraInizio = log.oraInizio || 'N/A';
        const oraFine = log.oraFine || 'N/A';

        html += `
                <tr>
                    <td>${logIndex + 1}. ${log.modalita} - ${dataItaliana} ${oraInizio} - ${dataItaliana} ${oraFine}</td>
                    <td style="text-align: center;">${log.oreIntervento}h</td>
                    <td style="text-align: center;">€${parseFloat(log.costoUnitario).toFixed(0)}</td>
                    <td style="text-align: center;">${parseFloat(log.sconto).toFixed(0)}%</td>
                    <td style="text-align: right;">€${costoManodopera.toFixed(2)}</td>
                </tr>
`;
      });

      html += `
            </tbody>
        </table>
`;

      // DESCRIZIONI - Una per ogni timelog
      ticket.timelogs.forEach((log, logIndex) => {
        const descrizione = log.descrizione || 'N/A';
        html += `
        <div class="description">
            <strong>Descrizione Dettagliata ${logIndex + 1}:</strong> ${descrizione}
        </div>
`;
      });

      // MATERIALI - Raccogli tutti i materiali validi
      let allMaterialsText = '';
      let hasMaterials = false;
      
      ticket.timelogs.forEach(log => {
        if (log.materials && log.materials.length > 0) {
          log.materials.forEach(m => {
            const nomeMateriale = (m.nome || '').trim();
            if (nomeMateriale && nomeMateriale !== '0' && nomeMateriale !== '') {
              hasMaterials = true;
              allMaterialsText += `${nomeMateriale} (${m.quantita}x) €${parseFloat(m.costo).toFixed(2)}, `;
            }
          });
        }
      });
      
      if (hasMaterials) {
        allMaterialsText = allMaterialsText.slice(0, -2); // Rimuovi ultima virgola
        html += `
        <div class="materials">
            <strong>Materiali:</strong> ${allMaterialsText}
        </div>
`;
      } else {
        html += `
        <div class="materials">
            <strong>Materiali:</strong> N/A
        </div>
`;
      }
    }

    html += `
        <div class="ticket-total">
            TOTALE TICKET: (${ticket.numero}) €${totaleTicket.toFixed(2)}
        </div>
    </div>
`;
  });

  // Summary
  html += `
    <div class="summary">
        <div class="summary-row">
            <span>TOTALE COMPLESSIVO SERVIZI:</span>
            <span>€${totalServizi.toFixed(2)}</span>
        </div>
        <div class="summary-row">
            <span>TOTALE MATERIALI:</span>
            <span>€${totalMateriali.toFixed(2)}</span>
        </div>
        <div class="summary-row grand-total">
            <span>TOTALE GENERALE DOCUMENTO:</span>
            <span>€${totalGenerale.toFixed(2)}</span>
        </div>
    </div>

    <div class="footer">
        <span>Totale ticket: ${tickets.length}</span>
        <span>Data generazione: ${new Date().toLocaleDateString('it-IT')} | Pagina 1</span>
    </div>

</body>
</html>
`;

  return html;
};
