import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Se hai un file CSS per gli stili globali, importalo qui
import './index.css';

// Polyfill for Array.prototype.toSorted (ES2023) to fix compatibility issues
if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function (compareFn) {
    const copy = this.slice();
    copy.sort(compareFn);
    return copy;
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);