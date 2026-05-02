// src/components/NotificationModal.jsx

import React from 'react';
import { Bell, Clock } from 'lucide-react';
import {
  HubModalBackdrop,
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalBody,
  HubModalSecondaryButton,
} from './Modals/HubModalChrome';

export default function NotificationModal({ ticket, onClose, onOpenTicket, onSnooze }) {
  if (!ticket) return null;

  return (
    <HubModalBackdrop zClass="z-[118]" className="backdrop-blur-sm">
      <HubModalInnerCard maxWidthClass="max-w-md" className="animate-fade-in">
        <HubModalChromeHeader icon={Bell} title="Nuovo messaggio" onClose={onClose} compact />
        <HubModalBody className="space-y-3">
          <button
            type="button"
            onClick={() => {
              onOpenTicket(ticket.id);
              onClose();
            }}
            className="mb-1 w-full rounded-lg border-2 border-amber-400/50 bg-amber-500/10 p-4 text-left transition-all hover:border-amber-400 hover:bg-amber-500/15 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-1 font-medium text-white">{ticket.titolo}</p>
                <p className="text-sm text-white/60">Cliente: {ticket.clientName}</p>
              </div>
              <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-[#121212]">
                {ticket.unreadCount}
              </div>
            </div>
          </button>
          <HubModalSecondaryButton
            className="flex w-full items-center justify-center gap-2"
            onClick={() => {
              onSnooze(ticket.id);
              onClose();
            }}
          >
            <Clock size={16} aria-hidden />
            Ricordamelo dopo
          </HubModalSecondaryButton>
        </HubModalBody>
      </HubModalInnerCard>
    </HubModalBackdrop>
  );
}
