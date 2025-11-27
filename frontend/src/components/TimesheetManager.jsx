import React, { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Plus, Download, Calculator, Calendar, Settings, X, UserPlus, Building2, FileSpreadsheet, FileText, AlertTriangle, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const TimesheetManager = ({ currentUser, getAuthHeader, showNotification }) => {
  // --- STATI GENERALI ---
  const GLOBAL_EMPLOYEES_KEY = 'GLOBAL_LIST'; // Chiave unica per lista dipendenti globale
  const [showSettings, setShowSettings] = useState(false);
  const [showTimeCodesSettings, setShowTimeCodesSettings] = useState(false); // Default chiuso come richiesto
  // weekRange non è più usato direttamente, ma mantenuto per compatibilità
  const [weekRange, setWeekRange] = useState(() => {
    const today = new Date();
    // Imposta di default alla settimana successiva (+7 giorni) per facilitare la pianificazione turni
    today.setDate(today.getDate() + 7);

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
  const [globalSearchName, setGlobalSearchName] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // --- GESTIONE MODALE SICURA ---
  const onConfirmAction = useRef(null);
  const saveTimeoutRef = useRef(null); // Ref per debounce salvataggio
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: ''
  });

  // --- GESTIONE MODALE ANTEPRIMA PDF ---
  const [pdfPreviewModal, setPdfPreviewModal] = useState({
    isOpen: false,
    pdfData: null
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

  // Stato per errori di validazione orari: { "scheduleKey-dayIndex-field": "messaggio errore" }
  const [validationErrors, setValidationErrors] = useState({});

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
    weekRangeValue: null,
    hasCode: false // Flag per sapere se il campo ha un codice
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
        // Imposta di default alla settimana successiva (+7 giorni)
        today.setDate(today.getDate() + 7);

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

  // --- CARICAMENTO LIBRERIE PDF (jsPDF e jsPDF-AutoTable) ---
  useEffect(() => {
    const scripts = [];

    // Carica jsPDF
    const jspdfScript = document.createElement('script');
    jspdfScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    jspdfScript.async = true;
    document.body.appendChild(jspdfScript);
    scripts.push(jspdfScript);

    // Carica jsPDF-AutoTable dopo jsPDF
    jspdfScript.onload = () => {
      const autotableScript = document.createElement('script');
      autotableScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js";
      autotableScript.async = true;
      document.body.appendChild(autotableScript);
      scripts.push(autotableScript);
    };

    return () => {
      scripts.forEach(script => {
        try {
          if (document.body.contains(script)) {
            document.body.removeChild(script);
          }
        } catch (e) { }
      });
    }
  }, []);

  // --- FUNZIONE HELPER PER RETRY AUTOMATICO ---
  const fetchWithRetry = async (url, options, maxRetries = 3, operationName = 'operazione') => {
    const delays = [1000, 2000, 4000]; // Backoff: 1s, 2s, 4s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Mostra notifica durante i tentativi (tranne il primo)
        if (attempt > 0 && showNotification) {
          showNotification(`⏳ Tentativo ${attempt + 1}/${maxRetries} per ${operationName}...`, 'info', 2000);
        }

        // Crea un AbortController per il timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout di 10 secondi

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Se la risposta è ok, restituiscila
        if (response.ok) {
          return response;
        }

        // Se è un errore HTTP (400, 403, 500, ecc.), non fare retry (sono errori logici, non di rete)
        if (response.status >= 400 && response.status < 600) {
          return response;
        }

        // Se non è ok e non è un errore HTTP standard, potrebbe essere un problema di rete
        throw new Error(`Errore di rete: ${response.status}`);
      } catch (error) {
        // Se è l'ultimo tentativo, lancia l'errore
        if (attempt === maxRetries - 1) {
          if (showNotification) {
            const errorMsg = error.name === 'AbortError' ? 'Timeout: la richiesta ha impiegato troppo tempo' : (error.message || 'Errore di connessione');
            showNotification(`❌ ${operationName} fallita dopo ${maxRetries} tentativi. ${errorMsg}`, 'error', 8000);
          }
          throw error;
        }

        // Se è un errore di timeout, rete o abort, aspetta prima di riprovare
        if (error.name === 'AbortError' || error.name === 'TypeError' || error.message.includes('network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
          continue;
        }

        // Per altri errori (es. errori HTTP 400/403), non fare retry
        throw error;
      }
    }

    throw new Error(`Tutti i tentativi falliti per ${operationName}`);
  };

  // --- CARICAMENTO DATI DAL BACKEND ---
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Flag per prevenire salvataggio automatico durante il caricamento
  const isInitialLoadRef = useRef(true);

  // --- SALVATAGGIO AUTOMATICO QUANDO CAMBIANO I DIPENDENTI ---
  useEffect(() => {
    // Non salvare durante il caricamento iniziale
    if (loading) return;

    // Non salvare durante il primo caricamento (per evitare di sovrascrivere dati esistenti)
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Non salvare se non ci sono dati
    if (Object.keys(employeesData).length === 0) return;

    // Debounce: salva dopo 500ms dall'ultimo cambiamento
    const timeoutId = setTimeout(() => {
      saveData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [employeesData]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Imposta il flag per prevenire salvataggio automatico durante il caricamento
      isInitialLoadRef.current = true;

      let response;
      try {
        response = await fetchWithRetry(
          buildApiUrl('/api/orari/data'),
          {
            headers: getAuthHeader()
          },
          3,
          'caricamento dati'
        );
      } catch (error) {
        // Se fetchWithRetry fallisce completamente, prova con fetch normale come fallback
        console.warn('⚠️ fetchWithRetry fallito, provo con fetch normale:', error);
        try {
          response = await fetch(buildApiUrl('/api/orari/data'), {
            headers: getAuthHeader()
          });
        } catch (fallbackError) {
          console.error('❌ Errore caricamento dati (anche fallback fallito):', fallbackError);
          if (showNotification) {
            showNotification('Errore nel caricamento dei dati. Riprova più tardi.', 'error', 6000);
          }
          setLoading(false);
          return;
        }
      }

      // Gestione errore accesso negato
      if (response.status === 403) {
        const error = await response.json();
        if (error.code === 'ORARI_ACCESS_DENIED') {
          console.error('❌ Accesso negato al sistema orari:', error.message);
          if (showNotification) {
            showNotification('Accesso negato: non hai i permessi per accedere al sistema orari. Contatta l\'amministratore per richiedere l\'accesso.', 'error', 8000);
          }
          // Reindirizza alla home
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
          return;
        }
      }

      // Gestione altri errori HTTP
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore caricamento dati:', response.status, errorData);
        if (showNotification) {
          showNotification(`Errore nel caricamento dei dati (${response.status}). Riprova più tardi.`, 'error', 6000);
        }
        setLoading(false);
        return;
      }

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

          employeeKeys.forEach(key => {
            const count = Array.isArray(data.employees[key]) ? data.employees[key].length : 0;

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




          // Verifica che i dipendenti siano stati caricati correttamente
          Object.keys(cleanedEmployees).forEach(key => {
            const count = Array.isArray(cleanedEmployees[key]) ? cleanedEmployees[key].length : 0;
          });

          // MIGRAZIONE: Raccogli tutti i dipendenti dalle liste specifiche e mettili nella lista globale
          // Poi rimuovi tutte le liste specifiche
          let globalList = cleanedEmployees[GLOBAL_EMPLOYEES_KEY] || [];
          const uniqueEmployees = new Map(); // { "id": { id, name } }

          // Aggiungi i dipendenti già presenti nella lista globale
          globalList.forEach(emp => {
            if (emp && emp.id && emp.name) {
              uniqueEmployees.set(emp.id, { id: emp.id, name: emp.name });
            }
          });

          // Raccogli tutti i dipendenti dalle liste specifiche
          Object.keys(cleanedEmployees).forEach(key => {
            // Salta la chiave globale
            if (key === GLOBAL_EMPLOYEES_KEY) return;

            const employees = cleanedEmployees[key] || [];
            employees.forEach(emp => {
              if (emp && emp.id && emp.name) {
                // Usa solo l'ID come chiave per evitare duplicati
                if (!uniqueEmployees.has(emp.id)) {
                  uniqueEmployees.set(emp.id, { id: emp.id, name: emp.name });
                }
              }
            });
          });

          // Converti la Map in array
          globalList = Array.from(uniqueEmployees.values());

          if (globalList.length > 0) {
            console.log(`🔄 MIGRAZIONE: ${globalList.length} dipendenti unici migrati alla lista globale, rimozione liste specifiche`);
          }

          // IMPORTANTE: Mantieni SOLO la lista globale, rimuovi tutte le liste specifiche
          const preservedEmployees = {
            [GLOBAL_EMPLOYEES_KEY]: globalList // Solo la lista globale
          };

          setEmployeesData(preservedEmployees);

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

                }
              }
            }
          });

          setSchedule(migratedSchedule);

          // NON salvare automaticamente dopo la migrazione per evitare di sovrascrivere dati
          // La migrazione viene salvata solo quando l'utente modifica manualmente i dati
          // Questo previene la perdita di dati durante il caricamento


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

            // MODIFICA: Assicurati che timeCodes sia un oggetto
            let loadedTimeCodes = data.timeCodes;
            if (Array.isArray(loadedTimeCodes)) {
              console.warn('⚠️ timeCodes è un array, converto in oggetto');
              const converted = {};
              loadedTimeCodes.forEach(code => {
                if (typeof code === 'string') converted[code] = code; // Fallback label = key
                else if (code.key) converted[code.key] = code.label || code.key;
              });
              loadedTimeCodes = converted;
            }
            setTimeCodes(loadedTimeCodes);
            // Carica l'ordine se presente, altrimenti usa l'ordine delle chiavi
            if (data.timeCodesOrder && Array.isArray(data.timeCodesOrder)) {
              setTimeCodesOrder(data.timeCodesOrder);
            } else {
              // Retrocompatibilità: genera l'ordine dalle chiavi esistenti
              setTimeCodesOrder(Object.keys(loadedTimeCodes));
            }

            // PULIZIA DUPLICATI: Assicurati che timeCodesOrder non abbia duplicati
            setTimeCodesOrder(prev => [...new Set(prev)]);
          } else {

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
              [GLOBAL_EMPLOYEES_KEY]: []
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
          // Salva i dati iniziali solo se non ci sono dati nel database
          setTimeout(() => {
            isInitialLoadRef.current = false; // Permetti salvataggio per dati iniziali
            saveData();
          }, 500);
        }
      }

    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setLoading(false);
      // Dopo il caricamento, permetti il salvataggio automatico
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1000);
    }
  };

  // Funzione di salvataggio debounced per input frequenti
  const debouncedSave = (overrideTimeCodes = null, overrideTimeCodesOrder = null) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveData(overrideTimeCodes, overrideTimeCodesOrder);
    }, 1000);
  };

  // --- AUTO-SAVE EFFECT ---
  useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) return;

    // Debounce save
    const timer = setTimeout(() => {
      saveData();
    }, 1000);

    return () => clearTimeout(timer);
  }, [schedule, employeesData, companies, departmentsStructure, timeCodes, timeCodesOrder]);

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

      const response = await fetchWithRetry(
        buildApiUrl('/api/orari/save'),
        {
          method: 'POST',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cleanData)
        },
        3,
        'salvataggio dati'
      );

      if (response.ok) {
        const result = await response.json();

        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore salvataggio:', errorData);
        // Mostra notifica solo se non è un errore di rete (già gestito da fetchWithRetry)
        if (response.status >= 400 && response.status < 500 && showNotification) {
          showNotification(`Errore nel salvataggio: ${errorData.error || 'Errore sconosciuto'}`, 'error', 6000);
        }
        return false;
      }
    } catch (error) {
      console.error('❌ Errore salvataggio:', error);
      // L'errore è già stato gestito da fetchWithRetry con notifica
      return false;
    }
  };
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

  // Helper per ottenere la lista globale dei dipendenti
  const getCurrentEmployees = () => {
    return employeesData[GLOBAL_EMPLOYEES_KEY] || [];
  };

  // Variabile derivata per la lista corrente di dipendenti
  const currentEmployees = getCurrentEmployees();


  // --- CALCOLI SICURI ---
  // --- HELPER FUNCTIONS: TIME MANIPULATION & VALIDATION ---

  // Oggetto helper per manipolazione orari (funzioni pure)
  const timeHelpers = {
    // Converte stringa orario (HH.MM o HH:MM) in minuti totali
    toMinutes: (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return 0;
      const cleanStr = timeStr.trim().replace(',', '.').replace(':', '.');
      const parts = cleanStr.split('.');
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      return hours * 60 + minutes;
    },

    // Converte minuti totali in stringa orario HH.MM
    toTimeStr: (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
    },

    // Converte stringa orario in decimale (per calcoli ore)
    toDecimal: (timeStr) => {
      if (!timeStr) return 0;
      const minutes = timeHelpers.toMinutes(timeStr);
      return minutes / 60;
    },

    // Formatta una stringa orario in HH.MM
    format: (timeStr) => {
      if (!timeStr) return '';
      let cleanStr = String(timeStr).replace(',', '.').replace(':', '.').trim();
      if (!cleanStr.includes('.')) cleanStr += '.00';
      const parts = cleanStr.split('.');
      const hours = String(parseInt(parts[0]) || 0).padStart(2, '0');
      const minutes = String(parseInt(parts[1]) || 0).padStart(2, '0');
      return `${hours}.${minutes}`;
    },

    // Verifica sovrapposizione tra due intervalli [start, end]
    checkOverlap: (start1, end1, start2, end2) => {
      return Math.max(start1, start2) < Math.min(end1, end2);
    }
  };

  // Helper: converte label in chiave o viceversa
  const getCodeKey = (code) => {
    if (!code) return null;
    if (timeCodes[code]) return code;
    return Object.keys(timeCodes).find(key => timeCodes[key] === code) || null;
  };

  const getCodeLabel = (code) => {
    if (!code) return '';
    if (timeCodes[code]) return timeCodes[code];
    return code;
  };

  // Verifica se un codice è assenza
  const isAbsenceCode = (code) => {
    return ['R', 'F', 'M', 'P', 'I'].includes(code);
  };

  const isAbsenceCodeForHours = (code) => {
    if (!code) return false;
    const codeKey = getCodeKey(code);
    if (!codeKey) return false;
    return isAbsenceCode(codeKey);
  };

  // Calcola ore giornaliere
  const calculateDailyHours = (dayData) => {
    if (!dayData) return 0;
    if (dayData.code && isAbsenceCodeForHours(dayData.code)) return 0;

    let total = 0;
    if (dayData.in1 && dayData.out1) {
      // Verifica che in1 e out1 siano orari validi (non codici)
      const in1IsTime = /^\d{1,2}[.:]\d{2}$/.test(dayData.in1);
      const out1IsTime = /^\d{1,2}[.:]\d{2}$/.test(dayData.out1);
      if (in1IsTime && out1IsTime) {
        const start = timeHelpers.toDecimal(dayData.in1);
        const end = timeHelpers.toDecimal(dayData.out1);
        if (end > start) total += (end - start);
      }
    }
    if (dayData.in2 && dayData.out2) {
      // Verifica che in2 e out2 siano orari validi (non codici come "Atripalda", "Malattia", ecc.)
      const in2IsTime = /^\d{1,2}[.:]\d{2}$/.test(dayData.in2);
      const out2IsTime = /^\d{1,2}[.:]\d{2}$/.test(dayData.out2);
      if (in2IsTime && out2IsTime) {
        const start = timeHelpers.toDecimal(dayData.in2);
        const end = timeHelpers.toDecimal(dayData.out2);
        if (end > start) total += (end - start);
      }
    }
    return total;
  };

  // Calcola totale settimanale
  const calculateWeeklyTotal = (empId, contextKey = null, weekRangeValue = null) => {
    let total = 0;
    const currentWeek = weekRangeValue || weekRange;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;
    const empSchedule = schedule[scheduleKey] || {};

    days.forEach((_, index) => {
      total += calculateDailyHours(empSchedule[index]);
    });
    return isNaN(total) ? "0.0" : total.toFixed(1);
  };

  // --- FUNZIONI DI VALIDAZIONE ---

  const validateTimeFormat = (timeStr) => {
    if (!timeStr || !timeStr.trim()) return { valid: true, error: null };
    const cleanStr = timeStr.replace(',', '.').replace(':', '.').trim();
    const parts = cleanStr.split('.');

    if (parts.length !== 2) return { valid: false, error: 'Formato non valido. Usa HH.MM' };

    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);

    if (isNaN(hours) || isNaN(minutes)) return { valid: false, error: 'Formato non valido' };
    if (hours < 0 || hours > 23) return { valid: false, error: 'Ore 00-23' };
    if (minutes < 0 || minutes > 59) return { valid: false, error: 'Minuti 00-59' };

    return { valid: true, error: null };
  };

  // Funzione per verificare sovrapposizioni di orari per lo stesso dipendente in altre aziende/reparti
  const checkOverlappingSchedules = (empId, empName, dayIndex, dayData, currentContextKey, currentWeek, scheduleData) => {
    const overlaps = [];
    const t = timeHelpers;

    // Trova tutti i dipendenti con lo stesso nome (stesso dipendente) in altre aziende/reparti
    const globalEmployees = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
    const sameNameEmployees = globalEmployees.filter(e => e.name === empName && e.id !== empId);

    // Per ogni dipendente con lo stesso nome, controlla gli orari in altre aziende/reparti
    sameNameEmployees.forEach(otherEmp => {
      // Cerca lo schedule di questo dipendente in tutte le aziende/reparti
      Object.keys(scheduleData).forEach(scheduleKey => {
        // Pattern: settimana-contextKey-empId
        if (scheduleKey.startsWith(`${currentWeek}-`) && scheduleKey.endsWith(`-${otherEmp.id}`)) {
          const otherContextKey = scheduleKey.replace(`${currentWeek}-`, '').replace(`-${otherEmp.id}`, '');

          // Salta se è lo stesso contesto
          if (otherContextKey === currentContextKey) return;

          const otherDayData = scheduleData[scheduleKey]?.[dayIndex];
          if (!otherDayData) return;

          // Estrai azienda e reparto dal contextKey
          const parts = otherContextKey.split('-');
          const otherCompany = parts[0];
          const otherDept = parts.slice(1).join('-');

          // Verifica sovrapposizioni tra i turni
          // Turno 1 corrente vs Turno 1 altro
          if (dayData.in1 && dayData.out1 && otherDayData.in1 && otherDayData.out1) {
            const start1 = t.toMinutes(dayData.in1);
            const end1 = t.toMinutes(dayData.out1);
            const start2 = t.toMinutes(otherDayData.in1);
            const end2 = t.toMinutes(otherDayData.out1);

            // Gestisci turni notturni
            const end1Adj = end1 < start1 ? end1 + 1440 : end1;
            const end2Adj = end2 < start2 ? end2 + 1440 : end2;

            if (Math.max(start1, start2) < Math.min(end1Adj, end2Adj)) {
              overlaps.push({
                company: otherCompany,
                department: otherDept,
                shift: 'Turno 1',
                time: `${otherDayData.in1} - ${otherDayData.out1}`
              });
            }
          }

          // Turno 1 corrente vs Turno 2 altro
          if (dayData.in1 && dayData.out1 && otherDayData.in2 && otherDayData.out2) {
            const start1 = t.toMinutes(dayData.in1);
            const end1 = t.toMinutes(dayData.out1);
            const start2 = t.toMinutes(otherDayData.in2);
            const end2 = t.toMinutes(otherDayData.out2);

            const end1Adj = end1 < start1 ? end1 + 1440 : end1;
            const end2Adj = end2 < start2 ? end2 + 1440 : end2;

            if (Math.max(start1, start2) < Math.min(end1Adj, end2Adj)) {
              overlaps.push({
                company: otherCompany,
                department: otherDept,
                shift: 'Turno 2',
                time: `${otherDayData.in2} - ${otherDayData.out2}`
              });
            }
          }

          // Turno 2 corrente vs Turno 1 altro
          if (dayData.in2 && dayData.out2 && otherDayData.in1 && otherDayData.out1) {
            const start1 = t.toMinutes(dayData.in2);
            const end1 = t.toMinutes(dayData.out2);
            const start2 = t.toMinutes(otherDayData.in1);
            const end2 = t.toMinutes(otherDayData.out1);

            const end1Adj = end1 < start1 ? end1 + 1440 : end1;
            const end2Adj = end2 < start2 ? end2 + 1440 : end2;

            if (Math.max(start1, start2) < Math.min(end1Adj, end2Adj)) {
              overlaps.push({
                company: otherCompany,
                department: otherDept,
                shift: 'Turno 1',
                time: `${otherDayData.in1} - ${otherDayData.out1}`
              });
            }
          }

          // Turno 2 corrente vs Turno 2 altro
          if (dayData.in2 && dayData.out2 && otherDayData.in2 && otherDayData.out2) {
            const start1 = t.toMinutes(dayData.in2);
            const end1 = t.toMinutes(dayData.out2);
            const start2 = t.toMinutes(otherDayData.in2);
            const end2 = t.toMinutes(otherDayData.out2);

            const end1Adj = end1 < start1 ? end1 + 1440 : end1;
            const end2Adj = end2 < start2 ? end2 + 1440 : end2;

            if (Math.max(start1, start2) < Math.min(end1Adj, end2Adj)) {
              overlaps.push({
                company: otherCompany,
                department: otherDept,
                shift: 'Turno 2',
                time: `${otherDayData.in2} - ${otherDayData.out2}`
              });
            }
          }
        }
      });
    });

    return overlaps;
  };

  const validateDaySchedule = (dayData) => {
    const errors = {};

    // 1. Validazione formato base
    ['in1', 'out1', 'in2', 'out2'].forEach(field => {
      if (dayData[field]) {
        const check = validateTimeFormat(dayData[field]);
        if (!check.valid) errors[field] = check.error;
      }
    });

    // Se ci sono errori di formato, fermati qui
    if (Object.keys(errors).length > 0) return errors;

    // 2. Validazione logica turni
    const t = timeHelpers; // alias breve

    // Relazione Turno 1 - Turno 2
    if (dayData.in1 && dayData.out1 && dayData.in2) {
      const out1Mins = t.toMinutes(dayData.out1);
      const in2Mins = t.toMinutes(dayData.in2);
      const in1Mins = t.toMinutes(dayData.in1);

      // Se il turno 1 non è notturno (finisce stesso giorno), il turno 2 deve iniziare dopo
      const isShift1Overnight = out1Mins < in1Mins;

      if (!isShift1Overnight && in2Mins < out1Mins) {
        errors['in2'] = 'Sovrapposizione turni';
      }
    }

    return errors;
  };

  const handleInputChange = (empId, dayIndex, field, value, contextKey = null, weekRangeValue = null, currentCompany = null) => {
    // 1. Gestione Codici Rapidi
    // IMPORTANTE: Non applicare codici durante la digitazione se la stringa è troppo corta
    // Questo evita che "A" venga interpretato come "Malattia" quando l'utente vuole digitare "AT" o "AV"
    if (['in1', 'out1', 'in2', 'out2'].includes(field) && value && String(value).trim() !== '') {
      const strValue = String(value).trim().toUpperCase();
      let detectedCode = null;

      // Se la stringa è esattamente una chiave di codice, usala
      if (timeCodes[strValue]) {
        detectedCode = strValue;
      } else if (['L', 'M', 'A'].includes(strValue)) {
        // Riconosci codici geografici hardcoded
        detectedCode = strValue;
      } else {
        // Cerca corrispondenza esatta o che il label inizi con la stringa digitata
        // NON usare includes() perché "A" verrebbe trovato in "MALATTIA"
        const foundKey = Object.keys(timeCodes).find(key => {
          const label = timeCodes[key].toUpperCase();
          // Corrispondenza esatta
          if (label === strValue) return true;
          // Il label inizia con la stringa digitata (per codici come "AT", "AV", "MALATTIA")
          if (label.startsWith(strValue)) return true;
          // La stringa digitata inizia con il label (per codici corti come "R", "M", "F")
          if (strValue.startsWith(label)) return true;
          return false;
        });
        if (foundKey) detectedCode = foundKey;
      }

      // Applica il codice solo se:
      // 1. La stringa ha almeno 2 caratteri (per evitare che "A" venga interpretato come "Malattia")
      // 2. OPPURE è una corrispondenza esatta con una chiave di codice (es. "R", "M", "F")
      // 3. OPPURE la stringa corrisponde esattamente a un label (es. "MALATTIA", "RIPOSO")
      const isExactKeyMatch = timeCodes[strValue] !== undefined;
      const isExactLabelMatch = Object.values(timeCodes).some(label => label.toUpperCase() === strValue);
      const shouldApply = (strValue.length >= 2 || isExactKeyMatch || isExactLabelMatch) && strValue.length <= 10;

      if (detectedCode && shouldApply) {
        // Se è in2, NON applicare il codice durante la digitazione (onChange)
        // Applica solo su blur per permettere all'utente di completare la digitazione
        if (field === 'in2') {
          // NON applicare qui, lascia che l'utente continui a digitare
          // Il codice verrà applicato su onBlur
          // Continua con l'aggiornamento normale dello stato (non return)
        } else {
          // Per in1 o altri campi, usa la logica normale
          // Verifica se è un codice geografico che punta all'azienda corrente
          // Se sì, non applicarlo ma segnalalo come errore
          if (isGeographicCode(detectedCode)) {
            // Estrai l'azienda corrente: usa il parametro se disponibile, altrimenti dal contextKey
            let companyToCheck = currentCompany;
            if (!companyToCheck && contextKey) {
              const parts = contextKey.split('-');
              companyToCheck = parts[0] || '';
            }
            if (!companyToCheck) {
              // Se non c'è contextKey, usa selectedCompany o la prima azienda
              companyToCheck = selectedCompany || companies[0] || '';
            }

            const targetCompany = getCompanyFromGeographicCode(detectedCode);
            // MODIFICA: Permetti l'uso di codici geografici anche nell'azienda corrente se sono hardcoded (L, M, A)
            // Questo permette di usarli come semplici etichette
            const isHardcoded = ['L', 'M', 'A'].includes(detectedCode);

            if (targetCompany && targetCompany === companyToCheck && !isHardcoded) {
              // Il codice geografico punta all'azienda corrente, segnala errore
              const currentWeek = weekRangeValue || weekRange;
              const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
              const scheduleKeyForError = `${currentWeek}-${baseKey}`;
              const errorKey = `${scheduleKeyForError}-${dayIndex}-${field}`;
              setValidationErrors(prev => ({
                ...prev,
                [errorKey]: `Codice geografico non valido: non puoi applicare "${timeCodes[detectedCode]}" nella stessa azienda`
              }));
              // Non applicare il codice, continua con l'aggiornamento normale
            } else {
              // Il codice geografico punta a un'altra azienda (o è hardcoded e permesso), applicalo normalmente
              handleQuickCode(empId, dayIndex, timeCodes[detectedCode] || detectedCode, contextKey, weekRangeValue);
              return;
            }
          } else {
            // Non è un codice geografico, applicalo normalmente
            handleQuickCode(empId, dayIndex, timeCodes[detectedCode] || detectedCode, contextKey, weekRangeValue);
            return;
          }
        }
      }
    }

    // 2. Aggiornamento Stato
    // RIMOSSO: Il blocco che impediva l'inserimento in in2 se non era valido.
    // Ora permettiamo l'inserimento e validiamo su onBlur.


    const currentWeek = weekRangeValue || weekRange;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;

    setSchedule(prev => {
      const newSchedule = { ...prev };
      if (!newSchedule[scheduleKey]) newSchedule[scheduleKey] = {};
      if (!newSchedule[scheduleKey][dayIndex]) newSchedule[scheduleKey][dayIndex] = {};

      // Pulisci il campo code solo se si sta inserendo un orario (non un codice)
      // Se field è in2 e value contiene lettere, potrebbe essere un codice, quindi non pulire code
      if (['in1', 'out1', 'in2', 'out2'].includes(field)) {
        // Verifica se il valore è un orario (solo numeri e punti/due punti) o un codice (contiene lettere)
        const isTimeValue = /^[\d.:]+$/.test(String(value).trim());
        // Pulisci code solo se è un orario, non se è un codice
        if (isTimeValue || !value) {
          newSchedule[scheduleKey][dayIndex].code = '';
        }
      }

      newSchedule[scheduleKey][dayIndex][field] = value;
      return newSchedule;
    });
  };

  const handleBlur = (empId, dayIndex, field, value, contextKey = null, weekRangeValue = null, currentCompany = null) => {
    try {
      console.log('🔍 handleBlur triggered:', { field, value, timeCodesKeys: Object.keys(timeCodes) });

      // 1. Gestione Codici Rapidi (anche su blur)
      // Su blur possiamo essere più permissivi, ma evitiamo ancora che "A" venga interpretato come "Malattia"
      if (['in1', 'out1', 'in2', 'out2'].includes(field) && value) {
        const strValue = String(value).trim().toUpperCase();
        let detectedCode = null;

        // Per in2, verifica PRIMA se è un nome di città (Atripalda, Avellino, Lioni)
        // o un codice geografico diretto (AT, AV, L)
        // IMPORTANTE: Questo deve essere fatto PRIMA di cercare nei timeCodes
        if (field === 'in2') {
          // Mappa nomi città a codici geografici
          const cityToCode = {
            'ATRIPALDA': 'AT',
            'AVELLINO': 'AV',
            'LIONI': 'L'
          };
          if (cityToCode[strValue]) {
            detectedCode = cityToCode[strValue];
          } else if (['AT', 'AV', 'L'].includes(strValue)) {
            detectedCode = strValue;
          } else {
            // Per in2, cerca SOLO corrispondenze esatte nei timeCodes (non parziali)
            // Questo evita che "a" venga trovato come inizio di "Avellino" o "Atripalda"
            if (timeCodes[strValue]) {
              detectedCode = strValue;
            } else {
              // Cerca SOLO corrispondenza esatta con un label (non parziale)
              const foundKey = Object.keys(timeCodes).find(key => {
                const label = timeCodes[key].toUpperCase();
                // SOLO corrispondenza esatta (non startsWith o includes)
                return label === strValue;
              });
              if (foundKey) detectedCode = foundKey;
            }
          }
        } else {
          // Per in1, out1, out2, usa la logica normale
          // MODIFICA: Cerca case-insensitive
          const upperStr = strValue.toUpperCase();
          if (timeCodes[upperStr]) {
            detectedCode = upperStr;
          } else if (['AT', 'AV', 'L'].includes(upperStr)) {
            // Riconosci codici geografici hardcoded anche qui
            detectedCode = upperStr;
          } else {
            // Cerca corrispondenza esatta o che il label inizi con la stringa digitata
            // NON usare includes() perché "A" verrebbe trovato in "MALATTIA"
            const foundKey = Object.keys(timeCodes).find(key => {
              const label = timeCodes[key].toUpperCase();
              // Corrispondenza esatta
              if (label === upperStr) return true;
              // Il label inizia con la stringa digitata (per codici come "AT", "AV", "MALATTIA")
              if (label.startsWith(upperStr)) return true;
              // La stringa digitata inizia con il label (per codici corti come "R", "M", "F")
              if (upperStr.startsWith(label)) return true;
              return false;
            });
            if (foundKey) detectedCode = foundKey;
          }
        }

        // Su blur, applica solo se:
        // 1. La stringa ha almeno 2 caratteri (per evitare che "A" venga interpretato come "Malattia" o "Avellino")
        // 2. OPPURE è una corrispondenza esatta con una chiave di codice (es. "R", "M", "F", "AT", "AV", "L")
        // 3. OPPURE la stringa corrisponde esattamente a un label (es. "MALATTIA", "RIPOSO", "AVELLINO", "ATRIPALDA", "LIONI")
        // IMPORTANTE: Per in2, richiediamo almeno 2 caratteri per evitare che "a" venga salvato
        // MODIFICA: isExactKeyMatch deve essere case-insensitive per supportare "m" -> "M"
        const isExactKeyMatch = timeCodes[strValue.toUpperCase()] !== undefined;
        const isExactLabelMatch = Object.values(timeCodes).some(label => label.toUpperCase() === strValue);
        const isGeographic = isGeographicCode(detectedCode) || ['ATRIPALDA', 'AVELLINO', 'LIONI'].includes(strValue);
        const isGeographicCodeShort = ['AT', 'AV', 'L'].includes(strValue.toUpperCase());
        // Per in2, richiediamo almeno 2 caratteri O una corrispondenza esatta (codice geografico corto o nome città completo o chiave codice)
        const shouldApply = field === 'in2'
          ? (strValue.length >= 2 && (isGeographic || isGeographicCodeShort || isExactLabelMatch)) || isExactKeyMatch
          : (strValue.length >= 2 || isExactKeyMatch || isExactLabelMatch || isGeographic) && strValue.length <= 15;

        // Se è in2 e non è un codice valido, pulisci il campo
        if (field === 'in2' && (!detectedCode || !shouldApply)) {
          const currentWeek = weekRangeValue || weekRange;
          const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
          const scheduleKey = `${currentWeek}-${baseKey}`;

          setSchedule(prev => {
            const newSchedule = { ...prev };
            if (!newSchedule[scheduleKey]) newSchedule[scheduleKey] = {};
            if (!newSchedule[scheduleKey][dayIndex]) {
              newSchedule[scheduleKey][dayIndex] = {
                code: prev[scheduleKey]?.[dayIndex]?.code || '',
                in1: prev[scheduleKey]?.[dayIndex]?.in1 || '',
                out1: prev[scheduleKey]?.[dayIndex]?.out1 || '',
                in2: '',
                out2: prev[scheduleKey]?.[dayIndex]?.out2 || ''
              };
            } else {
              // Pulisci solo in2, mantieni tutto il resto
              newSchedule[scheduleKey][dayIndex] = {
                ...newSchedule[scheduleKey][dayIndex],
                in2: ''
              };
            }
            return newSchedule;
          });

          setTimeout(() => saveData(), 100);
          return; // Esci senza applicare codice
        }

        if (detectedCode && shouldApply) {
          // Verifica se è un codice geografico che punta all'azienda corrente
          // Se sì, non applicarlo ma segnalalo come errore
          if (isGeographicCode(detectedCode)) {
            // Estrai l'azienda corrente: usa il parametro se disponibile, altrimenti dal contextKey
            let companyToCheck = currentCompany;
            if (!companyToCheck && contextKey) {
              const parts = contextKey.split('-');
              companyToCheck = parts[0] || '';
            }
            if (!companyToCheck) {
              // Se non c'è contextKey, usa selectedCompany o la prima azienda
              companyToCheck = selectedCompany || companies[0] || '';
            }

            const targetCompany = getCompanyFromGeographicCode(detectedCode);
            // MODIFICA: Permetti l'uso di codici geografici anche nell'azienda corrente se sono hardcoded (AT, AV, L)
            const isHardcoded = ['AT', 'AV', 'L'].includes(detectedCode);

            if (targetCompany && targetCompany === companyToCheck && !isHardcoded) {
              // Il codice geografico punta all'azienda corrente, segnala errore
              const currentWeek = weekRangeValue || weekRange;
              const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
              const scheduleKeyForError = `${currentWeek}-${baseKey}`;
              const errorKey = `${scheduleKeyForError}-${dayIndex}-${field}`;
              setValidationErrors(prev => ({
                ...prev,
                [errorKey]: `Codice geografico non valido: non puoi applicare "${timeCodes[detectedCode] || detectedCode}" nella stessa azienda`
              }));
              // Non applicare il codice, continua con la validazione normale
            } else {
              // Il codice geografico punta a un'altra azienda (o è hardcoded e permesso)
              // Se è in2, salva SOLO in in2 senza propagazione (solo visualizzazione)
              if (field === 'in2') {
                // Salva solo il codice in in2, senza creare schedule in altre aziende
                const currentWeek = weekRangeValue || weekRange;
                const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
                const scheduleKey = `${currentWeek}-${baseKey}`;

                setSchedule(prev => {
                  const newSchedule = { ...prev };
                  if (!newSchedule[scheduleKey]) newSchedule[scheduleKey] = {};
                  if (!newSchedule[scheduleKey][dayIndex]) {
                    newSchedule[scheduleKey][dayIndex] = {
                      code: '',
                      in1: prev[scheduleKey]?.[dayIndex]?.in1 || '',
                      out1: prev[scheduleKey]?.[dayIndex]?.out1 || '',
                      in2: '',
                      out2: ''
                    };
                  }

                  // Salva solo il label del codice in in2
                  // MA imposta anche geographicCode per permettere la notifica di trasferimento
                  let codeLabel = timeCodes[detectedCode];

                  // Fallback per codici geografici hardcoded se non presenti in timeCodes
                  if (!codeLabel) {
                    if (detectedCode === 'L') codeLabel = 'Lioni';
                    else if (detectedCode === 'M') codeLabel = 'Mercurio';
                    else if (detectedCode === 'A') codeLabel = 'Albatros';
                    else codeLabel = detectedCode;
                  }

                  newSchedule[scheduleKey][dayIndex].in2 = codeLabel;

                  // Imposta geographicCode se è un codice geografico o azienda
                  // Questo è fondamentale per checkTransfersToCompany
                  const isGeo = ['L', 'M', 'A'].includes(detectedCode) || getCompanyFromGeographicCode(detectedCode);
                  if (isGeo) {
                    newSchedule[scheduleKey][dayIndex].geographicCode = detectedCode;
                  }

                  // Pulisci out2 se c'era un orario
                  if (newSchedule[scheduleKey][dayIndex].out2 && /^\d/.test(newSchedule[scheduleKey][dayIndex].out2)) {
                    newSchedule[scheduleKey][dayIndex].out2 = '';
                  }
                  // IMPORTANTE: NON toccare il campo code - deve rimanere vuoto o invariato

                  // --- LOGICA TRASFERIMENTO PARZIALE (POMERIGGIO) ---
                  // Se il codice corrisponde a un'azienda, crea/aggiorna lo schedule nell'azienda target
                  const targetCompany = getCompanyFromGeographicCode(detectedCode) ||
                    (companies.includes(codeLabel) ? codeLabel : null);

                  if (targetCompany && targetCompany !== currentCompany) {
                    // Trova il dipendente nell'azienda target (o aggiungilo se necessario - logica semplificata: assumiamo esista o venga gestito altrove)
                    // Per ora, cerchiamo se esiste uno schedule per questo dipendente nell'azienda target
                    // Se non esiste, dovremmo idealmente crearlo, ma richiede di conoscere il reparto target.
                    // Cerchiamo il primo reparto disponibile dell'azienda target
                    const targetDepts = departmentsStructure[targetCompany] || [];
                    if (targetDepts.length > 0) {
                      const targetDept = targetDepts[0]; // Usa il primo reparto come default
                      const targetContextKey = `${targetCompany}-${targetDept}`;
                      const targetScheduleKey = `${currentWeek}-${targetContextKey}-${empId}`;

                      if (!newSchedule[targetScheduleKey]) newSchedule[targetScheduleKey] = {};
                      if (!newSchedule[targetScheduleKey][dayIndex]) {
                        newSchedule[targetScheduleKey][dayIndex] = {
                          code: '', in1: '', out1: '', in2: '', out2: ''
                        };
                      }

                      // Imposta il turno pomeridiano nell'azienda target
                      // Esempio: se in2 è "Mercurio", in Mercurio mettiamo un placeholder o lo stesso orario?
                      // L'utente non ha specificato l'orario, solo il codice.
                      // Mettiamo "14.00" - "18.00" come default? O lasciamo vuoto ma presente?
                      // Mettiamo "Turno Pomeriggio" come codice?
                      // Per ora, segniamo la presenza con un codice fittizio o lasciamo vuoto ma inizializzato
                      // L'utente ha detto "valutato come codice Azienda e quindi per il trasferimento"
                      // Probabilmente vuole che il dipendente appaia nella lista dell'altra azienda.
                      // Inizializzando lo schedule, il dipendente apparirà.
                      newSchedule[targetScheduleKey][dayIndex].fromCompany = currentCompany;
                    }
                  }

                  return newSchedule;
                });

                setTimeout(() => saveData(), 100);
                return; // IMPORTANTE: esci subito per non continuare con la validazione orari
              } else {
                // Per in1 o altri campi, usa la logica normale con propagazione
                handleQuickCode(empId, dayIndex, timeCodes[detectedCode] || detectedCode, contextKey, weekRangeValue);
                return;
              }
            }
          } else {
            // Non è un codice geografico (es. FERIE, MALATTIA, o codice azienda non riconosciuto come geo)

            // SE siamo in in2, applica SOLO a in2, NON usare handleQuickCode che sovrascrive tutto il giorno
            if (field === 'in2') {
              const currentWeek = weekRangeValue || weekRange;
              const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
              const scheduleKey = `${currentWeek}-${baseKey}`;

              setSchedule(prev => {
                const newSchedule = { ...prev };
                if (!newSchedule[scheduleKey]) newSchedule[scheduleKey] = {};
                if (!newSchedule[scheduleKey][dayIndex]) {
                  newSchedule[scheduleKey][dayIndex] = {
                    code: '',
                    in1: prev[scheduleKey]?.[dayIndex]?.in1 || '',
                    out1: prev[scheduleKey]?.[dayIndex]?.out1 || '',
                    in2: '',
                    out2: ''
                  };
                }

                const codeLabel = timeCodes[detectedCode] || detectedCode;
                newSchedule[scheduleKey][dayIndex].in2 = codeLabel;

                // Pulisci out2 se c'era un orario
                if (newSchedule[scheduleKey][dayIndex].out2 && /^\d/.test(newSchedule[scheduleKey][dayIndex].out2)) {
                  newSchedule[scheduleKey][dayIndex].out2 = '';
                }
                return newSchedule;
              });

              setTimeout(() => saveData(), 100);
              return;
            }

            // Altrimenti (in1, etc) applicalo normalmente come codice giornaliero
            handleQuickCode(empId, dayIndex, timeCodes[detectedCode] || detectedCode, contextKey, weekRangeValue);
            return;
          }
        }
      }

      const currentWeek = weekRangeValue || weekRange;
      const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
      const scheduleKey = `${currentWeek}-${baseKey}`;
      const errorKey = `${scheduleKey}-${dayIndex}-${field}`;

      // Pulisci errore precedente
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });

      if (!value) {
        const dayData = schedule[scheduleKey]?.[dayIndex] || {};
        const dayErrors = validateDaySchedule(dayData);
        if (Object.keys(dayErrors).length > 0) {
          setValidationErrors(prev => ({ ...prev, ...Object.keys(dayErrors).reduce((acc, k) => ({ ...acc, [`${scheduleKey}-${dayIndex}-${k}`]: dayErrors[k] }), {}) }));
        }
        return;
      }

      const strValue = String(value);

      // 2. Validazione Caratteri
      // Permetti lettere solo se è un codice geografico o un codice di assenza
      // Per in2, permetti anche codici geografici (AT, AV, L o nomi di città) o codici di assenza
      const hasInvalidChars = /[A-Za-z]/.test(strValue);
      if (hasInvalidChars) {
        // Verifica se è un codice valido (geografico o assenza)
        const upperValue = strValue.trim().toUpperCase();
        const isKnownCode = timeCodes[upperValue] !== undefined ||
          ['AT', 'AV', 'L'].includes(upperValue) ||
          Object.values(timeCodes).some(label => label.toUpperCase() === upperValue) ||
          // Permetti anche nomi di città comuni (Atripalda, Avellino, Lioni)
          ['ATRIPALDA', 'AVELLINO', 'LIONI'].includes(upperValue);

        if (!isKnownCode && field !== 'in2') {
          // Per in2, permette anche testo libero (potrebbe essere un nome di città o codice)
          // Per altri campi, blocca se non è un codice valido
          setValidationErrors(prev => ({ ...prev, [errorKey]: 'Valore non valido' }));
          if (showNotification) showNotification('Inserisci un orario valido', 'warning', 4000);
          handleInputChange(empId, dayIndex, field, '', contextKey, weekRangeValue);
          return;
        }
        // Se è in2 e contiene lettere, potrebbe essere un codice geografico, nome città o codice assenza
        // Non bloccare, lascia che handleBlur lo gestisca
      }

      // 3. Formattazione
      const formatted = timeHelpers.format(strValue);

      // 4. Validazione Formato
      const formatCheck = validateTimeFormat(formatted);
      if (!formatCheck.valid) {
        setValidationErrors(prev => ({ ...prev, [errorKey]: formatCheck.error }));
        if (showNotification) showNotification(formatCheck.error, 'warning', 4000);
      }

      // 5. Aggiorna con valore formattato
      if (formatted !== value) {
        handleInputChange(empId, dayIndex, field, formatted, contextKey, weekRangeValue);
      }

      // 6. Validazione Finale Giorno
      setTimeout(() => {
        const updatedDayData = schedule[scheduleKey]?.[dayIndex] || {};
        const dayDataForValidation = { ...updatedDayData, [field]: formatted };
        const dayErrors = validateDaySchedule(dayDataForValidation);

        setValidationErrors(prev => {
          const newErrors = { ...prev };
          Object.keys(newErrors).forEach(key => {
            if (key.startsWith(`${scheduleKey}-${dayIndex}-`)) delete newErrors[key];
          });
          Object.keys(dayErrors).forEach(f => {
            newErrors[`${scheduleKey}-${dayIndex}-${f}`] = dayErrors[f];
          });
          return newErrors;
        });

        // 7. Controllo sovrapposizioni con altre aziende/reparti (solo se il giorno ha orari completi)
        if ((dayDataForValidation.in1 && dayDataForValidation.out1) || (dayDataForValidation.in2 && dayDataForValidation.out2)) {
          // Trova il nome del dipendente
          const globalEmployees = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
          const employee = globalEmployees.find(e => e.id === empId);
          if (employee) {
            // Usa lo stato aggiornato dello schedule
            setSchedule(currentSchedule => {
              const overlaps = checkOverlappingSchedules(
                empId,
                employee.name,
                dayIndex,
                dayDataForValidation,
                contextKey || baseKey,
                currentWeek,
                currentSchedule
              );

              if (overlaps.length > 0) {
                const overlapMessages = overlaps.map(ov =>
                  `${ov.company} > ${ov.department} (${ov.shift}: ${ov.time})`
                ).join(', ');

                if (showNotification) {
                  showNotification(
                    `⚠️ Attenzione: Orari sovrapposti con ${overlapMessages}`,
                    'warning',
                    8000
                  );
                }
              }
              return currentSchedule; // Non modificare lo schedule, solo controllare
            });
          }
        }
      }, 200);
    } catch (error) {
      console.error('❌ Errore critico in handleBlur:', error);
      if (showNotification) showNotification(`Errore nel processare il codice: ${error.message}`, 'error');

      // In caso di errore, pulisci il campo per evitare stati inconsistenti
      // Ma solo se non è un orario valido
      if (field === 'in2' && !/^\d/.test(value)) {
        // Tentativo di recupero safe
      }
    }
  };

  const getInputBorderClass = (empId, dayIndex, field, contextKey, weekRangeValue, hasScheduleInOtherCompany = false) => {
    const currentWeek = weekRangeValue || weekRange;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;
    const errorKey = `${scheduleKey}-${dayIndex}-${field}`;
    const hasError = validationErrors[errorKey];

    if (hasScheduleInOtherCompany) {
      return hasError ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-100 cursor-help';
    }
    return hasError ? 'border-red-500 bg-red-50 focus:border-red-600' : 'border-gray-300 focus:border-blue-500';
  };

  const getFieldError = (empId, dayIndex, field, contextKey, weekRangeValue) => {
    const currentWeek = weekRangeValue || weekRange;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;
    const errorKey = `${scheduleKey}-${dayIndex}-${field}`;
    return validationErrors[errorKey] || null;
  };

  // Mappatura codici geografici → aziende
  const getCompanyFromGeographicCode = (code) => {
    // PRIMA: Verifica se il nome del codice geografico esiste come azienda
    const codeName = timeCodes[code]; // Es. "Atripalda", "Avellino", "Lioni"
    if (codeName && companies.includes(codeName)) {
      return codeName; // Usa direttamente il nome del codice se esiste come azienda
    }

    // ALTRIMENTI: Usa il mapping di fallback
    const codeMap = {
      'L': 'Albatros',    // Lioni → Albatros
      'M': 'Mercurio',
      'A': 'Albatros'     // A -> Albatros (ridondante ma sicuro)
    };
    return codeMap[code] || null;
  };

  // Verifica se un codice è geografico
  const isGeographicCode = (code) => {
    return ['L', 'M', 'A'].includes(code);
  };

  const handleQuickCode = (empId, dayIndex, code, contextKey = null, weekRangeValue = null, targetField = null) => {
    // Se il codice è vuoto, pulisci SOLO quella cella (giorno) specifica
    if (!code || code.trim() === '') {
      const currentWeek = weekRangeValue || weekRange;
      const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
      const scheduleKey = `${currentWeek}-${baseKey}`;

      // PRIMA: Leggi i dati correnti per verificare se c'è un codice geografico
      const currentDayData = schedule[scheduleKey]?.[dayIndex] || {};
      let targetKeyToRemove = null;
      let targetScheduleKeyToRemove = null;
      let sourceKeyToRemove = null;
      let sourceScheduleKeyToRemove = null;

      // Estrai azienda e reparto dal contextKey corrente
      let currentCompany = '';
      let currentDept = '';
      if (contextKey) {
        const parts = contextKey.split('-');
        currentCompany = parts[0] || '';
        currentDept = parts.slice(1).join('-') || '';
      } else {
        currentCompany = selectedCompany || companies[0] || '';
        currentDept = selectedDept || '';
      }

      // CASO 1: Se si cancella dall'azienda di origine e c'è un codice geografico
      if (currentDayData.geographicCode) {
        const targetCompany = getCompanyFromGeographicCode(currentDayData.geographicCode);

        if (targetCompany) {
          // Usa lo stesso reparto nell'azienda target
          const targetDepts = departmentsStructure[targetCompany] || [];
          let targetDept = currentDept;

          // Verifica se il reparto corrente esiste nell'azienda target
          if (!targetDepts.includes(currentDept) && targetDepts.length > 0) {
            // Se il reparto non esiste, usa il primo reparto disponibile
            if (!targetDepts.includes(targetDept)) {
              targetDept = targetDepts[0];
            }
          }

          targetKeyToRemove = `${targetCompany}-${targetDept}`;
          targetScheduleKeyToRemove = `${currentWeek}-${targetKeyToRemove}-${empId}`;
        }
      }

      // CASO 2: Se si cancella dall'azienda target (ha fromCompany), elimina anche il codice geografico dall'azienda di origine
      if (currentDayData.fromCompany && currentDayData.fromCompany !== currentCompany) {
        const sourceCompany = currentDayData.fromCompany;
        const sourceDept = currentDept; // Usa lo stesso reparto dell'azienda di origine

        sourceKeyToRemove = `${sourceCompany}-${sourceDept}`;
        sourceScheduleKeyToRemove = `${currentWeek}-${sourceKeyToRemove}-${empId}`;
      }

      setSchedule(prev => {
        const newSchedule = { ...prev };
        if (!newSchedule[scheduleKey]) newSchedule[scheduleKey] = {};

        // Elimina lo schedule nell'azienda target se esiste (CASO 1: cancellazione dall'azienda di origine)
        if (targetScheduleKeyToRemove && newSchedule[targetScheduleKeyToRemove]) {
          const targetDaySchedule = newSchedule[targetScheduleKeyToRemove];

          // Elimina il giorno specifico
          const updatedTargetSchedule = { ...targetDaySchedule };
          delete updatedTargetSchedule[dayIndex];

          // Verifica se lo schedule è completamente vuoto (nessun giorno con dati)
          const hasAnyData = Object.values(updatedTargetSchedule).some(dayData => {
            if (!dayData) return false;
            // Verifica se c'è almeno un campo con dati
            return (dayData.code && dayData.code.trim() !== '') ||
              (dayData.in1 && dayData.in1.trim() !== '') ||
              (dayData.out1 && dayData.out1.trim() !== '') ||
              (dayData.in2 && dayData.in2.trim() !== '') ||
              (dayData.out2 && dayData.out2.trim() !== '');
          });

          if (hasAnyData) {
            // Se ci sono ancora dati, mantieni lo schedule aggiornato
            newSchedule[targetScheduleKeyToRemove] = updatedTargetSchedule;
          } else {
            // Se lo schedule è completamente vuoto, eliminalo completamente
            delete newSchedule[targetScheduleKeyToRemove];
          }
        }

        // Elimina il codice geografico dall'azienda di origine se si cancella dall'azienda target (CASO 2)
        if (sourceScheduleKeyToRemove && newSchedule[sourceScheduleKeyToRemove]) {
          const sourceDaySchedule = newSchedule[sourceScheduleKeyToRemove];

          if (sourceDaySchedule[dayIndex]) {
            // Trova il codice geografico che punta all'azienda corrente
            const sourceDayData = sourceDaySchedule[dayIndex];
            if (sourceDayData.geographicCode) {
              const targetCompanyFromCode = getCompanyFromGeographicCode(sourceDayData.geographicCode);
              // Se il codice geografico punta all'azienda corrente, eliminalo
              if (targetCompanyFromCode === currentCompany) {
                const updatedSourceDayData = { ...sourceDayData };
                updatedSourceDayData.geographicCode = undefined;
                updatedSourceDayData.fromCompany = undefined;
                // Se non ci sono altri dati, elimina completamente il giorno
                const hasOtherData = (updatedSourceDayData.code && updatedSourceDayData.code.trim() !== '') ||
                  (updatedSourceDayData.in1 && updatedSourceDayData.in1.trim() !== '') ||
                  (updatedSourceDayData.out1 && updatedSourceDayData.out1.trim() !== '') ||
                  (updatedSourceDayData.in2 && updatedSourceDayData.in2.trim() !== '') ||
                  (updatedSourceDayData.out2 && updatedSourceDayData.out2.trim() !== '');

                if (hasOtherData) {
                  newSchedule[sourceScheduleKeyToRemove][dayIndex] = updatedSourceDayData;
                } else {
                  delete newSchedule[sourceScheduleKeyToRemove][dayIndex];
                }
              }
            }
          }
        }

        // Pulisci SOLO i campi di quella cella specifica, mantenendo la struttura
        newSchedule[scheduleKey][dayIndex] = {
          code: '',
          in1: '',
          out1: '',
          in2: '',
          out2: '',
          fromCompany: undefined,
          geographicCode: undefined
        };

        // CASO 2: Se si cancella dall'azienda target, verifica se lo schedule corrente è vuoto
        if (currentDayData.fromCompany && currentDayData.fromCompany !== currentCompany) {
          const currentSchedule = newSchedule[scheduleKey];
          // Verifica se lo schedule è completamente vuoto dopo la pulizia
          const hasAnyData = Object.values(currentSchedule).some(dayData => {
            if (!dayData) return false;
            // Verifica se c'è almeno un campo con dati
            return (dayData.code && dayData.code.trim() !== '') ||
              (dayData.in1 && dayData.in1.trim() !== '') ||
              (dayData.out1 && dayData.out1.trim() !== '') ||
              (dayData.in2 && dayData.in2.trim() !== '') ||
              (dayData.out2 && dayData.out2.trim() !== '');
          });

          // Se lo schedule è completamente vuoto, eliminalo completamente
          if (!hasAnyData) {
            delete newSchedule[scheduleKey];

            // Rimuovi anche il dipendente da employeesData
            const currentKey = contextKey || `${currentCompany}-${currentDept}`;
            // Salva la chiave per usarla nel setTimeout
            const keyToRemove = currentKey;
            const empIdToRemove = empId;
            const companyToCheck = currentCompany;
            const scheduleKeyToCheck = scheduleKey;

            // Rimuovi immediatamente il dipendente da employeesData (lo schedule è già stato eliminato)
            // Verifica se ci sono altri schedule per questo dipendente in altri reparti della stessa azienda
            const hasOtherSchedules = Object.keys(newSchedule).some(key => {
              if (key.includes(`-${companyToCheck}-`) && key.endsWith(`-${empIdToRemove}`) && key !== scheduleKeyToCheck) {
                const otherSchedule = newSchedule[key];
                if (otherSchedule && Object.keys(otherSchedule).length > 0) {
                  // Verifica se ha dati
                  return Object.values(otherSchedule).some(dayData => {
                    if (!dayData) return false;
                    return (dayData.code && dayData.code.trim() !== '') ||
                      (dayData.in1 && dayData.in1.trim() !== '') ||
                      (dayData.out1 && dayData.out1.trim() !== '') ||
                      (dayData.in2 && dayData.in2.trim() !== '') ||
                      (dayData.out2 && dayData.out2.trim() !== '');
                  });
                }
              }
              return false;
            });

            // Rimuovi il dipendente solo se non ha altri schedule in altri reparti
            if (!hasOtherSchedules) {
              // Usa setTimeout per assicurarsi che lo schedule sia stato aggiornato
              setTimeout(() => {
                setEmployeesData(prev => {
                  const targetEmployees = prev[keyToRemove] || [];
                  if (targetEmployees.some(e => e.id === empIdToRemove)) {
                    console.log(`🗑️ Rimozione dipendente ${empIdToRemove} da ${keyToRemove} - schedule vuoto`);
                    return {
                      ...prev,
                      [keyToRemove]: targetEmployees.filter(e => e.id !== empIdToRemove)
                    };
                  }
                  return prev;
                });
              }, 100);
            }
          }
        }

        return newSchedule;
      });

      // Dopo aver aggiornato lo schedule, verifica se bisogna rimuovere il dipendente da employeesData
      // CASO 1: Cancellazione dall'azienda di origine (targetKeyToRemove)
      if (targetKeyToRemove && targetScheduleKeyToRemove) {
        // Usa setTimeout per verificare lo stato aggiornato dopo che React ha applicato le modifiche
        setTimeout(() => {
          // Verifica se lo schedule è stato completamente eliminato
          const targetSchedule = schedule[targetScheduleKeyToRemove];
          if (!targetSchedule || Object.keys(targetSchedule).length === 0) {
            // Verifica se ci sono altri schedule per questo dipendente in altri reparti della stessa azienda
            const [targetCompany] = targetKeyToRemove.split('-');
            const hasOtherSchedules = Object.keys(schedule).some(key => {
              if (key.includes(`-${targetCompany}-`) && key.endsWith(`-${empId}`) && key !== targetScheduleKeyToRemove) {
                const otherSchedule = schedule[key];
                if (otherSchedule && Object.keys(otherSchedule).length > 0) {
                  // Verifica se ha dati
                  return Object.values(otherSchedule).some(dayData => {
                    if (!dayData) return false;
                    return (dayData.code && dayData.code.trim() !== '') ||
                      (dayData.in1 && dayData.in1.trim() !== '') ||
                      (dayData.out1 && dayData.out1.trim() !== '') ||
                      (dayData.in2 && dayData.in2.trim() !== '') ||
                      (dayData.out2 && dayData.out2.trim() !== '');
                  });
                }
              }
              return false;
            });

            // Rimuovi il dipendente solo se non ha altri schedule in altri reparti
            if (!hasOtherSchedules) {
              setEmployeesData(prev => {
                const targetEmployees = prev[targetKeyToRemove] || [];
                if (targetEmployees.some(e => e.id === empId)) {
                  return {
                    ...prev,
                    [targetKeyToRemove]: targetEmployees.filter(e => e.id !== empId)
                  };
                }
                return prev;
              });
            }
          }
        }, 200);
      }


      return;
    }

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
    const codeKey = getCodeKey(code) || '';

    // Se è un codice assenza, applica direttamente al giorno selezionato (senza popup)
    if (isAbsenceCode(codeKey)) {
      // Applica direttamente il codice al giorno selezionato (solo 1 giorno, manuale)
      const keyToSave = codeKey;

      setSchedule(prev => {
        const newSchedule = { ...prev };
        if (!newSchedule[scheduleKey]) newSchedule[scheduleKey] = {};
        if (!newSchedule[scheduleKey][dayIndex]) newSchedule[scheduleKey][dayIndex] = {};

        // Applica il codice solo al giorno selezionato
        newSchedule[scheduleKey][dayIndex] = {
          code: keyToSave,
          in1: '',
          out1: '',
          in2: '',
          out2: '',
          fromCompany: undefined,
          geographicCode: undefined
        };

        return newSchedule;
      });
      return;
    }

    // Per codici non-assenza (geografici), salva la chiave invece del label
    const keyToSave = codeKey || code;

    // Se è un codice geografico, salva anche in geographicCode per permettere la ricerca
    const isGeoCode = isGeographicCode(codeKey);

    // Nota: currentCompany è già stato estratto sopra (riga 1255)

    setSchedule(prev => {
      const currentDayData = prev[scheduleKey]?.[dayIndex] || {};
      const hasExistingTimes = (currentDayData.in1 && currentDayData.out1) || (currentDayData.in2 && currentDayData.out2);

      // Se targetField è in2, applica il codice solo a in2 senza toccare code o altri campi
      if (targetField === 'in2') {
        const codeLabel = timeCodes[keyToSave] || code;
        return {
          ...prev,
          [scheduleKey]: {
            ...prev[scheduleKey],
            [dayIndex]: {
              ...currentDayData,
              in2: codeLabel, // Salva solo il label in in2
              out2: '' // Pulisci out2 se c'era un orario
              // NON toccare code, in1, out1 - devono rimanere invariati
            }
          }
        };
      }

      const newSchedule = {
        ...prev,
        [scheduleKey]: {
          ...prev[scheduleKey],
          [dayIndex]: {
            // Se è un codice geografico E ci sono orari esistenti, preserva gli orari
            // Altrimenti, applica il codice normalmente
            code: keyToSave || '',
            in1: (isGeoCode && hasExistingTimes) ? (currentDayData.in1 || '') : (keyToSave ? '' : (prev[scheduleKey]?.[dayIndex]?.in1 || '')),
            out1: (isGeoCode && hasExistingTimes) ? (currentDayData.out1 || '') : (keyToSave ? '' : (prev[scheduleKey]?.[dayIndex]?.out1 || '')),
            in2: (isGeoCode && hasExistingTimes) ? (currentDayData.in2 || '') : (keyToSave ? '' : (prev[scheduleKey]?.[dayIndex]?.in2 || '')),
            out2: (isGeoCode && hasExistingTimes) ? (currentDayData.out2 || '') : (keyToSave ? '' : (prev[scheduleKey]?.[dayIndex]?.out2 || '')),
            // Se è un codice geografico, salva anche in geographicCode e fromCompany
            geographicCode: isGeoCode ? codeKey : (prev[scheduleKey]?.[dayIndex]?.geographicCode || undefined),
            fromCompany: isGeoCode ? currentCompany : (prev[scheduleKey]?.[dayIndex]?.fromCompany || undefined)
          }
        }
      };

      // RIMOSSA: Logica che crea automaticamente il dipendente nell'azienda target quando si applica un codice geografico
      // Ora quando si applica un codice geografico, viene salvato solo nell'azienda di origine
      // Il dipendente non viene più aggiunto automaticamente all'azienda target

      return newSchedule;
    });
  };

  // Applica codice assenza a giorni consecutivi in TUTTE le aziende dove il dipendente è presente
  const applyAbsenceCode = (empId, startDayIndex, code, codeKey, days, contextKey = null, weekRangeValue = null) => {
    const currentWeek = weekRangeValue || weekRange;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;

    // Usa codeKey se disponibile, altrimenti cerca la chiave dal label
    const keyToSave = codeKey || getCodeKey(code) || code;

    setSchedule(prev => {
      const newSchedule = { ...prev };

      for (let i = 0; i < days; i++) {
        const dayIdx = startDayIndex + i;
        if (dayIdx >= 7) continue; // Skip if out of week bounds

        if (!newSchedule[scheduleKey][dayIdx]) newSchedule[scheduleKey][dayIdx] = {};

        newSchedule[scheduleKey][dayIdx] = {
          ...newSchedule[scheduleKey][dayIdx],
          code: keyToSave,
          in1: '',
          out1: '',
          in2: '',
          out2: '',
          fromCompany: undefined,
          geographicCode: undefined
        };
      }

      return newSchedule;
    });
  };

  // Funzione helper per salvare con uno schedule specifico
  const saveDataWithSchedule = async (scheduleToSave) => {
    try {
      // Usa scheduleToSave se fornito, altrimenti usa lo stato corrente
      const scheduleData = scheduleToSave !== undefined ? scheduleToSave : schedule;

      // Salva SOLO la lista globale, rimuovi tutte le liste specifiche
      const employeesToSave = {
        [GLOBAL_EMPLOYEES_KEY]: employeesData[GLOBAL_EMPLOYEES_KEY] || []
      };

      const dataToSave = {
        companies,
        departments: departmentsStructure,
        employees: employeesToSave,
        schedule: scheduleData,
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

      return true;
    } catch (error) {
      console.error('❌ Errore salvataggio dipendente:', error);
      if (showNotification) {
        showNotification(`Errore nel salvataggio: ${error.message}`, 'error', 6000);
      }
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
      if (showNotification) {
        showNotification(`Errore: Azienda o reparto non validi. Azienda: ${company || 'non selezionata'}, Reparto: ${dept || 'non selezionato'}`, 'error', 6000);
      }
      return;
    }

    const key = getContextKey(company, dept);
    const employeeName = nameToUse.toUpperCase().trim();

    // Cerca se esiste già un dipendente con questo nome nella lista globale
    const globalList = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
    const existingEmployee = globalList.find(e => e.name === employeeName);

    // Usa l'ID esistente se trovato, altrimenti crea un nuovo ID
    const employeeId = existingEmployee ? existingEmployee.id : Date.now();
    const newName = employeeName;

    // Aggiungi alla lista globale se non esiste già
    if (!existingEmployee) {
      setEmployeesData(prev => {
        const updated = { ...prev };
        const globalList = updated[GLOBAL_EMPLOYEES_KEY] || [];
        const existsInGlobal = globalList.some(e => e.id === employeeId || e.name === newName);
        if (!existsInGlobal) {
          updated[GLOBAL_EMPLOYEES_KEY] = [...globalList, { id: employeeId, name: newName }];
        }
        return updated;
      });
    }

    // 2. Aggiungi subito alla settimana corrente per l'azienda/reparto selezionato (anche se il dipendente esiste già)
    const currentWeek = weekRangeValue || getWeekDates(0).formatted;
    const scheduleKey = `${currentWeek}-${key}-${employeeId}`;

    setSchedule(prevSchedule => {
      // Se esiste già uno schedule per questo dipendente/settimana, non sovrascriverlo
      if (prevSchedule[scheduleKey] !== undefined) {
        return prevSchedule;
      }

      // Inizializza con almeno un giorno vuoto (lunedì) per far apparire il dipendente nella lista
      const newSchedule = {
        ...prevSchedule,
        [scheduleKey]: {
          0: { in1: '', out1: '', in2: '', out2: '', code: '' } // Inizializza lunedì vuoto
        }
      };

      return newSchedule;
    });

    setQuickAddName('');
    setShowSuggestions(false);

    // Focus automatico sul primo campo orario (Lunedì Entrata)
    setTimeout(() => {
      const inputId = `input-${employeeId}-0-in1`;
      const element = document.getElementById(inputId);
      if (element) {
        element.focus();
        element.select();
      }
    }, 600); // Ritardo leggermente maggiore perché c'è anche il salvataggio struttura
  };

  // Funzione per validare il nome del dipendente
  const validateEmployeeName = (employeeName) => {
    const nameUpper = employeeName.toUpperCase().trim();

    // 1. Verifica formato nome.cognome
    if (!nameUpper.includes('.')) {
      return {
        valid: false,
        error: 'Il nome deve essere nel formato "nome.cognome" (es. mario.rossi)'
      };
    }

    const parts = nameUpper.split('.');
    if (parts.length !== 2) {
      return {
        valid: false,
        error: 'Il nome deve essere nel formato "nome.cognome" con un solo punto'
      };
    }

    const [nome, cognome] = parts.map(p => p.trim());
    if (!nome || !cognome) {
      return {
        valid: false,
        error: 'Il nome e il cognome non possono essere vuoti'
      };
    }

    // 2. Verifica se esiste già
    const globalList = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
    const exactMatch = globalList.find(e => e.name === nameUpper);
    if (exactMatch) {
      return {
        valid: false,
        error: `Il dipendente "${nameUpper}" esiste già!`
      };
    }

    // 3. Verifica omonimi (cognome.nome e nomi simili)
    const reversedName = `${cognome}.${nome}`;
    const reversedMatch = globalList.find(e => e.name === reversedName);
    if (reversedMatch) {
      return {
        valid: false,
        error: `Attenzione: esiste già un dipendente "${reversedName}". Verifica se si tratta dello stesso dipendente.`
      };
    }

    // Verifica nomi simili (stesso nome o stesso cognome)
    const similarEmployees = globalList.filter(e => {
      const empParts = e.name.split('.');
      if (empParts.length !== 2) return false;
      const [empNome, empCognome] = empParts.map(p => p.trim());
      // Stesso nome o stesso cognome
      return empNome === nome || empCognome === cognome;
    });

    if (similarEmployees.length > 0) {
      const similarNames = similarEmployees.map(e => e.name).join(', ');
      return {
        valid: true,
        warning: `Attenzione: esistono dipendenti con nomi simili: ${similarNames}. Verifica che non si tratti dello stesso dipendente.`
      };
    }

    return { valid: true };
  };

  // Funzione per creare e aggiungere un nuovo dipendente con validazione
  const handleCreateAndAddEmployee = (employeeName, targetCompany, targetDept, weekRangeValue) => {
    const validation = validateEmployeeName(employeeName);

    if (!validation.valid) {
      if (showNotification) {
        showNotification(validation.error, 'error', 6000);
      }
      return;
    }

    // Mostra warning se ci sono omonimi simili
    if (validation.warning) {
      if (showNotification) {
        showNotification(validation.warning, 'warning', 8000);
      }
      // Continua comunque, ma avvisa l'utente
    }

    // Usa handleQuickAddEmployee con il nome forzato
    handleQuickAddEmployee(targetCompany, targetDept, weekRangeValue, employeeName);
  };

  // --- GESTIONE CODICI ORARI ---
  const addTimeCode = () => {
    if (!newCodeKey.trim() || !newCodeLabel.trim()) return;
    const key = newCodeKey.toUpperCase().trim();
    if (key.length > 1) {
      if (showNotification) {
        showNotification("Il codice deve essere di 1 solo carattere (es. M, F, P)", 'warning', 5000);
      }
      return;
    }

    // BLOCCO CODICI RISERVATI
    if (['M', 'L', 'A'].includes(key)) {
      if (showNotification) {
        showNotification(`Il codice "${key}" è riservato e non può essere modificato.`, 'error', 5000);
      }
      return;
    }

    // RIMOSSO: Blocco che impediva la sovrascrittura.
    // ORA: Impedisci sovrascrittura come richiesto dall'utente.
    if (timeCodes[key]) {
      if (showNotification) {
        showNotification(`Il codice "${key}" esiste già. Eliminalo prima di ricrearlo.`, 'warning', 5000);
      }
      return;
    }

    const newCodes = { ...timeCodes, [key]: newCodeLabel.trim() };
    // Assicurati che la chiave non sia già nell'ordine (anche se il check sopra dovrebbe prevenirlo)
    const newOrder = [...new Set([...timeCodesOrder, key])];

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

      saveData(newCodes, newOrder); // Passa i nuovi valori direttamente
    }, 100); // Ridotto a 100ms per salvare più velocemente
  };

  const deleteTimeCode = (key) => {
    // BLOCCO CODICI RISERVATI
    if (['M', 'L', 'A'].includes(key)) {
      if (showNotification) {
        showNotification(`Il codice "${key}" è riservato e non può essere eliminato.`, 'error', 5000);
      }
      return;
    }

    // VERIFICA UTILIZZO: Controlla se il codice è usato nello schedule
    const label = timeCodes[key];
    const isUsed = Object.values(schedule).some(weekData => {
      if (!weekData) return false;
      return Object.values(weekData).some(dayData => {
        if (!dayData) return false;
        // Controlla se il codice è usato come 'code' (etichetta intera) o in 'in2' (etichetta intera)
        // Nota: lo schedule salva l'etichetta (es. 'Malattia'), non la chiave (es. 'M')
        // Ma per sicurezza controlliamo entrambi, e in modo case-insensitive
        const codeToCheck = (dayData.code || '').toUpperCase();
        const in2ToCheck = (dayData.in2 || '').toUpperCase();
        const keyUpper = key.toUpperCase();
        const labelUpper = label.toUpperCase();

        return codeToCheck === labelUpper || codeToCheck === keyUpper ||
          in2ToCheck === labelUpper || in2ToCheck === keyUpper;
      });
    });

    if (isUsed) {
      if (showNotification) {
        showNotification(
          `Impossibile eliminare il codice "${key}" (${label}): è utilizzato nei turni esistenti. Rimuovilo dai turni prima di eliminarlo per non perdere la relazione.`,
          'error',
          8000
        );
      }
      return;
    }

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
  const handleContextMenu = (e, empId, dayIndex, contextKey = null, weekRangeValue = null, field = null) => {
    e.preventDefault();

    // Verifica se il campo ha un codice
    const currentWeek = weekRangeValue || weekRange;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;
    const cellData = schedule[scheduleKey]?.[dayIndex] || {};
    const hasCode = cellData.code && cellData.code.trim() !== '';

    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      empId,
      dayIndex,
      contextKey,
      weekRangeValue,
      hasCode, // Flag per sapere se ha un codice
      field // Campo su cui è stato fatto click destro (in1, out1, in2, out2, o null per il campo code)
    });
  };

  // Funzione per convertire un codice in orario (rimuove il codice e pulisce i campi)
  const convertCodeToTime = (empId, dayIndex, contextKey = null, weekRangeValue = null) => {
    const currentWeek = weekRangeValue || weekRange;
    const baseKey = contextKey ? `${contextKey}-${empId}` : empId;
    const scheduleKey = `${currentWeek}-${baseKey}`;

    setSchedule(prev => {
      const newSchedule = { ...prev };
      if (!newSchedule[scheduleKey]) newSchedule[scheduleKey] = {};
      if (!newSchedule[scheduleKey][dayIndex]) newSchedule[scheduleKey][dayIndex] = {};

      // Rimuovi il codice e pulisci tutti i campi orario
      newSchedule[scheduleKey][dayIndex] = {
        ...newSchedule[scheduleKey][dayIndex],
        code: '',
        in1: '',
        out1: '',
        in2: '',
        out2: '',
        fromCompany: undefined,
        geographicCode: undefined
      };

      return newSchedule;
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

  const addEmployee = () => {
    if (!newEmployeeName.trim()) return;

    // Valida il nome del dipendente
    const validation = validateEmployeeName(newEmployeeName);

    if (!validation.valid) {
      if (showNotification) {
        showNotification(validation.error, 'error', 6000);
      }
      return;
    }

    // Mostra warning se ci sono omonimi simili
    if (validation.warning) {
      if (showNotification) {
        showNotification(validation.warning, 'warning', 8000);
      }
      // Continua comunque, ma avvisa l'utente
    }

    const newId = Date.now();
    const newName = newEmployeeName.toUpperCase().trim();

    // Aggiungi SOLO alla lista globale - non creare automaticamente lo schedule
    // Il dipendente verrà aggiunto alle liste solo quando selezionato dalla ricerca
    setEmployeesData(prev => {
      const globalList = prev[GLOBAL_EMPLOYEES_KEY] || [];
      return {
        ...prev,
        [GLOBAL_EMPLOYEES_KEY]: [...globalList, { id: newId, name: newName }]
      };
    });

    setNewEmployeeName('');
    // Il salvataggio avverrà tramite useEffect
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
    // Rimuovi il dipendente dalla lista globale
    setEmployeesData(prev => {
      const globalList = prev[GLOBAL_EMPLOYEES_KEY] || [];
      return {
        ...prev,
        [GLOBAL_EMPLOYEES_KEY]: globalList.filter(e => e.id !== empId)
      };
    });

    // Rimuovi anche gli orari (cerca tutte le chiavi che contengono questo empId)
    setSchedule(prev => {
      const newSchedule = { ...prev };
      Object.keys(newSchedule).forEach(scheduleKey => {
        if (scheduleKey.includes(`-${empId}`) || scheduleKey.endsWith(empId.toString())) {
          delete newSchedule[scheduleKey];
        }
      });
      return newSchedule;
    });
  };

  // Rimuove i dati del dipendente per quella settimana e contesto specifico
  // IMPORTANTE: Quando l'utente elimina un dipendente, rimuove COMPLETAMENTE lo schedule per quell'azienda
  // Questo fa scomparire il dipendente dalla lista, anche se aveva dati riportati da altre aziende
  const removeEmployeeFromWeek = (empId, contextKey = null, weekRangeValue = null, company = null, department = null) => {
    const currentWeek = weekRangeValue || getWeekDates(0).formatted;

    setSchedule(prev => {
      const newSchedule = { ...prev };
      let foundAndDeleted = false;

      // Se abbiamo company e department, cerca lo schedule in tutti i reparti di quella azienda
      if (company) {
        const companyDepts = departmentsStructure[company] || [];
        const deptsToCheck = department && companyDepts.includes(department)
          ? [department, ...companyDepts.filter(d => d !== department)]
          : companyDepts.length > 0 ? companyDepts : [department].filter(Boolean);

        // Rimuovi COMPLETAMENTE lo schedule in tutti i reparti dell'azienda
        for (const dept of deptsToCheck) {
          const checkKey = getContextKey(company, dept);
          const scheduleKey = `${currentWeek}-${checkKey}-${empId}`;

          if (newSchedule[scheduleKey]) {
            // Rimuovi completamente lo schedule per questa azienda/reparto
            delete newSchedule[scheduleKey];
            foundAndDeleted = true;
          }
        }
      }

      // Fallback: usa contextKey se fornito
      if (!foundAndDeleted && contextKey) {
        const baseKey = `${contextKey}-${empId}`;
        const scheduleKey = `${currentWeek}-${baseKey}`;

        if (newSchedule[scheduleKey]) {
          // Rimuovi completamente lo schedule
          delete newSchedule[scheduleKey];
          foundAndDeleted = true;
        }
      }

      // Salva le modifiche sul database
      if (foundAndDeleted) {
        setTimeout(() => saveDataWithSchedule(newSchedule), 100);
      }

      return newSchedule;
    });

    // NOTA: Non rimuoviamo il dipendente dalla lista globale qui
    // perché potrebbe essere usato in altri reparti/aziende
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

    const newNameUpper = newEmployeeName.toUpperCase().trim();
    let targetEmployeeId = newEmployeeId;

    // Verifica se esiste già un dipendente con questo nome (case-insensitive)
    const existingEmployee = currentEmployees.find(
      emp => emp.id !== oldEmployeeId && emp.name.toUpperCase() === newNameUpper
    );

    if (existingEmployee) {
      // Se il dipendente esiste già: SCAMBIA SOLO I NOMI
      // Gli orari rimangono invariati (attaccati ai rispettivi ID)
      const oldEmployee = currentEmployees.find(emp => emp.id === oldEmployeeId);
      if (oldEmployee) {
        setEmployeesData(prev => {
          const globalList = prev[GLOBAL_EMPLOYEES_KEY] || [];
          const updatedList = globalList.map(emp => {
            if (emp.id === oldEmployeeId) {
              return { ...emp, name: newNameUpper };
            } else if (emp.id === existingEmployee.id) {
              return { ...emp, name: oldEmployee.name };
            }
            return emp;
          });
          return {
            ...prev,
            [GLOBAL_EMPLOYEES_KEY]: updatedList
          };
        });
      }
      // NON trasferire gli orari - rimangono dove sono
    } else if (!targetEmployeeId) {
      // Se il dipendente NON esiste: crea nuovo nella lista globale e trasferisci gli orari
      targetEmployeeId = Date.now();
      const newEmployee = { id: targetEmployeeId, name: newNameUpper };

      setEmployeesData(prev => {
        const globalList = prev[GLOBAL_EMPLOYEES_KEY] || [];
        return {
          ...prev,
          [GLOBAL_EMPLOYEES_KEY]: [...globalList.filter(e => e.id !== oldEmployeeId), newEmployee]
        };
      });

      // Trasferisci gli orari dal vecchio al nuovo dipendente
      setSchedule(prev => {
        const newSchedule = { ...prev };
        Object.keys(newSchedule).forEach(scheduleKey => {
          if (scheduleKey.includes(`-${oldEmployeeId}`) || scheduleKey.endsWith(oldEmployeeId.toString())) {
            const newKey = scheduleKey.replace(`-${oldEmployeeId}`, `-${targetEmployeeId}`).replace(oldEmployeeId.toString(), targetEmployeeId.toString());
            newSchedule[newKey] = { ...newSchedule[scheduleKey] };
            delete newSchedule[scheduleKey];
          }
        });
        return newSchedule;
      });
    } else {
      // Dipendente selezionato dalla lista che esiste già
      // Trasferisci gli orari
      setSchedule(prev => {
        const newSchedule = { ...prev };
        Object.keys(newSchedule).forEach(scheduleKey => {
          if (scheduleKey.includes(`-${oldEmployeeId}`) || scheduleKey.endsWith(oldEmployeeId.toString())) {
            const newKey = scheduleKey.replace(`-${oldEmployeeId}`, `-${targetEmployeeId}`).replace(oldEmployeeId.toString(), targetEmployeeId.toString());
            if (newSchedule[newKey]) {
              // Unisci gli orari se il target ha già orari
              newSchedule[newKey] = { ...newSchedule[scheduleKey], ...newSchedule[newKey] };
            } else {
              newSchedule[newKey] = { ...newSchedule[scheduleKey] };
            }
            delete newSchedule[scheduleKey];
          }
        });
        return newSchedule;
      });

      // Rimuovi il vecchio dipendente dalla lista globale
      setEmployeesData(prev => {
        const globalList = prev[GLOBAL_EMPLOYEES_KEY] || [];
        return {
          ...prev,
          [GLOBAL_EMPLOYEES_KEY]: globalList.filter(emp => emp.id !== oldEmployeeId)
        };
      });
    }

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

  };

  const removeList = (listId) => {
    setViewLists(prev => prev.filter(list => list.id !== listId));

  };

  const updateListFilter = (listId, filterType, value) => {
    setViewLists(prev => {
      const firstList = prev[0];
      const isFirstList = firstList?.id === listId;

      // Aggiorna la lista modificata
      let updatedLists = prev.map(list => {
        if (list.id === listId) {
          const updated = { ...list, [filterType]: value };

          // Se cambia l'azienda, resetta il reparto al primo disponibile
          if (filterType === 'company') {
            updated.department = departmentsStructure[value]?.[0] || '';
          }

          // Controlla se questa combinazione (azienda/reparto/settimana) esiste già in un'altra lista
          if (updated.company && updated.department && updated.weekRange) {
            const isDuplicate = prev.some(otherList =>
              otherList.id !== listId &&
              otherList.company === updated.company &&
              otherList.department === updated.department &&
              otherList.weekRange === updated.weekRange
            );

            if (isDuplicate) {
              // Se è un duplicato, mostra avviso e non applicare la modifica
              if (showNotification) {
                showNotification('⚠️ Questa combinazione (Azienda/Reparto/Settimana) esiste già in un\'altra lista. Seleziona una settimana diversa (precedente o successiva).', 'warning', 5000);
              }
              // Restituisci la lista originale senza modifiche
              return list;
            }
          }

          return updated;
        }
        return list;
      });

      // RIMOSSA: Logica che crea automaticamente liste di confronto
      // Ora le liste vengono create solo manualmente tramite il pulsante "Aggiungi Lista"

      return updatedLists;
    });
  };

  // Helper per ottenere il contesto corrente (per compatibilità)
  const getCurrentContextKey = () => {
    return getContextKey(selectedCompany, selectedDept);
  };

  // Helper per generare la chiave del contesto (Azienda-Reparto)
  const getContextKey = (company, dept) => {
    if (!company) return '';
    return dept ? `${company}-${dept}` : company;
  };

  // Funzione per aprire una lista quando si clicca su un risultato di ricerca
  const openListFromSearch = (result) => {
    // Verifica se la lista esiste già
    const existingList = viewLists.find(list =>
      list.company === result.company &&
      list.department === result.department &&
      list.weekRange === result.week
    );

    if (!existingList) {
      // Rimuovi la maschera vuota (quella con company e department vuoti) se presente
      // e aggiungi la nuova lista
      const newId = Date.now();
      const newList = {
        id: newId,
        company: result.company,
        department: result.department,
        weekRange: result.week
      };
      setViewLists(prev => {
        // Filtra via le maschere vuote (company e department vuoti)
        const withoutEmpty = prev.filter(list => list.company !== '' || list.department !== '');
        // Aggiungi la nuova lista
        return [...withoutEmpty, newList];
      });
    }

    // Chiudi la ricerca
    setGlobalSearchName('');
    setSearchResults([]);
  };

  // Funzione per cercare dove è impegnato un dipendente
  const searchEmployeeEngagements = (employeeName) => {
    if (!employeeName || !employeeName.trim()) {
      setSearchResults([]);
      return;
    }

    const nameUpper = employeeName.toUpperCase().trim();
    const globalEmployees = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
    const matchingEmployees = globalEmployees.filter(e => e.name.toUpperCase().includes(nameUpper));

    if (matchingEmployees.length === 0) {
      setSearchResults([]);
      return;
    }

    const results = [];

    // Per ogni dipendente trovato, cerca tutti i suoi schedule
    matchingEmployees.forEach(emp => {
      Object.keys(schedule).forEach(scheduleKey => {
        // Pattern: "dd/mm/yyyy al dd/mm/yyyy-Company-Department-empId"
        if (scheduleKey.endsWith(`-${emp.id}`)) {
          // Estrai la settimana (prima parte fino a "al")
          const weekMatch = scheduleKey.match(/^(.+? al .+?)-/);
          if (!weekMatch) return;

          const weekPart = weekMatch[1];
          const restOfKey = scheduleKey.replace(`${weekPart}-`, '');

          // Estrai contextKey e empId
          const lastDashIndex = restOfKey.lastIndexOf('-');
          if (lastDashIndex === -1) return;

          const contextKey = restOfKey.substring(0, lastDashIndex);
          const empId = restOfKey.substring(lastDashIndex + 1);

          // Estrai azienda e reparto dal contextKey
          const contextParts = contextKey.split('-');
          const company = contextParts[0];
          const department = contextParts.slice(1).join('-');

          const empSchedule = schedule[scheduleKey];
          if (empSchedule && Object.keys(empSchedule).length > 0) {
            // Verifica se ci sono dati effettivi
            const hasData = Object.values(empSchedule).some(dayData => {
              if (!dayData) return false;
              return (dayData.code && dayData.code.trim() !== '') ||
                (dayData.in1 && dayData.in1.trim() !== '') ||
                (dayData.out1 && dayData.out1.trim() !== '') ||
                (dayData.in2 && dayData.in2.trim() !== '') ||
                (dayData.out2 && dayData.out2.trim() !== '');
            });

            if (hasData) {
              // Conta i giorni con dati
              const daysWithData = Object.values(empSchedule).filter(dayData => {
                if (!dayData) return false;
                return (dayData.code && dayData.code.trim() !== '') ||
                  (dayData.in1 && dayData.in1.trim() !== '') ||
                  (dayData.out1 && dayData.out1.trim() !== '') ||
                  (dayData.in2 && dayData.in2.trim() !== '') ||
                  (dayData.out2 && dayData.out2.trim() !== '');
              }).length;

              // Prepara l'anteprima degli orari (solo i primi 3 giorni con dati)
              const schedulePreview = [];
              const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
              for (let dayIdx = 0; dayIdx < 7 && schedulePreview.length < 3; dayIdx++) {
                const dayData = empSchedule[dayIdx];
                if (dayData) {
                  const hasDayData = (dayData.code && dayData.code.trim() !== '') ||
                    (dayData.in1 && dayData.in1.trim() !== '') ||
                    (dayData.out1 && dayData.out1.trim() !== '') ||
                    (dayData.in2 && dayData.in2.trim() !== '') ||
                    (dayData.out2 && dayData.out2.trim() !== '');
                  if (hasDayData) {
                    schedulePreview.push({
                      dayName: dayNames[dayIdx],
                      dayIndex: dayIdx,
                      data: dayData
                    });
                  }
                }
              }

              results.push({
                employeeName: emp.name,
                employeeId: emp.id,
                company,
                department,
                week: weekPart,
                daysWithData,
                schedule: empSchedule,
                schedulePreview
              });
            }
          }
        }
      });
    });

    setSearchResults(results);
  };

  // Helper per trovare lo schedule di un dipendente in un'azienda (cerca in tutti i reparti)
  const getEmployeeSchedule = (empId, company, department, weekRangeValue = null) => {
    const currentWeek = weekRangeValue || weekRange;
    const companyDepts = departmentsStructure[company] || [];
    const deptsToCheck = department && companyDepts.includes(department)
      ? [department, ...companyDepts.filter(d => d !== department)]
      : companyDepts.length > 0 ? companyDepts : [department].filter(Boolean);

    // Cerca lo schedule in tutti i reparti dell'azienda
    for (const dept of deptsToCheck) {
      const checkKey = getContextKey(company, dept);
      const scheduleKey = `${currentWeek}-${checkKey}-${empId}`;
      if (schedule[scheduleKey] !== undefined) {
        return { scheduleKey, schedule: schedule[scheduleKey], department: dept };
      }
    }

    // Fallback: usa il reparto selezionato anche se non ha schedule
    const fallbackKey = getContextKey(company, department);
    const fallbackScheduleKey = `${currentWeek}-${fallbackKey}-${empId}`;
    return { scheduleKey: fallbackScheduleKey, schedule: schedule[fallbackScheduleKey] || {}, department: department || companyDepts[0] || '' };
  };

  const getEmployeesForList = (list) => {
    const { company, department, weekRange: listWeekRange } = list;
    const currentWeek = listWeekRange || weekRange;
    const key = getContextKey(company, department);

    // Usa SOLO la lista globale e filtra per presenza nello schedule corrente
    const globalEmployees = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
    const checkKey = getContextKey(company, department);

    // Mostra dipendenti che hanno uno schedule per questa azienda/reparto
    // (anche se vuoto, basta che lo schedule esista)
    const employeesWithSchedule = globalEmployees.filter(emp => {
      const scheduleKey = `${currentWeek}-${checkKey}-${emp.id}`;
      const empSchedule = schedule[scheduleKey];

      // Se lo schedule esiste (anche se vuoto), mostra il dipendente
      // Questo permette di vedere i dipendenti appena aggiunti anche se non hanno ancora orari inseriti
      return empSchedule !== undefined && Object.keys(empSchedule).length > 0;
    });

    // Cerca anche dipendenti di altre aziende che hanno codici geografici per questa azienda
    const geographicEmployees = [];

    // Verifica se questa azienda è target di un codice geografico
    const geographicCodes = Object.keys(timeCodes).filter(codeKey => {
      const targetCompany = getCompanyFromGeographicCode(codeKey);
      return targetCompany === company;
    });

    if (geographicCodes.length > 0) {
      // 1. Cerca nello schedule dell'azienda CORRENTE per dipendenti con geographicCode
      // IMPORTANTE: Verifica che lo schedule abbia effettivamente dei dati, non solo che esista
      Object.keys(schedule).forEach(scheduleKey => {
        // Pattern: settimana-contextKey-empId
        if (scheduleKey.startsWith(`${currentWeek}-${key}-`)) {
          const empId = parseInt(scheduleKey.split('-').pop());
          const daySchedule = schedule[scheduleKey];

          // Verifica se lo schedule ha dati (non vuoto)
          const hasData = Object.values(daySchedule).some(dayData => {
            if (!dayData) return false;
            return (dayData.code && dayData.code.trim() !== '') ||
              (dayData.in1 && dayData.in1.trim() !== '') ||
              (dayData.out1 && dayData.out1.trim() !== '') ||
              (dayData.in2 && dayData.in2.trim() !== '') ||
              (dayData.out2 && dayData.out2.trim() !== '') ||
              (dayData.geographicCode && dayData.geographicCode.trim() !== '');
          });

          if (!hasData) return; // Salta se lo schedule è vuoto

          // Verifica se ha un geographicCode che punta a questa azienda
          const hasGeographicCode = Object.values(daySchedule).some(dayData => {
            if (!dayData) return false;
            return dayData.geographicCode && geographicCodes.includes(dayData.geographicCode);
          });

          if (hasGeographicCode) {
            // Trova il dipendente nella lista globale
            const emp = globalEmployees.find(e => e.id === empId);
            if (emp && !employeesWithSchedule.some(e => e.id === empId)) {
              // Trova l'azienda di origine dal fromCompany
              const fromCompany = Object.values(daySchedule).find(d => d?.fromCompany)?.fromCompany;
              geographicEmployees.push({
                ...emp,
                company: company,
                department: department,
                contextKey: key,
                isGeographic: true,
                originalCompany: fromCompany || 'Unknown'
              });
            }
          }
        }
      });

      // 2. Cerca anche nelle altre aziende, ma SOLO se il dipendente ha uno schedule nel reparto specifico di questa lista
      // IMPORTANTE: Verifica che lo schedule esista nel reparto corretto E abbia dati, non solo che abbia un codice geografico
      const targetScheduleKey = `${currentWeek}-${key}-`;
      Object.keys(schedule).forEach(scheduleKey => {
        // Verifica che lo schedule sia per questa azienda/reparto specifico
        if (!scheduleKey.startsWith(targetScheduleKey)) return;

        const empId = parseInt(scheduleKey.split('-').pop());
        const daySchedule = schedule[scheduleKey];

        if (!daySchedule) return;

        // IMPORTANTE: Verifica che lo schedule abbia effettivamente dei dati (non vuoto)
        const hasData = Object.values(daySchedule).some(dayData => {
          if (!dayData) return false;
          return (dayData.code && dayData.code.trim() !== '') ||
            (dayData.in1 && dayData.in1.trim() !== '') ||
            (dayData.out1 && dayData.out1.trim() !== '') ||
            (dayData.in2 && dayData.in2.trim() !== '') ||
            (dayData.out2 && dayData.out2.trim() !== '') ||
            (dayData.geographicCode && dayData.geographicCode.trim() !== '');
        });

        if (!hasData) return; // Salta se lo schedule è vuoto

        // Verifica se ha un codice geografico per questa azienda
        const hasGeographicCode = Object.values(daySchedule).some(dayData => {
          if (!dayData) return false;
          // Verifica se ha un codice geografico diretto
          if (dayData.code) {
            const dayCodeKey = getCodeKey(dayData.code);
            if (dayCodeKey && geographicCodes.includes(dayCodeKey)) return true;
          }
          // Verifica se ha geographicCode che punta a questa azienda
          if (dayData.geographicCode && geographicCodes.includes(dayData.geographicCode)) {
            return true;
          }
          return false;
        });

        if (hasGeographicCode) {
          // Trova il dipendente nella lista globale
          const emp = globalEmployees.find(e => e.id === empId);
          if (emp && !employeesWithSchedule.some(e => e.id === empId) && !geographicEmployees.some(e => e.id === empId)) {
            // Trova l'azienda di origine dal fromCompany
            const fromCompany = Object.values(daySchedule).find(d => d?.fromCompany)?.fromCompany;
            geographicEmployees.push({
              ...emp,
              company: company,
              department: department,
              contextKey: key,
              isGeographic: true,
              originalCompany: fromCompany || 'Unknown'
            });
          }
        }
      });
    }

    // Combina i dipendenti normali con quelli geografici (evita duplicati)
    // IMPORTANTE: Se un dipendente è già presente come normale (perché è stato aggiunto a employeesData),
    // non aggiungerlo anche come geografico per evitare duplicazioni
    const allEmployees = [...employeesWithSchedule];
    const existingIds = new Set(employeesWithSchedule.map(e => e.id));

    geographicEmployees.forEach(geoEmp => {
      // Aggiungi solo se NON è già presente come dipendente normale
      // (cioè se non è stato ancora aggiunto a employeesData per questa azienda)
      if (!existingIds.has(geoEmp.id)) {
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

  // Funzione per verificare se ci sono dipendenti con trasferte verso l'azienda selezionata
  const checkTransfersToCompany = (company, department, weekRangeValue = null) => {
    if (!company) return [];

    const currentWeek = weekRangeValue || weekRange;
    const transfers = [];

    // Verifica quali codici geografici puntano a questa azienda
    const geographicCodes = Object.keys(timeCodes).filter(codeKey => {
      const targetCompany = getCompanyFromGeographicCode(codeKey);
      return targetCompany === company;
    });

    if (geographicCodes.length === 0) return [];

    // Calcola le date della settimana
    const weekDates = getWeekDatesFromRange(currentWeek);
    const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

    // Cerca nello schedule tutti i dipendenti che hanno un geographicCode che punta a questa azienda
    Object.keys(schedule).forEach(scheduleKey => {
      // Pattern: settimana-contextKey-empId
      if (!scheduleKey.startsWith(`${currentWeek}-`)) return;

      const daySchedule = schedule[scheduleKey];
      if (!daySchedule) return;

      const empId = parseInt(scheduleKey.split('-').pop());
      const globalEmployees = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
      const employee = globalEmployees.find(e => e.id === empId);

      if (!employee) return;

      // Estrai l'azienda di origine dal fromCompany o dal contextKey
      const fromCompany = Object.values(daySchedule).find(d => d?.fromCompany)?.fromCompany;
      const contextKey = scheduleKey.replace(`${currentWeek}-`, '').replace(`-${empId}`, '');
      const sourceCompany = fromCompany || (contextKey ? contextKey.split('-')[0] : '');

      if (!sourceCompany || sourceCompany === company) return;

      // Cerca tutti i giorni con geographicCode che punta a questa azienda
      Object.keys(daySchedule).forEach(dayIndexStr => {
        const dayIndex = parseInt(dayIndexStr);
        const dayData = daySchedule[dayIndex];

        if (dayData && dayData.geographicCode && geographicCodes.includes(dayData.geographicCode)) {
          const dayDate = weekDates[dayIndex];
          const dayName = dayNames[dayIndex] || '';

          // Formatta la data in formato DD/MM/YYYY
          let formattedDate = '';
          if (dayDate && !isNaN(dayDate.getTime())) {
            const day = String(dayDate.getDate()).padStart(2, '0');
            const month = String(dayDate.getMonth() + 1).padStart(2, '0');
            const year = dayDate.getFullYear();
            formattedDate = `${day}/${month}/${year}`;
          }

          transfers.push({
            employeeName: employee.name,
            employeeId: empId,
            sourceCompany: sourceCompany,
            targetCompany: company,
            geographicCode: dayData.geographicCode,
            dayIndex: dayIndex,
            dayName: dayName,
            date: formattedDate
          });
        }
      });
    });

    return transfers;
  };

  // Funzione helper per ottenere le date della settimana da un range
  const getWeekDatesFromRange = (weekRange) => {
    if (!weekRange) return [];

    // Gestisci entrambi i formati: "DD/MM/YYYY - DD/MM/YYYY" o "DD/MM/YYYY al DD/MM/YYYY"
    let parts = weekRange.split(' - ');
    if (parts.length !== 2) {
      parts = weekRange.split(' al ');
    }
    if (parts.length !== 2) return [];

    // Parsing della data: DD/MM/YYYY -> YYYY-MM-DD
    const dateStr = parts[0].trim();
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return [];

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // I mesi in JavaScript sono 0-based
    const year = parseInt(dateParts[2], 10);

    const startDate = new Date(year, month, day);
    if (isNaN(startDate.getTime())) return [];

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Funzione per verificare se un dipendente ha una trasferta in un giorno specifico nell'azienda destinataria
  const hasTransferOnDay = (empId, dayIndex, company, weekRangeValue = null) => {
    const transfers = checkTransfersToCompany(company, null, weekRangeValue);
    return transfers.some(t => t.employeeId === empId && t.dayIndex === dayIndex);
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

      // Bordi migliorati
      const borderThin = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      };

      const borderThick = {
        top: { style: "thick", color: { rgb: "000000" } },
        bottom: { style: "thick", color: { rgb: "000000" } },
        left: { style: "thick", color: { rgb: "000000" } },
        right: { style: "thick", color: { rgb: "000000" } }
      };

      // Stile per riga separatrice tra dipendenti (sottile e scura per facilitare il taglio)
      const styleSeparator = {
        fill: { fgColor: { rgb: "000000" } },
        border: borderThick,
        alignment: { horizontal: "center", vertical: "center" }
      };

      // Stile titolo migliorato
      const styleTitle = {
        font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" } }, // Blu scuro
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: borderThin
      };

      // Stile header migliorato
      const styleHeader = {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "5B9BD5" } }, // Blu chiaro
        border: borderThin,
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };

      // Stile header totale migliorato
      const styleTotalHeader = {
        font: { bold: true, sz: 11, color: { rgb: "000000" } },
        fill: { fgColor: { rgb: "FFC000" } }, // Giallo
        border: borderThin,
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };

      // Stile celle normali migliorato
      const styleCell = {
        font: { sz: 10 },
        border: borderThin,
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "FFFFFF" } }
      };

      // Stile nome dipendente migliorato
      const styleEmpName = {
        font: { bold: true, sz: 8, color: { rgb: "000000" } },
        fill: { fgColor: { rgb: "E7E6E6" } }, // Grigio chiaro
        border: borderThin,
        alignment: { horizontal: "left", vertical: "center", indent: 1 }
      };

      // Stile cella totale migliorato
      const styleTotalCell = {
        font: { bold: true, sz: 11, color: { rgb: "000000" } },
        fill: { fgColor: { rgb: "FFE699" } }, // Giallo chiaro
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

        listEmployees.forEach((emp, empIndex) => {
          // Aggiungi riga separatrice nera PRIMA di ogni dipendente
          const separatorRow = new Array(16).fill({ v: "", s: styleSeparator });
          wsData.push(separatorRow);

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
              // Mostra il label del codice invece della chiave
              // Unifica le celle Entrata e Uscita in un'unica cella
              const codeLabel = getCodeLabel(data.code);
              row1[colIdx] = { v: codeLabel, s: styleCell };
              row1[colIdx + 1] = { v: "", s: styleCell }; // Cella vuota per il merge
              // Merge orizzontale (Entrata + Uscita) e verticale (riga 1 + riga 2)
              merges.push({ s: { r: startRowIndex, c: colIdx }, e: { r: startRowIndex + 1, c: colIdx + 1 } });
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

        // Imposta altezze righe per migliorare la leggibilità e facilitare il taglio
        ws['!rows'] = [];
        // Titolo più alto
        ws['!rows'][0] = { hpt: 30 };
        ws['!rows'][1] = { hpt: 25 };
        // Header più alto
        ws['!rows'][2] = { hpt: 25 };
        ws['!rows'][3] = { hpt: 20 };
        // Riga separatrice tra dipendenti molto sottile (1px) per facilitare il taglio
        for (let R = 4; R < wsData.length; R++) {
          const cell = wsData[R]?.[0];
          if (cell && cell.s && cell.s.fill && cell.s.fill.fgColor && cell.s.fill.fgColor.rgb === "000000") {
            ws['!rows'][R] = { hpt: 1 }; // Riga separatrice nera molto sottile (1px)
          } else {
            ws['!rows'][R] = { hpt: 20 }; // Righe normali
          }
        }

        // Ottimizza larghezze colonne per A4 orizzontale
        // A4 landscape: ~277mm disponibili con margini standard
        // Riduciamo le colonne per far entrare tutto
        const wscols = [{ wch: 18 }]; // Nome dipendente ridotto
        for (let i = 0; i < 14; i++) wscols.push({ wch: 7 }); // Colonne orari ridotte
        wscols.push({ wch: 8 }); // Totale ridotto
        ws['!cols'] = wscols;

        // Impostazioni di stampa per A4 orizzontale
        ws['!margins'] = {
          left: 0.5,   // 0.5 inch = ~12.7mm
          right: 0.5,
          top: 0.5,
          bottom: 0.5,
          header: 0.3,
          footer: 0.3
        };

        // Impostazioni pagina: A4 orizzontale
        ws['!pageSetup'] = {
          paperSize: 9, // A4
          orientation: 'landscape', // Orizzontale
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0, // 0 = adatta automaticamente
          scale: 100
        };

        // Impostazioni print options
        ws['!printOptions'] = {
          gridLines: true,
          horizontalCentered: true,
          verticalCentered: false
        };

        let sheetName = `${company} - ${department}`;
        const duplicateCount = viewLists.filter((l, i) => i < listIndex && l.company === company && l.department === department).length;
        if (duplicateCount > 0) {
          sheetName += ` (${duplicateCount + 1})`;
        }
        sheetName = sheetName.substring(0, 31).replace(/[^a-zA-Z0-9 -]/g, "");

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      if (!hasExportedData) {
        if (showNotification) {
          showNotification("Nessun dato da esportare nelle liste visualizzate.", 'warning', 5000);
        }
        return;
      }

      const fileName = `Turni_Multi_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

    } catch (error) {
      console.error("Export error:", error);
      openConfirm("Errore Esportazione", "Si è verificato un errore. Prova a ricaricare la pagina.", null);
    }
  };

  // --- EXPORT PDF CON ANTEPRIMA ---
  const generatePDFPreview = () => {
    const previewData = [];
    let hasData = false;

    viewLists.forEach((list, listIndex) => {
      const { company, department, weekRange: listWeekRange } = list;
      if (!company || !department) return;

      const listEmployees = getEmployeesForList(list);
      if (listEmployees.length === 0) return;

      hasData = true;
      const employeesData = [];

      listEmployees.forEach((emp) => {
        const currentWeek = listWeekRange || getWeekDates(0).formatted;
        const baseKey = emp.contextKey ? `${emp.contextKey}-${emp.id}` : emp.id;
        const scheduleKey = `${currentWeek}-${baseKey}`;

        const empNameDisplay = multiCompanyMode ? `${emp.name} (${emp.company} - ${emp.department})` : emp.name;
        const daysData = [];

        days.forEach((dayName, dayIdx) => {
          const data = schedule[scheduleKey]?.[dayIdx];
          if (data) {
            if (data.code) {
              const codeLabel = getCodeLabel(data.code);
              daysData.push({
                day: dayName,
                in1: codeLabel,
                out1: '', // Vuoto perché verrà unificato
                in2: '',
                out2: '',
                isCode: true // Flag per indicare che è un codice da unificare
              });
            } else {
              daysData.push({
                day: dayName,
                in1: data.in1 || '',
                out1: data.out1 || '',
                in2: data.in2 || '',
                out2: data.out2 || '',
                isCode: false
              });
            }
          } else {
            daysData.push({
              day: dayName,
              in1: '',
              out1: '',
              in2: '',
              out2: '',
              isCode: false
            });
          }
        });

        employeesData.push({
          name: empNameDisplay,
          days: daysData
        });
      });

      previewData.push({
        company,
        department,
        weekRange: listWeekRange,
        employees: employeesData
      });
    });

    return { previewData, hasData };
  };

  // Funzione helper per calcolare ore da stringa tempo
  const calculateHours = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const cleanStr = timeStr.replace(',', '.').replace(':', '.').trim();
    if (!cleanStr.includes('.')) {
      const val = parseFloat(cleanStr);
      return isNaN(val) ? 0 : val;
    }
    const parts = cleanStr.split('.');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    if (isNaN(hours)) return 0;
    const safeMinutes = isNaN(minutes) ? 0 : minutes;
    return hours + safeMinutes / 60;
  };

  const showPDFPreview = () => {
    const { previewData, hasData } = generatePDFPreview();

    if (!hasData) {
      if (showNotification) {
        showNotification("Nessun dato da esportare nelle liste visualizzate.", 'warning', 5000);
      }
      return;
    }

    setPdfPreviewModal({
      isOpen: true,
      pdfData: previewData
    });
  };

  const exportPDF = () => {
    try {
      if (!window.jspdf) {
        openConfirm("Errore Libreria", "La libreria PDF non è ancora caricata. Attendi...", null);
        return;
      }

      const { previewData, hasData } = generatePDFPreview();

      if (!hasData) {
        if (showNotification) {
          showNotification("Nessun dato da esportare nelle liste visualizzate.", 'warning', 5000);
        }
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      previewData.forEach((listData, listIndex) => {
        if (listIndex > 0) {
          doc.addPage();
        }

        const { company, department, weekRange: listWeekRange, employees } = listData;

        // Titolo
        doc.setFontSize(16);
        doc.setTextColor(68, 114, 196); // Blu scuro #4472C4
        doc.setFont(undefined, 'bold');
        doc.text(`REPARTO ${company.toUpperCase()} - ${department.toUpperCase()}`, 148.5, 15, { align: 'center' });

        // Sottotitolo
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`Orario settimanale: ${listWeekRange}`, 148.5, 22, { align: 'center' });

        // Prepara header tabella
        const headers = ['DIPENDENTE'];
        days.forEach(day => {
          headers.push(`${day}\nEntrata`, `${day}\nUscita`);
        });
        headers.push('TOTALE');

        // Prepara dati tabella
        const tableBody = [];
        const codeCells = []; // Array per tracciare le celle codice da unificare: {row, colEntrata}

        employees.forEach((emp, empIndex) => {
          // Calcola totale ore per questo dipendente
          let totalHours = 0;
          emp.days.forEach(dayData => {
            // Se c'è un codice, non calcolare ore
            if (dayData.isCode) {
              return;
            }
            const in1 = calculateHours(dayData.in1);
            const out1 = calculateHours(dayData.out1);
            const in2 = calculateHours(dayData.in2);
            const out2 = calculateHours(dayData.out2);
            if (in1 > 0 && out1 > 0) totalHours += (out1 - in1);
            if (in2 > 0 && out2 > 0) totalHours += (out2 - in2);
          });

          // Riga separatrice nera prima di ogni dipendente (eccetto il primo)
          if (empIndex > 0) {
            const separatorRow = new Array(headers.length).fill('');
            tableBody.push(separatorRow);
          }

          const row1Index = tableBody.length;
          // Riga 1 del dipendente
          const row1 = [emp.name];
          emp.days.forEach((dayData, dayIdx) => {
            if (dayData.isCode) {
              row1.push(dayData.in1 || '', ''); // Codice solo in Entrata, Uscita vuota
              // Traccia la cella da unificare (colonna Entrata, escludendo nome dipendente)
              codeCells.push({ row: row1Index, colEntrata: 1 + (dayIdx * 2) });
            } else {
              row1.push(dayData.in1 || '', dayData.out1 || '');
            }
          });
          row1.push(empIndex === 0 ? totalHours.toFixed(1) : ''); // Totale solo nella prima riga
          tableBody.push(row1);

          // Riga 2 del dipendente
          const row2 = [''];
          emp.days.forEach((dayData) => {
            if (dayData.isCode) {
              row2.push('', ''); // Entrambe vuote perché già gestito nella riga 1
            } else {
              row2.push(dayData.in2 || '', dayData.out2 || '');
            }
          });
          row2.push(''); // Totale vuoto nella seconda riga
          tableBody.push(row2);
        });

        // Aggiungi tabella
        doc.autoTable({
          head: [headers],
          body: tableBody,
          startY: 28,
          margin: { top: 28, right: 10, bottom: 10, left: 10 },
          styles: {
            fontSize: 8,
            cellPadding: 1.5,
            textColor: [0, 0, 0],
            overflow: 'linebreak',
            cellWidth: 'wrap',
            lineColor: [0, 0, 0],
            lineWidth: 0.1
          },
          headStyles: {
            fillColor: [91, 155, 213], // Blu chiaro #5B9BD5
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11,
            halign: 'center',
            valign: 'middle'
          },
          columnStyles: {
            0: {
              cellWidth: 45,
              fontStyle: 'bold',
              fontSize: 8,
              fillColor: [231, 230, 230], // Grigio chiaro per nome dipendente
              halign: 'left'
            },
            [headers.length - 1]: {
              fillColor: [255, 224, 153], // Giallo chiaro per totale
              fontStyle: 'bold',
              fontSize: 11,
              halign: 'center'
            }
          },
          didParseCell: function (data) {
            const rowIndex = data.row.index;
            const colIndex = data.column.index;
            const cellValue = data.cell.text[0] || '';

            // Riga separatrice nera (tutte le celle vuote)
            if (cellValue === '' && data.row.raw.every(cell => cell === '')) {
              data.cell.styles.fillColor = [0, 0, 0];
              data.cell.styles.minCellHeight = 1;
              data.cell.styles.cellPadding = 0;
            }

            // Nome dipendente (prima colonna, prima riga del dipendente)
            if (colIndex === 0 && cellValue !== '' && data.row.raw[0] !== '') {
              data.cell.styles.fillColor = [231, 230, 230];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 8;
              // Merge con la riga successiva
              if (rowIndex + 1 < tableBody.length && Array.isArray(tableBody[rowIndex + 1]) && tableBody[rowIndex + 1][0] === '') {
                data.cell.rowSpan = 2;
              }
            }

            // Totale (ultima colonna, prima riga del dipendente)
            if (colIndex === headers.length - 1 && cellValue !== '' && data.row.raw[0] !== '') {
              data.cell.styles.fillColor = [255, 224, 153];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 11;
              // Merge con la riga successiva
              if (rowIndex + 1 < tableBody.length && Array.isArray(tableBody[rowIndex + 1]) && tableBody[rowIndex + 1][0] === '') {
                data.cell.rowSpan = 2;
              }
            }

            // Celle codice: nascondi la cella Uscita quando c'è un codice
            const codeCell = codeCells.find(cc =>
              cc.row === rowIndex && cc.colEntrata === colIndex
            );
            if (codeCell) {
              // Questa è la cella Entrata con codice, nascondi il bordo destro
              data.cell.styles.lineColor = [0, 0, 0];
            }

            // Nascondi la cella Uscita quando la cella precedente è un codice
            const prevCodeCell = codeCells.find(cc =>
              cc.row === rowIndex && cc.colEntrata === colIndex - 1
            );
            if (prevCodeCell && colIndex > 0) {
              // Nascondi questa cella (Uscita) perché è unificata con Entrata
              data.cell.styles.fillColor = [255, 255, 255];
              data.cell.text = [''];
            }
          },
          didDrawCell: function (data) {
            // Unifica le celle codice (Entrata + Uscita) disegnando manualmente
            const codeCell = codeCells.find(cc =>
              cc.row === data.row.index && cc.colEntrata === data.column.index
            );

            if (codeCell) {
              // Questa è la cella Entrata con codice
              // Disegna una cella unificata che copre Entrata + Uscita e riga 1 + riga 2
              const cell = data.cell;
              const nextCell = data.table.getCell(data.row.index, data.column.index + 1);
              const nextRowCell = data.table.getCell(data.row.index + 1, data.column.index);

              if (nextCell && nextRowCell) {
                const x = cell.x;
                const y = cell.y;
                const width = cell.width + nextCell.width; // Larghezza doppia (Entrata + Uscita)
                const height = cell.height + nextRowCell.height; // Altezza doppia (riga 1 + riga 2)

                // Salva il contesto
                doc.saveGraphicsState();

                // Disegna il bordo della cella unificata
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.1);
                doc.rect(x, y, width, height);

                // Ripristina il contesto
                doc.restoreGraphicsState();
              }
            }

            // Nascondi la cella Uscita quando la cella precedente è un codice
            const prevCodeCell = codeCells.find(cc =>
              cc.row === data.row.index && cc.colEntrata === data.column.index - 1
            );
            if (prevCodeCell && data.column.index > 0) {
              // Nascondi questa cella (Uscita) perché è unificata con Entrata
              doc.saveGraphicsState();
              doc.setFillColor(255, 255, 255);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
              doc.restoreGraphicsState();
            }
          }
        });
      });

      const fileName = `Turni_Multi_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);

      setPdfPreviewModal({ isOpen: false, pdfData: null });

      if (showNotification) {
        showNotification("PDF esportato con successo!", 'success', 3000);
      }

    } catch (error) {
      console.error("Export PDF error:", error);
      openConfirm("Errore Esportazione PDF", "Si è verificato un errore. Prova a ricaricare la pagina.", null);
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
                              openConfirm(
                                "Rimuovi Dipendente dalla Settimana",
                                `ATTENZIONE: Se procedi, tutti i dati presenti per ${emp.name} in questa settimana (${listWeekRange}) saranno cancellati definitivamente dal database.\n\nVuoi continuare?`,
                                () => removeEmployeeFromWeek(emp.id, emp.contextKey, listWeekRange, company, department)
                              );
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-red-500 hover:text-red-700 p-1 rounded transition-opacity"
                            title="Rimuovi dalla settimana - cancella tutti i dati definitivamente"
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
                      // Verifica se è un codice geografico o se viene da altra azienda
                      // Usa la funzione helper per ottenere la chiave (gestisce sia chiavi che label)
                      const codeKey = getCodeKey(cellData.code);
                      // Verifica se è riposo: usa la chiave per il controllo
                      const isRest = codeKey === 'R';
                      const isGeographic = codeKey && isGeographicCode(codeKey);
                      const isFromOtherCompany = cellData.fromCompany && cellData.fromCompany !== emp.company;
                      const hasGeographicCode = cellData.geographicCode && !cellData.code; // Ha codice geografico ma non è un codice normale

                      // Verifica se in2 contiene un codice geografico
                      const in2GeographicCode = cellData.in2 && (() => {
                        const in2Upper = String(cellData.in2).trim().toUpperCase();
                        return isGeographicCode(getCodeKey(in2Upper)) ||
                          ['ATRIPALDA', 'AVELLINO', 'LIONI'].includes(in2Upper) ||
                          (cellData.geographicCode && cellData.in2 === timeCodes[cellData.geographicCode]);
                      })();
                      const hasGeographicIn2 = in2GeographicCode || (cellData.geographicCode && cellData.in2);

                      // Se viene da altra azienda con codice geografico, mostra gli input (non il codice)
                      const showGeographicInputs = isFromOtherCompany && hasGeographicCode;

                      // Verifica se il dipendente ha orari o codici in altre aziende per questo giorno
                      let hasScheduleInOtherCompany = false;
                      let otherCompanySchedule = null;
                      let otherCompanyName = null;
                      let otherCompanyCode = null;
                      let hasCodeInOtherCompany = false;

                      // Cerca in tutte le altre aziende dove il dipendente è presente
                      // Cerca sia in employeesData che nello schedule per trovare tutti i giorni occupati
                      companies.forEach(otherCompany => {
                        if (otherCompany === company) return; // Salta l'azienda corrente

                        const otherDepts = departmentsStructure[otherCompany] || [];
                        otherDepts.forEach(otherDept => {
                          const otherKey = getContextKey(otherCompany, otherDept);
                          if (otherKey === emp.contextKey) return; // Salta il reparto corrente

                          // Verifica se il dipendente ha uno schedule in questa azienda/reparto
                          const otherScheduleKey = `${currentWeek}-${otherKey}-${emp.id}`;
                          const otherDayData = schedule[otherScheduleKey]?.[dayIdx];

                          // Se ha uno schedule, controlla i dati del giorno
                          if (otherDayData) {
                            if (otherDayData) {
                              // Se ha un codice di assenza in questa azienda, mostralo
                              if (otherDayData.code) {
                                const otherCodeKey = getCodeKey(otherDayData.code);
                                if (otherCodeKey && isAbsenceCode(otherCodeKey)) {
                                  hasCodeInOtherCompany = true;
                                  otherCompanyCode = getCodeLabel(otherDayData.code);
                                  otherCompanyName = otherCompany;
                                  // NON copiare automaticamente i codici da altre aziende durante il rendering
                                  // Questo permette all'utente di pulire esplicitamente la cella senza che venga ripristinato
                                  // Il codice viene mostrato solo se è già presente nello schedule corrente
                                  // Se l'utente vuole copiare il codice, può farlo manualmente
                                }
                              }
                              // Se ha orari o codici in questa azienda (mostra sempre il tooltip)
                              if (!showGeographicInputs && (otherDayData.in1 || otherDayData.in2 || otherDayData.out1 || otherDayData.out2 || otherDayData.code)) {
                                hasScheduleInOtherCompany = true;
                                if (!otherCompanySchedule) {
                                  otherCompanySchedule = otherDayData;
                                }
                                if (!otherCompanyName) otherCompanyName = otherCompany;
                              }
                            }
                          }
                        });
                      });

                      // Evidenzia il giorno se ha un codice geografico che punta a questa azienda
                      // Verifica struttura parentesi graffe completata
                      const isGeographicTargetDay = cellData.geographicCode &&
                        getCompanyFromGeographicCode(cellData.geographicCode) === company &&
                        cellData.fromCompany !== company;

                      // I codici di assenza (Riposo, Malattia, ecc.) devono essere grigi, non gialli
                      // Il giallo è solo per codici geografici o input geografici
                      const shouldBeGray = cellData.code && (isAbsenceCode(getCodeKey(cellData.code)) || hasCodeInOtherCompany);
                      const shouldBeYellow = (isGeographic || isFromOtherCompany || hasGeographicIn2) && !shouldBeGray;

                      // Verifica se questo giorno ha una trasferta verso questa azienda
                      const hasTransfer = hasTransferOnDay(emp.id, dayIdx, company, listWeekRange);

                      return (
                        <td
                          key={dayIdx}
                          className={`p-1 border relative ${isRest || shouldBeGray ? 'bg-gray-200' : ''} ${shouldBeYellow || showGeographicInputs ? 'bg-yellow-100' : ''} ${hasScheduleInOtherCompany ? 'bg-gray-50' : ''} ${isGeographicTargetDay ? 'bg-blue-100 ring-2 ring-blue-400' : ''} ${hasTransfer ? 'bg-yellow-50' : ''}`}
                          onContextMenu={(e) => {
                            // Permetti il menu contestuale se c'è un codice (anche da altre aziende) o se ci sono orari
                            if ((cellData.code || cellData.in1 || cellData.out1 || cellData.in2 || cellData.out2) && !showGeographicInputs) {
                              handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange);
                            }
                          }}
                          title={hasTransfer ? 'Giorno con trasferta in arrivo' : ''}
                        >


                          {cellData.code && !showGeographicInputs ? (
                            <div
                              className={`h-14 flex items-center justify-center font-bold text-lg ${(isGeographic || isFromOtherCompany) && !shouldBeGray ? 'text-yellow-700' : 'text-slate-500'} bg-opacity-50 cursor-pointer hover:bg-gray-100 transition-colors`}
                              onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange)}
                              title={hasCodeInOtherCompany && otherCompanyName ? `${getCodeLabel(cellData.code)} (da ${otherCompanyName}) - Tasto destro per modificare` : "Tasto destro per modificare"}
                            >
                              {getCodeLabel(cellData.code)}
                            </div>
                          ) : showGeographicInputs ? (
                            // Mostra gli input per compilare gli orari quando viene da altra azienda
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <input
                                  id={`input-${emp.id}-${dayIdx}-in1-geo`}
                                  type="text"
                                  className={`w-full border bg-transparent rounded px-0.5 py-0.5 text-center text-xs focus:ring-1 focus:bg-white outline-none transition-all ${getInputBorderClass(emp.id, dayIdx, 'in1', emp.contextKey, listWeekRange, false)}`}
                                  placeholder=""
                                  value={cellData.in1 || ''}
                                  onChange={(e) => handleInputChange(emp.id, dayIdx, 'in1', e.target.value, emp.contextKey, listWeekRange, company)}
                                  onBlur={(e) => handleBlur(emp.id, dayIdx, 'in1', e.target.value, emp.contextKey, listWeekRange, company)}
                                  onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'in1')}
                                  title={getFieldError(emp.id, dayIdx, 'in1', emp.contextKey, listWeekRange) || ''}
                                />
                                <input
                                  type="text"
                                  className={`w-full border bg-transparent rounded px-0.5 py-0.5 text-center text-xs focus:ring-1 focus:bg-white outline-none transition-all ${getInputBorderClass(emp.id, dayIdx, 'out1', emp.contextKey, listWeekRange, false)}`}
                                  placeholder=""
                                  value={cellData.out1 || ''}
                                  onChange={(e) => handleInputChange(emp.id, dayIdx, 'out1', e.target.value, emp.contextKey, listWeekRange, company)}
                                  onBlur={(e) => handleBlur(emp.id, dayIdx, 'out1', e.target.value, emp.contextKey, listWeekRange, company)}
                                  onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'out1')}
                                  title={getFieldError(emp.id, dayIdx, 'out1', emp.contextKey, listWeekRange) || ''}
                                />
                              </div>
                              {/* Mostra sempre la seconda riga se in1 è compilato, oppure se in2 è già compilato */}
                              {(cellData.in1 || cellData.in2) && (() => {
                                // Verifica se in2 contiene un codice (non un orario)
                                const in2IsCode = cellData.in2 && !/^\d{1,2}[.:]\d{2}$/.test(cellData.in2);

                                if (in2IsCode) {
                                  // Mostra cella unificata con sfondo giallo e testo centrato
                                  return (
                                    <div
                                      className="h-7 bg-yellow-100 rounded flex items-center justify-center font-medium text-xs text-yellow-800 cursor-pointer hover:bg-yellow-200 transition-colors"
                                      onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange)}
                                      title="Tasto destro per modificare"
                                    >
                                      {cellData.in2}
                                    </div>
                                  );
                                } else {
                                  // Mostra due campi separati per orari
                                  return (
                                    <div className="flex gap-1 animate-in fade-in duration-300">
                                      <input
                                        type="text"
                                        className={`w-full border bg-transparent rounded px-0.5 py-0.5 text-center text-xs focus:border-blue-500 outline-none transition-all ${getInputBorderClass(emp.id, dayIdx, 'in2', emp.contextKey, listWeekRange, false)}`}
                                        placeholder={cellData.in1 ? "Orario o città" : ""}
                                        value={cellData.in2 || ''}
                                        onChange={(e) => handleInputChange(emp.id, dayIdx, 'in2', e.target.value, emp.contextKey, listWeekRange, company)}
                                        onBlur={(e) => handleBlur(emp.id, dayIdx, 'in2', e.target.value, emp.contextKey, listWeekRange, company)}
                                        onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'in2')}
                                        title={getFieldError(emp.id, dayIdx, 'in2', emp.contextKey, listWeekRange) || 'Inserisci orario o codice geografico (es. Atripalda, AV, AT)'}
                                      />
                                      <input
                                        type="text"
                                        className={`w-full border bg-transparent rounded px-0.5 py-0.5 text-center text-xs focus:border-blue-500 outline-none transition-all ${getInputBorderClass(emp.id, dayIdx, 'out2', emp.contextKey, listWeekRange, false)}`}
                                        placeholder=""
                                        value={cellData.out2 || ''}
                                        onChange={(e) => handleInputChange(emp.id, dayIdx, 'out2', e.target.value, emp.contextKey, listWeekRange, company)}
                                        onBlur={(e) => handleBlur(emp.id, dayIdx, 'out2', e.target.value, emp.contextKey, listWeekRange, company)}
                                        onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'out2')}
                                        title={getFieldError(emp.id, dayIdx, 'out2', emp.contextKey, listWeekRange) || ''}
                                      />
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 relative group">
                              {/* Tooltip per orari in altra azienda */}
                              {hasScheduleInOtherCompany && otherCompanySchedule && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-pre-line text-center min-w-[120px]">
                                  <div className="font-bold mb-1">{otherCompanyName}</div>
                                  {otherCompanySchedule.code ? (
                                    <div>{getCodeLabel(otherCompanySchedule.code)}</div>
                                  ) : (
                                    <>
                                      {otherCompanySchedule.in1 && otherCompanySchedule.out1 && (
                                        <div>{otherCompanySchedule.in1} - {otherCompanySchedule.out1}</div>
                                      )}
                                      {otherCompanySchedule.in2 && otherCompanySchedule.out2 && (
                                        <div>{otherCompanySchedule.in2} - {otherCompanySchedule.out2}</div>
                                      )}
                                    </>
                                  )}
                                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                    <div className="border-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-1">
                                <input
                                  id={`input-${emp.id}-${dayIdx}-in1`}
                                  type="text"
                                  className={`w-full border rounded px-0.5 py-0.5 text-center text-xs focus:ring-1 focus:bg-white outline-none transition-all ${getInputBorderClass(emp.id, dayIdx, 'in1', emp.contextKey, listWeekRange, hasScheduleInOtherCompany)}`}
                                  value={cellData.in1 || ''}
                                  onChange={(e) => handleInputChange(emp.id, dayIdx, 'in1', e.target.value, emp.contextKey, listWeekRange, company)}
                                  onBlur={(e) => handleBlur(emp.id, dayIdx, 'in1', e.target.value, emp.contextKey, listWeekRange, company)}
                                  onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'in1')}
                                  title={hasScheduleInOtherCompany ? `${otherCompanyName}\n${otherCompanySchedule.in1 || ''} - ${otherCompanySchedule.out1 || ''}${otherCompanySchedule.in2 ? `\n${otherCompanySchedule.in2} - ${otherCompanySchedule.out2}` : ''}` : (getFieldError(emp.id, dayIdx, 'in1', emp.contextKey, listWeekRange) || '')}
                                />
                                <input
                                  type="text"
                                  className={`w-full border rounded px-0.5 py-0.5 text-center text-xs focus:ring-1 focus:bg-white outline-none transition-all ${getInputBorderClass(emp.id, dayIdx, 'out1', emp.contextKey, listWeekRange, hasScheduleInOtherCompany)}`}
                                  value={cellData.out1 || ''}
                                  onChange={(e) => handleInputChange(emp.id, dayIdx, 'out1', e.target.value, emp.contextKey, listWeekRange, company)}
                                  onBlur={(e) => handleBlur(emp.id, dayIdx, 'out1', e.target.value, emp.contextKey, listWeekRange, company)}
                                  onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'out1')}
                                  title={hasScheduleInOtherCompany ? `${otherCompanyName}\n${otherCompanySchedule.in1 || ''} - ${otherCompanySchedule.out1 || ''}${otherCompanySchedule.in2 ? `\n${otherCompanySchedule.in2} - ${otherCompanySchedule.out2}` : ''}` : (getFieldError(emp.id, dayIdx, 'out1', emp.contextKey, listWeekRange) || '')}
                                />
                              </div>
                              {/* Mostra sempre la seconda riga se in1 è compilato, oppure se in2 è già compilato */}
                              {(cellData.in1 || cellData.in2) && (() => {
                                // Verifica se in2 contiene un codice (non un orario)
                                // Deve essere un codice COMPLETO (es. "Malattia", "Avellino") o un codice geografico (L, M, A)
                                // Altrimenti rimaniamo in modalità input per permettere onBlur
                                const isTime = /^\d{1,2}[.:]\d{2}$/.test(cellData.in2);
                                const isGeoCode = ['L', 'M', 'A'].includes(cellData.in2);
                                const isFullLabel = Object.values(timeCodes).includes(cellData.in2) ||
                                  ['LIONI', 'MERCURIO', 'LA TORRE', 'ALBATROS'].includes(cellData.in2);

                                const in2IsCode = cellData.in2 && !isTime && (isGeoCode || isFullLabel);

                                if (in2IsCode) {
                                  // Mostra cella unificata con sfondo giallo e testo centrato
                                  return (
                                    <div
                                      className="h-7 bg-yellow-100 rounded flex items-center justify-center font-medium text-xs text-yellow-800 cursor-pointer hover:bg-yellow-200 transition-colors"
                                      onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'in2')}
                                      title="Tasto destro per modificare"
                                    >
                                      {cellData.in2}
                                    </div>
                                  );
                                } else {
                                  // Mostra due campi separati per orari
                                  return (
                                    <div className="flex gap-1 animate-in fade-in duration-300">
                                      <input
                                        type="text"
                                        className={`w-full border rounded px-0.5 py-0.5 text-center text-xs focus:border-blue-500 outline-none transition-all ${getInputBorderClass(emp.id, dayIdx, 'in2', emp.contextKey, listWeekRange, hasScheduleInOtherCompany)}`}
                                        placeholder={cellData.in1 ? "Orario o città" : ""}
                                        value={cellData.in2 || ''}
                                        onChange={(e) => handleInputChange(emp.id, dayIdx, 'in2', e.target.value, emp.contextKey, listWeekRange, company)}
                                        onBlur={(e) => handleBlur(emp.id, dayIdx, 'in2', e.target.value, emp.contextKey, listWeekRange, company)}
                                        onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'in2')}
                                        title={getFieldError(emp.id, dayIdx, 'in2', emp.contextKey, listWeekRange) || 'Inserisci orario o codice geografico (es. Atripalda, AV, AT)'}
                                      />
                                      <input
                                        type="text"
                                        className={`w-full border rounded px-0.5 py-0.5 text-center text-xs focus:border-blue-500 outline-none transition-all ${getInputBorderClass(emp.id, dayIdx, 'out2', emp.contextKey, listWeekRange, hasScheduleInOtherCompany)}`}
                                        placeholder=""
                                        value={cellData.out2 || ''}
                                        onChange={(e) => handleInputChange(emp.id, dayIdx, 'out2', e.target.value, emp.contextKey, listWeekRange, company)}
                                        onBlur={(e) => handleBlur(emp.id, dayIdx, 'out2', e.target.value, emp.contextKey, listWeekRange, company)}
                                        onContextMenu={(e) => handleContextMenu(e, emp.id, dayIdx, emp.contextKey, listWeekRange, 'out2')}
                                        title={getFieldError(emp.id, dayIdx, 'out2', emp.contextKey, listWeekRange) || ''}
                                      />
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          )}
                        </td>
                      );
                    })
                    }
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
                          // Rimosso onKeyDown per evitare creazione accidentale con Enter
                          className="w-full bg-transparent border-b border-gray-400 focus:border-blue-500 outline-none text-sm uppercase placeholder-gray-400"
                        />
                        {showSuggestions && quickAddName && (
                          <div className="absolute bottom-full left-0 w-full min-w-[200px] bg-white border-2 border-blue-400 shadow-2xl rounded-lg z-[9999] max-h-60 overflow-y-auto mb-1">
                            {(() => {
                              // Usa SOLO la lista globale
                              const allEmployees = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
                              const searchTerm = quickAddName.toUpperCase().trim();
                              const filtered = allEmployees.filter(emp => emp.name.toUpperCase().includes(searchTerm));
                              const exactMatch = allEmployees.some(emp => emp.name.toUpperCase() === searchTerm);
                              // Mostra opzione "Aggiungi" se: non c'è match esatto E (lunghezza > 2 O non ci sono risultati filtrati)
                              const showAddOption = !exactMatch && (searchTerm.length > 2 || filtered.length === 0);

                              return (
                                <>
                                  {filtered.map(emp => (
                                    <div
                                      key={emp.id}
                                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0 text-gray-700"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleQuickAddEmployee(company, department, listWeekRange, emp.name);
                                      }}
                                    >
                                      {emp.name}
                                    </div>
                                  ))}
                                  {showAddOption && (
                                    <div
                                      className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm text-green-700 font-semibold border-t border-gray-200 flex items-center gap-2"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleCreateAndAddEmployee(quickAddName, company, department, listWeekRange);
                                      }}
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
                        // Rimosso onKeyDown per evitare creazione accidentale con Enter
                        className="w-full border-2 border-blue-300 rounded px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase placeholder-gray-400"
                      />
                      {showSuggestions && quickAddName && (
                        <div className="absolute bottom-full left-0 w-full bg-white border border-gray-300 shadow-xl rounded-md z-50 max-h-60 overflow-y-auto mb-1">
                          {(() => {
                            // Usa SOLO la lista globale
                            const allEmployees = employeesData[GLOBAL_EMPLOYEES_KEY] || [];
                            const searchTerm = quickAddName.toUpperCase().trim();
                            const filtered = allEmployees.filter(emp => emp.name.toUpperCase().includes(searchTerm));
                            const exactMatch = allEmployees.some(emp => emp.name.toUpperCase() === searchTerm);
                            // Mostra opzione "Aggiungi" se: non c'è match esatto E (lunghezza > 2 O non ci sono risultati filtrati)
                            const showAddOption = !exactMatch && (searchTerm.length > 2 || filtered.length === 0);

                            return (
                              <>
                                {filtered.map(emp => (
                                  <div
                                    key={emp.id}
                                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0 text-gray-700"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleQuickAddEmployee(company, department, listWeekRange, emp.name);
                                    }}
                                  >
                                    {emp.name}
                                  </div>
                                ))}
                                {showAddOption && (
                                  <div
                                    className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm text-green-700 font-semibold border-t border-gray-200 flex items-center gap-2"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleCreateAndAddEmployee(quickAddName, company, department, listWeekRange);
                                    }}
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

      {pdfPreviewModal.isOpen && pdfPreviewModal.pdfData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-red-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <h3 className="text-lg font-bold">Anteprima PDF</h3>
              </div>
              <button
                onClick={() => setPdfPreviewModal({ isOpen: false, pdfData: null })}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {pdfPreviewModal.pdfData.map((listData, listIndex) => (
                <div key={listIndex} className="mb-8 bg-white rounded-lg shadow-md p-6">
                  <div className="text-center mb-4 pb-3 border-b-2 border-blue-600">
                    <h2 className="text-xl font-bold text-blue-600 mb-2">
                      REPARTO {listData.company.toUpperCase()} - {listData.department.toUpperCase()}
                    </h2>
                    <p className="text-sm text-gray-600">Orario settimanale: {listData.weekRange}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs" style={{ fontSize: '8px' }}>
                      <thead>
                        <tr className="bg-blue-500 text-white">
                          <th className="border border-gray-300 p-2 text-left font-bold" style={{ fontSize: '11px', width: '150px' }}>DIPENDENTE</th>
                          {days.map((day, dayIdx) => (
                            <React.Fragment key={dayIdx}>
                              <th className="border border-gray-300 p-1 text-center font-bold" style={{ fontSize: '11px' }}>{day}<br />Entrata</th>
                              <th className="border border-gray-300 p-1 text-center font-bold" style={{ fontSize: '11px' }}>{day}<br />Uscita</th>
                            </React.Fragment>
                          ))}
                          <th className="border border-gray-300 p-2 text-center font-bold bg-yellow-400 text-black" style={{ fontSize: '11px' }}>TOTALE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listData.employees.map((emp, empIndex) => {
                          // Calcola totale ore per questo dipendente
                          let totalHours = 0;
                          emp.days.forEach(dayData => {
                            // Se c'è un codice, non calcolare ore
                            if (dayData.isCode) {
                              return;
                            }
                            const in1 = calculateHours(dayData.in1);
                            const out1 = calculateHours(dayData.out1);
                            const in2 = calculateHours(dayData.in2);
                            const out2 = calculateHours(dayData.out2);
                            if (in1 > 0 && out1 > 0) totalHours += (out1 - in1);
                            if (in2 > 0 && out2 > 0) totalHours += (out2 - in2);
                          });

                          return (
                            <React.Fragment key={empIndex}>
                              {empIndex > 0 && (
                                <tr>
                                  <td colSpan={16} className="h-1 bg-black p-0 border-0"></td>
                                </tr>
                              )}
                              <tr>
                                <td className="border border-gray-300 p-2 bg-gray-200 font-bold" rowSpan={2} style={{ fontSize: '8px' }}>
                                  {emp.name}
                                </td>
                                {emp.days.map((dayData, dayIdx) => {
                                  if (dayData.isCode) {
                                    // Cella unificata per codice (Entrata + Uscita, riga 1 + riga 2)
                                    return (
                                      <td
                                        key={dayIdx}
                                        className="border border-gray-300 p-1 text-center"
                                        colSpan={2}
                                        rowSpan={2}
                                      >
                                        {dayData.in1 || ''}
                                      </td>
                                    );
                                  } else {
                                    return (
                                      <React.Fragment key={dayIdx}>
                                        <td className="border border-gray-300 p-1 text-center">{dayData.in1 || ''}</td>
                                        <td className="border border-gray-300 p-1 text-center">{dayData.out1 || ''}</td>
                                      </React.Fragment>
                                    );
                                  }
                                })}
                                <td className="border border-gray-300 p-2 text-center bg-yellow-100 font-bold" rowSpan={2} style={{ fontSize: '11px' }}>
                                  {totalHours > 0 ? totalHours.toFixed(1) : ''}
                                </td>
                              </tr>
                              <tr>
                                {emp.days.map((dayData, dayIdx) => {
                                  // Se è un codice, non renderizzare nulla (già gestito nella riga 1 con rowSpan)
                                  if (dayData.isCode) {
                                    return null;
                                  } else {
                                    return (
                                      <React.Fragment key={dayIdx}>
                                        <td className="border border-gray-300 p-1 text-center">{dayData.in2 || ''}</td>
                                        <td className="border border-gray-300 p-1 text-center">{dayData.out2 || ''}</td>
                                      </React.Fragment>
                                    );
                                  }
                                })}
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-100 p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setPdfPreviewModal({ isOpen: false, pdfData: null })}
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={exportPDF}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg flex items-center gap-2"
              >
                <FileText size={16} /> Esporta PDF
              </button>
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
                onClick={showPDFPreview}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm font-bold transition-colors shadow-md"
              >
                <FileText size={16} /> Esporta PDF
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

          {/* CAMPO RICERCA GLOBALE DIPENDENTE */}
          <div className="mt-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Cerca dipendente per vedere dove è impegnato..."
                value={globalSearchName}
                onChange={(e) => {
                  setGlobalSearchName(e.target.value);
                  searchEmployeeEngagements(e.target.value);
                }}
                className="w-full bg-white text-gray-800 px-4 py-2 rounded-lg border-2 border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-300 outline-none"
              />
              {globalSearchName && (
                <button
                  onClick={() => {
                    setGlobalSearchName('');
                    setSearchResults([]);
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* RISULTATI RICERCA */}
            {searchResults.length > 0 && (
              <div className="mt-3 bg-white rounded-lg shadow-lg border-2 border-blue-400 max-h-96 overflow-y-auto">
                <div className="p-3 bg-blue-600 text-white font-bold text-sm sticky top-0">
                  Risultati ricerca: {searchResults.length} {searchResults.length === 1 ? 'impegno trovato' : 'impegni trovati'}
                </div>
                <div className="p-3 space-y-2">
                  {searchResults.map((result, index) => (
                    <div
                      key={`${result.employeeId}-${result.company}-${result.department}-${result.week}-${index}`}
                      onClick={() => openListFromSearch(result)}
                      className="bg-gray-50 p-3 rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-bold text-gray-800 text-sm mb-1">{result.employeeName}</div>
                          <div className="text-xs text-gray-600 mb-1">
                            <span className="font-semibold">{result.company}</span>
                            {result.department && <span> &gt; <span className="font-semibold">{result.department}</span></span>}
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            Settimana: {result.week} | {result.daysWithData} {result.daysWithData === 1 ? 'giorno' : 'giorni'} con orari
                          </div>

                          {/* ANTEPRIMA ORARI */}
                          {result.schedulePreview && result.schedulePreview.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-300">
                              <div className="text-xs font-semibold text-gray-700 mb-1">Anteprima orari:</div>
                              <div className="space-y-1">
                                {result.schedulePreview.map((preview, pIdx) => {
                                  const { dayName, data } = preview;
                                  const timeDisplay = data.code
                                    ? getCodeLabel(data.code)
                                    : [
                                      data.in1 && data.out1 ? `${data.in1}-${data.out1}` : '',
                                      data.in2 && data.out2 ? `${data.in2}-${data.out2}` : ''
                                    ].filter(Boolean).join(' / ') || 'Nessun orario';

                                  return (
                                    <div key={pIdx} className="text-xs text-gray-600 flex items-center gap-2">
                                      <span className="font-medium text-gray-500 w-16">{dayName}:</span>
                                      <span className="text-gray-700">{timeDisplay}</span>
                                    </div>
                                  );
                                })}
                                {result.daysWithData > result.schedulePreview.length && (
                                  <div className="text-xs text-gray-400 italic">
                                    ... e altri {result.daysWithData - result.schedulePreview.length} {result.daysWithData - result.schedulePreview.length === 1 ? 'giorno' : 'giorni'}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-blue-600 text-xs font-semibold mt-1">
                          Clicca per aprire →
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {globalSearchName && searchResults.length === 0 && (
              <div className="mt-3 bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm text-yellow-800">
                Nessun impegno trovato per "{globalSearchName}"
              </div>
            )}
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

            {/* GESTIONE CODICI ORARI (Spostato sopra e reso collassabile) */}
            <div className="mb-6 bg-white p-4 rounded shadow-sm border border-purple-200 transition-all">
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setShowTimeCodesSettings(!showTimeCodesSettings)}
              >
                <h3 className="font-bold text-slate-600 flex items-center gap-2 select-none">
                  <span className="bg-purple-100 text-purple-600 p-1 rounded"><Settings size={16} /></span>
                  Gestione Codici Orari (Shortcut)
                </h3>
                <button className="text-slate-400 hover:text-purple-600 transition-colors">
                  {showTimeCodesSettings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {showTimeCodesSettings && (
                <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
                  <p className="text-xs text-gray-500 mb-4">
                    Definisci i codici rapidi da usare negli orari. Esempio: scrivi "M" nel campo orario per inserire "Malattia".
                  </p>

                  <div className="flex gap-2 mb-4 items-end">
                    <div className="w-24">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Codice</label>
                      <input
                        type="text"
                        placeholder="Es. M"
                        maxLength={1}
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
                      className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-purple-700 h-[38px] flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus size={16} /> Aggiungi
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {timeCodesOrder.map((key, index) => {
                      const label = timeCodes[key];
                      if (!label) return null; // Skip se il codice non esiste più

                      const isLocked = ['M', 'L', 'A'].includes(key);

                      return (
                        <div
                          key={key}
                          draggable={!isLocked}
                          onDragStart={() => !isLocked && setDraggedCodeIndex(index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (!isLocked && draggedCodeIndex !== null && draggedCodeIndex !== index) {
                              reorderTimeCodes(draggedCodeIndex, index);
                            }
                            setDraggedCodeIndex(null);
                          }}
                          onDragEnd={() => setDraggedCodeIndex(null)}
                          className={`flex justify-between items-center p-2 rounded border transition-all ${isLocked
                            ? 'bg-blue-50 border-blue-200'
                            : `bg-purple-50 border-purple-100 cursor-move hover:bg-purple-100 ${draggedCodeIndex === index ? 'opacity-50 scale-95' : ''}`
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            {!isLocked && <span className="text-gray-400 cursor-grab active:cursor-grabbing" title="Trascina per riordinare">⋮⋮</span>}
                            <span className={`${isLocked ? 'bg-blue-200 text-blue-800' : 'bg-purple-200 text-purple-800'} font-bold px-2 py-0.5 rounded text-xs w-8 text-center`}>
                              {key}
                            </span>
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                          </div>
                          {isLocked ? (
                            <div className="text-blue-400 p-1" title="Codice bloccato">
                              <Lock size={14} />
                            </div>
                          ) : (
                            <button
                              onClick={() => deleteTimeCode(key)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Elimina codice"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* SELETTORE AZIENDA PER CONFIGURAZIONE */}
              <div className="bg-white p-4 rounded shadow-sm border border-blue-100">
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
                  className="w-full border-2 border-blue-300 rounded px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {companies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* GESTIONE REPARTI */}
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
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus size={16} /> Aggiungi
                  </button>
                </div>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
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
            </div>

            {/* DIPENDENTI (Full Width) */}
            <div className="bg-white p-4 rounded shadow-sm border border-blue-100">
              <h3 className="font-bold text-slate-600 mb-3 border-b pb-2">
                Dipendenti
              </h3>
              <div className="flex gap-2 mb-2">
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
              <p className="text-xs text-gray-500 italic mb-4">
                💡 Per una corretta identificazione è consigliato creare i dipendenti con <strong>nome.cognome</strong> per evitare omonimie.
              </p>
              <div className="max-h-40 overflow-y-auto">
                {currentEmployees.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentEmployees.map(emp => (
                      <div key={emp.id} className="flex justify-between items-center bg-slate-50 p-3 rounded border text-sm hover:bg-slate-100 transition-colors">
                        <span className="font-medium text-slate-700">{emp.name}</span>
                        <button
                          onClick={() => triggerDeleteEmployee(emp.id)}
                          className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                          title="Elimina dipendente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm italic text-center py-4">Nessun dipendente in questo reparto.</p>
                )}
              </div>
            </div>
          </div>

        )}

        {/* LISTE ORARI - Nascondi quando il pannello impostazioni è aperto */}
        {!showSettings && (
          <>
            <div className="p-4">
              {viewLists.map((list, index) => renderEmployeeList(list, index))}
            </div>

            {/* AVVISO TRASFERTE - Mostra solo se ci sono trasferte verso le aziende delle liste */}
            {(() => {
              // Raccogli tutte le trasferte da tutte le liste (includendo tutti i giorni)
              const allTransfers = [];
              viewLists.forEach(list => {
                if (list.company && list.department) {
                  const transfers = checkTransfersToCompany(list.company, list.department, list.weekRange);
                  transfers.forEach(transfer => {
                    // Aggiungi tutte le trasferte (inclusi tutti i giorni) con l'azienda target
                    allTransfers.push({ ...transfer, targetCompany: list.company, listId: list.id });
                  });
                }
              });

              if (allTransfers.length === 0) return null;

              // Raggruppa per azienda target
              const transfersByCompany = allTransfers.reduce((acc, transfer) => {
                if (!acc[transfer.targetCompany]) {
                  acc[transfer.targetCompany] = [];
                }
                acc[transfer.targetCompany].push(transfer);
                return acc;
              }, {});

              return Object.entries(transfersByCompany).map(([targetCompany, transfers]) => {
                // Raggruppa per dipendente, mantenendo tutti i giorni
                const transfersByEmployee = transfers.reduce((acc, transfer) => {
                  const key = `${transfer.employeeName}-${transfer.sourceCompany}`;
                  if (!acc[key]) {
                    acc[key] = {
                      employeeName: transfer.employeeName,
                      sourceCompany: transfer.sourceCompany,
                      days: []
                    };
                  }
                  if (transfer.dayName && transfer.date) {
                    acc[key].days.push({
                      dayName: transfer.dayName,
                      date: transfer.date,
                      dayIndex: transfer.dayIndex
                    });
                  }
                  return acc;
                }, {});

                const transferList = Object.values(transfersByEmployee);

                return (
                  <div key={targetCompany} className="px-4 pb-2">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Trasferte in arrivo presso {targetCompany}
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p className="mb-1">
                              {transferList.length === 1 ? (
                                <>
                                  Il dipendente <strong>{transferList[0].employeeName}</strong> ha una trasferta da <strong>{transferList[0].sourceCompany}</strong>
                                  {transferList[0].days.length > 0 && (
                                    <>
                                      {' '}il giorno{' '}
                                      {transferList[0].days.length === 1 ? (
                                        <strong>{transferList[0].days[0].dayName} {transferList[0].days[0].date}</strong>
                                      ) : (
                                        transferList[0].days.map((d, idx) => (
                                          <span key={idx}><strong>{d.dayName} {d.date}</strong>{idx < transferList[0].days.length - 1 ? ', ' : ''}</span>
                                        ))
                                      )}
                                    </>
                                  )}
                                  {' '}presso questo punto vendita.
                                </>
                              ) : (
                                <>
                                  {transferList.length} dipendenti hanno trasferte presso questo punto vendita:
                                  <ul className="list-disc list-inside mt-1 space-y-1">
                                    {transferList.map((transfer, idx) => (
                                      <li key={idx}>
                                        <strong>{transfer.employeeName}</strong> da <strong>{transfer.sourceCompany}</strong>
                                        {transfer.days.length > 0 && (
                                          <span className="text-yellow-800 font-semibold">
                                            {' '}- {transfer.days.length === 1 ? (
                                              <>{transfer.days[0].dayName} {transfer.days[0].date}</>
                                            ) : (
                                              transfer.days.map((d, dIdx) => (
                                                <span key={dIdx}>{d.dayName} {d.date}{dIdx < transfer.days.length - 1 ? ', ' : ''}</span>
                                              ))
                                            )}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </p>
                            <p className="mt-2 font-medium">
                              Gestisci l'orario di occupazione per questi dipendenti.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}

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
          </>
        )}
      </div>


      {/* MENU CONTESTUALE */}
      {
        contextMenu.visible && (
          <div
            className="fixed bg-white shadow-xl rounded border border-gray-200 z-[100] py-1 min-w-[150px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500">
              {contextMenu.hasCode ? 'Modifica Campo' : 'Inserisci Codice'}
            </div>

            {/* Se ha un codice, mostra opzione per convertire in orario */}
            {contextMenu.hasCode && (
              <div className="border-b border-gray-100">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-green-700 flex items-center gap-2 font-medium"
                  onClick={() => {
                    convertCodeToTime(contextMenu.empId, contextMenu.dayIndex, contextMenu.contextKey, contextMenu.weekRangeValue);
                    closeContextMenu();
                  }}
                >
                  <Calendar size={14} /> Converti in Orario
                </button>
              </div>
            )}

            {timeCodesOrder.map((code) => {
              const label = timeCodes[code];
              if (!label) return null; // Skip se il codice non esiste più

              // LOGICA MIGLIORATA: Nascondi codici geografici se siamo già nell'azienda target
              let currentCompany = '';
              if (contextMenu.contextKey) {
                currentCompany = contextMenu.contextKey.split('-')[0];
              } else if (selectedCompany) {
                currentCompany = selectedCompany;
              }

              const targetCompany = getCompanyFromGeographicCode(code);
              if (targetCompany && targetCompany === currentCompany) {
                return null; // Nascondi opzione ridondante
              }

              return (
                <button
                  key={code}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between group"
                  onClick={() => {
                    handleQuickCode(contextMenu.empId, contextMenu.dayIndex, label, contextMenu.contextKey, contextMenu.weekRangeValue, contextMenu.field);
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

    </div >
  );
};


export default TimesheetManager;

