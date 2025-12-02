const express = require('express');
const router = express.Router();
const db = require('../crypto_db');
const fetch = require('node-fetch');

// Helper to get portfolio
const getPortfolio = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM portfolio LIMIT 1", (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// GET /api/crypto/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const portfolio = await getPortfolio();

        db.all("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10", (err, trades) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all("SELECT * FROM bot_settings", (err, bots) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                    portfolio: {
                        balance_usd: portfolio.balance_usd,
                        holdings: JSON.parse(portfolio.holdings)
                    },
                    recent_trades: trades,
                    active_bots: bots
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/price/:symbol (Proxy to get real price)
router.get('/price/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toLowerCase(); // e.g., bitcoin
    try {
        // Using CoinCap API for free real-time data
        const response = await fetch(`https://api.coincap.io/v2/assets/${symbol}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

// POST /api/crypto/bot/toggle
router.post('/bot/toggle', (req, res) => {
    const { strategy_name, is_active } = req.body;
    db.run("UPDATE bot_settings SET is_active = ? WHERE strategy_name = ?", [is_active ? 1 : 0, strategy_name], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, strategy_name, is_active });
    });
});

// POST /api/crypto/trade (Simulation)
router.post('/trade', async (req, res) => {
    const { symbol, type, amount, price, strategy } = req.body;
    // In a real app, we would check balance here.
    // For this demo, we just record it.

    const cost = amount * price;

    try {
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings);

        if (type === 'buy') {
            if (balance < cost) return res.status(400).json({ error: 'Insufficient funds' });
            balance -= cost;
            holdings[symbol] = (holdings[symbol] || 0) + amount;
        } else {
            if (!holdings[symbol] || holdings[symbol] < amount) return res.status(400).json({ error: 'Insufficient crypto' });
            balance += cost;
            holdings[symbol] -= amount;
        }

        // Update DB
        db.serialize(() => {
            db.run("UPDATE portfolio SET balance_usd = ?, holdings = ?", [balance, JSON.stringify(holdings)]);
            db.run("INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
                [symbol, type, amount, price, strategy]);
        });

        res.json({ success: true, new_balance: balance, new_holdings: holdings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
