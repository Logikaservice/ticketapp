// src/App.jsx

import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import AllModals from './components/Modals/AllModals';
import { getInitialMaterial, getInitialTimeLog } from './utils/helpers';
import { formatReportDate } from './utils/formatters';
import ManageClientsModal from './components/ManageClientsModal';
import NewClientModal from './components/NewClientModal';

export default function TicketApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [notificationTimeout, setNotificationTimeout] = useState(null);

  const handleCloseNotification = () => {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    setNotification(p => ({ ...p, show: false }));
  };

  const showNotification = (message, type = 'success', duration = 5000) => {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    setNotification({ show: true, message, type });
    const newTimeout = setTimeout(() => {
      setNotification(p => ({ ...p, show: false }));
    }, duration);
    setNotificationTimeout(newTimeout);
  };

  const [modalState, setModalState] = useState({ type: null, data: null });
  const [newTicketData, setNewTicketData] = useState({ 
    titolo: '', 
    descrizione: '', 
    categoria: 'assistenza', 
    priorita: 'media', 
    nomerichiedente: '' 
  });
  const [settingsData, setSettingsData] = useState({ 
    nome: '', 
    email: '', 
    vecchiaPassword: '', 
    nuovaPassword: '', 
    confermaNuovaPassword: '' 
  });
  const [newClientData, setNewClientData] = useState({ 
    email: '', 
    password: '', 
    telefono: '', 
    azienda: '' 
  });
  const [timeLogs, setTimeLogs] = useState([]);
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');
  const [hasShownUnreadNotification, setHasShownUnreadNotification] = useState(false);

  const getUnreadCount = (ticket) => {
    if (!ticket.messaggi || ticket.messaggi.length === 0) return 0;
    const lastRead = currentUser.ruolo === 'cliente' ? ticket.last_read_by_client : ticket.last_read_by_tecnico;
    if (!lastRead) return ticket.messaggi.length;
    return ticket.messaggi.filter(m => new Date(m.data) > new Date(lastRead)).length;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!process.env.REACT_APP_API_URL || !currentUser) return;
      try {
        const [ticketsRes, usersRes] = await Promise.all([
          fetch(`${process.env.REACT_APP_API_URL}/api/tickets`),
          currentUser.ruolo === 'tecnico' ? fetch(`${process.env.REACT_APP_API_URL}/api/users`) : Promise.resolve({ ok: false })
        ]);

        if (!ticketsRes.ok) throw new Error("Errore nel caricare i ticket");
        const ticketsData = await ticketsRes.json();
        setTickets(ticketsData);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }

        if (!hasShownUnreadNotification) {
