// Componenti helper per Eventi Unificati
// File: EventBadges.jsx

import React from 'react';

// Badge evento migliorato (dispositivi + agent)
export const EventBadge = ({ event }) => {
    const { event_category, event_type, severity, is_new_device, change_type } = event;

    // Se è un evento vecchio formato, usa change_type
    const actualEventType = event_type || change_type;
    const actualCategory = event_category || 'device';

    // Configurazione badge per eventi dispositivi
    const deviceBadges = {
        new_device: {
            icon: '🆕',
            label: 'Nuovo Dispositivo',
            bg: 'bg-green-100',
            text: 'text-green-800',
            border: 'border-green-300'
        },
        device_online: {
            icon: is_new_device ? '🆕' : '🔵',
            label: is_new_device ? 'Nuovo' : 'Riconnesso',
            bg: is_new_device ? 'bg-green-100' : 'bg-blue-100',
            text: is_new_device ? 'text-green-800' : 'text-blue-800',
            border: is_new_device ? 'border-green-300' : 'border-blue-300'
        },
        device_offline: {
            icon: '🔴',
            label: 'Offline',
            bg: 'bg-red-100',
            text: 'text-red-800',
            border: 'border-red-300'
        },
        ip_changed: {
            icon: '🟠',
            label: 'IP Cambiato',
            bg: 'bg-orange-100',
            text: 'text-orange-800',
            border: 'border-orange-300'
        },
        mac_changed: {
            icon: '🟠',
            label: 'MAC Cambiato',
            bg: 'bg-orange-100',
            text: 'text-orange-800',
            border: 'border-orange-300'
        },
        hostname_changed: {
            icon: '🟡',
            label: 'Hostname Cambiato',
            bg: 'bg-yellow-100',
            text: 'text-yellow-800',
            border: 'border-yellow-300'
        }
    };

    // Configurazione badge per eventi agent
    const agentBadges = {
        offline: {
            icon: '🔴',
            label: 'Agent Offline',
            bg: 'bg-red-100',
            text: 'text-red-800',
            border: 'border-red-300'
        },
        online: {
            icon: '🟢',
            label: 'Agent Online',
            bg: 'bg-green-100',
            text: 'text-green-800',
            border: 'border-green-300'
        },
        reboot: {
            icon: '🟣',
            label: 'Agent Riavviato',
            bg: 'bg-purple-100',
            text: 'text-purple-800',
            border: 'border-purple-300'
        },
        network_issue: {
            icon: '⚠️',
            label: 'Problema Rete',
            bg: 'bg-yellow-100',
            text: 'text-yellow-800',
            border: 'border-yellow-300'
        }
    };

    const badges = actualCategory === 'agent' ? agentBadges : deviceBadges;
    const badge = badges[actualEventType] || {
        icon: '❓',
        label: actualEventType,
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-300'
    };

    return (
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border} flex items-center gap-1`}>
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
            </span>
            {severity === 'critical' && (
                <span className="text-red-600 font-bold" title="Critico">!</span>
            )}
        </div>
    );
};

// Indicatore gravità
export const SeverityIndicator = ({ severity }) => {
    const config = {
        critical: { icon: '🔴', label: 'Critico', color: 'text-red-600' },
        warning: { icon: '🟠', label: 'Attenzione', color: 'text-orange-600' },
        info: { icon: '🔵', label: 'Info', color: 'text-blue-600' }
    };

    const { icon, label, color } = config[severity] || config.info;

    return (
        <div className={`flex items-center gap-1 ${color}`} title={label}>
            <span>{icon}</span>
        </div>
    );
};
