// frontend/src/components/KeepassIcon.jsx

import React from 'react';

// Componente per visualizzare le icone KeePass
// KeePass usa un set standard di 69 icone (0-68)
// Usiamo un servizio online che fornisce le icone standard di KeePass
const KeepassIcon = ({ iconId = 0, size = 16, className = '' }) => {
  // Normalizza iconId (0-68)
  const normalizedId = Math.max(0, Math.min(68, parseInt(iconId) || 0));
  
  // URL per le icone KeePass standard (usando un servizio pubblico)
  // Alternativa: possiamo usare icone locali o un CDN
  const iconUrl = `https://raw.githubusercontent.com/keepassxreboot/keepassxc/develop/share/icons/database/${normalizedId}.png`;
  
  return (
    <img
      src={iconUrl}
      alt={`Icon ${normalizedId}`}
      width={size}
      height={size}
      className={className}
      onError={(e) => {
        // Fallback: mostra un'icona generica se l'immagine non si carica
        e.target.style.display = 'none';
        e.target.nextSibling?.style?.display = 'inline-block';
      }}
      style={{ display: 'inline-block' }}
    />
  );
};

export default KeepassIcon;

