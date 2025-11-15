// backend/routes/analytics.js

const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Helper per calcolare il costo totale di un ticket (manodopera + materiali)
  const calculateTicketCost = (ticket) => {
    let totalCost = 0;
    
    try {
      let timelogs = ticket.timelogs;
      if (typeof timelogs === 'string') {
        timelogs = JSON.parse(timelogs);
      }
      
      if (Array.isArray(timelogs)) {
        timelogs.forEach(log => {
          // Calcolo manodopera
          const ore = parseFloat(log.oreIntervento) || 0;
          const costoUnitario = parseFloat(log.costoUnitario) || 0;
          const sconto = parseFloat(log.sconto) || 0;
          const costoManodopera = ore * costoUnitario * (1 - sconto / 100);
          
          // Calcolo materiali
          const materials = Array.isArray(log.materials) ? log.materials : [];
          const costoMateriali = materials.reduce((sum, m) => {
            const quantita = parseInt(m.quantita) || 0;
            const costo = parseFloat(m.costo) || 0;
            return sum + (quantita * costo);
          }, 0);
          
          totalCost += costoManodopera + costoMateriali;
        });
      }
    } catch (err) {
      console.error('Errore calcolo costo ticket:', err);
    }
    
    return totalCost;
  };

  // GET /api/analytics
  router.get('/', async (req, res) => {
    try {
      const { company } = req.query; // Filtro opzionale per azienda
      
      // Limita agli ultimi 2 anni per performance
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      // Query per ottenere tutti i ticket con i loro dati (limitati agli ultimi 2 anni)
      let query = `
        SELECT 
          t.id,
          t.stato,
          t.dataapertura,
          t.timelogs,
          u.azienda
        FROM tickets t
        LEFT JOIN users u ON t.clienteid = u.id
        WHERE t.stato IN ('fatturato', 'inviato', 'chiuso', 'risolto')
        AND t.dataapertura >= $1
      `;
      
      const params = [twoYearsAgo.toISOString()];
      if (company && company !== 'all') {
        query += ' AND u.azienda = $2';
        params.push(company);
      }
      
      query += ' ORDER BY t.dataapertura';
      
      console.log('📊 Analytics: Eseguo query con', params.length, 'parametri');
      const startTime = Date.now();
      const result = await pool.query(query, params);
      const queryTime = Date.now() - startTime;
      console.log(`📊 Analytics: Query completata in ${queryTime}ms, ${result.rows.length} ticket trovati`);
      
      // Raggruppa per mese e stato
      const monthlyData = {};
      
      result.rows.forEach(ticket => {
        const dataApertura = new Date(ticket.dataapertura);
        if (isNaN(dataApertura.getTime())) return;
        
        const year = dataApertura.getFullYear();
        const month = dataApertura.getMonth() + 1; // 1-12
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const monthLabel = `${String(month).padStart(2, '0')}/${year}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthLabel,
            pagato: 0,      // fatturato
            inAttesa: 0,    // inviato
            daFatturare: 0, // chiuso
            daCompletare: 0 // risolto
          };
        }
        
        const cost = calculateTicketCost(ticket);
        
        switch (ticket.stato) {
          case 'fatturato':
            monthlyData[monthKey].pagato += cost;
            break;
          case 'inviato':
            monthlyData[monthKey].inAttesa += cost;
            break;
          case 'chiuso':
            monthlyData[monthKey].daFatturare += cost;
            break;
          case 'risolto':
            monthlyData[monthKey].daCompletare += cost;
            break;
        }
      });
      
      // Converti in array e ordina per mese
      const data = Object.values(monthlyData).sort((a, b) => {
        const [monthA, yearA] = a.month.split('/').map(Number);
        const [monthB, yearB] = b.month.split('/').map(Number);
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
      });
      
      // Calcola totali
      const totals = data.reduce((acc, month) => {
        acc.pagato += month.pagato;
        acc.inAttesa += month.inAttesa;
        acc.daFatturare += month.daFatturare;
        acc.daCompletare += month.daCompletare;
        return acc;
      }, { pagato: 0, inAttesa: 0, daFatturare: 0, daCompletare: 0 });
      
      res.json({ data, totals });
    } catch (err) {
      console.error('Errore analytics:', err);
      res.status(500).json({ error: 'Errore nel recupero dei dati analytics' });
    }
  });

  return router;
};

