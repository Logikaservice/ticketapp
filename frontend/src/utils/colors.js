export const getStatoColor = (stato) => {
  const colors = {
    aperto: 'bg-blue-100 text-blue-800',
    in_lavorazione: 'bg-yellow-100 text-yellow-800',
    risolto: 'bg-green-100 text-green-800',
    chiuso: 'bg-gray-100 text-gray-800',
    inviato: 'bg-gray-300 text-gray-800 font-bold',
    fatturato: 'bg-indigo-100 text-indigo-800'
  };
  return colors[stato] || 'bg-gray-100 text-gray-800';
};

export const getPrioritaColor = (priorita) => {
  const colors = {
    bassa: 'text-gray-600',
    media: 'text-blue-600',
    alta: 'text-orange-600',
    urgente: 'text-red-600'
  };
  return colors[priorita.toLowerCase()] || 'text-gray-600';
};

export const getPrioritaBgClass = (priorita) => {
  const colors = {
    bassa: 'bg-gray-100',
    media: 'bg-blue-300',
    alta: 'bg-orange-100',
    urgente: 'bg-red-100'
  };
  return colors[priorita.toLowerCase()] || 'bg-gray-100';
};

export const getPrioritySolidBgClass = (priorita) => {
  const colors = {
    bassa: 'bg-gray-500',
    media: 'bg-blue-500',
    alta: 'bg-orange-500',
    urgente: 'bg-red-600'
  };
  return colors[priorita.toLowerCase()] || 'bg-gray-500';
};
