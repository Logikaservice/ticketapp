/**
 * Generatore Report PDF Professionale - Backtest Crypto Bot
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class BacktestPDFReport {
    constructor() {
        this.doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        this.pageWidth = 595.28;
        this.pageHeight = 841.89;
        this.margin = 50;
        this.contentWidth = this.pageWidth - (this.margin * 2);
    }

    async generate(outputPath = './Backtest_Report.pdf') {
        const stream = fs.createWriteStream(outputPath);
        this.doc.pipe(stream);

        // Carica dati dai risultati salvati
        const results = this.loadBacktestResults();

        // Pagina 1: Copertina
        this.addCoverPage();

        // Pagina 2: Executive Summary
        this.doc.addPage();
        this.addExecutiveSummary(results);

        // Pagina 3: Classifica Performance
        this.doc.addPage();
        this.addPerformanceRanking(results);

        // Pagina 4: Analisi Top 3
        this.doc.addPage();
        this.addTop3Analysis(results);

        // Pagina 5: Analisi Bottom 3
        this.doc.addPage();
        this.addBottom3Analysis(results);

        // Pagina 6: Raccomandazioni
        this.doc.addPage();
        this.addRecommendations(results);

        // Pagina 7: Appendice Tecnica
        this.doc.addPage();
        this.addTechnicalAppendix(results);

        this.doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        });
    }

    loadBacktestResults() {
        // Dati hardcoded dai risultati del test
        return [
            { symbol: 'Litecoin', emoji: 'Ł', totalReturn: 2.58, winRate: 50.0, profitFactor: 1.80, maxDrawdown: 1.22, sharpeRatio: 0.24, totalTrades: 20 },
            { symbol: 'Ethereum', emoji: 'Ξ', totalReturn: 2.31, winRate: 55.6, profitFactor: 1.82, maxDrawdown: 0.91, sharpeRatio: 0.30, totalTrades: 18 },
            { symbol: 'Solana', emoji: '◎', totalReturn: 1.94, winRate: 50.0, profitFactor: 1.50, maxDrawdown: 1.16, sharpeRatio: 0.20, totalTrades: 16 },
            { symbol: 'XRP', emoji: '✕', totalReturn: 0.67, winRate: 40.0, profitFactor: 1.24, maxDrawdown: 1.47, sharpeRatio: 0.08, totalTrades: 15 },
            { symbol: 'Dogecoin', emoji: 'Ð', totalReturn: 0.09, winRate: 35.7, profitFactor: 1.03, maxDrawdown: 1.74, sharpeRatio: 0.01, totalTrades: 14 },
            { symbol: 'Bitcoin', emoji: '₿', totalReturn: 0.02, winRate: 42.1, profitFactor: 1.01, maxDrawdown: 1.31, sharpeRatio: 0.00, totalTrades: 19 },
            { symbol: 'Polkadot', emoji: '●', totalReturn: -0.75, winRate: 33.3, profitFactor: 0.79, maxDrawdown: 2.15, sharpeRatio: -0.09, totalTrades: 21 },
            { symbol: 'Cardano', emoji: '₳', totalReturn: -1.19, winRate: 38.5, profitFactor: 0.75, maxDrawdown: 2.44, sharpeRatio: -0.14, totalTrades: 13 },
            { symbol: 'Chainlink', emoji: '⬡', totalReturn: -2.02, winRate: 33.3, profitFactor: 0.68, maxDrawdown: 2.98, sharpeRatio: -0.19, totalTrades: 39 }
        ];
    }

    addCoverPage() {
        // Header con logo/titolo
        this.doc
            .fontSize(32)
            .font('Helvetica-Bold')
            .fillColor('#1a1a1a')
            .text('CRYPTO TRADING BOT', this.margin, 150, { align: 'center' });

        this.doc
            .fontSize(24)
            .fillColor('#4a4a4a')
            .text('Backtest Analysis Report', this.margin, 200, { align: 'center' });

        // Box informativo
        const boxY = 280;
        this.doc
            .rect(this.margin + 50, boxY, this.contentWidth - 100, 180)
            .fillAndStroke('#f8f9fa', '#dee2e6');

        this.doc
            .fontSize(14)
            .fillColor('#1a1a1a')
            .font('Helvetica')
            .text('Test Period: 30 Days', this.margin + 70, boxY + 30)
            .text('Assets Tested: 9 Cryptocurrencies', this.margin + 70, boxY + 60)
            .text('Total Trades: 175', this.margin + 70, boxY + 90)
            .text('Initial Capital: $1,000 per asset', this.margin + 70, boxY + 120);

        // Data e versione
        const today = new Date().toLocaleDateString('it-IT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        this.doc
            .fontSize(12)
            .fillColor('#6c757d')
            .text(`Report Generated: ${today}`, this.margin, 700, { align: 'center' })
            .text('TicketApp Crypto Bot v1.0', this.margin, 720, { align: 'center' });
    }

    addExecutiveSummary(results) {
        this.addSectionTitle('Executive Summary');

        const profitable = results.filter(r => r.totalReturn > 0).length;
        const avgReturn = results.reduce((sum, r) => sum + r.totalReturn, 0) / results.length;
        const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
        const avgPF = results.reduce((sum, r) => sum + r.profitFactor, 0) / results.length;

        let y = 140;

        // Key Findings Box
        this.drawBox(this.margin, y, this.contentWidth, 120, '#e7f3ff', '#0066cc');

        this.doc
            .fontSize(16)
            .font('Helvetica-Bold')
            .fillColor('#0066cc')
            .text('Key Findings', this.margin + 20, y + 15);

        this.doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#1a1a1a')
            .text(`• ${profitable}/9 assets profitable (${(profitable / 9 * 100).toFixed(1)}%)`, this.margin + 20, y + 45)
            .text(`• Average return: ${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}%`, this.margin + 20, y + 65)
            .text(`• Average win rate: ${avgWinRate.toFixed(1)}%`, this.margin + 20, y + 85);

        y += 140;

        // Performance Highlights
        this.doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#1a1a1a')
            .text('Performance Highlights', this.margin, y);

        y += 30;

        const best = results[0];
        const worst = results[results.length - 1];

        this.doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#28a745')
            .text(`✓ Best Performer: ${best.emoji} ${best.symbol} (${best.totalReturn >= 0 ? '+' : ''}${best.totalReturn.toFixed(2)}%)`, this.margin + 20, y);

        y += 25;

        this.doc
            .fillColor('#dc3545')
            .text(`✗ Worst Performer: ${worst.emoji} ${worst.symbol} (${worst.totalReturn >= 0 ? '+' : ''}${worst.totalReturn.toFixed(2)}%)`, this.margin + 20, y);

        y += 40;

        // Risk Metrics
        this.doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#1a1a1a')
            .text('Risk Metrics', this.margin, y);

        y += 30;

        const maxDD = Math.max(...results.map(r => r.maxDrawdown));
        const avgDD = results.reduce((sum, r) => sum + r.maxDrawdown, 0) / results.length;

        this.doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#1a1a1a')
            .text(`• Maximum Drawdown: ${maxDD.toFixed(2)}% (${results.find(r => r.maxDrawdown === maxDD).symbol})`, this.margin + 20, y)
            .text(`• Average Drawdown: ${avgDD.toFixed(2)}%`, this.margin + 20, y + 25)
            .text(`• Average Profit Factor: ${avgPF.toFixed(2)}`, this.margin + 20, y + 50);
    }

    addPerformanceRanking(results) {
        this.addSectionTitle('Performance Ranking');

        let y = 140;

        // Table Header
        this.doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#ffffff');

        this.doc.rect(this.margin, y, this.contentWidth, 25).fill('#343a40');

        this.doc
            .text('Rank', this.margin + 10, y + 8)
            .text('Asset', this.margin + 60, y + 8)
            .text('Return', this.margin + 180, y + 8)
            .text('Win Rate', this.margin + 250, y + 8)
            .text('PF', this.margin + 330, y + 8)
            .text('Max DD', this.margin + 380, y + 8)
            .text('Trades', this.margin + 450, y + 8);

        y += 25;

        // Table Rows
        results.forEach((r, idx) => {
            const rowColor = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
            this.doc.rect(this.margin, y, this.contentWidth, 30).fill(rowColor);

            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';

            this.doc
                .fontSize(10)
                .font('Helvetica')
                .fillColor('#1a1a1a')
                .text(`${medal} ${idx + 1}`, this.margin + 10, y + 10)
                .text(`${r.emoji} ${r.symbol}`, this.margin + 60, y + 10);

            const returnColor = r.totalReturn > 0 ? '#28a745' : r.totalReturn < 0 ? '#dc3545' : '#6c757d';
            this.doc
                .fillColor(returnColor)
                .text(`${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn.toFixed(2)}%`, this.margin + 180, y + 10);

            this.doc
                .fillColor('#1a1a1a')
                .text(`${r.winRate.toFixed(1)}%`, this.margin + 250, y + 10)
                .text(r.profitFactor.toFixed(2), this.margin + 330, y + 10)
                .text(`${r.maxDrawdown.toFixed(2)}%`, this.margin + 380, y + 10)
                .text(r.totalTrades.toString(), this.margin + 450, y + 10);

            y += 30;
        });
    }

    addTop3Analysis(results) {
        this.addSectionTitle('Top 3 Performers - Detailed Analysis');

        const top3 = results.slice(0, 3);
        let y = 140;

        top3.forEach((asset, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';

            // Asset Box
            this.drawBox(this.margin, y, this.contentWidth, 160, '#e7f5e7', '#28a745');

            this.doc
                .fontSize(14)
                .font('Helvetica-Bold')
                .fillColor('#28a745')
                .text(`${medal} ${asset.emoji} ${asset.symbol.toUpperCase()}`, this.margin + 15, y + 15);

            this.doc
                .fontSize(20)
                .fillColor('#28a745')
                .text(`${asset.totalReturn >= 0 ? '+' : ''}${asset.totalReturn.toFixed(2)}%`, this.margin + 15, y + 40);

            this.doc
                .fontSize(10)
                .font('Helvetica')
                .fillColor('#1a1a1a')
                .text('Strengths:', this.margin + 15, y + 75)
                .text(`• Win Rate: ${asset.winRate.toFixed(1)}% ${asset.winRate > 50 ? '(Above 50%)' : ''}`, this.margin + 25, y + 95)
                .text(`• Profit Factor: ${asset.profitFactor.toFixed(2)} ${asset.profitFactor > 1.5 ? '(Excellent)' : '(Good)'}`, this.margin + 25, y + 110)
                .text(`• Max Drawdown: ${asset.maxDrawdown.toFixed(2)}% (Low risk)`, this.margin + 25, y + 125);

            y += 180;
        });
    }

    addBottom3Analysis(results) {
        this.addSectionTitle('Bottom 3 Performers - Areas of Concern');

        const bottom3 = results.slice(-3).reverse();
        let y = 140;

        bottom3.forEach((asset, idx) => {
            // Asset Box
            this.drawBox(this.margin, y, this.contentWidth, 160, '#ffe7e7', '#dc3545');

            this.doc
                .fontSize(14)
                .font('Helvetica-Bold')
                .fillColor('#dc3545')
                .text(`${asset.emoji} ${asset.symbol.toUpperCase()}`, this.margin + 15, y + 15);

            this.doc
                .fontSize(20)
                .fillColor('#dc3545')
                .text(`${asset.totalReturn >= 0 ? '+' : ''}${asset.totalReturn.toFixed(2)}%`, this.margin + 15, y + 40);

            this.doc
                .fontSize(10)
                .font('Helvetica')
                .fillColor('#1a1a1a')
                .text('Issues:', this.margin + 15, y + 75)
                .text(`• Win Rate: ${asset.winRate.toFixed(1)}% (Below 50%)`, this.margin + 25, y + 95)
                .text(`• Profit Factor: ${asset.profitFactor.toFixed(2)} (Loss-making)`, this.margin + 25, y + 110)
                .text(`• Recommendation: ${asset.totalReturn < -1 ? 'DISABLE' : 'Increase filters'}`, this.margin + 25, y + 125);

            y += 180;
        });
    }

    addRecommendations(results) {
        this.addSectionTitle('Strategic Recommendations');

        let y = 140;

        // Portfolio Allocation
        this.doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#1a1a1a')
            .text('Recommended Portfolio Allocation', this.margin, y);

        y += 30;

        this.drawBox(this.margin, y, this.contentWidth, 140, '#fff3cd', '#ffc107');

        this.doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#1a1a1a')
            .text('Tier 1 - High Allocation (60% capital):', this.margin + 15, y + 15)
            .text('• Litecoin: 25%', this.margin + 25, y + 35)
            .text('• Ethereum: 25%', this.margin + 25, y + 50)
            .text('• Solana: 10%', this.margin + 25, y + 65)
            .text('Tier 2 - Medium Allocation (30% capital):', this.margin + 15, y + 90)
            .text('• XRP, Dogecoin, Bitcoin: 10% each', this.margin + 25, y + 110);

        y += 160;

        // Action Items
        this.doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#1a1a1a')
            .text('Immediate Action Items', this.margin, y);

        y += 30;

        this.doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#1a1a1a')
            .text('1. DISABLE trading on: Polkadot, Cardano, Chainlink', this.margin + 15, y)
            .text('2. INCREASE position size on: Litecoin, Ethereum', this.margin + 15, y + 25)
            .text('3. IMPLEMENT stricter filters for mid-tier assets', this.margin + 15, y + 50)
            .text('4. MONITOR performance weekly and adjust', this.margin + 15, y + 75);
    }

    addTechnicalAppendix(results) {
        this.addSectionTitle('Technical Appendix');

        let y = 140;

        this.doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#1a1a1a')
            .text('Methodology', this.margin, y);

        y += 25;

        this.doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#1a1a1a')
            .text('• Backtest Period: 30 days (historical data)', this.margin + 15, y)
            .text('• Initial Capital: $1,000 per asset', this.margin + 15, y + 20)
            .text('• Trade Size: $100 per position', this.margin + 15, y + 40)
            .text('• Strategy: RSI + Bollinger Bands + Multi-timeframe filters', this.margin + 15, y + 60)
            .text('• Stop Loss: 2% | Take Profit: 3%', this.margin + 15, y + 80)
            .text('• Data Source: Binance (15m candles)', this.margin + 15, y + 100);

        y += 140;

        this.doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#1a1a1a')
            .text('Glossary', this.margin, y);

        y += 25;

        this.doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#1a1a1a')
            .text('• Win Rate: Percentage of profitable trades', this.margin + 15, y)
            .text('• Profit Factor: Ratio of gross profit to gross loss', this.margin + 15, y + 18)
            .text('• Max Drawdown: Largest peak-to-trough decline', this.margin + 15, y + 36)
            .text('• Sharpe Ratio: Risk-adjusted return metric', this.margin + 15, y + 54);
    }

    addSectionTitle(title) {
        this.doc
            .fontSize(18)
            .font('Helvetica-Bold')
            .fillColor('#1a1a1a')
            .text(title, this.margin, 80);

        this.doc
            .moveTo(this.margin, 110)
            .lineTo(this.pageWidth - this.margin, 110)
            .strokeColor('#dee2e6')
            .lineWidth(2)
            .stroke();
    }

    drawBox(x, y, width, height, fillColor, strokeColor) {
        this.doc
            .rect(x, y, width, height)
            .fillAndStroke(fillColor, strokeColor);
    }
}

// Esegui generazione
async function main() {
    try {
        console.log('📄 Generazione Report PDF...\n');

        const generator = new BacktestPDFReport();
        const outputPath = await generator.generate('./Backtest_Report.pdf');

        console.log('✅ Report PDF generato con successo!');
        console.log(`📁 Percorso: ${path.resolve(outputPath)}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

main();
