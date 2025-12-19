import React, { useState, useEffect } from 'react';
import CryptoDashboard from './components/CryptoDashboard/CryptoDashboard';
import BotAnalysisPageNew from './components/CryptoDashboard/BotAnalysisPageNew';
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

  // ✅ FIX: Controlla se siamo nella pagina Bot Analysis
  const urlParams = new URLSearchParams(window.location.search);
  const isBotAnalysis = urlParams.get('page') === 'bot-analysis';
  const symbol = urlParams.get('symbol') || 'bitcoin';

  // ✅ Dopo il login
  if (isLoggedIn) {
    // ✅ FIX: Se siamo in bot-analysis, mostra BotAnalysisPageNew
    if (isBotAnalysis) {
      const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
      return (
        <BotAnalysisPageNew
          symbol={symbol}
          getAuthHeader={getAuthHeader}
          apiBase={apiBase}
        />
      );
    }

    // Altrimenti mostra CryptoDashboard normale
    return (
      <CryptoDashboard 
        getAuthHeader={getAuthHeader}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  // ✅ Login screen
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

