export const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatTimeLogDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatReportDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');
};