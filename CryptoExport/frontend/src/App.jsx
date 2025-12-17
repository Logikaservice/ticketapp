import React, { useState, useEffect, useRef } from 'react';
import CryptoDashboard from './components/CryptoDashboard/CryptoDashboard';
import './index.css';

export default function App() {
  // ✅ Stati necessari per auth e login
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // Controlla token al mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    if (token && user) {
      setIsLoggedIn(true);
      setCurrentUser(JSON.parse(user));
    }
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
      const response = await fetch(`${apiBase}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        setIsLoggedIn(true);
        setCurrentUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ✅ Dopo il login, mostra CryptoDashboard completo originale
  if (isLoggedIn) {
    return (
      <CryptoDashboard 
        getAuthHeader={getAuthHeader}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  // ✅ Login screen (il resto del codice sotto)
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-teal-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold">Crypto Bot Dashboard</h1>
          <p className="text-gray-600 mt-2">Accedi per gestire i tuoi bot di trading</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin(loginData.email, loginData.password);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="email@example.com"
              required
            />
        </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
              required
            />
      </div>

          <button
            type="submit"
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
          >
            Accedi
          </button>
        </form>
      </div>
    </div>
  );
}

/* CODICE VECCHIO RIMOSSO - ORA USA CRYPTODASHBOARD COMPLETO
  // Vecchio codice bot-analysis inline e dashboard semplificato rimosso
  const urlParams = new URLSearchParams(window.location.search);
  const isBotAnalysis_OLD = urlParams.get('page') === 'bot-analysis';

  if (isBotAnalysis_OLD) {
    const symbol = urlParams.get('symbol') || 'bitcoin';
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      const fetchData = async () => {
        try {
          const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
          const url = `${apiBase}/api/crypto/bot-analysis?symbol=${symbol}&_t=${Date.now()}`;
          const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          if (response.ok) {
            const jsonData = await response.json();
            setData(jsonData);
          }
        } catch (err) {
          console.error('Errore fetch:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }, [symbol]);

    if (loading) {
      return (
        <div style={{ padding: '20px', color: '#fff', background: '#1a1a1a', minHeight: '100vh' }}>
          <h1>Caricamento...</h1>
        </div>
      );
    }

    return (
      <div style={{ padding: '20px', color: '#fff', background: '#1a1a1a', minHeight: '100vh' }}>
        <button 
          onClick={() => window.location.href = '/'} 
          style={{ padding: '10px 20px', marginBottom: '20px', cursor: 'pointer' }}
        >
          ← Torna al Dashboard
        </button>
        <h1>🤖 Analisi Bot - {symbol.toUpperCase()}</h1>
        
        {data && (
          <div>
            <div style={{ marginTop: '20px', padding: '15px', background: '#2a2a2a', borderRadius: '8px' }}>
              <h3>Prezzo Corrente</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>${data.currentPrice?.toFixed(4) || '0.0000'}</p>
            </div>
            
            <div style={{ marginTop: '20px', padding: '15px', background: '#2a2a2a', borderRadius: '8px' }}>
              <h3>Segnale</h3>
              <p style={{ fontSize: '20px', color: data.signal?.direction === 'LONG' ? '#4ade80' : data.signal?.direction === 'SHORT' ? '#ef4444' : '#fbbf24' }}>
                {data.signal?.direction || 'NEUTRAL'} - Forza: {data.signal?.strength || 0}/100
              </p>
              {data.signal?.reasons && (
                <ul style={{ marginTop: '10px' }}>
                  {data.signal.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
            
            {data.requirements?.long && (
              <div style={{ marginTop: '20px', padding: '15px', background: '#2a2a2a', borderRadius: '8px' }}>
                <h3>Requisiti LONG</h3>
                <p>Strength: {data.requirements.long.currentStrength}/{data.requirements.long.minStrength}</p>
                <p>Conferme: {data.requirements.long.currentConfirmations}/{data.requirements.long.minConfirmations}</p>
                <p>Può aprire: {data.requirements.long.canOpen ? '✅ Sì' : '❌ No'}</p>
              </div>
            )}
          </div>
        )}
      );
    }
  */
