-- Script SQL per inizializzare le tabelle del Network Monitoring
-- Eseguire questo script per creare lo schema database necessario

-- Tabella per gli agent installati sui server clienti
CREATE TABLE IF NOT EXISTS network_agents (
  id SERIAL PRIMARY KEY,
  azienda_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  agent_name VARCHAR(255),
  installed_on TIMESTAMP DEFAULT NOW(),
  last_heartbeat TIMESTAMP,
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
  version VARCHAR(50),
  network_ranges TEXT[], -- Array di range IP da monitorare (es: ['192.168.1.0/24', '10.0.0.0/16'])
  scan_interval_minutes INTEGER DEFAULT 15,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabella per memorizzare i dispositivi di rete rilevati
CREATE TABLE IF NOT EXISTS network_devices (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NOT NULL, -- Supporta IPv4 e IPv6
  mac_address VARCHAR(17),
  hostname VARCHAR(255),
  vendor VARCHAR(255), -- Vendor del dispositivo (dal MAC lookup)
  device_type VARCHAR(100), -- router, server, printer, workstation, unknown
  status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline')),
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, ip_address, mac_address)
);

-- Tabella per storico cambiamenti nella rete
CREATE TABLE IF NOT EXISTS network_changes (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES network_devices(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('new_device', 'device_offline', 'device_online', 'ip_changed', 'mac_changed', 'hostname_changed', 'vendor_changed')),
  old_value TEXT,
  new_value TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  notified BOOLEAN DEFAULT false,
  notification_ip VARCHAR(45), -- IP specifico per cui inviare notifica (se configurato)
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL
);

-- Tabella per configurazione notifiche IP-specifiche per azienda
CREATE TABLE IF NOT EXISTS network_notification_config (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, ip_address)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_network_agents_azienda ON network_agents(azienda_id);
CREATE INDEX IF NOT EXISTS idx_network_agents_api_key ON network_agents(api_key);
CREATE INDEX IF NOT EXISTS idx_network_agents_status ON network_agents(status);
CREATE INDEX IF NOT EXISTS idx_network_devices_agent ON network_devices(agent_id);
CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_network_devices_mac ON network_devices(mac_address);
CREATE INDEX IF NOT EXISTS idx_network_devices_last_seen ON network_devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_network_devices_status ON network_devices(status);
CREATE INDEX IF NOT EXISTS idx_network_changes_agent ON network_changes(agent_id);
CREATE INDEX IF NOT EXISTS idx_network_changes_detected ON network_changes(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_changes_notified ON network_changes(notified);
CREATE INDEX IF NOT EXISTS idx_network_changes_change_type ON network_changes(change_type);
CREATE INDEX IF NOT EXISTS idx_network_notification_config_agent ON network_notification_config(agent_id);
CREATE INDEX IF NOT EXISTS idx_network_notification_config_ip ON network_notification_config(ip_address);

-- Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_network_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_network_agents_updated_at
  BEFORE UPDATE ON network_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_network_agents_updated_at();
