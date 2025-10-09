import React from 'react';
import { User } from 'lucide-react';

const LoginScreen = ({ loginData, setLoginData, handleLogin, handleAutoFillLogin }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
      <div className="text-center mb-8">
        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <User size={32} className="text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold">Sistema Ticketing</h1>
        <p className="text-gray-600">Accedi per gestire i tuoi ticket</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={loginData.email}
            // CORREZIONE: Usiamo la forma funzionale per aggiornare lo stato in modo sicuro
            onChange={(e) => setLoginData(prevData => ({ ...prevData, email: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            value={loginData.password}
            // CORREZIONE: Usiamo la forma funzionale anche qui
            onChange={(e) => setLoginData(prevData => ({ ...prevData, password: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          Accedi
        </button>
      </div>
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs font-semibold mb-2">Account di prova (dal DB):</p>
        <div className="space-y-2 text-xs">
          <button
            onClick={() => handleAutoFillLogin('cliente')}
            className="w-full text-left p-1 rounded-md hover:bg-gray-100"
          >
            Cliente: cliente@example.com / cliente123
          </button>
          <button
            onClick={() => handleAutoFillLogin('tecnico')}
            className="w-full text-left p-1 rounded-md hover:bg-gray-100"
          >
            Tecnico: tecnico@example.com / tecnico123
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default LoginScreen;