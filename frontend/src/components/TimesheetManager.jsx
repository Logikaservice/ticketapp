import React, { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Plus, Download, Calculator, Calendar, Settings, X, UserPlus, Building2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const TimesheetManager = ({ currentUser, getAuthHeader }) => {
  // --- STATI GENERALI ---
  const [showSettings, setShowSettings] = useState(false);
  const [weekRange, setWeekRange] = useState(() => {
    // Calcola la settimana corrente
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const formatDate = (d) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    return `${formatDate(monday)} al ${formatDate(sunday)}`;
  });
  const [quickAddName, setQuickAddName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- GESTIONE MODALE SICURA ---
  const onConfirmAction = useRef(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: ''
  });

  // --- STATI STRUTTURA AZIENDALE ---
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  // Aziende selezionate per visualizzazione multipla
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [showCompanyFilter, setShowCompanyFilter] = useState(false);
  // Stato per selezionare azienda/reparto quando si aggiunge un dipendente in modalità multi-azienda
  const [selectedAddCompany, setSelectedAddCompany] = useState('');
  const [selectedAddDept, setSelectedAddDept] = useState('');
  
  // Modalità multi-azienda attiva quando ci sono aziende selezionate
  const multiCompanyMode = selectedCompanies.length > 0;

  // Struttura dei reparti per ogni azienda
  const [departmentsStructure, setDepartmentsStructure] = useState({});

  // --- STATI DATI (Dipendenti e Orari) ---
  const [employeesData, setEmployeesData] = useState({});
  const [schedule, setSchedule] = useState({});
  const [newDeptName, setNewDeptName] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  
  // Stato per sostituzione dipendente
  const [replaceEmployeeModal, setReplaceEmployeeModal] = useState({
    isOpen: false,
    oldEmployeeId: null,
    oldEmployeeName: '',
    newEmployeeName: '',
    newEmployeeId: null
  });

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  // --- CARICAMENTO LIBRERIA EXCEL (Versione con STILI) ---
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      try {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      } catch (e) { }
    }
  }, []);

  // --- CARICAMENTO DATI DAL BACKEND ---
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/api/orari/data'), {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        // Se ci sono aziende, carica i dati
        if (data.companies && data.companies.length > 0) {
          setCompanies(data.companies);
          setSelectedCompany(data.companies[0]);
          setDepartmentsStructure(data.departments || {});
          setEmployeesData(data.employees || {});
          setSchedule(data.schedule || {});
          
          // Imposta il primo reparto della prima azienda
          const firstDept = data.departments?.[data.companies[0]]?.[0];
          if (firstDept) {
            setSelectedDept(firstDept);
          }
          
          // Inizializza con la prima azienda selezionata (ma non in modalità multi-azienda)
          // setSelectedCompanies([]); // Non selezionare nessuna azienda di default
        } else {
          // Se non ci sono dati, inizializza con le aziende di default
          const defaultData = {
            companies: ['La Torre', 'Mercurio', 'Albatros'],
            departments: {
              'La Torre': ['Cucina'],
              'Mercurio': ['Cucina'],
              'Albatros': ['Cucina']
            },
            employees: {
              'La Torre-Cucina': [],
              'Mercurio-Cucina': [],
              'Albatros-Cucina': []
            },
            schedule: {}
          };
          setCompanies(defaultData.companies);
          setSelectedCompany(defaultData.companies[0]);
          setDepartmentsStructure(defaultData.departments);
          setEmployeesData(defaultData.employees);
          setSchedule(defaultData.schedule);
          setSelectedDept('Cucina');
          // Salva i dati iniziali
          setTimeout(() => saveData(), 500);
        }
      }
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- SALVATAGGIO DATI ---
  const saveData = async () => {
    try {
      // Usa lo stato corrente per assicurarsi di salvare i dati più recenti
      const dataToSave = {
        companies,
        departments: departmentsStructure,
        employees: employeesData,
        schedule
      };
      
      // Pulisci i dati prima di salvare (rimuovi undefined, null, etc.)
      const cleanData = JSON.parse(JSON.stringify(dataToSave));
      
      const response = await fetch(buildApiUrl('/api/orari/save'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Dati salvati con successo:', result);
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore salvataggio:', errorData);
        return false;
      }
    } catch (error) {
      console.error('❌ Errore salvataggio:', error);
      return false;
    }
  };

  // --- HELPER ---
  const getCurrentContextKey = () => `${selectedCompany}-${selectedDept}`;
  const getContextKey = (company, dept) => `${company}-${dept}`;
  
  // Ottieni dipendenti: modalità singola azienda o multipla
  const getCurrentEmployees = () => {
    if (multiCompanyMode && selectedCompanies.length > 0) {
      // Modalità multi-azienda: unisci tutti i dipendenti delle aziende selezionate
      const allEmployees = [];
      selectedCompanies.forEach(company => {
        const depts = departmentsStructure[company] || [];
        depts.forEach(dept => {
          const key = getContextKey(company, dept);
          const employees = employeesData[key] || [];
          console.log(`📋 Azienda: ${company}, Reparto: ${dept}, Key: ${key}, Dipendenti:`, employees);
          // Aggiungi informazioni azienda e reparto a ogni dipendente
          employees.forEach(emp => {
            allEmployees.push({
              ...emp,
              company: company,
              department: dept,
              contextKey: key
            });
          });
        });
      });
      console.log('👥 Totale dipendenti in modalità multi-azienda:', allEmployees.length);
      return allEmployees;
    } else {
      // Modalità singola azienda (comportamento originale)
      // Se non ci sono aziende selezionate, usa l'azienda selezionata nel dropdown
      const company = selectedCompany || companies[0];
      const dept = selectedDept || departmentsStructure[company]?.[0] || '';
      const key = getContextKey(company, dept);
      const employees = employeesData[key] || [];
      console.log(`📋 Azienda singola: ${company}, Reparto: ${dept}, Key: ${key}, Dipendenti:`, employees);
      return employees.map(emp => ({
        ...emp,
        company: company,
        department: dept,
        contextKey: key
      }));
    }
  };
  
  const currentEmployees = getCurrentEmployees();

  // --- FUNZIONI MODALE ---
  const openConfirm = (title, message, action) => {
    onConfirmAction.current = action; 
    setConfirmModal({ isOpen: true, title, message });
  };

  const closeConfirm = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    onConfirmAction.current = null;
  };

  const handleConfirm = () => {
    if (onConfirmAction.current) {
      try { onConfirmAction.current(); } catch (error) { console.error(error); }
    }
    closeConfirm();
  };


  // --- CALCOLI SICURI ---
  const timeToDecimal = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const cleanStr = timeStr.trim().replace(',', '.').replace(':', '.');
    if (!cleanStr.includes('.')) {
      const val = parseFloat(cleanStr);
      return isNaN(val) ? 0 : val;
    }
    const parts = cleanStr.split('.');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const result = hours + (minutes / 60);
    return isNaN(result) ? 0 : result;
  };

  const calculateDailyHours = (dayData) => {
    if (!dayData) return 0;
    if (dayData.code && ['R', 'FERIE', 'MAL', 'AV', 'AT'].includes(dayData.code.toUpperCase())) return 0;
    let total = 0;
    if (dayData.in1 && dayData.out1) {
      const start = timeToDecimal(dayData.in1);
      const end = timeToDecimal(dayData.out1);
      if (end > start) total += (end - start);
    }
    if (dayData.in2 && dayData.out2) {
      const start = timeToDecimal(dayData.in2);
      const end = timeToDecimal(dayData.out2);
      if (end > start) total += (end - start);
    }
    return total;
  };

  const calculateWeeklyTotal = (empId) => {
    let total = 0;
    const empSchedule = schedule[empId] || {};
    days.forEach((_, index) => {
      total += calculateDailyHours(empSchedule[index]);
    });
    return isNaN(total) ? "0.0" : total.toFixed(1);
  };

  // --- INPUT HANDLERS ---
  const handleInputChange = (empId, dayIndex, field, value, contextKey = null) => {
    // Usa contextKey se fornito (modalità multi-azienda), altrimenti usa empId
    const scheduleKey = contextKey ? `${contextKey}-${empId}` : empId;
    
    setSchedule(prev => ({
      ...prev,
      [scheduleKey]: { ...prev[scheduleKey], [dayIndex]: { ...prev[scheduleKey]?.[dayIndex], [field]: value } }
    }));
    // Salva automaticamente dopo ogni modifica
    setTimeout(() => saveData(), 500);
  };

  const handleBlur = (empId, dayIndex, field, value, contextKey = null) => {
     if (!value) return;
     const strValue = String(value);
     let formatted = strValue.replace(',', '.').replace(':', '.').trim();
     if (!formatted.includes('.')) formatted += '.00';
     const parts = formatted.split('.');
     if (parts[0].length === 1) parts[0] = '0' + parts[0];
     if (parts[1].length === 1) parts[1] = parts[1] + '0';
     formatted = parts.join('.');
     if (formatted !== value) handleInputChange(empId, dayIndex, field, formatted, contextKey);
     // Salva automaticamente dopo ogni modifica
     setTimeout(() => saveData(), 500);
  };

  const handleQuickCode = (empId, dayIndex, code, contextKey = null) => {
    // Usa contextKey se fornito (modalità multi-azienda), altrimenti usa empId
    const scheduleKey = contextKey ? `${contextKey}-${empId}` : empId;
    
    setSchedule(prev => {
      const newSchedule = {
        ...prev,
        [scheduleKey]: { 
          ...prev[scheduleKey], 
          [dayIndex]: { 
            code: code || '', 
            in1: code ? '' : (prev[scheduleKey]?.[dayIndex]?.in1 || ''), 
            out1: code ? '' : (prev[scheduleKey]?.[dayIndex]?.out1 || ''), 
            in2: code ? '' : (prev[scheduleKey]?.[dayIndex]?.in2 || ''), 
            out2: code ? '' : (prev[scheduleKey]?.[dayIndex]?.out2 || '') 
          } 
        }
      };
      
      // Salva con lo stato aggiornato usando una funzione che accede allo stato corrente
      setTimeout(() => {
        // Usa una funzione che legge lo stato più recente
        setSchedule(currentSchedule => {
          saveDataWithSchedule(currentSchedule);
          return currentSchedule;
        });
      }, 200);
      
      return newSchedule;
    });
  };

  // Funzione helper per salvare con uno schedule specifico
  const saveDataWithSchedule = async (scheduleToSave) => {
    try {
      const dataToSave = {
        companies,
        departments: departmentsStructure,
        employees: employeesData,
        schedule: scheduleToSave || schedule
      };
      
      const response = await fetch(buildApiUrl('/api/orari/save'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSave)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Dati salvati con successo (codice):', result);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore salvataggio:', errorData);
      }
    } catch (error) {
      console.error('❌ Errore salvataggio:', error);
    }
  };

  // --- AZIONI STRUTTURA ---
  const handleQuickAddEmployee = (targetCompany = null, targetDept = null) => {
    if (!quickAddName.trim()) {
      console.warn('⚠️ Nome dipendente vuoto');
      return;
    }
    
    // Se modalità multi-azienda e non specificato, usa la prima azienda selezionata
    let company = targetCompany || selectedCompany;
    let dept = targetDept || selectedDept;
    
    if (multiCompanyMode && selectedCompanies.length > 0 && !targetCompany) {
      company = selectedAddCompany || selectedCompanies[0];
      dept = selectedAddDept || departmentsStructure[selectedCompanies[0]]?.[0] || '';
    }
    
    // Verifica che company e dept siano validi
    if (!company || !dept) {
      console.error('❌ Errore: company o dept non validi', { 
        company, 
        dept, 
        selectedCompany, 
        selectedDept,
        selectedCompanies,
        departmentsStructure 
      });
      alert(`Errore: Azienda o reparto non validi. Azienda: ${company}, Reparto: ${dept}`);
      return;
    }
    
    const key = getContextKey(company, dept);
    const newId = Date.now();
    const employeeName = quickAddName.toUpperCase().trim();
    
    console.log('➕ Aggiungo dipendente:', {
      name: employeeName,
      company,
      dept,
      key,
      id: newId,
      currentEmployeesData: employeesData[key] || []
    });
    
    // Aggiorna lo stato
    setEmployeesData(prev => {
      const currentEmployees = prev[key] || [];
      const updated = {
        ...prev,
        [key]: [...currentEmployees, { id: newId, name: employeeName }]
      };
      
      console.log('📝 Stato aggiornato:', {
        key,
        oldCount: currentEmployees.length,
        newCount: updated[key].length,
        newEmployee: updated[key][updated[key].length - 1]
      });
      
      // Salva immediatamente con lo stato aggiornato
      setTimeout(() => {
        console.log('💾 Avvio salvataggio con dati:', {
          key,
          employees: updated[key],
          allEmployees: updated
        });
        saveDataWithEmployees(updated);
      }, 200);
      
      return updated;
    });
    
    // Reset campi
    setQuickAddName('');
    if (multiCompanyMode) {
      setSelectedAddCompany('');
      setSelectedAddDept('');
    }
  };
  
  // Funzione helper per salvare con dipendenti aggiornati
  const saveDataWithEmployees = async (empData) => {
    try {
      // Usa lo stato corrente per schedule, companies e departments
      const dataToSave = {
        companies: companies || [],
        departments: departmentsStructure || {},
        employees: empData || employeesData,
        schedule: schedule || {}
      };
      
      console.log('💾 Dati da salvare:', {
        companies: dataToSave.companies.length,
        departments: Object.keys(dataToSave.departments).length,
        employees: Object.keys(dataToSave.employees).length,
        schedule: Object.keys(dataToSave.schedule).length
      });
      
      // Pulisci i dati
      const cleanData = JSON.parse(JSON.stringify(dataToSave));
      
      // Verifica che ci siano dipendenti da salvare
      const employeeKeys = Object.keys(cleanData.employees);
      console.log('👥 Chiavi dipendenti da salvare:', employeeKeys);
      employeeKeys.forEach(key => {
        console.log(`  - ${key}: ${cleanData.employees[key].length} dipendenti`);
      });
      
      const response = await fetch(buildApiUrl('/api/orari/save'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Dipendente salvato con successo:', result);
        
        // Ricarica i dati per assicurarsi che siano sincronizzati
        setTimeout(() => {
          loadData();
        }, 300);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore salvataggio dipendente:', errorData);
        alert(`Errore nel salvataggio: ${errorData.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      console.error('❌ Errore salvataggio dipendente:', error);
      alert(`Errore nel salvataggio: ${error.message}`);
    }
  };

  const addDepartment = () => {
    if (!newDeptName.trim() || departmentsStructure[selectedCompany]?.includes(newDeptName)) return;
    
    setDepartmentsStructure(prev => {
      const updated = { ...prev, [selectedCompany]: [...(prev[selectedCompany] || []), newDeptName] };
      // Salva con lo stato aggiornato
      setTimeout(() => {
        setEmployeesData(empData => {
          const updatedEmpData = { ...empData, [`${selectedCompany}-${newDeptName}`]: [] };
          // Salva tutti i dati aggiornati usando lo stato corrente
          setSchedule(currentSchedule => {
            saveDataWithStructure(updated, updatedEmpData, currentSchedule);
            return currentSchedule;
          });
          return updatedEmpData;
        });
      }, 100);
      return updated;
    });
    setNewDeptName('');
  };
  
  // Funzione helper per salvare con struttura aggiornata
  const saveDataWithStructure = async (deptStructure, empData, currentSchedule) => {
    try {
      const dataToSave = {
        companies,
        departments: deptStructure || departmentsStructure,
        employees: empData || employeesData,
        schedule: currentSchedule || schedule
      };
      
      const cleanData = JSON.parse(JSON.stringify(dataToSave));
      
      const response = await fetch(buildApiUrl('/api/orari/save'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Reparti salvati con successo:', result);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore salvataggio reparti:', errorData);
      }
    } catch (error) {
      console.error('❌ Errore salvataggio reparti:', error);
    }
  };

  const triggerDeleteDepartment = (deptToDelete) => {
    openConfirm(
      "Elimina Reparto",
      `Sei sicuro di voler eliminare il reparto "${deptToDelete}"? Tutti i dipendenti e gli orari associati verranno eliminati.`,
      () => deleteDepartment(deptToDelete)
    );
  };

  const deleteDepartment = (deptToDelete) => {
    setDepartmentsStructure(prev => {
      const updated = { ...prev, [selectedCompany]: prev[selectedCompany].filter(d => d !== deptToDelete) };
      
      if (selectedDept === deptToDelete) {
        const remaining = updated[selectedCompany];
        setSelectedDept(remaining[0] || '');
      }
      
      const key = `${selectedCompany}-${deptToDelete}`;
      setEmployeesData(empData => {
        const newData = { ...empData };
        delete newData[key];
        // Salva con lo stato aggiornato
        setTimeout(() => {
          setSchedule(currentSchedule => {
            saveDataWithStructure(updated, newData, currentSchedule);
            return currentSchedule;
          });
        }, 100);
        return newData;
      });
      
      return updated;
    });
  };

  const addEmployee = () => {
    if (!newEmployeeName.trim()) return;
    const key = getCurrentContextKey();
    const newId = Date.now();
    setEmployeesData(prev => ({ ...prev, [key]: [...(prev[key] || []), { id: newId, name: newEmployeeName.toUpperCase() }] }));
    setNewEmployeeName('');
    saveData();
  };

  const triggerDeleteEmployee = (empId) => {
    const emp = currentEmployees.find(e => e.id === empId);
    openConfirm(
      "Elimina Dipendente",
      `Sei sicuro di voler eliminare il dipendente "${emp?.name}"?`,
      () => deleteEmployee(empId)
    );
  };

  const deleteEmployee = (empId) => {
    const key = getCurrentContextKey();
    setEmployeesData(prev => ({ ...prev, [key]: prev[key].filter(e => e.id !== empId) }));
    // Rimuovi anche gli orari
    setSchedule(prev => {
      const newSchedule = { ...prev };
      delete newSchedule[empId];
      return newSchedule;
    });
    saveData();
  };

  // --- SOSTITUZIONE DIPENDENTE ---
  const openReplaceEmployeeModal = (empId) => {
    const emp = currentEmployees.find(e => e.id === empId);
    if (!emp) return;
    setReplaceEmployeeModal({
      isOpen: true,
      oldEmployeeId: empId,
      oldEmployeeName: emp.name,
      newEmployeeName: '',
      newEmployeeId: null
    });
  };

  const closeReplaceEmployeeModal = () => {
    setReplaceEmployeeModal({
      isOpen: false,
      oldEmployeeId: null,
      oldEmployeeName: '',
      newEmployeeName: '',
      newEmployeeId: null
    });
  };

  const handleReplaceEmployee = () => {
    const { oldEmployeeId, newEmployeeName, newEmployeeId } = replaceEmployeeModal;
    if (!newEmployeeName.trim()) return;

    const key = getCurrentContextKey();
    const newNameUpper = newEmployeeName.toUpperCase().trim();
    let targetEmployeeId = newEmployeeId;

    // Verifica se esiste già un dipendente con questo nome (case-insensitive)
    const existingEmployee = currentEmployees.find(
      emp => emp.id !== oldEmployeeId && emp.name.toUpperCase() === newNameUpper
    );

    if (existingEmployee) {
      // Se il dipendente esiste già: SCAMBIA SOLO I NOMI (inverti i nomi)
      // Gli orari rimangono invariati (attaccati ai rispettivi ID)
      const oldEmployee = currentEmployees.find(emp => emp.id === oldEmployeeId);
      if (oldEmployee) {
        setEmployeesData(prev => ({
          ...prev,
          [key]: prev[key].map(emp => {
            if (emp.id === oldEmployeeId) {
              // Il vecchio dipendente prende il nome del nuovo
              return { ...emp, name: newNameUpper };
            } else if (emp.id === existingEmployee.id) {
              // Il nuovo dipendente prende il nome del vecchio
              return { ...emp, name: oldEmployee.name };
            }
            return emp;
          })
        }));
      }
      // NON trasferire gli orari - rimangono dove sono
    } else if (!targetEmployeeId) {
      // Se il dipendente NON esiste: crea nuovo e trasferisci gli orari
      targetEmployeeId = Date.now();
      const newEmployee = { id: targetEmployeeId, name: newNameUpper };
      setEmployeesData(prev => ({
        ...prev,
        [key]: [...(prev[key] || []), newEmployee]
      }));

      // Trasferisci gli orari dal vecchio al nuovo dipendente
      setSchedule(prev => {
        const newSchedule = { ...prev };
        if (newSchedule[oldEmployeeId]) {
          newSchedule[targetEmployeeId] = { ...newSchedule[oldEmployeeId] };
          delete newSchedule[oldEmployeeId];
        }
        return newSchedule;
      });

      // Rimuovi il vecchio dipendente dalla lista
      setEmployeesData(prev => ({
        ...prev,
        [key]: prev[key].filter(emp => emp.id !== oldEmployeeId)
      }));
    } else {
      // Dipendente selezionato dalla lista che non esiste nella lista corrente
      // Trasferisci gli orari
      setSchedule(prev => {
        const newSchedule = { ...prev };
        if (newSchedule[oldEmployeeId]) {
          if (newSchedule[targetEmployeeId]) {
            // Unisci gli orari se il target ha già orari
            newSchedule[targetEmployeeId] = { ...newSchedule[oldEmployeeId], ...newSchedule[targetEmployeeId] };
          } else {
            newSchedule[targetEmployeeId] = { ...newSchedule[oldEmployeeId] };
          }
          delete newSchedule[oldEmployeeId];
        }
        return newSchedule;
      });

      // Rimuovi il vecchio dipendente dalla lista
      setEmployeesData(prev => ({
        ...prev,
        [key]: prev[key].filter(emp => emp.id !== oldEmployeeId)
      }));
    }

    saveData();
    closeReplaceEmployeeModal();
  };

  // --- EXPORT EXCEL PERFETTO ---
  const strToExcelTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const cleanStr = timeStr.replace(',', '.').replace(':', '.').trim();
    
    if (!cleanStr.includes('.')) {
        const val = parseFloat(cleanStr);
        return isNaN(val) ? null : val / 24;
    }

    const parts = cleanStr.split('.');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    
    if (isNaN(hours)) return null;
    const safeMinutes = isNaN(minutes) ? 0 : minutes;
    
    return (hours + safeMinutes / 60) / 24; 
  };

  const exportExcel = () => {
    try {
        if (!window.XLSX) {
          openConfirm("Errore Libreria", "La libreria Excel non è ancora caricata. Attendi...", null);
          return;
        }

        const XLSX = window.XLSX;
        const wb = XLSX.utils.book_new();
        
        const borderThin = {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        };

        const styleTitle = { 
          font: { bold: true, sz: 14 }, 
          alignment: { horizontal: "center", vertical: "center" },
          border: borderThin
        };
        
        const styleHeader = { 
            font: { bold: true, color: { rgb: "000000" } }, 
            fill: { fgColor: { rgb: "D9D9D9" } },
            border: borderThin,
            alignment: { horizontal: "center", vertical: "center" }
        };

        const styleTotalHeader = {
            font: { bold: true }, 
            fill: { fgColor: { rgb: "FFFF00" } },
            border: borderThin,
            alignment: { horizontal: "center", vertical: "center" }
        };

        const styleCell = { 
            border: borderThin,
            alignment: { horizontal: "center", vertical: "center" }
        };

        const styleEmpName = {
            font: { bold: true },
            border: borderThin,
            alignment: { horizontal: "left", vertical: "center" }
        };

        const styleTotalCell = {
            font: { bold: true },
            fill: { fgColor: { rgb: "FFFF99" } },
            border: borderThin,
            alignment: { horizontal: "center", vertical: "center" }
        };

        const wsData = [];
        const merges = [];

        const titleRow = new Array(16).fill({ v: "", s: styleTitle });
        titleRow[0] = { v: `REPARTO ${selectedCompany.toUpperCase()} - ${selectedDept.toUpperCase()}`, s: styleTitle };
        wsData.push(titleRow);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } });

        const subTitleRow = new Array(16).fill({ v: "", s: styleTitle });
        subTitleRow[0] = { v: `Orario settimanale: ${weekRange}`, s: { ...styleTitle, font: { sz: 11 } } };
        wsData.push(subTitleRow);
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 15 } });

        const headerRow1 = new Array(16).fill(null);
        headerRow1[0] = { v: "DIPENDENTE", s: styleHeader };
        headerRow1[15] = { v: "TOTALE", s: styleTotalHeader };
        
        for(let i=0; i<7; i++) {
            const col = 1 + (i*2);
            headerRow1[col] = { v: days[i], s: styleHeader };
            headerRow1[col+1] = { v: "", s: styleHeader }; 
            merges.push({ s: { r: 2, c: col }, e: { r: 2, c: col+1 } });
        }
        wsData.push(headerRow1);

        const headerRow2 = new Array(16).fill(null);
        headerRow2[0] = { v: "", s: styleHeader }; 
        headerRow2[15] = { v: "", s: styleTotalHeader }; 
        
        merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });
        merges.push({ s: { r: 2, c: 15 }, e: { r: 3, c: 15 } });

        for(let i=0; i<7; i++) {
            const col = 1 + (i*2);
            headerRow2[col] = { v: "Entrata", s: styleHeader };
            headerRow2[col+1] = { v: "Uscita", s: styleHeader };
        }
        wsData.push(headerRow2);

        // Usa getCurrentEmployees() per ottenere i dipendenti corretti
        const employeesForExport = getCurrentEmployees();
        employeesForExport.forEach(emp => {
            const startRowIndex = wsData.length;
            const scheduleKey = multiCompanyMode ? `${emp.contextKey}-${emp.id}` : emp.id;
            
            const row1 = new Array(16).fill(null).map(() => ({ v: "", s: styleCell }));
            const row2 = new Array(16).fill(null).map(() => ({ v: "", s: styleCell }));

            // Se modalità multi-azienda, mostra anche azienda e reparto
            const empNameDisplay = multiCompanyMode ? `${emp.name} (${emp.company} - ${emp.department})` : emp.name;
            row1[0] = { v: empNameDisplay, s: styleEmpName };
            row2[0] = { v: "", s: styleEmpName };
            merges.push({ s: { r: startRowIndex, c: 0 }, e: { r: startRowIndex + 1, c: 0 } });

            row1[15] = { v: "", s: styleTotalCell };
            row2[15] = { v: "", s: styleTotalCell };
            merges.push({ s: { r: startRowIndex, c: 15 }, e: { r: startRowIndex + 1, c: 15 } });

            let formulaParts = [];

            days.forEach((_, dayIdx) => {
                const data = schedule[scheduleKey]?.[dayIdx];
                const colIdx = 1 + (dayIdx * 2);
                
                if (data?.code) {
                    row1[colIdx] = { v: data.code, s: styleCell };
                    row1[colIdx+1] = { v: data.code, s: styleCell };
                    merges.push({ s: { r: startRowIndex, c: colIdx }, e: { r: startRowIndex + 1, c: colIdx } });
                    merges.push({ s: { r: startRowIndex, c: colIdx+1 }, e: { r: startRowIndex + 1, c: colIdx+1 } });
                } else {
                    const valIn1 = strToExcelTime(data?.in1);
                    const valOut1 = strToExcelTime(data?.out1);
                    if (valIn1 !== null) row1[colIdx] = { v: valIn1, t: 'n', z: 'h:mm', s: styleCell };
                    if (valOut1 !== null) row1[colIdx+1] = { v: valOut1, t: 'n', z: 'h:mm', s: styleCell };

                    const valIn2 = strToExcelTime(data?.in2);
                    const valOut2 = strToExcelTime(data?.out2);
                    if (valIn2 !== null) row2[colIdx] = { v: valIn2, t: 'n', z: 'h:mm', s: styleCell };
                    if (valOut2 !== null) row2[colIdx+1] = { v: valOut2, t: 'n', z: 'h:mm', s: styleCell };

                    const r1 = startRowIndex + 1;
                    const r2 = startRowIndex + 2;
                    const cIn = XLSX.utils.encode_col(colIdx);
                    const cOut = XLSX.utils.encode_col(colIdx + 1);

                    if (valIn1 !== null && valOut1 !== null) formulaParts.push(`(${cOut}${r1}-${cIn}${r1})`);
                    if (valIn2 !== null && valOut2 !== null) formulaParts.push(`(${cOut}${r2}-${cIn}${r2})`);
                }
            });

            const formula = formulaParts.length > 0 ? `SUM(${formulaParts.join(',')})*24` : "0";
            row1[15] = { f: formula, t: 'n', z: '0.0', s: styleTotalCell };
            
            wsData.push(row1);
            wsData.push(row2);
        });

        const ws = XLSX.utils.aoa_to_sheet([]);
        const range = { s: { c: 0, r: 0 }, e: { c: 15, r: wsData.length - 1 } };
        ws['!ref'] = XLSX.utils.encode_range(range);
        
        for (let R = 0; R < wsData.length; ++R) {
            for (let C = 0; C < wsData[R].length; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                ws[cellRef] = wsData[R][C] || { v: "", s: styleCell };
            }
        }

        ws['!merges'] = merges;
        
        const wscols = [{ wch: 25 }]; 
        for(let i=0; i<14; i++) wscols.push({ wch: 9 }); 
        wscols.push({ wch: 10 });
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Turni");
        const fileName = `Turni_${selectedCompany}_${selectedDept}_${weekRange.replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);

    } catch (error) {
        console.error("Export error:", error);
        openConfirm("Errore Esportazione", "Si è verificato un errore. Prova a ricaricare la pagina.", null);
    }
  };

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento dati...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-sans relative">
      
      {/* MODALE SOSTITUZIONE DIPENDENTE */}
      {replaceEmployeeModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-blue-600 p-4 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserPlus size={20} />
                Sostituisci Dipendente
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Stai sostituendo <strong>{replaceEmployeeModal.oldEmployeeName}</strong> con un nuovo dipendente.
                <br />
                <span className="text-sm text-gray-500">Gli orari verranno mantenuti.</span>
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nuovo dipendente (o seleziona esistente)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={replaceEmployeeModal.newEmployeeName}
                    onChange={(e) => setReplaceEmployeeModal(prev => ({ ...prev, newEmployeeName: e.target.value, newEmployeeId: null }))}
                    placeholder="Nome nuovo dipendente"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleReplaceEmployee()}
                  />
                  {currentEmployees.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                      {currentEmployees
                        .filter(e => e.id !== replaceEmployeeModal.oldEmployeeId)
                        .map(emp => (
                          <button
                            key={emp.id}
                            onClick={() => setReplaceEmployeeModal(prev => ({ 
                              ...prev, 
                              newEmployeeName: emp.name,
                              newEmployeeId: emp.id
                            }))}
                            className={`w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 ${
                              replaceEmployeeModal.newEmployeeId === emp.id ? 'bg-blue-100' : ''
                            }`}
                          >
                            {emp.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={closeReplaceEmployeeModal}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleReplaceEmployee}
                  disabled={!replaceEmployeeModal.newEmployeeName.trim()}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sostituisci
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DI CONFERMA CUSTOM */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
            <div className="bg-slate-800 p-4 text-white flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-bold">{confirmModal.title}</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-6">{confirmModal.message}</p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={closeConfirm}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-colors"
                >
                  Annulla
                </button>
                {onConfirmAction.current && (
                  <button 
                    onClick={handleConfirm}
                    className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg"
                  >
                    Conferma
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-full mx-auto bg-white shadow-xl rounded-lg overflow-hidden min-h-[600px]">
        
        {/* HEADER PRINCIPALE */}
        <div className="bg-slate-800 text-white p-4">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Gestione Turni
              </h1>
              {multiCompanyMode && selectedCompanies.length > 0 ? (
                <p className="text-slate-400 text-xs">
                  {selectedCompanies.length} {selectedCompanies.length === 1 ? 'azienda' : 'aziende'} selezionate
                </p>
              ) : selectedCompany && selectedDept ? (
                <p className="text-slate-400 text-xs">{selectedCompany} &gt; {selectedDept}</p>
              ) : null}
            </div>

            <div className="flex gap-3 items-center">
              {companies.length > 0 && (
                <div className="bg-slate-700 p-1.5 rounded flex items-center gap-2">
                   <Building2 size={16} className="text-slate-300"/>
                   <select 
                    value={selectedCompany}
                    onChange={(e) => {
                      setSelectedCompany(e.target.value);
                      const firstDept = departmentsStructure[e.target.value]?.[0];
                      setSelectedDept(firstDept || '');
                      // Se non ci sono aziende selezionate per multi-azienda, usa questa come default
                      if (selectedCompanies.length === 0) {
                        setSelectedCompanies([e.target.value]);
                      }
                    }}
                    className="bg-slate-600 text-white border-none rounded text-sm p-1 focus:ring-2 focus:ring-blue-500"
                   >
                     {companies.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
              )}

              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded transition-colors ${showSettings ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                title="Impostazioni Reparti"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-end border-t border-slate-700 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Settimana:</span>
              <input 
                type="text" 
                value={weekRange}
                onChange={(e) => setWeekRange(e.target.value)}
                className="bg-slate-900 text-white border border-slate-600 rounded px-2 py-1 text-sm w-52 text-center"
              />
            </div>
            <button 
              onClick={exportExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-bold transition-colors shadow-md"
            >
              <FileSpreadsheet size={16} /> Scarica Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* PANNELLO IMPOSTAZIONI */}
        {showSettings && (
          <div className="bg-blue-50 border-b-4 border-blue-200 p-6 animate-in slide-in-from-top-5">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600"/>
                Configurazione Reparti - {selectedCompany}
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-4 rounded shadow-sm border border-blue-100">
                <h3 className="font-bold text-slate-600 mb-3 border-b pb-2">Gestione Reparti per {selectedCompany}</h3>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    placeholder="Nuovo reparto (es. Pizzeria)" 
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <button 
                    onClick={addDepartment}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700"
                  >
                    <Plus size={16} /> Aggiungi
                  </button>
                </div>
                <ul className="space-y-2">
                  {departmentsStructure[selectedCompany]?.map(dept => (
                    <li 
                      key={dept} 
                      className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-colors ${
                        selectedDept === dept 
                          ? 'bg-blue-100 border-blue-400 shadow-md' 
                          : 'bg-slate-50 hover:bg-blue-50'
                      }`}
                      onClick={() => setSelectedDept(dept)}
                    >
                      <span className={`font-medium ${selectedDept === dept ? 'text-blue-800 font-bold' : 'text-slate-700'}`}>
                        {dept}
                        {selectedDept === dept && <span className="ml-2 text-xs">✓ Selezionato</span>}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // Evita che il click selezioni il reparto
                          triggerDeleteDepartment(dept);
                        }}
                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                        title="Elimina reparto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                  {(!departmentsStructure[selectedCompany] || departmentsStructure[selectedCompany].length === 0) && (
                    <li className="text-gray-400 text-sm italic">Nessun reparto presente. Aggiungine uno.</li>
                  )}
                </ul>
              </div>

              <div className="bg-white p-4 rounded shadow-sm border border-blue-100">
                <h3 className="font-bold text-slate-600 mb-3 border-b pb-2">
                  Dipendenti in: {selectedCompany} - {selectedDept}
                </h3>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    placeholder="Nome dipendente" 
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <button 
                    onClick={addEmployee}
                    className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-emerald-700"
                  >
                    <UserPlus size={16} /> Aggiungi
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {currentEmployees.length > 0 ? (
                    <ul className="space-y-2">
                      {currentEmployees.map(emp => (
                        <li key={emp.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border text-sm">
                          <span>{emp.name}</span>
                          <button 
                            onClick={() => triggerDeleteEmployee(emp.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-sm">Nessun dipendente in questo reparto.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABELLA ORARI */}
        <div className="overflow-x-auto min-h-[400px]">
          {currentEmployees.length > 0 ? (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-gray-700 uppercase bg-gray-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-2 py-3 border bg-gray-200 w-32 min-w-[120px] z-20">DIPENDENTE</th>
                  {days.map((day, i) => (
                    <th key={i} className="px-1 py-2 border text-center min-w-[140px]">
                      {day}
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-2 font-normal normal-case">
                        <span>Entrata</span>
                        <span>Uscita</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-3 border bg-yellow-100 w-20 text-center font-bold text-black">TOTALE</th>
                </tr>
              </thead>
              <tbody>
                {currentEmployees.map((emp) => (
                  <tr key={`${emp.contextKey}-${emp.id}`} className="bg-white border-b hover:bg-blue-50 transition-colors group">
                    {multiCompanyMode && (
                      <td className="px-2 py-3 border text-xs text-gray-600 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="font-semibold">{emp.company}</div>
                        <div className="text-gray-500">{emp.department}</div>
                      </td>
                    )}
                    <td className={`px-2 py-3 border font-bold text-gray-800 ${multiCompanyMode ? '' : 'sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'}`}>
                      <div className="flex items-center gap-2">
                        <span>{emp.name}</span>
                        <button
                          onClick={() => {
                            // Imposta azienda e reparto prima di aprire il modal
                            if (multiCompanyMode) {
                              setSelectedCompany(emp.company);
                              setSelectedDept(emp.department);
                            }
                            openReplaceEmployeeModal(emp.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-blue-500 hover:text-blue-700 p-1 rounded transition-opacity"
                          title="Sostituisci dipendente (mantiene orari)"
                        >
                          <UserPlus size={14} />
                        </button>
                      </div>
                    </td>
                    {days.map((day, dayIdx) => {
                      // Usa contextKey per gestire dipendenti con stesso ID in aziende diverse
                      const scheduleKey = multiCompanyMode ? `${emp.contextKey}-${emp.id}` : emp.id;
                      const cellData = schedule[scheduleKey]?.[dayIdx] || {};
                      const isRest = cellData.code === 'R';
                      
                      return (
                        <td key={dayIdx} className={`p-1 border relative ${isRest ? 'bg-gray-200' : ''}`}>
                          <div className="absolute top-0 right-0 opacity-0 hover:opacity-100 z-10">
                            <select 
                              className="text-[10px] bg-slate-800 text-white p-0.5 rounded shadow-lg cursor-pointer"
                              onChange={(e) => handleQuickCode(emp.id, dayIdx, e.target.value, multiCompanyMode ? emp.contextKey : null)}
                              value={cellData.code || ''}
                            >
                              <option value="">Orario</option>
                              <option value="R">Riposo</option>
                              <option value="FERIE">Ferie</option>
                              <option value="MAL">Malattia</option>
                              <option value="AV">Avellino</option>
                              <option value="AT">Atripalda</option>
                            </select>
                          </div>

                          {cellData.code ? (
                            <div className="h-14 flex items-center justify-center font-bold text-lg text-slate-500 bg-opacity-50">
                              {cellData.code}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <input 
                                  type="text" 
                                  className="w-full border border-gray-300 rounded px-1 py-0.5 text-center focus:border-blue-500 focus:ring-1 focus:bg-white outline-none transition-all"
                                  value={cellData.in1 || ''}
                                  onChange={(e) => handleInputChange(emp.id, dayIdx, 'in1', e.target.value, multiCompanyMode ? emp.contextKey : null)}
                                  onBlur={(e) => handleBlur(emp.id, dayIdx, 'in1', e.target.value, multiCompanyMode ? emp.contextKey : null)}
                                />
                                <input 
                                  type="text" 
                                  className="w-full border border-gray-300 rounded px-1 py-0.5 text-center focus:border-blue-500 focus:ring-1 focus:bg-white outline-none transition-all"
                                  value={cellData.out1 || ''}
                                  onChange={(e) => handleInputChange(emp.id, dayIdx, 'out1', e.target.value, multiCompanyMode ? emp.contextKey : null)}
                                  onBlur={(e) => handleBlur(emp.id, dayIdx, 'out1', e.target.value, multiCompanyMode ? emp.contextKey : null)}
                                />
                              </div>
                              {(cellData.in1 || cellData.in2 || cellData.out1) && (
                                <div className="flex gap-1 animate-in fade-in duration-300">
                                  <input 
                                    type="text" 
                                    className="w-full border border-gray-200 rounded px-1 py-0.5 text-center text-xs focus:border-blue-500 outline-none bg-gray-50"
                                    value={cellData.in2 || ''}
                                    onChange={(e) => handleInputChange(emp.id, dayIdx, 'in2', e.target.value, multiCompanyMode ? emp.contextKey : null)}
                                    onBlur={(e) => handleBlur(emp.id, dayIdx, 'in2', e.target.value, multiCompanyMode ? emp.contextKey : null)}
                                  />
                                  <input 
                                    type="text" 
                                    className="w-full border border-gray-200 rounded px-1 py-0.5 text-center text-xs focus:border-blue-500 outline-none bg-gray-50"
                                    value={cellData.out2 || ''}
                                    onChange={(e) => handleInputChange(emp.id, dayIdx, 'out2', e.target.value, multiCompanyMode ? emp.contextKey : null)}
                                    onBlur={(e) => handleBlur(emp.id, dayIdx, 'out2', e.target.value, multiCompanyMode ? emp.contextKey : null)}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 border text-center font-bold text-lg bg-yellow-50 text-slate-800">
                      {calculateWeeklyTotal(emp.id, multiCompanyMode ? emp.contextKey : null)}
                    </td>
                  </tr>
                ))}
                {/* RIGA AGGIUNTA RAPIDA */}
                <tr className="bg-gray-50 border-b border-dashed border-gray-300 hover:bg-blue-50 transition-colors group">
                  {multiCompanyMode && (
                    <td className="px-2 py-3 border text-xs text-gray-500 sticky left-0 bg-gray-50 z-10 group-hover:bg-blue-50">
                      {selectedCompanies.length > 0 && (
                        <select
                          value={selectedAddCompany && selectedAddDept ? `${selectedAddCompany}-${selectedAddDept}` : `${selectedCompanies[0]}-${departmentsStructure[selectedCompanies[0]]?.[0] || ''}`}
                          onChange={(e) => {
                            const [company, dept] = e.target.value.split('-');
                            setSelectedAddCompany(company);
                            setSelectedAddDept(dept);
                          }}
                          className="text-xs bg-gray-100 border border-gray-300 rounded px-1 py-1 w-full"
                        >
                          {selectedCompanies.map(company => 
                            (departmentsStructure[company] || []).map(dept => (
                              <option key={`${company}-${dept}`} value={`${company}-${dept}`}>
                                {company} - {dept}
                              </option>
                            ))
                          )}
                        </select>
                      )}
                    </td>
                  )}
                  <td className={`px-2 py-3 border font-bold text-gray-500 ${multiCompanyMode ? '' : 'sticky left-0 bg-gray-50 z-10 group-hover:bg-blue-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'}`}>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          if (multiCompanyMode && selectedCompanies.length > 0) {
                            const company = selectedAddCompany || selectedCompanies[0];
                            const dept = selectedAddDept || departmentsStructure[selectedCompanies[0]]?.[0] || '';
                            handleQuickAddEmployee(company, dept);
                            // Reset dopo l'aggiunta
                            setSelectedAddCompany('');
                            setSelectedAddDept('');
                          } else {
                            handleQuickAddEmployee();
                          }
                        }}
                        className="p-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                        title="Aggiungi Dipendente"
                      >
                        <Plus size={16} />
                      </button>
                      <input 
                        type="text" 
                        placeholder="Nuovo Dipendente..." 
                        value={quickAddName}
                        onChange={(e) => setQuickAddName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (multiCompanyMode && selectedCompanies.length > 0) {
                              const company = selectedAddCompany || selectedCompanies[0];
                              const dept = selectedAddDept || departmentsStructure[selectedCompanies[0]]?.[0] || '';
                              handleQuickAddEmployee(company, dept);
                              // Reset dopo l'aggiunta
                              setSelectedAddCompany('');
                              setSelectedAddDept('');
                            } else {
                              handleQuickAddEmployee();
                            }
                          }
                        }}
                        className="w-full bg-transparent border-b border-gray-400 focus:border-blue-500 outline-none text-sm uppercase placeholder-gray-400"
                      />
                    </div>
                  </td>
                  {days.map((_, i) => (
                    <td key={i} className="p-1 border bg-gray-50 group-hover:bg-blue-50"></td>
                  ))}
                  <td className="p-1 border bg-gray-50 group-hover:bg-blue-50"></td>
                </tr>
                
                {/* MODULO RICERCA E FILTRO AZIENDE */}
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={multiCompanyMode ? 10 : 9} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowCompanyFilter(!showCompanyFilter)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          <Building2 size={16} />
                          {showCompanyFilter ? 'Nascondi' : 'Mostra'} Filtro Aziende
                        </button>
                        {multiCompanyMode && (
                          <span className="text-sm text-gray-600">
                            {selectedCompanies.length} {selectedCompanies.length === 1 ? 'azienda' : 'aziende'} selezionate
                          </span>
                        )}
                      </div>
                      {multiCompanyMode && (
                        <button
                          onClick={() => {
                            setSelectedCompanies([]);
                            setShowCompanyFilter(false);
                          }}
                          className="px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                        >
                          Reset Filtro
                        </button>
                      )}
                    </div>
                    
                    {showCompanyFilter && (
                      <div className="mt-3 p-3 bg-white rounded border border-blue-200 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-700 mb-2">Seleziona Aziende da Visualizzare:</h4>
                        <div className="flex flex-wrap gap-3">
                          {companies.map(company => (
                            <label key={company} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded cursor-pointer hover:bg-blue-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedCompanies.includes(company)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCompanies(prev => [...prev, company]);
                                  } else {
                                    setSelectedCompanies(prev => prev.filter(c => c !== company));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="text-sm font-medium text-gray-700">{company}</span>
                            </label>
                          ))}
                        </div>
                        {selectedCompanies.length === 0 && (
                          <p className="mt-2 text-xs text-gray-500 italic">
                            Seleziona almeno un'azienda per visualizzare i dipendenti. Se non selezioni nessuna azienda, verrà mostrata solo l'azienda selezionata nel menu principale.
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white">
               <UserPlus size={48} className="mb-4 opacity-20" />
               <p className="text-lg">Nessun dipendente in questo reparto.</p>
               <div className="mt-4 flex gap-2">
                 <input 
                    type="text" 
                    placeholder="Nome dipendente" 
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickAddEmployee()}
                    className="border border-gray-300 rounded px-3 py-2"
                  />
                  <button 
                    onClick={handleQuickAddEmployee}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Aggiungi
                  </button>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimesheetManager;

