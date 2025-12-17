/**
 * Utility per sopprimere errori runtime.lastError dalle estensioni del browser
 * Questi errori sono comuni e non sono causati dal nostro codice
 */

export const suppressExtensionErrors = () => {
  // Intercetta console.error per filtrare errori runtime.lastError
  const originalError = console.error;
  console.error = function(...args) {
    const errorMessage = args.join(' ');
    
    // Filtra errori runtime.lastError e message port closed
    if (
      errorMessage.includes('runtime.lastError') ||
      errorMessage.includes('message port closed') ||
      errorMessage.includes('The message port closed')
    ) {
      // Sopprimi silenziosamente - sono errori delle estensioni, non del nostro codice
      return;
    }
    
    // Chiama l'originale per tutti gli altri errori
    originalError.apply(console, args);
  };

  // Gestisci errori non catturati
  window.addEventListener('error', (event) => {
    if (
      event.message &&
      (event.message.includes('runtime.lastError') ||
       event.message.includes('message port closed'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });

  // Gestisci promise rejection non gestite
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason &&
      typeof event.reason === 'object' &&
      event.reason.message &&
      (event.reason.message.includes('runtime.lastError') ||
       event.reason.message.includes('message port closed'))
    ) {
      event.preventDefault();
      return false;
    }
  });
};

