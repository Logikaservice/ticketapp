import React, { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Plus, Download, Calculator, Calendar, Settings, X, UserPlus, Building2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const TimesheetManager = ({ currentUser, getAuthHeader }) => {
  // --- STATI GENERALI ---
  const [showSettings, setShowSettings] = useState(false);
  // weekRange non è più usato direttamente, ma mantenuto per compatibilità
  const [weekRange, setWeekRange] = useState(() => {
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
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  // --- STATO CODICI ORARI ---
  const [timeCodes, setTimeCodes] = useState({
    'R': 'Riposo',
    'F': 'Ferie',
    'M': 'Malattia',
    'P': 'Permesso',
    'I': 'Infortunio'
  });
  const [timeCodesOrder, setTimeCodesOrder] = useState(['R', 'F', 'M', 'P', 'I']); // Ordine di visualizzazione
  const [newCodeKey, setNewCodeKey] = useState('');
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [draggedCodeIndex, setDraggedCodeIndex] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    empId: null,
    dayIndex: null,
    contextKey: null,
    weekRangeValue: null
  });

  // Stato per popup giorni assenza
  const [absenceDaysModal, setAbsenceDaysModal] = useState({
    isOpen: false,
    empId: null,
    dayIndex: null,
    code: null,
    codeKey: null,
    contextKey: null,
    weekRangeValue: null,
    days: 1
  });

  // Stato per sostituzione dipendente
  const [replaceEmployeeModal, setReplaceEmployeeModal] = useState({
    isOpen: false,
    oldEmployeeId: null,
    oldEmployeeName: '',
    newEmployeeName: '',
    newEmployeeId: null
  });

  // --- SISTEMA MULTI-LISTA ---
  // Ogni lista ha filtri indipendenti per confrontare reparti/aziende/settimane diverse
  const [viewLists, setViewLists] = useState([
    {
      id: 1,
      company: '',
      department: '',
      weekRange: (() => {
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
      })()
    }
  ]);

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  // --- FUNZIONI HELPER PER SETTIMANE ---
  // Calcola il lunedì di una settimana (offset: 0 = questa settimana, 1 = prossima, -1 = scorsa, ecc.)
  const getWeekDates = (offset = 0) => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    monday.setDate(monday.getDate() + (offset * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const formatDate = (d) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    return {
      monday,
      sunday,
      formatted: `${formatDate(monday)} al ${formatDate(sunday)}`,
      label: offset === 0 ? 'Questa settimana' :
        offset === 1 ? 'Prossima settimana' :
          offset === -1 ? 'Settimana scorsa' :
            offset > 1 ? `Tra ${offset} settimane` :
              `${Math.abs(offset)} settimane fa`
    };
  };

  // Genera opzioni settimane (da -2 a +8 settimane)
  const getWeekOptions = () => {
    const options = [];
    for (let i = -2; i <= 8; i++) {
      const week = getWeekDates(i);
      options.push({
        value: week.formatted,
        label: `${week.label} (${week.formatted})`,
        offset: i
      });
    }
    return options;
  };

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

  // --- SALVATAGGIO AUTOMATICO QUANDO CAMBIANO I DIPENDENTI ---
  useEffect(() => {
    // Non salvare durante il caricamento iniziale
    if (loading) return;

    // Non salvare se non ci sono dati
    if (Object.keys(employeesData).length === 0) return;

    console.log('🔄 employeesData cambiato, salvataggio automatico tra 500ms...');

    // Debounce: salva dopo 500ms dall'ultimo cambiamento
    const timeoutId = setTimeout(() => {
      console.log('💾 Esecuzione salvataggio automatico...');
      saveData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [employeesData]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📥 Caricamento dati dal backend...');
      const response = await fetch(buildApiUrl('/api/orari/data'), {
        headers: getAuthHeader()
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📥 Dati ricevuti dal backend:', {
          companies: data.companies?.length || 0,
          departments: Object.keys(data.departments || {}).length,
          employees: Object.keys(data.employees || {}).length,
          schedule: Object.keys(data.schedule || {}).length
        });

        // Log dettagliato dipendenti ricevuti
        if (data.employees) {
          const employeeKeys = Object.keys(data.employees);
          console.log('👥 Chiavi dipendenti ricevute dal backend:', employeeKeys);
          employeeKeys.forEach(key => {
            const count = Array.isArray(data.employees[key]) ? data.employees[key].length : 0;
            console.log(`   - ${key}: ${count} dipendenti`, data.employees[key]);
          });
        }

        // Se ci sono aziende, carica i dati
        if (data.companies && data.companies.length > 0) {
          setCompanies(data.companies.map(c => String(c).trim()));
          setSelectedCompany(String(data.companies[0]).trim());
          setDepartmentsStructure(data.departments || {});

          // Pulisci i dati employees rimuovendo chiavi invalide
          const cleanedEmployees = {};
          if (data.employees) {
            Object.keys(data.employees).forEach(key => {
              const cleanKey = String(key).trim();
              // Rimuovi chiavi con [object Object] o chiavi invalide
              if (cleanKey && !cleanKey.includes('[object Object]') && Array.isArray(data.employees[key])) {
                cleanedEmployees[cleanKey] = data.employees[key];
              } else {
                console.warn('⚠️ Chiave invalida rimossa:', key);
              }
            });
          }

          console.log('✅ Dipendenti puliti e caricati:', Object.keys(cleanedEmployees));
          console.log('📊 Dettaglio dipendenti caricati:', cleanedEmployees);

          // Verifica che i dipendenti siano stati caricati correttamente
          Object.keys(cleanedEmployees).forEach(key => {
            const count = Array.isArray(cleanedEmployees[key]) ? cleanedEmployees[key].length : 0;
            console.log(`   ✅ ${key}: ${count} dipendenti caricati`, cleanedEmployees[key]);
          });

          setEmployeesData(cleanedEmployees);

          // Migra automaticamente i dati vecchi (senza settimana) alla settimana corrente
          const currentWeek = getWeekDates(0).formatted;
          const oldSchedule = data.schedule || {};
          const migratedSchedule = { ...oldSchedule };

          // Trova tutte le chiavi vecchie (che non contengono una data nel formato "dd/mm/yyyy al dd/mm/yyyy")
          const weekPattern = /^\d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}-/;
          Object.keys(oldSchedule).forEach(oldKey => {
            // Se la chiave non contiene una settimana, è una chiave vecchia
            if (!weekPattern.test(oldKey)) {
              // Per ogni dipendente, migra i dati alla settimana corrente
              const employeeSchedule = oldSchedule[oldKey];
              if (employeeSchedule && typeof employeeSchedule === 'object') {
                const newKey = `${currentWeek}-${oldKey}`;
                // Migra solo se non esiste già una chiave nuova per questa settimana
                if (!migratedSchedule[newKey]) {
                  migratedSchedule[newKey] = employeeSchedule;
                  console.log(`🔄 Migrato dati da "${oldKey}" a "${newKey}"`);
                }
              }
            }
          });

          setSchedule(migratedSchedule);

          // Salva la migrazione se ci sono state modifiche
          if (Object.keys(migratedSchedule).length > Object.keys(oldSchedule).length) {
            setTimeout(() => {
              saveData();
            }, 1000);
          }

          // Imposta il primo reparto della prima azienda
          const firstDept = data.departments?.[data.companies[0]]?.[0];
          if (firstDept) {
            setSelectedDept(firstDept);
          }

          // Verifica finale dopo il setState
          setTimeout(() => {
            console.log('🔍 Verifica finale stato dopo caricamento:', {
              employeesDataKeys: Object.keys(cleanedEmployees),
              employeesDataCount: Object.keys(cleanedEmployees).reduce((sum, key) => sum + (cleanedEmployees[key]?.length || 0), 0)
            });
          }, 100);

          // Inizializza con la prima azienda selezionata (ma non in modalità multi-azienda)
          // setSelectedCompanies([]); // Non selezionare nessuna azienda di default
          // Carica i codici orari se presenti, altrimenti mantieni i default
          console.log('📋 Codici orari ricevuti dal backend:', {
            timeCodes: data.timeCodes ? Object.keys(data.timeCodes) : 'NON PRESENTI',
            timeCodesOrder: data.timeCodesOrder || 'NON PRESENTE',
            count: data.timeCodes ? Object.keys(data.timeCodes).length : 0
          });
          
          if (data.timeCodes && Object.keys(data.timeCodes).length > 0) {
            console.log('✅ Caricamento codici orari dal database:', data.timeCodes);
            setTimeCodes(data.timeCodes);
            // Carica l'ordine se presente, altrimenti usa l'ordine delle chiavi
            if (data.timeCodesOrder && Array.isArray(data.timeCodesOrder)) {
              setTimeCodesOrder(data.timeCodesOrder);
            } else {
              // Retrocompatibilità: genera l'ordine dalle chiavi esistenti
              setTimeCodesOrder(Object.keys(data.timeCodes));
            }
          } else {
            console.log('⚠️ Nessun codice orario nel database, uso i default');
          }
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
            schedule: {},
            timeCodes: {
              'R': 'Riposo',
              'F': 'Ferie',
              'M': 'Malattia',
              'P': 'Permesso',
              'I': 'Infortunio'
            }
          };
          setCompanies(defaultData.companies);
          setSelectedCompany(defaultData.companies[0]);
          setDepartmentsStructure(defaultData.departments);
          setEmployeesData(defaultData.employees);
          setSchedule(defaultData.schedule);
          setTimeCodes(defaultData.timeCodes);
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
  const saveData = async (overrideTimeCodes = null, overrideTimeCodesOrder = null) => {
    try {
      // Usa i parametri override se forniti, altrimenti usa lo stato corrente
      const codesToSave = overrideTimeCodes !== null ? overrideTimeCodes : timeCodes;
      const orderToSave = overrideTimeCodesOrder !== null ? overrideTimeCodesOrder : timeCodesOrder;
      
      // Usa lo stato corrente per assicurarsi di salvare i dati più recenti
      const dataToSave = {
        companies,
        departments: departmentsStructure,
        employees: employeesData,
        schedule,
        timeCodes: codesToSave,
        timeCodesOrder: orderToSave
      };

      // Log codici orari prima del salvataggio
      console.log('💾 Salvataggio dati - Codici orari inclusi:', {
        timeCodes: codesToSave ? Object.keys(codesToSave) : 'NON PRESENTI',
        timeCodesOrder: orderToSave || 'NON PRESENTE',
        count: codesToSave ? Object.keys(codesToSave).length : 0,
        details: codesToSave || {},
        source: overrideTimeCodes !== null ? 'PARAMETRI DIRETTI' : 'STATO REACT'
      });

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
      return allEmployees;
    } else {
      // Modalità singola azienda (comportamento originale)
      // Se non ci sono aziende selezionate, usa l'azienda selezionata nel dropdown
      const company = selectedCompany || companies[0];
      const dept = selectedDept || departmentsStructure[company]?.[0] || '';
      const key = getContextKey(company, dept);
      const employees = employeesData[key] || [];
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

  const calculateWeeklyTotal = (empId, contextKey = null, weekRangeValue = null) => {
    let total = 0;
    // Usa la settimana selezionata nella lista corrente, altrimenti usa weekRange globale
    const currentWeek = weekRangeValue || weekRange;
    // Usa contextKey se fornito (modalità multi-azienda), altrimenti usa empId
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    // Chiave completa: settimana-baseKey
    const scheduleKey = `${currentWeek}-${baseKey}`;
    const empSchedule = schedule[scheduleKey] || {};
    days.forEach((_, index) => {
      total += calculateDailyHours(empSchedule[index]);
    });
    return isNaN(total) ? "0.0" : total.toFixed(1);
  };

  // --- INPUT HANDLERS ---
  const handleInputChange = (empId, dayIndex, field, value, contextKey = null, weekRangeValue = null) => {
    // Usa la settimana selezionata nella lista corrente, altrimenti usa weekRange globale
    const currentWeek = weekRangeValue || weekRange;
    // Usa contextKey se fornito (modalità multi-azienda), altrimenti usa empId
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    // Chiave completa: settimana-baseKey
    const scheduleKey = `${currentWeek}-${baseKey}`;

    setSchedule(prev => ({
      ...prev,
      [scheduleKey]: { ...prev[scheduleKey], [dayIndex]: { ...prev[scheduleKey]?.[dayIndex], [field]: value } }
    }));
    // Salva automaticamente dopo ogni modifica
    setTimeout(() => saveData(), 500);
  };

  const handleBlur = (empId, dayIndex, field, value, contextKey = null, weekRangeValue = null) => {
    // Logica Shortcut su in1
    if (field === 'in1' && value) {
      const upperVal = String(value).toUpperCase();
      // Usa i codici dinamici dallo stato
      const shortcuts = timeCodes;

      if (shortcuts[upperVal]) {
        handleQuickCode(empId, dayIndex, shortcuts[upperVal], contextKey, weekRangeValue);
        return; // Interrompi il salvataggio normale dell'orario
      }
    }

    if (!value) return;
    const strValue = String(value);
    let formatted = strValue.replace(',', '.').replace(':', '.').trim();
    if (!formatted.includes('.')) formatted += '.00';
    const parts = formatted.split('.');
    if (parts[0].length === 1) parts[0] = '0' + parts[0];
    if (parts[1].length === 1) parts[1] = parts[1] + '0';
    formatted = parts.join('.');
    if (formatted !== value) handleInputChange(empId, dayIndex, field, formatted, contextKey, weekRangeValue);
    // Salva automaticamente dopo ogni modifica
    setTimeout(() => saveData(), 500);
  };

  // Mappatura codici geografici → aziende
  const getCompanyFromGeographicCode = (code) => {
    const codeMap = {
      'AT': 'Atripalda',
      'AV': 'Avellino',
      'L': 'Lioni'
    };
    return codeMap[code] || null;
  };

  // Verifica se un codice è geografico
  const isGeographicCode = (code) => {
    return ['AT', 'AV', 'L'].includes(code);
  };

  // Verifica se un codice è assenza
  const isAbsenceCode = (code) => {
    return ['R', 'F', 'M', 'I'].includes(code);
  };

  const handleQuickCode = (empId, dayIndex, code, contextKey = null, weekRangeValue = null) => {
    // Usa la settimana selezionata nella lista corrente, altrimenti usa weekRange globale
    const currentWeek = weekRangeValue || weekRange;
    // Usa contextKey se fornito (modalità multi-azienda), altrimenti usa empId
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    // Chiave completa: settimana-baseKey
    const scheduleKey = `${currentWeek}-${baseKey}`;

    // Estrai azienda e reparto dal contextKey (formato: "Azienda-Reparto")
    let currentCompany = '';
    let currentDept = '';
    if (contextKey) {
      const parts = contextKey.split('-');
      currentCompany = parts[0] || '';
      currentDept = parts.slice(1).join('-') || '';
    } else {
      // Se non c'è contextKey, prova a dedurlo dalla lista corrente
      currentCompany = selectedCompany || companies[0] || '';
      currentDept = selectedDept || '';
    }

    // Trova il codice key dal label (es. "Avellino" → "AV")
    const codeKey = Object.keys(timeCodes).find(key => timeCodes[key] === code) || '';
    
    // Se è un codice assenza, mostra popup per giorni
    if (isAbsenceCode(codeKey)) {
      setAbsenceDaysModal({
        isOpen: true,
        empId,
        dayIndex,
        code,
        codeKey,
        contextKey,
        weekRangeValue,
        days: 1
      });
      return; // Non applicare subito, aspetta conferma giorni
    }

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

      // Se è un codice geografico, salva anche nell'altra azienda
      if (isGeographicCode(codeKey) && currentCompany) {
        const targetCompany = getCompanyFromGeographicCode(codeKey);
        if (targetCompany && targetCompany !== currentCompany) {
          // Trova il dipendente corrente
          const empKey = contextKey || `${currentCompany}-${currentDept}`;
          const employees = employeesData[empKey] || [];
          const employee = employees.find(e => e.id === empId);
          
          if (employee) {
            // Crea/salva il dipendente nell'azienda target se non esiste
            const targetKey = `${targetCompany}-${currentDept}`;
            setEmployeesData(prev => {
              const targetEmployees = prev[targetKey] || [];
              const exists = targetEmployees.some(e => e.id === empId && e.name === employee.name);
              if (!exists) {
                return {
                  ...prev,
                  [targetKey]: [...targetEmployees, { id: empId, name: employee.name }]
                };
              }
              return prev;
            });

            // Salva lo stesso orario nell'azienda target
            const targetScheduleKey = `${currentWeek}-${targetKey}-${empId}`;
            newSchedule[targetScheduleKey] = {
              ...newSchedule[targetScheduleKey],
              [dayIndex]: {
                code: code,
                in1: '',
                out1: '',
                in2: '',
                out2: '',
                fromCompany: currentCompany // Flag per indicare da dove viene
              }
            };
          }
        }
      }

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

  // Applica codice assenza a giorni consecutivi
  const applyAbsenceCode = (empId, startDayIndex, code, codeKey, days, contextKey = null, weekRangeValue = null) => {
    const currentWeek = weekRangeValue || weekRange;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;

    setSchedule(prev => {
      const newSchedule = { ...prev };
      if (!newSchedule[scheduleKey]) {
        newSchedule[scheduleKey] = {};
      }

      // Applica il codice ai giorni consecutivi
      for (let i = 0; i < days && (startDayIndex + i) < 7; i++) {
        newSchedule[scheduleKey][startDayIndex + i] = {
          code: code,
          in1: '',
          out1: '',
          in2: '',
          out2: ''
        };
      }

      setTimeout(() => {
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
        schedule: scheduleToSave || schedule,
        timeCodes,
        timeCodesOrder
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

  // Funzione per salvare direttamente i dati dipendenti
  const saveDataDirectly = async (empData, companiesData, deptsData, scheduleData) => {
    try {
      console.log('💾 saveDataDirectly chiamata con:', {
        empDataKeys: Object.keys(empData || {}),
        companiesCount: companiesData?.length || 0,
        deptsKeys: Object.keys(deptsData || {}),
        scheduleKeys: Object.keys(scheduleData || {})
      });

      // Pulisci i dati employees
      const cleanedEmployees = {};
      if (empData) {
        Object.keys(empData).forEach(key => {
          const cleanKey = String(key).trim();
          if (cleanKey && !cleanKey.includes('[object Object]') && Array.isArray(empData[key])) {
            cleanedEmployees[cleanKey] = empData[key];
            console.log(`   ✅ Chiave pulita: ${cleanKey} con ${empData[key].length} dipendenti`);
          } else {
            console.warn(`   ⚠️ Chiave scartata: ${key}`);
          }
        });
      }

      const dataToSave = {
        companies: (companiesData || []).map(c => String(c).trim()),
        departments: deptsData || {},
        employees: cleanedEmployees,
        schedule: scheduleData || {},
        timeCodes: timeCodes
      };

      console.log('📤 Invio dati al backend:', {
        companies: dataToSave.companies,
        departmentsKeys: Object.keys(dataToSave.departments),
        employeesKeys: Object.keys(dataToSave.employees),
        scheduleKeys: Object.keys(dataToSave.schedule)
      });

      const response = await fetch(buildApiUrl('/api/orari/save'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nel salvataggio');
      }

      const result = await response.json();
      console.log('✅ Dipendente salvato con successo:', result);
      return true;
    } catch (error) {
      console.error('❌ Errore salvataggio dipendente:', error);
      alert(`Errore nel salvataggio: ${error.message}`);
      return false;
    }
  };

  // --- AZIONI STRUTTURA ---
  const handleQuickAddEmployee = (targetCompany = null, targetDept = null, weekRangeValue = null, forceName = null) => {
    const nameToUse = forceName || quickAddName;
    if (!nameToUse.trim()) return;

    // Se modalità multi-azienda e non specificato, usa la prima azienda selezionata
    let company = targetCompany || selectedCompany;
    let dept = targetDept || selectedDept;

    if (multiCompanyMode && selectedCompanies.length > 0 && !targetCompany) {
      company = selectedAddCompany || selectedCompanies[0];
      dept = selectedAddDept || departmentsStructure[selectedCompanies[0]]?.[0] || '';
    }

    // Assicurati che company e dept siano stringhe (non oggetti)
    company = String(company || '').trim();
    dept = String(dept || '').trim();

    // Verifica che company e dept siano validi
    if (!company || !dept) {
      alert(`Errore: Azienda o reparto non validi. Azienda: ${company || 'non selezionata'}, Reparto: ${dept || 'non selezionato'}`);
      return;
    }

    const key = getContextKey(company, dept);
    const employeeName = nameToUse.toUpperCase().trim();

    // Cerca il dipendente tra quelli già creati per questa azienda/reparto
    const existingEmployees = employeesData[key] || [];

    const foundEmployee = existingEmployees.find(emp => {
      const empName = String(emp.name || '').toUpperCase().trim();
      return empName === employeeName;
    });

    if (!foundEmployee) {
      // Rimosso alert come richiesto
      // alert(`Dipendente "${employeeName}" non trovato in ${company} - ${dept}.\n\nDipendenti disponibili: ${availableNames}\n\nCrea prima il dipendente dall'ingranaggio (⚙️) nelle impostazioni.`);
      // setQuickAddName('');
      return;
    }

    // Se il dipendente esiste, aggiungi gli orari vuoti per la settimana corrente
    const currentWeek = weekRangeValue || getWeekDates(0).formatted;
    const baseKey = key;
    const scheduleKey = `${currentWeek}-${baseKey}-${foundEmployee.id}`;

    // Verifica se ha già orari per questa settimana
    if (!schedule[scheduleKey]) {
      // Crea una struttura vuota per questa settimana
      setSchedule(prev => ({
        ...prev,
        [scheduleKey]: {}
      }));
      // Salva automaticamente
      setTimeout(() => saveData(), 500);
    }

    console.log('✅ Dipendente aggiunto alla settimana:', {
      nome: foundEmployee.name,
      azienda: company,
      reparto: dept,
      settimana: currentWeek,
      id: foundEmployee.id
    });

    // Reset campi
    setQuickAddName('');
    setShowSuggestions(false);
    if (multiCompanyMode) {
      setSelectedAddCompany('');
      setSelectedAddDept('');
    }

    // Focus automatico sul primo campo orario (Lunedì Entrata)
    setTimeout(() => {
      const inputId = `input-${foundEmployee.id}-0-in1`;
      const element = document.getElementById(inputId);
      if (element) {
        element.focus();
        element.select(); // Seleziona anche il contenuto se presente
      }
    }, 300); // Piccolo ritardo per permettere il render
  };

  const handleCreateAndAddEmployee = (name, targetCompany, targetDept, weekRangeValue) => {
    if (!name.trim()) return;

    const company = targetCompany || selectedCompany;
    const dept = targetDept || selectedDept;
    const key = getContextKey(company, dept);
    const newId = Date.now();
    const newName = name.toUpperCase().trim();

    // 1. Crea il dipendente in employeesData
    setEmployeesData(prev => {
      const updated = {
        ...prev,
        [key]: [...(prev[key] || []), { id: newId, name: newName }]
      };

      // 2. Aggiungi subito alla settimana corrente
      const currentWeek = weekRangeValue || getWeekDates(0).formatted;
      const scheduleKey = `${currentWeek}-${key}-${newId}`;

      setSchedule(prevSchedule => {
        const newSchedule = {
          ...prevSchedule,
          [scheduleKey]: {}
        };

        // 3. Salva tutto
        setTimeout(() => {
          saveDataWithStructure(departmentsStructure, updated, newSchedule);
        }, 500);

        return newSchedule;
      });

      return updated;
    });

    setQuickAddName('');
    setShowSuggestions(false);

    // Focus automatico sul primo campo orario (Lunedì Entrata)
    setTimeout(() => {
      const inputId = `input-${newId}-0-in1`;
      const element = document.getElementById(inputId);
      if (element) {
        element.focus();
        element.select();
      }
    }, 600); // Ritardo leggermente maggiore perché c'è anche il salvataggio struttura
  };


  // --- GESTIONE CODICI ORARI ---
  const addTimeCode = () => {
    if (!newCodeKey.trim() || !newCodeLabel.trim()) return;
    const key = newCodeKey.toUpperCase().trim();
    if (key.length > 2) {
      alert("Il codice deve essere di massimo 2 caratteri (es. M, F, P)");
      return;
    }
    if (timeCodes[key]) {
      alert("Questo codice esiste già!");
      return;
    }

    const newCodes = { ...timeCodes, [key]: newCodeLabel.trim() };
    const newOrder = [...timeCodesOrder, key];
    
    console.log('➕ Aggiunta nuovo codice orario:', {
      key: key,
      label: newCodeLabel.trim(),
      timeCodes: newCodes,
      timeCodesOrder: newOrder,
      count: Object.keys(newCodes).length
    });
    
    // Aggiorna lo stato
    setTimeCodes(newCodes);
    setTimeCodesOrder(newOrder); // Aggiungi alla fine dell'ordine
    setNewCodeKey('');
    setNewCodeLabel('');
    
    // Salva IMMEDIATAMENTE con i nuovi valori (non aspettare che React aggiorni lo stato)
    setTimeout(() => {
      console.log('💾 Salvataggio dopo aggiunta codice orario con valori diretti...');
      saveData(newCodes, newOrder); // Passa i nuovi valori direttamente
    }, 100); // Ridotto a 100ms per salvare più velocemente
  };

  const deleteTimeCode = (key) => {
    const newCodes = { ...timeCodes };
    delete newCodes[key];
    const newOrder = timeCodesOrder.filter(k => k !== key); // Rimuovi dall'ordine
    
    console.log('🗑️ Eliminazione codice orario:', {
      key: key,
      timeCodes: newCodes,
      timeCodesOrder: newOrder,
      count: Object.keys(newCodes).length
    });
    
    setTimeCodes(newCodes);
    setTimeCodesOrder(newOrder);
    // Salva IMMEDIATAMENTE con i nuovi valori
    setTimeout(() => saveData(newCodes, newOrder), 100);
  };

  const reorderTimeCodes = (fromIndex, toIndex) => {
    const newOrder = [...timeCodesOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    
    console.log('🔄 Riordinamento codici orari:', {
      fromIndex: fromIndex,
      toIndex: toIndex,
      newOrder: newOrder
    });
    
    setTimeCodesOrder(newOrder);
    // Salva IMMEDIATAMENTE con il nuovo ordine
    setTimeout(() => saveData(timeCodes, newOrder), 100);
  };

  // --- MENU CONTESTUALE ---
  const handleContextMenu = (e, empId, dayIndex, contextKey = null, weekRangeValue = null) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      empId,
      dayIndex,
      contextKey,
      weekRangeValue
    });
  };

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Chiudi menu al click fuori
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
      // Pulisci i dati employees
      const cleanedEmployees = {};
      const empDataToUse = empData || employeesData;
      if (empDataToUse) {
        Object.keys(empDataToUse).forEach(key => {
          const cleanKey = String(key).trim();
          if (cleanKey && !cleanKey.includes('[object Object]') && Array.isArray(empDataToUse[key])) {
            cleanedEmployees[cleanKey] = empDataToUse[key];
          }
        });
      }

      const dataToSave = {
        companies: (companies || []).map(c => String(c).trim()),
        departments: deptStructure || departmentsStructure,
        employees: cleanedEmployees,
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
        console.log('✅ Dati salvati con successo');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore salvataggio:', errorData);
      }
    } catch (error) {
      console.error('❌ Errore salvataggio:', error);
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

  // Rimuove dipendente solo dalla visualizzazione della settimana corrente (non dal database)
  const removeEmployeeFromWeek = (empId, contextKey = null, weekRangeValue = null) => {
    // NOTA: Non rimuoviamo più da employeesData, così il dipendente rimane nel DB

    // Rimuovi solo gli orari per questa settimana
    const currentWeek = weekRangeValue || getWeekDates(0).formatted;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;

    setSchedule(prev => {
      const newSchedule = { ...prev };
      delete newSchedule[scheduleKey];

      // Se c'era una vecchia chiave (compatibilità), rimuovi anche quella
      const oldKey = `${baseKey}`; // Se baseKey era solo empId o context-empId
      if (newSchedule[oldKey]) delete newSchedule[oldKey];

      // Salva le modifiche
      setTimeout(() => saveDataWithSchedule(newSchedule), 100);

      return newSchedule;
    });
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

  // --- GESTIONE MULTI-LISTA ---
  const addNewList = () => {
    const newId = Date.now();
    const newList = {
      id: newId,
      company: companies[0] || '',
      department: departmentsStructure[companies[0]]?.[0] || '',
      weekRange: weekRange
    };
    setViewLists(prev => [...prev, newList]);
    console.log('➕ Nuova lista aggiunta:', newList);
  };

  const removeList = (listId) => {
    setViewLists(prev => prev.filter(list => list.id !== listId));
    console.log('🗑️ Lista rimossa:', listId);
  };

  const updateListFilter = (listId, filterType, value) => {
    setViewLists(prev => prev.map(list => {
      if (list.id === listId) {
        const updated = { ...list, [filterType]: value };

        // Se cambia l'azienda, resetta il reparto al primo disponibile
        if (filterType === 'company') {
          updated.department = departmentsStructure[value]?.[0] || '';
        }

        console.log(`🔄 Filtro aggiornato per lista ${listId}:`, filterType, '=', value);
        return updated;
      }
      return list;
    }));
  };

  const getEmployeesForList = (listConfig) => {
    const { company, department, weekRange: listWeekRange } = listConfig;
    if (!company || !department) return [];

    const key = getContextKey(company, department);
    const employees = employeesData[key] || [];
    const currentWeek = listWeekRange || getWeekDates(0).formatted;

    // Filtra solo i dipendenti che hanno orari compilati per questa settimana
    const employeesWithSchedule = employees.filter(emp => {
      const baseKey = key.includes('-') ? key : `${company}-${department}`;
      const scheduleKey = `${currentWeek}-${baseKey}-${emp.id}`;
      // Prova anche con la vecchia chiave per compatibilità
      const oldScheduleKey = `${baseKey}-${emp.id}`;
      const hasSchedule = schedule[scheduleKey] || schedule[oldScheduleKey];

      if (hasSchedule) {
        // Se esiste l'oggetto schedule (anche vuoto), mostra il dipendente
        return true;
      }
      return false;
    });

    // Cerca anche dipendenti di altre aziende che hanno codici geografici per questa azienda
    const geographicEmployees = [];
    Object.keys(employeesData).forEach(otherKey => {
      if (otherKey === key) return; // Salta l'azienda corrente
      
      const [otherCompany, ...otherDeptParts] = otherKey.split('-');
      const otherDept = otherDeptParts.join('-');
      
      // Verifica se questa azienda è target di un codice geografico
      const geographicCodes = Object.keys(timeCodes).filter(codeKey => {
        const targetCompany = getCompanyFromGeographicCode(codeKey);
        return targetCompany === company;
      });
      
      if (geographicCodes.length > 0) {
        const otherEmployees = employeesData[otherKey] || [];
        otherEmployees.forEach(emp => {
          const otherScheduleKey = `${currentWeek}-${otherKey}-${emp.id}`;
          const otherSchedule = schedule[otherScheduleKey];
          
          if (otherSchedule) {
            // Verifica se ha un codice geografico per questa azienda
            const hasGeographicCode = Object.values(otherSchedule).some(dayData => {
              if (!dayData || !dayData.code) return false;
              const dayCodeKey = Object.keys(timeCodes).find(k => timeCodes[k] === dayData.code);
              return geographicCodes.includes(dayCodeKey);
            });
            
            if (hasGeographicCode) {
              geographicEmployees.push({
                ...emp,
                company: company,
                department: department,
                contextKey: key,
                isGeographic: true,
                originalCompany: otherCompany,
                originalDept: otherDept
              });
            }
          }
        });
      }
    });

    // Combina i dipendenti normali con quelli geografici (evita duplicati)
    const allEmployees = [...employeesWithSchedule];
    geographicEmployees.forEach(geoEmp => {
      if (!allEmployees.some(e => e.id === geoEmp.id && e.contextKey === geoEmp.contextKey)) {
        allEmployees.push(geoEmp);
      }
    });

    return allEmployees.map(emp => ({
      ...emp,
      company: emp.company || company,
      department: emp.department || department,
      contextKey: emp.contextKey || key
    }));
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
      let hasExportedData = false;

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

      viewLists.forEach((list, listIndex) => {
        const { company, department, weekRange: listWeekRange } = list;
        if (!company || !department) return;

        const listEmployees = getEmployeesForList(list);
        if (listEmployees.length === 0) return;

        hasExportedData = true;

        const wsData = [];
        const merges = [];

        const titleRow = new Array(16).fill({ v: "", s: styleTitle });
        titleRow[0] = { v: `REPARTO ${company.toUpperCase()} - ${department.toUpperCase()}`, s: styleTitle };
        wsData.push(titleRow);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } });

        const subTitleRow = new Array(16).fill({ v: "", s: styleTitle });
        subTitleRow[0] = { v: `Orario settimanale: ${listWeekRange}`, s: { ...styleTitle, font: { sz: 11 } } };
        wsData.push(subTitleRow);
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 15 } });

        const headerRow1 = new Array(16).fill(null);
        headerRow1[0] = { v: "DIPENDENTE", s: styleHeader };
        headerRow1[15] = { v: "TOTALE", s: styleTotalHeader };

        for (let i = 0; i < 7; i++) {
          const col = 1 + (i * 2);
          headerRow1[col] = { v: days[i], s: styleHeader };
          headerRow1[col + 1] = { v: "", s: styleHeader };
          merges.push({ s: { r: 2, c: col }, e: { r: 2, c: col + 1 } });
        }
        wsData.push(headerRow1);

        const headerRow2 = new Array(16).fill(null);
        headerRow2[0] = { v: "", s: styleHeader };
        headerRow2[15] = { v: "", s: styleTotalHeader };

        merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });
        merges.push({ s: { r: 2, c: 15 }, e: { r: 3, c: 15 } });

        for (let i = 0; i < 7; i++) {
          const col = 1 + (i * 2);
          headerRow2[col] = { v: "Entrata", s: styleHeader };
          headerRow2[col + 1] = { v: "Uscita", s: styleHeader };
        }
        wsData.push(headerRow2);

        listEmployees.forEach(emp => {
          const startRowIndex = wsData.length;
          // Costruisci la chiave corretta includendo la settimana
          const currentWeek = listWeekRange || getWeekDates(0).formatted;
          // Usa contextKey se disponibile (modalità multi-azienda), altrimenti usa empId
          // Nota: getEmployeesForList aggiunge sempre contextKey
          const baseKey = emp.contextKey ? `${emp.contextKey}-${emp.id}` : emp.id;
          const scheduleKey = `${currentWeek}-${baseKey}`;

          const row1 = new Array(16).fill(null).map(() => ({ v: "", s: styleCell }));
          const row2 = new Array(16).fill(null).map(() => ({ v: "", s: styleCell }));

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
              row1[colIdx + 1] = { v: data.code, s: styleCell };
              merges.push({ s: { r: startRowIndex, c: colIdx }, e: { r: startRowIndex + 1, c: colIdx } });
              merges.push({ s: { r: startRowIndex, c: colIdx + 1 }, e: { r: startRowIndex + 1, c: colIdx + 1 } });
            } else {
              const valIn1 = strToExcelTime(data?.in1);
              const valOut1 = strToExcelTime(data?.out1);
              if (valIn1 !== null) row1[colIdx] = { v: valIn1, t: 'n', z: 'h:mm', s: styleCell };
              if (valOut1 !== null) row1[colIdx + 1] = { v: valOut1, t: 'n', z: 'h:mm', s: styleCell };

              const valIn2 = strToExcelTime(data?.in2);
              const valOut2 = strToExcelTime(data?.out2);
              if (valIn2 !== null) row2[colIdx] = { v: valIn2, t: 'n', z: 'h:mm', s: styleCell };
              if (valOut2 !== null) row2[colIdx + 1] = { v: valOut2, t: 'n', z: 'h:mm', s: styleCell };

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
        for (let i = 0; i < 14; i++) wscols.push({ wch: 9 });
        wscols.push({ wch: 10 });
        ws['!cols'] = wscols;

        let sheetName = `${company} - ${department}`;
        const duplicateCount = viewLists.filter((l, i) => i < listIndex && l.company === company && l.department === department).length;
        if (duplicateCount > 0) {
          sheetName += ` (${duplicateCount + 1})`;
        }
        sheetName = sheetName.substring(0, 31).replace(/[^a-zA-Z0-9 -]/g, "");

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      if (!hasExportedData) {
        alert("Nessun dato da esportare nelle liste visualizzate.");
        return;
      }

      const fileName = `Turni_Multi_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

    } catch (error) {
      console.error("Export error:", error);
      openConfirm("Errore Esportazione", "Si è verificato un errore. Prova a ricaricare la pagina.", null);
    }
  };

  // --- RENDER LISTA ---
  const renderEmployeeList = (listConfig, index) => {
    const { id, company, department, weekRange: listWeekRange } = listConfig;
    const listEmployees = getEmployeesForList(listConfig);
    const isFirstList = index === 0;

    return (
      <div key={id} className="mb-8 border-b-4 border-slate-200 pb-8 last:border-0">
        {/* FILTRI LISTA */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 mb-4 mx-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1">
              {/* Filtro Azienda */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600 mb-1">Azienda</label>
                <select
                  value={company || ''}
                  onChange={(e) => updateListFilter(id, 'company', e.target.value)}
                  className="bg-white border-2 border-blue-300 rounded px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleziona Azienda</option>
                  {companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Filtro Reparto */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600 mb-1">Reparto</label>
                <select
                  value={department || ''}
                  onChange={(e) => updateListFilter(id, 'department', e.target.value)}
                  disabled={!company}
                  className="bg-white border-2 border-blue-300 rounded px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Seleziona Reparto</option>
                  {(departmentsStructure[company] || []).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Filtro Settimana */}
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600 mb-1">Settimana</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={(() => {
                      // Estrai la data di inizio dal weekRange (formato: "dd/mm/yyyy al dd/mm/yyyy")
                      if (listWeekRange) {
                        const startDateStr = listWeekRange.split(' al ')[0];
                        const [day, month, year] = startDateStr.split('/');
                        return `${year}-${month}-${day}`;
                      }
                      const week = getWeekDates(0);
                      const [day, month, year] = week.formatted.split(' al ')[0].split('/');
                      return `${year}-${month}-${day}`;
                    })()}
                    onChange={(e) => {
                      const selectedDate = new Date(e.target.value);
                      const monday = new Date(selectedDate);
                      monday.setDate(selectedDate.getDate() - (selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1));
                      const sunday = new Date(monday);
                      sunday.setDate(monday.getDate() + 6);
                      const formatDate = (d) => {
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}/${month}/${year}`;
                      };
                      const newWeekRange = `${formatDate(monday)} al ${formatDate(sunday)}`;
                      updateListFilter(id, 'weekRange', newWeekRange);
                    }}
                    className="bg-white border-2 border-blue-300 rounded px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">al</span>
                  <input
                    type="date"
                    value={(() => {
                      // Estrai la data di fine dal weekRange
                      if (listWeekRange) {
                        const endDateStr = listWeekRange.split(' al ')[1];
                        const [day, month, year] = endDateStr.split('/');
                        return `${year}-${month}-${day}`;
                      }
                      const week = getWeekDates(0);
                      const [day, month, year] = week.formatted.split(' al ')[1].split('/');
                      return `${year}-${month}-${day}`;
                    })()}
                    onChange={(e) => {
                      const selectedDate = new Date(e.target.value);
                      // Calcola il lunedì della settimana che contiene questa data
                      const monday = new Date(selectedDate);
                      monday.setDate(selectedDate.getDate() - (selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1));
                      const sunday = new Date(monday);
                      sunday.setDate(monday.getDate() + 6);
                      const formatDate = (d) => {
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}/${month}/${year}`;
                      };
                      const newWeekRange = `${formatDate(monday)} al ${formatDate(sunday)}`;
                      updateListFilter(id, 'weekRange', newWeekRange);
                    }}
                    className="bg-white border-2 border-blue-300 rounded px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Pulsante Rimuovi (solo per liste aggiuntive) */}
            {!isFirstList && (
              <button
                onClick={() => removeList(id)}
                className="bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 transition-colors"
                title="Rimuovi questa lista"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* TABELLA ORARI */}
        <div className="overflow-x-auto min-h-[200px] mx-4">
          {listEmployees.length > 0 ? (
            <table className="w-full text-sm text-left border-collapse shadow-md">
              <thead className="text-xs text-gray-700 uppercase bg-gray-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-2 py-3 border bg-gray-200 w-28 min-w-[100px] z-20">DIPENDENTE</th>
                  {days.map((day, i) => (
                    <th key={i} className="px-1 py-2 border text-center min-w-[100px]">
                      {day}
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1 font-normal normal-case">
                        <span>Entrata</span>
                        <span>Uscita</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-3 border bg-yellow-100 w-16 text-center font-bold text-black">TOTALE</th>
                </tr>
              </thead>
              <tbody>
                {listEmployees.map((emp) => (
                  <tr key={`${emp.contextKey}-${emp.id}`} className="bg-white border-b hover:bg-blue-50 transition-colors group">
                    <td className="px-2 py-3 border font-bold text-gray-800 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-2">
                        <span>{emp.name}</span>
                        <div className="flex items-center gap-1">
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
                            title="Sostituisci dipendente"
                          >
                            <UserPlus size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Rimuovere ${emp.name} da questa settimana? (Rimarrà disponibile per il futuro)`)) {
                                removeEmployeeFromWeek(emp.id, emp.contextKey, listWeekRange);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-red-500 hover:text-red-700 p-1 rounded transition-opacity"
                            title="Rimuovi dalla settimana (non elimina dal database)"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </td>
                    {days.map((day, dayIdx) => {
                      // Usa la settimana della lista corrente per la chiave schedule
                      const currentWeek = listWeekRange || getWeekDates(0).formatted;
                      const baseKey = `${emp.contextKey}-${emp.id}`;
                      const scheduleKey = `${currentWeek}-${baseKey}`;
                      // Fallback: se non trovi dati con la nuova chiave, prova con la vecchia (per compatibilità con dati esistenti)
                      let cellData = schedule[scheduleKey]?.[dayIdx] || {};
                      if (!cellData || Object.keys(cellData).length === 0) {
                        // Prova con la vecchia chiave (senza settimana)
                        const oldKey = `${baseKey}-${emp.id}`;
                        const oldData = schedule[oldKey]?.[dayIdx];
                        if (oldData && Object.keys(oldData).length > 0) {
                          // Migra automaticamente i dati vecchi alla nuova struttura
                          cellData = oldData;
                          // Salva con la nuova chiave (migrazione automatica)
                          setSchedule(prev => {
                            const newSchedule = {
                              ...prev,
                              [scheduleKey]: {
                                ...prev[scheduleKey],
                                [dayIdx]: oldData
                              }
                            };
                            // Salva la migrazione
                            setTimeout(() => saveData(), 100);
                            return newSchedule;
                          });
                        }
                      }
                      const isRest = cellData.code === 'R';
                      // Verifica se è un codice geografico
                      const codeKey = cellData.code ? Object.keys(timeCodes).find(k => timeCodes[k] === cellData.code) : null;
                      const isGeographic = codeKey && isGeographicCode(codeKey);
                      const isFromOtherCompany = cellData.fromCompany && cellData.fromCompany !== emp.company;

                      return (
                        <td key={dayIdx} className={`p-1 border relative ${isRest ? 'bg-gray-200' : ''} ${isGeographic || isFromOtherCompany ? 'bg-yellow-50' : ''}`}>


                          {cellData.code ? (
                            <div className={`h-14 flex items-center justify-center font-bold text-lg ${isGeographic || isFromOtherCompany ? 'text-yellow-700' : 'text-slate-500'} bg-opacity-50`}>
                              {cellData.code}
                              {isFromOtherCompany && (
                                <span className="ml-1 text-xs text-yellow-600" title={`Da ${cellData.fromCompany}`}>
                                  ⚠
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <input
                                  id={`input-${emp.id}-${dayIdx}-in1`}
                                  type="text"
                                  className="w-full border border-gray-300 rounded px-0.5 py-0.5 text-center text-xs focus:border-blue-500 focus:ring-1 focus:bg-white outline-none transition-all"
                                  value={cellData.in1 || ''}
                                  onChange={(e) => handleInputChange(emp.id, dayIdx, 'in1', e.target.value, emp.contextKey, listWeekRange)}
                                  onBlur={(e) => handleBlur(emp.id, dayIdx, 'in1', e.target.value, emp.contextKey, listWeekRange)}
                                  onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange)}
                                />
                                <input
                                  type="text"
                                  className="w-full border border-gray-300 rounded px-0.5 py-0.5 text-center text-xs focus:border-blue-500 focus:ring-1 focus:bg-white outline-none transition-all"
                                  value={cellData.out1 || ''}
                                  onChange={(e) => handleInputChange(emp.id, dayIdx, 'out1', e.target.value, emp.contextKey, listWeekRange)}
                                  onBlur={(e) => handleBlur(emp.id, dayIdx, 'out1', e.target.value, emp.contextKey, listWeekRange)}
                                  onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange)}
                                />
                              </div>
                              {(cellData.in1 || cellData.in2 || cellData.out1) && (
                                <div className="flex gap-1 animate-in fade-in duration-300">
                                  <input
                                    type="text"
                                    className="w-full border border-gray-200 rounded px-0.5 py-0.5 text-center text-xs focus:border-blue-500 outline-none bg-gray-50"
                                    value={cellData.in2 || ''}
                                    onChange={(e) => handleInputChange(emp.id, dayIdx, 'in2', e.target.value, emp.contextKey, listWeekRange)}
                                    onBlur={(e) => handleBlur(emp.id, dayIdx, 'in2', e.target.value, emp.contextKey, listWeekRange)}
                                    onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange)}
                                  />
                                  <input
                                    type="text"
                                    className="w-full border border-gray-200 rounded px-0.5 py-0.5 text-center text-xs focus:border-blue-500 outline-none bg-gray-50"
                                    value={cellData.out2 || ''}
                                    onChange={(e) => handleInputChange(emp.id, dayIdx, 'out2', e.target.value, emp.contextKey, listWeekRange)}
                                    onBlur={(e) => handleBlur(emp.id, dayIdx, 'out2', e.target.value, emp.contextKey, listWeekRange)}
                                    onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange)}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 border text-center font-bold text-lg bg-yellow-50 text-slate-800">
                      {calculateWeeklyTotal(emp.id, emp.contextKey, listWeekRange)}
                    </td>
                  </tr>
                ))}
                {/* RIGA AGGIUNTA RAPIDA */}
                <tr className="bg-gray-50 border-b border-dashed border-gray-300 hover:bg-blue-50 transition-colors group">
                  <td className="px-2 py-3 border font-bold text-gray-500 sticky left-0 bg-gray-50 z-10 group-hover:bg-blue-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-2">
                      <div className="relative w-full">
                        <input
                          type="text"
                          placeholder="Cerca dipendente..."
                          value={quickAddName}
                          onChange={(e) => {
                            setQuickAddName(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          onKeyDown={(e) => e.key === 'Enter' && handleQuickAddEmployee(company, department, listWeekRange)}
                          className="w-full bg-transparent border-b border-gray-400 focus:border-blue-500 outline-none text-sm uppercase placeholder-gray-400"
                        />
                        {showSuggestions && quickAddName && (
                          <div className="absolute bottom-full left-0 w-full min-w-[200px] bg-white border-2 border-blue-400 shadow-2xl rounded-lg z-[9999] max-h-60 overflow-y-auto mb-1">
                            {(() => {
                              const key = getContextKey(company, department);
                              const existingEmployees = employeesData[key] || [];
                              const searchTerm = quickAddName.toUpperCase().trim();
                              const filtered = existingEmployees.filter(emp => emp.name.toUpperCase().includes(searchTerm));
                              const exactMatch = existingEmployees.some(emp => emp.name.toUpperCase() === searchTerm);
                              const showAddOption = searchTerm.length > 3 && !exactMatch;

                              return (
                                <>
                                  {filtered.map(emp => (
                                    <div
                                      key={emp.id}
                                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0 text-gray-700"
                                      onClick={() => handleQuickAddEmployee(company, department, listWeekRange, emp.name)}
                                    >
                                      {emp.name}
                                    </div>
                                  ))}
                                  {showAddOption && (
                                    <div
                                      className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm text-green-700 font-semibold border-t border-gray-200 flex items-center gap-2"
                                      onClick={() => handleCreateAndAddEmployee(quickAddName, company, department, listWeekRange)}
                                    >
                                      <Plus size={14} /> Aggiungi "{searchTerm}"
                                    </div>
                                  )}
                                  {filtered.length === 0 && !showAddOption && (
                                    <div className="px-3 py-2 text-xs text-gray-400 italic">
                                      Nessun risultato
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {days.map((_, i) => (
                    <td key={i} className="p-1 border bg-gray-50 group-hover:bg-blue-50"></td>
                  ))}
                  <td className="p-1 border bg-gray-50 group-hover:bg-blue-50"></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-white border-2 border-dashed border-gray-200 rounded-lg p-6">
              {company && department ? (
                <>
                  <UserPlus size={32} className="mb-4 opacity-20" />
                  <p className="text-sm text-center px-4 mb-4">
                    Nessun dipendente con orari per questa settimana.
                  </p>
                  <div className="flex items-center gap-2 w-full max-w-md">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Inserisci il primo dipendente..."
                        value={quickAddName}
                        onChange={(e) => {
                          setQuickAddName(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickAddEmployee(company, department, listWeekRange)}
                        className="w-full border-2 border-blue-300 rounded px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase placeholder-gray-400"
                      />
                      {showSuggestions && quickAddName && (
                        <div className="absolute bottom-full left-0 w-full bg-white border border-gray-300 shadow-xl rounded-md z-50 max-h-60 overflow-y-auto mb-1">
                          {(() => {
                            const key = getContextKey(company, department);
                            const existingEmployees = employeesData[key] || [];
                            const searchTerm = quickAddName.toUpperCase().trim();
                            const filtered = existingEmployees.filter(emp => emp.name.toUpperCase().includes(searchTerm));
                            const exactMatch = existingEmployees.some(emp => emp.name.toUpperCase() === searchTerm);
                            const showAddOption = searchTerm.length > 3 && !exactMatch;

                            return (
                              <>
                                {filtered.map(emp => (
                                  <div
                                    key={emp.id}
                                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0 text-gray-700"
                                    onClick={() => handleQuickAddEmployee(company, department, listWeekRange, emp.name)}
                                  >
                                    {emp.name}
                                  </div>
                                ))}
                                {showAddOption && (
                                  <div
                                    className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm text-green-700 font-semibold border-t border-gray-200 flex items-center gap-2"
                                    onClick={() => handleCreateAndAddEmployee(quickAddName, company, department, listWeekRange)}
                                  >
                                    <Plus size={14} /> Aggiungi "{searchTerm}"
                                  </div>
                                )}
                                {filtered.length === 0 && !showAddOption && (
                                  <div className="px-3 py-2 text-xs text-gray-400 italic">
                                    Nessun risultato
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Cerca tra i dipendenti già creati dall'<Settings size={12} className="text-blue-600 inline" /> per questa azienda e reparto
                  </p>
                </>
              ) : (
                <p className="text-sm text-center px-4 text-gray-400">
                  Seleziona un'azienda e un reparto per iniziare
                </p>
              )}
            </div>
          )}
        </div>
      </div >
    );
  };

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
                            className={`w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 ${replaceEmployeeModal.newEmployeeId === emp.id ? 'bg-blue-100' : ''
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
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-bold transition-colors shadow-md"
              >
                <FileSpreadsheet size={16} /> Scarica Excel (.xlsx)
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded transition-colors ${showSettings ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                title="Impostazioni Reparti"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* PANNELLO IMPOSTAZIONI */}
        {showSettings && (
          <div className="bg-blue-50 border-b-4 border-blue-200 p-6 animate-in slide-in-from-top-5">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Impostazioni e Configurazione - {selectedCompany}
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            {/* SELETTORE AZIENDA PER CONFIGURAZIONE */}
            <div className="mb-6 bg-white p-4 rounded shadow-sm border border-blue-100">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Azienda da Configurare
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  // Reset del reparto selezionato quando cambia l'azienda per evitare incongruenze
                  const firstDept = departmentsStructure[e.target.value]?.[0];
                  if (firstDept) setSelectedDept(firstDept);
                  else setSelectedDept('');
                }}
                className="w-full md:w-1/3 border-2 border-blue-300 rounded px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {companies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* GESTIONE CODICI ORARI */}
            <div className="mb-8 bg-white p-4 rounded shadow-sm border border-purple-200">
              <h3 className="font-bold text-slate-600 mb-3 border-b pb-2 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-600 p-1 rounded"><Settings size={16} /></span>
                Gestione Codici Orari (Shortcut)
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Definisci i codici rapidi da usare negli orari. Esempio: scrivi "M" nel campo orario per inserire "Malattia".
              </p>

              <div className="flex gap-2 mb-4 items-end">
                <div className="w-24">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Codice</label>
                  <input
                    type="text"
                    placeholder="Es. M"
                    maxLength={2}
                    value={newCodeKey}
                    onChange={(e) => setNewCodeKey(e.target.value.toUpperCase())}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm uppercase text-center font-bold"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Descrizione Estesa</label>
                  <input
                    type="text"
                    placeholder="Es. Malattia"
                    value={newCodeLabel}
                    onChange={(e) => setNewCodeLabel(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={addTimeCode}
                  className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-purple-700 h-[38px]"
                >
                  <Plus size={16} /> Aggiungi
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {timeCodesOrder.map((key, index) => {
                  const label = timeCodes[key];
                  if (!label) return null; // Skip se il codice non esiste più

                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => setDraggedCodeIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedCodeIndex !== null && draggedCodeIndex !== index) {
                          reorderTimeCodes(draggedCodeIndex, index);
                        }
                        setDraggedCodeIndex(null);
                      }}
                      onDragEnd={() => setDraggedCodeIndex(null)}
                      className={`flex justify-between items-center bg-purple-50 p-2 rounded border border-purple-100 cursor-move hover:bg-purple-100 transition-all ${draggedCodeIndex === index ? 'opacity-50 scale-95' : ''
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 cursor-grab active:cursor-grabbing" title="Trascina per riordinare">⋮⋮</span>
                        <span className="bg-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded text-xs w-8 text-center">
                          {key}
                        </span>
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                      </div>
                      <button
                        onClick={() => deleteTimeCode(key)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Elimina codice"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
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
                      className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-colors ${selectedDept === dept
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

        {/* LISTE ORARI */}
        <div className="p-4">
          {viewLists.map((list, index) => renderEmployeeList(list, index))}
        </div>

        {/* PULSANTE AGGIUNGI LISTA */}
        <div className="p-4 border-t bg-gray-50 flex justify-center">
          <button
            onClick={addNewList}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105"
          >
            <Plus size={20} />
            Aggiungi un'altra lista di confronto
          </button>
        </div>
      </div>


      {/* MENU CONTESTUALE */}
      {
        contextMenu.visible && (
          <div
            className="fixed bg-white shadow-xl rounded border border-gray-200 z-[100] py-1 min-w-[150px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500">
              Inserisci Codice
            </div>
            {timeCodesOrder.map((code) => {
              const label = timeCodes[code];
              if (!label) return null; // Skip se il codice non esiste più

              return (
                <button
                  key={code}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between group"
                  onClick={() => {
                    handleQuickCode(contextMenu.empId, contextMenu.dayIndex, label, contextMenu.contextKey, contextMenu.weekRangeValue);
                    closeContextMenu();
                  }}
                >
                  <span className="font-medium text-gray-700">{label}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 rounded group-hover:bg-blue-100 group-hover:text-blue-600">{code}</span>
                </button>
              );
            })}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm text-red-600 flex items-center gap-2"
                onClick={() => {
                  handleQuickCode(contextMenu.empId, contextMenu.dayIndex, '', contextMenu.contextKey, contextMenu.weekRangeValue);
                  closeContextMenu();
                }}
              >
                <Trash2 size={14} /> Pulisci Cella
              </button>
            </div>
          </div>
        )}

        {/* MODAL GIORNI ASSENZA */}
        {absenceDaysModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]">
            <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Inserisci {absenceDaysModal.code}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Quanti giorni consecutivi vuoi applicare questo codice a partire da oggi?
              </p>
              <div className="flex items-center gap-4 mb-6">
                <label className="text-sm font-medium text-gray-700">Giorni:</label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={absenceDaysModal.days}
                  onChange={(e) => setAbsenceDaysModal(prev => ({ ...prev, days: parseInt(e.target.value) || 1 }))}
                  className="border-2 border-blue-300 rounded px-4 py-2 text-lg font-bold text-center w-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setAbsenceDaysModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    applyAbsenceCode(
                      absenceDaysModal.empId,
                      absenceDaysModal.dayIndex,
                      absenceDaysModal.code,
                      absenceDaysModal.codeKey,
                      absenceDaysModal.days,
                      absenceDaysModal.contextKey,
                      absenceDaysModal.weekRangeValue
                    );
                    setAbsenceDaysModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                >
                  Applica
                </button>
              </div>
            </div>
          </div>
        )}
      }

    </div >
  );
};

export default TimesheetManager;

