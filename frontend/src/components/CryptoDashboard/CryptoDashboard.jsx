import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Activity, Power, RefreshCw, Settings, BarChart2, Wallet, Maximize2, Minimize2, DollarSign } from 'lucide-react';
import OpenPositions from './OpenPositions';
import TradingViewChart from './TradingViewChart';
import ApexChart from './ApexChart';
import BotSettings from './BotSettings';
import StatisticsPanel from './StatisticsPanel';
import CryptoNotification from './CryptoNotification';
import MarketScanner from './MarketScanner';
import GeneralSettings from './GeneralSettings';
import cryptoSounds from '../../utils/cryptoSounds';
import { useCryptoWebSocket } from '../../hooks/useCryptoWebSocket';
import './CryptoLayout.css';
import './CryptoStandalone.css';

const CryptoDashboard = () => {
    const [portfolio, setPortfolio] = useState({ balance_usd: 10800, holdings: {}, rsi: null }); // balance_usd is now in USDT (10800 USDT ≈ 10000 EUR)
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [trades, setTrades] = useState([]);
    const [botStatus, setBotStatus] = useState({ active: false, strategy: 'RSI_Strategy' });
    const [priceData, setPriceData] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [currentSymbol, setCurrentSymbol] = useState('bitcoin'); // Current symbol being viewed
    const [availableSymbols, setAvailableSymbols] = useState([]);
    const [activeBots, setActiveBots] = useState([]);

    // Determine API base URL
    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

    const [allTrades, setAllTrades] = useState([]); // For chart plotting
    const [openPositions, setOpenPositions] = useState([]);
    const [closedPositions, setClosedPositions] = useState([]); // ✅ FIX: Aggiungi closed positions per recuperare P&L
    const [showBotSettings, setShowBotSettings] = useState(false);
    const [showBacktestPanel, setShowBacktestPanel] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [botParameters, setBotParameters] = useState(null);
    const [useApexChart, setUseApexChart] = useState(false); // Toggle tra TradingView e ApexChart
    const [showAddFundsModal, setShowAddFundsModal] = useState(false); // Modal per aggiungere fondi
    const [showGeneralSettings, setShowGeneralSettings] = useState(false); // Modal per impostazioni generali

    // WebSocket for real-time notifications
    const { connected: wsConnected } = useCryptoWebSocket(
        // onPositionOpened
        (data) => {
            console.log('📈 Position opened via WebSocket:', data);
            addNotification({ ...data, type: 'opened' });
            // Play sound
            cryptoSounds.positionOpened();
            // Refresh data immediately (no delay for instant updates)
            fetchData();
            fetchPrice(); // Also update price immediately
        },
        // onPositionClosed
        (data) => {
            console.log('📉 Position closed via WebSocket:', data);
            addNotification({ ...data, type: 'closed' });
            // Play sound based on profit/loss
            if (data.profit_loss >= 0) {
                cryptoSounds.positionClosedProfit();
            } else {
                cryptoSounds.positionClosedLoss();
            }
            // Refresh data immediately (no delay for instant updates)
            fetchData();
            fetchPrice(); // Also update price immediately
        }
    );

    const addNotification = (notification) => {
        const id = Date.now() + Math.random();
        setNotifications(prev => [...prev, { ...notification, id }]);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const fetchData = async () => {
        try {
            // ✅ FIX: Correggi automaticamente P&L anomali al caricamento
            try {
                const fixRes = await fetch(`${apiBase}/api/crypto/fix-closed-positions-pnl`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (fixRes.ok) {
                    const fixData = await fixRes.json();
                    console.log('🔧 [AUTO-FIX] P&L corretti automaticamente:', fixData);
                }
            } catch (fixError) {
                console.warn('⚠️ [AUTO-FIX] Errore correzione automatica P&L:', fixError);
                // Continua comunque, non bloccare il caricamento
            }

            const res = await fetch(`${apiBase}/api/crypto/dashboard`);
            if (res.ok) {
                const data = await res.json();
                console.log('📊 Dashboard data received:', {
                    portfolio: data.portfolio,
                    tradesCount: data.recent_trades?.length || 0,
                    allTradesCount: data.all_trades?.length || 0,
                    openPositionsCount: data.open_positions?.length || 0
                });
                setPortfolio({ ...data.portfolio, rsi: data.rsi });
                setTrades(data.recent_trades || []);
                setAllTrades(data.all_trades || []); // Store full history for chart
                setOpenPositions(data.open_positions || []); // Store open positions
                setClosedPositions(data.closed_positions || []); // ✅ FIX: Store closed positions per P&L
                // ✅ FIX: Controlla se c'è ALMENO un bot attivo (non solo per currentSymbol)
                const anyActiveBot = data.active_bots?.find(b => b.strategy_name === 'RSI_Strategy' && b.is_active === 1);
                const bot = data.active_bots?.find(b => b.strategy_name === 'RSI_Strategy' && b.symbol === currentSymbol);
                // Se c'è almeno un bot attivo, mostra ACTIVE, altrimenti PAUSED
                setBotStatus({
                    active: anyActiveBot ? true : false,
                    strategy: bot?.strategy_name || 'RSI_Strategy',
                    currentSymbolBot: bot ? (bot.is_active === 1) : false
                });
                // Load bot parameters for backtesting
                if (data.bot_parameters) {
                    setBotParameters(data.bot_parameters);
                }
                // Load performance stats for Kelly Criterion
                if (data.performance_stats) {
                    console.log('📊 [KELLY] Performance stats ricevuti:', data.performance_stats);
                    setPerformanceStats(data.performance_stats);
                } else {
                    console.warn('⚠️ [KELLY] Performance stats non presenti nella risposta');
                    setPerformanceStats(null);
                }
            } else {
                console.error('❌ Dashboard fetch failed:', res.status, res.statusText);
            }
        } catch (error) {
            console.error("❌ Error fetching dashboard:", error);
        }
    };

    const fetchAvailableSymbols = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/symbols/available`);
            if (res.ok) {
                const data = await res.json();
                console.log('📊 Available symbols received:', data.symbols?.length || 0, 'symbols');
                setAvailableSymbols(data.symbols || []);
            } else {
                console.error('❌ Error fetching symbols:', res.status, res.statusText);
            }
        } catch (error) {
            console.error("❌ Error fetching available symbols:", error);
        }
    };

    const fetchActiveBots = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/bot/active`);
            if (res.ok) {
                const data = await res.json();
                setActiveBots(data.active_bots || []);
            }
        } catch (error) {
            console.error("❌ Error fetching active bots:", error);
        }
    };

    const handleUpdatePnL = async () => {
        try {
            await fetch(`${apiBase}/api/crypto/positions/update-pnl?symbol=bitcoin`);
            // Refresh positions after update
            const res = await fetch(`${apiBase}/api/crypto/positions?status=open`);
            if (res.ok) {
                const data = await res.json();
                setOpenPositions(data.positions || []);
            }
        } catch (error) {
            console.error("Error updating P&L:", error);
        }
    };

    const handleClosePosition = async (ticketId) => {
        try {
            // Pass current price to ensure correct closing price
            const res = await fetch(`${apiBase}/api/crypto/positions/close/${ticketId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    close_price: currentPrice,
                    symbol: 'bitcoin'
                })
            });
            if (res.ok) {
                // Refresh data
                fetchData();
            } else {
                const error = await res.json();
                alert(error.error || 'Errore nella chiusura della posizione');
            }
        } catch (error) {
            console.error("Error closing position:", error);
            alert('Errore nella chiusura della posizione');
        }
    };

    const handleResetPortfolio = async () => {
        const confirmMessage = `⚠️ ATTENZIONE: Reset completo del portfolio!\n\nQuesto cancellerà:\n- TUTTE le posizioni (aperte e chiuse)\n- TUTTI i trades (marker sul grafico e lista recenti)\n\nVuoi continuare?`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        // Chiedi l'importo iniziale
        const defaultBalance = '1000';
        const initialBalanceInput = window.prompt("Inserisci il saldo iniziale (USDT) per il nuovo portfolio:", defaultBalance);

        if (initialBalanceInput === null) return; // Annullato dall'utente

        const initialBalance = parseFloat(initialBalanceInput);
        if (isNaN(initialBalance) || initialBalance < 0) {
            alert("⚠️ Importo non valido. Inserisci un numero maggiore o uguale a 0.");
            return;
        }

        try {
            const res = await fetch(`${apiBase}/api/crypto/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initial_balance: initialBalance })
            });

            if (res.ok) {
                const result = await res.json();
                alert(result.message || 'Portfolio resettato completamente!');
                // Refresh data
                fetchData();
            } else {
                const error = await res.json();
                alert(error.error || 'Errore nel reset del portfolio');
            }
        } catch (error) {
            console.error("Error resetting portfolio:", error);
            alert('Errore nel reset del portfolio');
        }
    };

    const handleAddFunds = async (amount) => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/add-funds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseFloat(amount) })
            });

            if (res.ok) {
                const result = await res.json();
                alert(`✅ Fondi aggiunti con successo!\n\nImporto: $${amount} USDT\nNuovo saldo: $${result.new_balance.toFixed(2)} USDT`);
                // Refresh data
                fetchData();
                setShowAddFundsModal(false);
            } else {
                const error = await res.json();
                alert(error.error || 'Errore nell\'aggiunta dei fondi');
            }
        } catch (error) {
            console.error("Error adding funds:", error);
            alert('Errore nell\'aggiunta dei fondi');
        }
    };

    const fetchPrice = async () => {
        try {
            // Fetch real price for current symbol from Binance (same source as bot)
            const res = await fetch(`${apiBase}/api/crypto/price/${currentSymbol}?currency=usdt`);
            if (res.ok) {
                const data = await res.json();
                // Read price directly (USDT from Binance, same as bot uses)
                const price = parseFloat(data.price || data.data?.priceUsd || 0);
                if (price > 0) {
                    setCurrentPrice(price);
                    // NOTE: We don't add to priceData here - the chart uses OHLC data from /api/crypto/history
                }
            }
        } catch (error) {
            console.error('Error fetching price:', error);
            // Don't set mock price - keep using last known price
        }
    };

    const fetchHistory = async (interval = '15m') => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/history?interval=${interval}&symbol=${currentSymbol}`);
            if (res.ok) {
                const history = await res.json();
                setPriceData(history);
            } else {
                console.error('❌ History fetch failed:', res.status, res.statusText);
            }
        } catch (error) {
            console.error("❌ Error fetching history:", error);
        }
    };

    // Fetch history for ApexChart (15m di default, ma può cambiare)
    const [apexHistory, setApexHistory] = useState([]);
    const [apexInterval, setApexInterval] = useState('15m'); // Default 15m per corrispondenza
    const fetchApexHistory = async (interval = '15m') => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/history?interval=${interval}&symbol=${currentSymbol}`);
            if (res.ok) {
                const history = await res.json();
                setApexHistory(history);
            } else {
                console.error('❌ ApexChart history fetch failed:', res.status, res.statusText);
            }
        } catch (error) {
            console.error("❌ Error fetching ApexChart history:", error);
        }
    };

    useEffect(() => {
        fetchAvailableSymbols();
        fetchActiveBots();
        fetchHistory(); // Load history first (15m for TradingView)
        fetchApexHistory(apexInterval); // Load history for ApexChart
        fetchData();
        fetchPrice();

        // Update price frequently (every 1 second for real-time feel)
        const priceInterval = setInterval(() => {
            fetchPrice();
        }, 1000);

        // Update data (positions, trades) every 1.5 seconds for instant updates
        const dataInterval = setInterval(() => {
            fetchData();
            fetchActiveBots(); // Also update active bots
        }, 1500);

        // Update history (candles) more frequently (every 5 seconds) for real-time updates
        // ✅ FIX: Aggiornamento più frequente per vedere candele in tempo reale
        const historyInterval = setInterval(() => {
            fetchHistory();
            if (useApexChart) {
                fetchApexHistory(apexInterval); // Update data when using ApexChart
            }
        }, 5000); // Ridotto da 15s a 5s per aggiornamenti più frequenti

        return () => {
            clearInterval(priceInterval);
            clearInterval(dataInterval);
            clearInterval(historyInterval);
        };
    }, [currentSymbol]);

    // Add/remove crypto-standalone class to body
    useEffect(() => {
        document.body.classList.add('crypto-standalone');
        return () => {
            document.body.classList.remove('crypto-standalone');
        };
    }, []);

    // Fullscreen toggle function
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            });
        }
    };

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);


    const toggleBot = async (symbol = null) => {
        try {
            const targetSymbol = symbol || currentSymbol;
            const currentBot = activeBots.find(b => b.symbol === targetSymbol);
            const newStatus = currentBot ? !currentBot.is_active : true;

            console.log(`🤖 Toggling bot for ${targetSymbol}, new status: ${newStatus}`);

            const response = await fetch(`${apiBase}/api/crypto/bot/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy_name: 'RSI_Strategy',
                    symbol: targetSymbol,
                    is_active: newStatus
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error("❌ Error toggling bot:", errorData);
                alert(`Errore nell'attivazione del bot: ${errorData.error || response.statusText}`);
                return;
            }

            const result = await response.json();
            console.log('✅ Bot toggle result:', result);

            // Update local state
            if (targetSymbol === currentSymbol) {
                setBotStatus(prev => ({ ...prev, active: newStatus }));
            }

            // Refresh active bots list
            await fetchActiveBots();

            // Show success message
            if (newStatus) {
                const symbolInfo = availableSymbols.find(s => s.symbol === targetSymbol);
                alert(`Bot attivato per ${symbolInfo?.display || targetSymbol.toUpperCase()}`);
            } else {
                const symbolInfo = availableSymbols.find(s => s.symbol === targetSymbol);
                alert(`Bot disattivato per ${symbolInfo?.display || targetSymbol.toUpperCase()}`);
            }
        } catch (error) {
            console.error("❌ Error toggling bot:", error);
            alert(`Errore nell'attivazione del bot: ${error.message || 'Errore di connessione'}`);
        }
    };

    // Calculate total balance (USDT + All Crypto values)
    const [allSymbolPrices, setAllSymbolPrices] = useState({});

    // Fetch prices for all symbols in holdings AND open positions
    useEffect(() => {
        const fetchAllPrices = async () => {
            const holdings = portfolio.holdings || {};
            const holdingsSymbols = Object.keys(holdings).filter(s => holdings[s] > 0);

            // ✅ FIX: Recupera prezzi anche per tutti i simboli delle posizioni aperte
            const openPositionSymbols = openPositions
                .filter(pos => pos.status === 'open')
                .map(pos => pos.symbol)
                .filter((symbol, index, self) => self.indexOf(symbol) === index); // Remove duplicates

            // Combina tutti i simboli unici
            const allSymbols = [...new Set([...holdingsSymbols, ...openPositionSymbols])];
            const prices = {};

            for (const symbol of allSymbols) {
                try {
                    const res = await fetch(`${apiBase}/api/crypto/price/${symbol}?currency=usdt`);
                    if (res.ok) {
                        const data = await res.json();
                        prices[symbol] = parseFloat(data.price || 0);
                    }
                } catch (error) {
                    console.error(`Error fetching price for ${symbol}:`, error);
                }
            }

            setAllSymbolPrices(prices);
        };

        // Aggiorna prezzi quando cambiano holdings o posizioni aperte
        fetchAllPrices();
    }, [portfolio.holdings, openPositions, apiBase]);

    // Calculate total balance (USDT + All Crypto values - Short Liabilities)
    // ✅ FIX: Total Balance = Capitale Disponibile (cash) = balance_usd
    // Se hai $1000 USDT totali e investi $500, il Total Balance mostra $500 (capitale disponibile)
    // Il valore delle posizioni è già "bloccato" e non è disponibile come cash
    // ✅ FIX: Use ONLY open positions effectively ignoring 'portfolio.holdings' which might be corrupted
    const holdings = portfolio.holdings || {}; // Restore this for fallback logic

    // ✅ FIX CRITICO: Filtra STRICTO solo posizioni aperte PRIMA di usarle (evita ReferenceError)
    const validOpenPositions = (openPositions || []).filter(pos => {
        // Validazione STRICTA: deve essere esattamente 'open'
        if (!pos || pos.status !== 'open') {
            return false;
        }
        // Validazione: deve avere ticket_id valido
        if (!pos.ticket_id) {
            return false;
        }
        return true;
    });

    // ✅ FIX CRITICO: Dichiarare tutte le costanti PRIMA del loro utilizzo
    const MAX_REASONABLE_BALANCE = 10000000; // 10 milioni USDT max (soglia di sicurezza)
    const MIN_REASONABLE_BALANCE = -1000000; // -1 milione min (per permettere debiti)
    const MAX_REASONABLE_VOLUME = 1000000; // 1 milione di unità max
    const MAX_REASONABLE_PRICE = 1000000; // 1 milione USDT max per unità

    let totalLongValue = 0;
    let totalShortLiability = 0;

    // ✅ FIX: Usa validOpenPositions invece di openPositions per coerenza
    if (validOpenPositions && validOpenPositions.length > 0) {
        validOpenPositions.forEach(pos => {
            // ✅ FIX: Validazione aggiuntiva
            if (pos.status !== 'open') {
                return; // Skip non-open positions
            }

            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;

            // ✅ FIX: Valida remainingVolume
            if (remainingVolume <= 0) {
                return; // Skip positions with no remaining volume
            }

            if (remainingVolume > MAX_REASONABLE_VOLUME) {
                console.error(`🚨 [BALANCE] Volume anomale per posizione ${pos.ticket_id}: ${remainingVolume}. Skipping.`);
                return;
            }

            // Use live price if available, otherwise try currentSymbol price or position's last known price
            let price = allSymbolPrices[pos.symbol] || (pos.symbol === currentSymbol ? currentPrice : parseFloat(pos.current_price) || 0);

            // ✅ FIX CRITICO: Valida che il prezzo sia ragionevole
            if (price > MAX_REASONABLE_PRICE) {
                console.error(`🚨 [BALANCE] Prezzo anomale per ${pos.symbol}: $${price.toLocaleString()} USDT. Usando entry_price come fallback.`);
                // Usa entry_price come fallback se il prezzo è anomale
                const fallbackPrice = parseFloat(pos.entry_price) || 0;
                if (fallbackPrice > 0 && fallbackPrice <= MAX_REASONABLE_PRICE) {
                    price = fallbackPrice;
                } else {
                    console.error(`🚨 [BALANCE] Anche entry_price è anomale (${fallbackPrice}). Skipping posizione ${pos.ticket_id}.`);
                    return;
                }
            }

            if (pos.type === 'buy' && pos.status === 'open') {
                const longValue = remainingVolume * price;
                // ✅ FIX: Valida che il valore calcolato sia ragionevole
                if (longValue > MAX_REASONABLE_BALANCE) {
                    console.error(`🚨 [BALANCE] Valore LONG anomale per ${pos.ticket_id}: $${longValue.toLocaleString()} USDT. Skipping.`);
                    return;
                }
                totalLongValue += longValue;
            } else if (pos.type === 'sell' && pos.status === 'open') {
                // ✅ FIX: Per SHORT, il debito è FISSO all'entry price (quanto crypto dobbiamo restituire)
                // NON usiamo current_price perché il debito non cambia - solo il P&L cambia
                const entryPrice = parseFloat(pos.entry_price) || 0;

                // ✅ FIX: Valida entry_price
                if (entryPrice > MAX_REASONABLE_PRICE) {
                    console.error(`🚨 [BALANCE] Entry price anomale per SHORT ${pos.ticket_id}: $${entryPrice.toLocaleString()} USDT. Skipping.`);
                    return;
                }

                if (entryPrice > 0) {
                    const shortLiability = remainingVolume * entryPrice;
                    // ✅ FIX: Valida che il valore calcolato sia ragionevole
                    if (shortLiability > MAX_REASONABLE_BALANCE) {
                        console.error(`🚨 [BALANCE] Valore SHORT anomale per ${pos.ticket_id}: $${shortLiability.toLocaleString()} USDT. Skipping.`);
                        return;
                    }
                    totalShortLiability += shortLiability;
                }
            }
        });
    }

    // ✅ FIX CRITICO: Calcolo corretto Total Balance
    // LONG: Valore attuale delle crypto possedute (current_price * volume)
    // SHORT: Debito da ripagare (entry_price * volume) - questo è quanto dobbiamo restituire
    // Equity = Cash + Long Value - Short Debt

    // Per SHORT, il debito è FISSO all'entry price (quanto abbiamo "preso in prestito")
    // NON cambia con il prezzo corrente - quello influenza solo il P&L

    // ✅ FIX CRITICO: Valida portfolio.balance_usd per evitare valori assurdi
    // ✅ NOTA: MAX_REASONABLE_BALANCE e MIN_REASONABLE_BALANCE sono già dichiarati sopra
    const rawBalance = parseFloat(portfolio.balance_usd) || 0;

    // ✅ DEBUG CRITICO: Log valori PRIMA della validazione per capire da dove viene il problema
    console.log('🔍 [BALANCE DEBUG - RAW VALUES]', {
        'portfolio.balance_usd (raw)': portfolio.balance_usd,
        'rawBalance (parsed)': rawBalance,
        'totalLongValue': totalLongValue,
        'totalShortLiability': totalShortLiability,
        'openPositions count': validOpenPositions.length,
        'allSymbolPrices keys': Object.keys(allSymbolPrices),
        'currentPrice': currentPrice,
        'currentSymbol': currentSymbol
    });

    // ✅ DEBUG: Log dettagli per ogni posizione aperta
    if (validOpenPositions.length > 0) {
        console.log('🔍 [BALANCE DEBUG - OPEN POSITIONS]', validOpenPositions.map(pos => ({
            ticket_id: pos.ticket_id,
            symbol: pos.symbol,
            type: pos.type,
            volume: pos.volume,
            volume_closed: pos.volume_closed,
            entry_price: pos.entry_price,
            current_price: pos.current_price,
            'price from allSymbolPrices': allSymbolPrices[pos.symbol],
            'calculated remainingVolume': (parseFloat(pos.volume) || 0) - (parseFloat(pos.volume_closed) || 0),
            'calculated longValue (if buy)': pos.type === 'buy' ? ((parseFloat(pos.volume) || 0) - (parseFloat(pos.volume_closed) || 0)) * (allSymbolPrices[pos.symbol] || parseFloat(pos.current_price) || 0) : 0,
            'calculated shortLiability (if sell)': pos.type === 'sell' ? ((parseFloat(pos.volume) || 0) - (parseFloat(pos.volume_closed) || 0)) * (parseFloat(pos.entry_price) || 0) : 0
        })));
    }

    let validatedBalance = rawBalance;
    if (rawBalance > MAX_REASONABLE_BALANCE || rawBalance < MIN_REASONABLE_BALANCE) {
        console.error(`🚨 [BALANCE] Valore anomale di balance_usd: $${rawBalance.toLocaleString()} USDT. Usando fallback: $10000 USDT`);
        validatedBalance = 10000; // Fallback a 10k USDT
    }

    // ✅ DEBUG: Log valori DOPO la validazione
    console.log('🔍 [BALANCE DEBUG - VALIDATED VALUES]', {
        'validatedBalance (available cash)': validatedBalance,
        'totalLongValue (invested in LONG)': totalLongValue,
        'totalShortLiability (SHORT debt)': totalShortLiability,
        'totalBalance (available cash only)': validatedBalance,
        'portfolio equity (cash + positions)': validatedBalance + totalLongValue - totalShortLiability
    });

    // ✅ FIX: Total Balance = Capitale Disponibile (cash) = balance_usd
    // Se hai $1000 USDT totali e investi $500, il Total Balance deve mostrare $500 (capitale disponibile)
    // Il valore delle posizioni (totalLongValue - totalShortLiability) è già "bloccato" e non è disponibile
    const totalBalance = validatedBalance; // Solo capitale disponibile, non equity totale

    // ✅ FIX CRITICO: Usa direttamente profit_loss calcolato dal backend
    // ✅ FIX: Validazione STRICTA - solo posizioni con status === 'open' e dati validi
    // ✅ NOTA: validOpenPositions è già dichiarato sopra, non dichiararlo di nuovo!
    let pnlValue = 0;
    let pnlPercent = 0;
    let totalInvestedValue = 0;
    let avgPrice = 0;

    if (validOpenPositions.length > 0) {
        // Calcolo SEMPLICE: somma i profit_loss già calcolati dal backend
        // Questo evita problemi con prezzi sbagliati o mancanti
        validOpenPositions.forEach(pos => {
            // ✅ FIX: Validazione aggiuntiva per sicurezza
            if (pos.status !== 'open') {
                console.warn(`⚠️ [P&L] Skipping position ${pos.ticket_id} with invalid status: ${pos.status}`);
                return;
            }

            // Usa direttamente profit_loss dal backend (già calcolato correttamente)
            const positionPnL = parseFloat(pos.profit_loss) || 0;

            // ✅ FIX: Valida valori anomali (evita errori di calcolo)
            const MAX_REASONABLE_PNL = 1000000; // 1 milione USDT max
            if (Math.abs(positionPnL) > MAX_REASONABLE_PNL) {
                console.warn(`⚠️ [P&L] Skipping anomalous profit_loss for position ${pos.ticket_id}: $${positionPnL.toFixed(2)} USDT`);
                return;
            }

            pnlValue += positionPnL;

            // Calcola invested value per la percentuale
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;

            if (remainingVolume > 0 && entryPrice > 0) {
                const invested = remainingVolume * entryPrice;
                totalInvestedValue += invested;
            }
        });

        // Calcola percentuale P&L
        pnlPercent = totalInvestedValue > 0 ? (pnlValue / totalInvestedValue) * 100 : 0;

        // Calculate average price (weighted average of all entry prices)
        const totalVolume = validOpenPositions.reduce((sum, pos) => {
            if (pos.status !== 'open') return sum;
            const vol = parseFloat(pos.volume) || 0;
            const volClosed = parseFloat(pos.volume_closed) || 0;
            return sum + (vol - volClosed);
        }, 0);

        avgPrice = totalInvestedValue > 0 && totalVolume > 0 ? totalInvestedValue / totalVolume : 0;
    } else {
        // Fallback: use old calculation if no open positions (for backward compatibility)
        const currentHoldings = holdings[currentSymbol] || 0;
        avgPrice = portfolio.avg_buy_price || 0;
        const investedValue = currentHoldings * avgPrice;
        const currentValue = currentHoldings * currentPrice;
        pnlValue = currentValue - investedValue;
        pnlPercent = investedValue > 0 ? (pnlValue / investedValue) * 100 : 0;
    }

    // ✅ DEBUG: Calcolo alternativo per verificare correttezza
    // Formula alternativa: Initial Balance + Realized P&L + Unrealized P&L
    // (dove Unrealized P&L è già incluso in totalLongValue - totalShortLiability)
    // Nota: Questo è solo per debug, il calcolo principale è quello sopra
    const realizedPnL = closedPositions?.reduce((sum, pos) => {
        const pnl = parseFloat(pos.profit_loss) || 0;
        return sum + pnl;
    }, 0) || 0;

    const unrealizedPnL = pnlValue; // Ora pnlValue è già calcolato sopra

    // ✅ DEBUG: Log per verificare calcolo (solo in console, non visibile all'utente)
    if (Math.abs(totalBalance - (validatedBalance + totalLongValue - totalShortLiability)) > 0.01) {
        console.warn('⚠️ [BALANCE] Discrepanza nel calcolo totalBalance');
    }

    // ✅ DEBUG: Log componenti balance (solo se ci sono valori anomali)
    if (Math.abs(validatedBalance) > 100000 || Math.abs(totalLongValue) > 100000 || Math.abs(totalShortLiability) > 100000) {
        console.log('📊 [BALANCE DEBUG]', {
            validatedBalance: validatedBalance.toFixed(2),
            totalLongValue: totalLongValue.toFixed(2),
            totalShortLiability: totalShortLiability.toFixed(2),
            totalBalance: totalBalance.toFixed(2),
            realizedPnL: realizedPnL.toFixed(2),
            unrealizedPnL: unrealizedPnL.toFixed(2),
            openPositionsCount: validOpenPositions.length
        });
    }

    // TradingView Chart doesn't need chartData preparation anymore

    return (
        <div className="crypto-dashboard">
            <div className="crypto-header" style={{ position: 'relative' }}>
                {/* ✅ Logo LogiKa in alto a sinistra (PNG) */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    marginLeft: '-0.5rem',
                    paddingTop: '0.5rem'
                }}>
                    <img
                        src="/logo-logika.png"
                        alt="Logika"
                        style={{
                            height: '80px',
                            width: 'auto',
                            display: 'block',
                            maxWidth: '300px',
                            objectFit: 'contain'
                        }}
                        onError={(e) => {
                            // Fallback se l'immagine non viene trovata
                            console.warn('Logo Logika non trovato in /logo-logika.png');
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af' }}>
                    <button
                        onClick={toggleFullscreen}
                        style={{
                            padding: '6px 10px',
                            background: '#374151',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.85rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#4b5563';
                            e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#374151';
                            e.currentTarget.style.color = '#9ca3af';
                        }}
                        title={isFullscreen ? "Esci da Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        {isFullscreen ? "Esci" : "Fullscreen"}
                    </button>
                    <Wallet size={18} /> Demo Account
                </div>
            </div>

            {/* TOP STATS GRID - 4 COLUMNS (separato Impostazioni) */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr 0.6fr', gap: '20px', marginBottom: '20px' }}>
                <div className="balance-card" style={{ marginBottom: 0 }}>
                    <div className="balance-label">Total Balance (Available Cash)</div>
                    <div className="balance-amount">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</div>
                    <div className="balance-change change-positive">
                        <ArrowUpRight size={16} /> +2.4% Today
                    </div>
                </div>

                <div className="balance-card" style={{ marginBottom: 0, background: 'linear-gradient(145deg, #1c1c1e, #2a2a2d)' }}>
                    <div className="balance-label">Open Position P&L</div>
                    <div className={`balance-amount ${pnlValue >= 0 ? 'text-green-500' : 'text-red-500'}`} style={{ fontSize: '2.5rem' }}>
                        {pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)} USDT
                    </div>
                    <div style={{ color: pnlValue >= 0 ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                        {pnlValue >= 0 ? '▲' : '▼'} {pnlPercent.toFixed(2)}%
                        <span style={{ color: '#9ca3af', marginLeft: '10px', fontSize: '0.9rem', fontWeight: 'normal' }}>
                            (Avg: ${avgPrice.toFixed(2)} USDT)
                        </span>
                    </div>
                </div>

                {/* Compact Bot Control */}
                <div className="balance-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="balance-label">AI Bot Status</div>
                        <Power size={20} className={botStatus.active ? "text-green-500" : "text-gray-500"} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                        <div className={`bot-indicator ${botStatus.active ? 'bot-active' : 'bot-inactive'}`} style={{ width: '40px', height: '40px' }}>
                            <Activity size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', color: botStatus.active ? '#4ade80' : '#9ca3af' }}>
                                {botStatus.active ? "Active" : "Paused"}
                            </div>
                            {!botStatus.active && (
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }} title="Bot in pausa: non apre nuove posizioni, ma continua ad aggiornare dati e gestire posizioni esistenti">
                                    (aggiorna dati)
                                </div>
                            )}
                            {portfolio.rsi !== null && (
                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>RSI: {portfolio.rsi.toFixed(2)}</div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexDirection: 'column' }}>
                        {/* ✅ Toggle Bot Button */}
                        <button
                            onClick={async () => {
                                try {
                                    const newStatus = !botStatus.active;

                                    console.log(`🤖 Toggling ALL bots to ${newStatus ? 'ACTIVE' : 'PAUSED'}`);

                                    const response = await fetch(`${apiBase}/api/crypto/bot/toggle-all`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            is_active: newStatus
                                        })
                                    });

                                    if (!response.ok) {
                                        const errorData = await response.json();
                                        throw new Error(errorData.error || 'Errore nel toggle bot');
                                    }

                                    const data = await response.json();
                                    console.log(`✅ ${data.message}`);

                                    // Aggiorna stato locale
                                    setBotStatus(prev => ({ ...prev, active: newStatus }));

                                    // Mostra messaggio
                                    alert(data.message);

                                    // Ricarica dashboard per aggiornare dati
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 1000);

                                } catch (error) {
                                    console.error('Errore toggle bot:', error);
                                    alert(`Errore: ${error.message}`);
                                }
                            }}
                            style={{
                                width: '100%',
                                padding: '10px',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                background: botStatus.active ? '#ef4444' : '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            title={botStatus.active ? 'Disattiva Bot (le posizioni esistenti continueranno ad essere gestite)' : 'Attiva Bot (il bot inizierà ad aprire nuove posizioni)'}
                        >
                            <Power size={18} />
                            {botStatus.active ? 'Disattiva Bot' : 'Attiva Bot'}
                        </button>

                        {/* Settings Button */}
                        <button
                            className="toggle-btn"
                            onClick={() => setShowBotSettings(true)}
                            style={{ width: '100%', padding: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            title="Configurazione Bot"
                        >
                            <Settings size={18} />
                            <span>Impostazioni</span>
                        </button>
                    </div>
                </div>

                {/* Impostazioni Generali - Quadrato separato a destra */}
                <div className="balance-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="balance-label">Impostazioni</div>
                        <Settings size={20} className="text-blue-500" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <button
                            className="toggle-btn"
                            onClick={() => setShowGeneralSettings(true)}
                            style={{ width: '100%', padding: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            title="Impostazioni Generali"
                        >
                            <Settings size={18} />
                            <span>Impostazioni</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ADVANCED STATISTICS PANEL */}
            <StatisticsPanel apiBase={apiBase} />

            {/* MAIN CRYPTO GRID - CHART & OPEN POSITIONS */}
            <div className="crypto-grid">
                <div className="crypto-card">
                    <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <Activity size={20} className="text-blue-500" />
                            <select
                                value={currentSymbol}
                                onChange={(e) => {
                                    setCurrentSymbol(e.target.value);
                                    // Reset price data when changing symbol
                                    setPriceData([]);
                                    setApexHistory([]);
                                }}
                                style={{
                                    background: '#1f2937',
                                    color: '#fff',
                                    border: '1px solid #374151',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    minWidth: '150px'
                                }}
                            >
                                {availableSymbols.length > 0 ? (
                                    availableSymbols.map(s => (
                                        <option key={s.symbol} value={s.symbol}>
                                            {s.display}
                                        </option>
                                    ))
                                ) : (
                                    <option value="bitcoin">Loading symbols...</option>
                                )}
                            </select>
                            <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                                {availableSymbols.find(s => s.symbol === currentSymbol)?.display || 'Live Market'}
                            </span>
                        </div>
                        <button
                            onClick={() => setUseApexChart(!useApexChart)}
                            style={{
                                padding: '6px 12px',
                                background: useApexChart ? '#4ade80' : '#3f3f46',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '500',
                                transition: 'all 0.2s'
                            }}
                            title={useApexChart ? 'Passa a TradingView (con tool di disegno)' : 'Passa ad ApexChart (con marker precisi e aggiornamenti real-time)'}
                        >
                            {useApexChart ? '📊 TradingView' : '📍 ApexChart'}
                        </button>
                    </div>
                    {useApexChart ? (
                        <ApexChart
                            symbol={(() => {
                                const found = availableSymbols.find(s => s.symbol === currentSymbol);
                                if (found) return found.pair;

                                // ✅ FIX: Auto-generate pair if not found
                                const upperSymbol = currentSymbol.toUpperCase().replace(/_/g, '');
                                return `${upperSymbol}USDT`;
                            })()}
                            trades={(allTrades || []).filter(t => t.symbol === currentSymbol).map(trade => ({
                                type: trade.type,
                                timestamp: trade.timestamp,
                                price: typeof trade.price === 'number' ? trade.price : parseFloat(trade.price),
                                amount: typeof trade.amount === 'number' ? trade.amount : parseFloat(trade.amount),
                                strategy: trade.strategy || 'Bot',
                                ticket_id: trade.ticket_id || null
                            }))}
                            openPositions={(openPositions || []).filter(p => p.symbol === currentSymbol)}
                            currentPrice={currentPrice}
                            priceHistory={apexHistory.length > 0 ? apexHistory : priceData || []}
                            currentInterval={apexInterval}
                            onIntervalChange={(newInterval) => {
                                setApexInterval(newInterval);
                                fetchApexHistory(newInterval);
                            }}
                        />
                    ) : (
                        <TradingViewChart
                            symbol={(() => {
                                const found = availableSymbols.find(s => s.symbol === currentSymbol);
                                if (found) return found.pair;

                                // ✅ FIX: Auto-generate pair if not found
                                // Prova prima USDT, poi EUR come fallback
                                const upperSymbol = currentSymbol.toUpperCase().replace(/_/g, '');
                                return `${upperSymbol}USDT`;
                            })()}
                            trades={(allTrades || []).filter(t => t.symbol === currentSymbol).map(trade => ({
                                type: trade.type,
                                timestamp: trade.timestamp,
                                price: typeof trade.price === 'number' ? trade.price : parseFloat(trade.price),
                                amount: typeof trade.amount === 'number' ? trade.amount : parseFloat(trade.amount),
                                strategy: trade.strategy || 'Bot',
                                ticket_id: trade.ticket_id || null
                            }))}
                            openPositions={(openPositions || []).filter(p => p.symbol === currentSymbol)}
                            currentPrice={currentPrice}
                            priceHistory={priceData || []}
                        />
                    )}
                </div>

                {/* MT5 Style Open Positions */}
                <div className="crypto-card" style={{ gridColumn: 'span 2' }}>
                    <OpenPositions
                        positions={openPositions}
                        currentPrice={currentPrice}
                        onClosePosition={handleClosePosition}
                        onUpdatePnL={handleUpdatePnL}
                        availableSymbols={availableSymbols}
                        onSelectSymbol={setCurrentSymbol}
                        apiBase={apiBase}
                    />
                </div>
            </div>

            {/* MARKET SCANNER */}
            <MarketScanner
                apiBase={apiBase}
                onSelectSymbol={(symbol) => {
                    setCurrentSymbol(symbol);
                    setPriceData([]);
                    setApexHistory([]);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
            />


            {/* Kelly Criterion rimosso - ora usiamo Fixed Position Sizing */}

            {/* RECENT TRADES HISTORY */}
            <div className="crypto-card" style={{ marginTop: '20px' }}>
                <div className="card-title">
                    <RefreshCw size={20} className="text-gray-400" />
                    Closed Positions History
                </div>
                <div className="trades-list">
                    {closedPositions.length === 0 ? (
                        <div style={{ color: '#555', textAlign: 'center', padding: '20px' }}>Nessuna posizione chiusa ancora</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ color: '#6b7280', borderBottom: '1px solid #374151' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Time</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Symbol</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Price</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>P&L</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closedPositions.map((pos, i) => {
                                    const isBuy = pos.type === 'buy';
                                    const volume = parseFloat(pos.volume) || 0;
                                    const volumeClosed = parseFloat(pos.volume_closed) || 0;
                                    const remainingVolume = volume - volumeClosed;
                                    const entryPrice = parseFloat(pos.entry_price) || 0;
                                    let closePrice = parseFloat(pos.current_price) || 0;
                                    const totalValue = remainingVolume * closePrice;
                                    let pnl = parseFloat(pos.profit_loss) || 0;
                                    const closedAt = pos.closed_at ? new Date(pos.closed_at) : null;

                                    // ✅ FIX CRITICO: Valida e ricalcola P&L se anomale
                                    const MAX_REASONABLE_PNL = 1000000; // 1 milione USDT max
                                    const MAX_REASONABLE_PRICE = 1000000; // 1 milione USDT max

                                    // ✅ FIX: Verifica anche se il prezzo è completamente fuori range (es. $77246 per SAND)
                                    // Se entry_price è ragionevole (es. $0.12) ma closePrice è assurdo (es. $77246),
                                    // il P&L sarà assurdo anche se non supera MAX_REASONABLE_PNL in valore assoluto
                                    const priceRatio = entryPrice > 0 ? closePrice / entryPrice : 0;
                                    const isPriceAnomalous = priceRatio > 100 || (priceRatio < 0.01 && priceRatio > 0);

                                    // Se P&L o prezzo sono anomali, ricalcola
                                    if (Math.abs(pnl) > MAX_REASONABLE_PNL ||
                                        closePrice > MAX_REASONABLE_PRICE ||
                                        entryPrice > MAX_REASONABLE_PRICE ||
                                        isPriceAnomalous) {

                                        console.warn(`⚠️ [FRONTEND] P&L anomale per posizione ${pos.ticket_id}:`, {
                                            pnl: pnl,
                                            entryPrice: entryPrice,
                                            closePrice: closePrice,
                                            volume: remainingVolume,
                                            priceRatio: priceRatio,
                                            isPriceAnomalous: isPriceAnomalous
                                        });

                                        // Ricalcola P&L con logica corretta
                                        if (entryPrice > 0 && entryPrice <= MAX_REASONABLE_PRICE &&
                                            remainingVolume > 0) {

                                            // Se il prezzo di chiusura è anomale, usa entry price (P&L = 0)
                                            if (closePrice > MAX_REASONABLE_PRICE || closePrice <= 0 || isPriceAnomalous) {
                                                // ✅ FIX: Per SAND, se entry è $0.12 e close è $77246, usa entry
                                                closePrice = entryPrice;
                                                console.warn(`   → Prezzo chiusura anomale (ratio: ${priceRatio.toFixed(2)}x), uso entry price: $${entryPrice.toFixed(6)} USDT`);
                                            }

                                            // Ricalcola P&L
                                            if (pos.type === 'buy') {
                                                // LONG: profit quando prezzo sale
                                                pnl = (closePrice - entryPrice) * remainingVolume;
                                            } else {
                                                // SHORT: profit quando prezzo scende
                                                pnl = (entryPrice - closePrice) * remainingVolume;
                                            }

                                            console.log(`   → P&L ricalcolato: $${pnl.toFixed(2)} USDT (entry: $${entryPrice.toFixed(6)}, close: $${closePrice.toFixed(6)}, vol: ${remainingVolume.toFixed(4)})`);
                                        } else {
                                            // Se non possiamo ricalcolare, mostra 0
                                            pnl = 0;
                                            console.warn(`   → Dati insufficienti, P&L impostato a 0`);
                                        }
                                    }

                                    // Get symbol display name
                                    const symbolDisplay = pos.symbol ? (pos.symbol === 'bitcoin' ? 'BTC/USDT' :
                                        pos.symbol === 'bitcoin_usdt' ? 'BTC/USDT' :
                                            pos.symbol === 'solana' ? 'SOL/USDT' :
                                                pos.symbol === 'solana_eur' ? 'SOL/USDT' :
                                                    pos.symbol.toUpperCase().replace('_', '/').replace('EUR', 'USDT')) : '-';

                                    // ✅ FIX: Formato unificato P&L: sempre +$X.XX o -$X.XX USDT (segno prima del simbolo)
                                    const displayPnl = (
                                        <span style={{ color: pnl >= 0 ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>
                                            {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)} USDT
                                        </span>
                                    );

                                    return (
                                        <tr key={pos.ticket_id || i} style={{ borderBottom: '1px solid #1f2937' }}>
                                            <td style={{ padding: '10px', color: '#9ca3af' }}>
                                                {closedAt ? closedAt.toLocaleTimeString() : 'N/A'}
                                            </td>
                                            <td style={{ padding: '10px', color: '#e5e7eb', fontWeight: '500' }}>
                                                {symbolDisplay}
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{
                                                    color: isBuy ? '#4ade80' : '#ef4444',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {pos.type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', color: '#e5e7eb' }}>
                                                ${closePrice > 1000000 ? entryPrice.toFixed(2) : closePrice.toFixed(2)} USDT
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', color: '#e5e7eb' }}>
                                                {volume.toFixed(4)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', color: '#9ca3af' }}>
                                                ${totalValue.toFixed(2)} USDT
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                {displayPnl}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                {pos.signal_details ? (
                                                    <button
                                                        onClick={() => {
                                                            try {
                                                                const signalData = typeof pos.signal_details === 'string'
                                                                    ? JSON.parse(pos.signal_details)
                                                                    : pos.signal_details;

                                                                const details = [
                                                                    `📊 SIGNAL DETAILS`,
                                                                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                                                                    `Direction: ${signalData.direction || 'N/A'}`,
                                                                    `Strength: ${signalData.strength || 0}/100`,
                                                                    `Confirmations: ${signalData.confirmations || 0}`,
                                                                    ``,
                                                                    `📋 REASONS:`,
                                                                    ...(signalData.reasons || []).map((r, i) => `${i + 1}. ${r}`),
                                                                    ``,
                                                                    `📊 INDICATORS:`,
                                                                    `  RSI: ${signalData.indicators?.rsi?.toFixed(2) || 'N/A'}`,
                                                                    `  Trend: ${signalData.indicators?.trend || 'N/A'}`
                                                                ].join('\n');
                                                                alert(details);
                                                            } catch (err) {
                                                                alert('Dettagli non disponibili');
                                                            }
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            border: '1px solid #4b5563',
                                                            color: '#9ca3af',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.background = '#374151'}
                                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                    >
                                                        Info
                                                    </button>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Bot Settings Modal */}
            <BotSettings
                isOpen={showBotSettings}
                onClose={() => setShowBotSettings(false)}
                apiBase={apiBase}
            />

            {/* General Settings Modal */}
            <GeneralSettings
                isOpen={showGeneralSettings}
                onClose={() => setShowGeneralSettings(false)}
                onResetPortfolio={handleResetPortfolio}
                onAddFunds={() => {
                    setShowGeneralSettings(false);
                    setShowAddFundsModal(true);
                }}
            />


            {/* Add Funds Modal */}
            {showAddFundsModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #1f2937, #111827)',
                        borderRadius: '16px',
                        padding: '30px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                        border: '1px solid #374151'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <DollarSign size={24} className="text-green-500" />
                                Aggiungi Fondi
                            </h2>
                            <button
                                onClick={() => setShowAddFundsModal(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#9ca3af',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    padding: '0',
                                    width: '30px',
                                    height: '30px'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ color: '#9ca3af', marginBottom: '20px', fontSize: '0.9rem' }}>
                            Simula un deposito di fondi nel tuo portfolio. L'importo verrà aggiunto al saldo attuale.
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ color: '#e5e7eb', fontSize: '0.9rem', display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                Importo da aggiungere (USDT)
                            </label>
                            <input
                                type="number"
                                id="addFundsAmount"
                                min="1"
                                step="0.01"
                                placeholder="Inserisci importo..."
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#111827',
                                    border: '1px solid #374151',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold'
                                }}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        const amount = document.getElementById('addFundsAmount').value;
                                        if (amount && parseFloat(amount) > 0) {
                                            handleAddFunds(amount);
                                        }
                                    }
                                }}
                            />
                        </div>

                        {/* Quick Amount Buttons */}
                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '10px' }}>Importi rapidi:</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                {[50, 100, 250, 500].map(amount => (
                                    <button
                                        key={amount}
                                        onClick={() => {
                                            document.getElementById('addFundsAmount').value = amount;
                                        }}
                                        style={{
                                            padding: '10px',
                                            background: '#374151',
                                            border: '1px solid #4b5563',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: '500',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = '#4b5563';
                                            e.target.style.borderColor = '#6366f1';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = '#374151';
                                            e.target.style.borderColor = '#4b5563';
                                        }}
                                    >
                                        ${amount} USDT
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowAddFundsModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#374151',
                                    border: '1px solid #4b5563',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: '500'
                                }}
                            >
                                Annulla
                            </button>
                            <button
                                onClick={() => {
                                    const amount = document.getElementById('addFundsAmount').value;
                                    if (!amount || parseFloat(amount) <= 0) {
                                        alert('⚠️ Inserisci un importo valido maggiore di 0');
                                        return;
                                    }
                                    handleAddFunds(amount);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                Conferma Deposito
                            </button>
                        </div>

                        <div style={{ marginTop: '20px', padding: '12px', background: '#1f2937', borderRadius: '8px', border: '1px solid #374151' }}>
                            <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '6px' }}>
                                💡 <strong>Nota:</strong> Questa è una simulazione
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                                I fondi aggiunti sono virtuali e servono solo per testare la strategia di trading.
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Real-time Notifications */}
            <div className="crypto-notifications-container">
                {notifications.map(notification => (
                    <CryptoNotification
                        key={notification.id}
                        notification={notification}
                        onClose={() => removeNotification(notification.id)}
                    />
                ))}
            </div>
        </div>
    );
};

export default CryptoDashboard;
