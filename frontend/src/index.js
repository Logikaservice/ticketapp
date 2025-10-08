import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Se hai un file CSS per gli stili globali, importalo qui
import './index.css'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);