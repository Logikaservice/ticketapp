// src/contexts/ThemeContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Carica il tema salvato o usa 'light' come default
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('ticketapp-theme');
    return savedTheme || 'light';
  });

  // Aggiorna localStorage e document quando cambia il tema
  useEffect(() => {
    localStorage.setItem('ticketapp-theme', theme);
    
    // Aggiungi/rimuovi classe dark sul document root
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const value = {
    theme,
    toggleTheme,
    isDark: theme === 'dark'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
