const nodemailer = require('nodemailer');

/**
 * Send email notification for crypto trading events
 * @param {string} type - 'position_opened' or 'position_closed'
 * @param {object} data - Trade data
 */
const sendCryptoEmail = async (type, data) => {
    try {
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

        if (!emailUser || !emailPass) {
            console.log('⚠️ Email not configured, skipping crypto notification');
            return;
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: emailUser, pass: emailPass }
        });

        let subject, html;

        if (type === 'position_opened') {
            const emoji = data.type === 'LONG' ? '📈' : '📉';
            subject = `${emoji} Nuova Posizione ${data.type} Aperta - ${data.symbol.toUpperCase()}`;
            html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, ${data.type === 'LONG' ? '#10b981' : '#ef4444'} 0%, ${data.type === 'LONG' ? '#059669' : '#dc2626'} 100%); color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">${emoji} Crypto Trading Bot</h1>
                        <p style="margin: 10px 0 0 0;">Nuova Posizione Aperta</p>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <h2 style="color: #333; margin-top: 0;">Dettagli Posizione</h2>
                        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${data.type === 'LONG' ? '#10b981' : '#ef4444'};">
                            <p><strong>Tipo:</strong> <span style="color: ${data.type === 'LONG' ? '#10b981' : '#ef4444'}; font-weight: bold;">${data.type}</span></p>
                            <p><strong>Simbolo:</strong> ${data.symbol.toUpperCase()}</p>
                            <p><strong>Prezzo Entrata:</strong> €${data.entry_price.toFixed(2)}</p>
                            <p><strong>Volume:</strong> ${data.volume.toFixed(4)}</p>
                            <p><strong>Valore Totale:</strong> €${(data.entry_price * data.volume).toFixed(2)}</p>
                            <p><strong>Stop Loss:</strong> €${data.stop_loss ? data.stop_loss.toFixed(2) : 'N/A'}</p>
                            <p><strong>Take Profit:</strong> €${data.take_profit ? data.take_profit.toFixed(2) : 'N/A'}</p>
                            <p><strong>Data/Ora:</strong> ${new Date(data.timestamp).toLocaleString('it-IT')}</p>
                        </div>
                        ${data.signal_details ? `
                        <div style="background: #e0f2f7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                            <h3 style="color: #0288d1; margin-top: 0;">📊 Segnale di Trading</h3>
                            <p><strong>Forza:</strong> ${data.signal_details.strength || 0}/100</p>
                            <p><strong>Conferme:</strong> ${data.signal_details.confirmations || 0}</p>
                            ${data.signal_details.reasons ? `<p><strong>Motivi:</strong><br>${data.signal_details.reasons.join('<br>')}</p>` : ''}
                        </div>
                        ` : ''}
                        <div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0; color: #856404;">
                                <strong>💡 Nota:</strong> Il bot monitorerà automaticamente questa posizione e la chiuderà quando raggiungerà il take-profit o lo stop-loss.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'position_closed') {
            const isProfit = data.profit_loss >= 0;
            const emoji = isProfit ? '💰' : '📉';
            subject = `${emoji} Posizione Chiusa ${isProfit ? 'con Profitto' : 'con Perdita'} - ${data.symbol.toUpperCase()}`;
            html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, ${isProfit ? '#10b981' : '#ef4444'} 0%, ${isProfit ? '#059669' : '#dc2626'} 100%); color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">${emoji} Crypto Trading Bot</h1>
                        <p style="margin: 10px 0 0 0;">Posizione Chiusa</p>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                        <h2 style="color: #333; margin-top: 0;">Risultato Trading</h2>
                        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${isProfit ? '#10b981' : '#ef4444'};">
                            <p><strong>Simbolo:</strong> ${data.symbol.toUpperCase()}</p>
                            <p><strong>Tipo:</strong> ${data.type}</p>
                            <p><strong>Prezzo Entrata:</strong> €${data.entry_price.toFixed(2)}</p>
                            <p><strong>Prezzo Uscita:</strong> €${data.close_price.toFixed(2)}</p>
                            <p><strong>Volume:</strong> ${data.volume.toFixed(4)}</p>
                            <p style="font-size: 1.2rem; margin-top: 15px;">
                                <strong>Profitto/Perdita:</strong> 
                                <span style="color: ${isProfit ? '#10b981' : '#ef4444'}; font-weight: bold;">
                                    ${isProfit ? '+' : ''}€${data.profit_loss.toFixed(2)} (${data.profit_loss_percent ? data.profit_loss_percent.toFixed(2) : '0.00'}%)
                                </span>
                            </p>
                            <p><strong>Durata:</strong> ${data.duration || 'N/A'}</p>
                            <p><strong>Data Chiusura:</strong> ${new Date(data.close_time).toLocaleString('it-IT')}</p>
                        </div>
                        <div style="background: ${isProfit ? '#d1fae5' : '#fee2e2'}; border-radius: 8px; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0; color: ${isProfit ? '#065f46' : '#991b1b'};">
                                <strong>${isProfit ? '🎉 Ottimo lavoro!' : '⚠️ Attenzione'}</strong><br>
                                ${isProfit ? 'Il bot ha chiuso la posizione con profitto.' : 'Il bot ha limitato le perdite chiudendo la posizione.'}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }

        await transporter.sendMail({
            from: emailUser,
            to: 'info@logikaservice.it',
            subject: subject,
            html: html
        });

        console.log(`✅ Email crypto notification sent: ${type}`);
    } catch (error) {
        console.error('❌ Error sending crypto email:', error);
    }
};

module.exports = { sendCryptoEmail };
