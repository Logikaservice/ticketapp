// src/hooks/useReports.js

import { generateReportHTML } from '../utils/reportGenerator';

export const useReports = (tickets, users, setModalState, showNotification) => {
  
  const handleGenerateSentReport = () => {
    const sentTickets = tickets.filter(t => t.stato === 'inviato');
    
    if (sentTickets.length === 0) {
      showNotification('Nessun ticket inviato da mostrare.', 'info');
      return;
    }

    const htmlContent = generateReportHTML(sentTickets, 'Report Ticket Inviati', 'sent', users);

    setModalState({
      type: 'reportHTML',
      data: {
        title: 'Report Ticket Inviati',
        htmlContent: htmlContent
      }
    });
  };

  const handleGenerateInvoiceReport = () => {
    const invoicedTickets = tickets.filter(t => t.stato === 'fatturato');
    
    if (invoicedTickets.length === 0) {
      showNotification('Nessun ticket fatturato da mostrare.', 'info');
      return;
    }

    const htmlContent = generateReportHTML(invoicedTickets, 'Lista Fatture', 'invoice', users);

    setModalState({
      type: 'reportHTML',
      data: {
        title: 'Lista Fatture',
        htmlContent: htmlContent
      }
    });
  };

  return {
    handleGenerateSentReport,
    handleGenerateInvoiceReport
  };
};
