/**
 * Email template utilities
 */

const getEmailFooter = (frontendUrl) => {
  const url = frontendUrl || process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com';
  return `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #6b7280; font-size: 11px; margin: 0 0 8px 0;">
        <a href="${url}" 
           style="color: #4caf50; text-decoration: none; font-weight: 500; font-size: 12px;">
          🔐 Accedi al sistema TicketApp
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 10px; margin: 0;">
        Questa email è stata inviata automaticamente dal sistema TicketApp
      </p>
    </div>
  `;
};

const getTicketCreatedTemplate = (ticket, clientName) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">TicketApp</h1>
        <p style="margin: 10px 0 0 0;">Ticket Creato con Successo</p>
      </div>
      <div style="padding: 30px; background: #f8f9fa;">
        <h2 style="color: #333; margin-top: 0;">Ciao ${clientName || 'Cliente'}!</h2>
        <p>Hai creato con successo un nuovo ticket di assistenza:</p>
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #4caf50;">
          <h3 style="color: #4caf50; margin-top: 0;">📋 Dettagli Ticket</h3>
          <p><strong>Numero:</strong> ${ticket.numero}</p>
          <p><strong>Titolo:</strong> ${ticket.titolo}</p>
          <p><strong>Descrizione:</strong> ${ticket.descrizione}</p>
          <p><strong>Priorità:</strong> ${ticket.priorita.toUpperCase()}</p>
          <p><strong>Stato:</strong> ${ticket.stato}</p>
          <p><strong>Data apertura:</strong> ${new Date(ticket.dataapertura).toLocaleDateString('it-IT')}</p>
        </div>
        <div style="background: #e8f5e8; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #2e7d32;">
            <strong>✅ Il tuo ticket è stato creato e aggiunto al calendario!</strong><br>
            Il nostro team tecnico lo esaminerà al più presto.
          </p>
        </div>
        ${getEmailFooter()}
      </div>
    </div>
  `;
};

module.exports = {
  getEmailFooter,
  getTicketCreatedTemplate
};

