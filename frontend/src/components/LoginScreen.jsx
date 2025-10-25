import React from 'react';
import { User } from 'lucide-react';

const LoginScreen = ({ loginData, setLoginData, handleLogin }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center p-4">
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
            onChange={(e) => setLoginData(prevData => ({ ...prevData, password: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          Accedi
        </button>
      </div>
    </div>
  </div>
);

export default LoginScreen;
