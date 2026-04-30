const express = require('express');
const archiver = require('archiver');

const router = express.Router();

module.exports = (pool) => {
  let tablesReady = false;

  const ensureTables = async () => {
    if (tablesReady) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vpn_profiles (
        id SERIAL PRIMARY KEY,
        profile_name VARCHAR(120) NOT NULL,
        customer_name VARCHAR(160),
        installer_url TEXT NOT NULL,
        ovpn_filename VARCHAR(180) NOT NULL,
        ovpn_content TEXT NOT NULL,
        rdp_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vpn_profiles_created_at ON vpn_profiles(created_at DESC)`);
    tablesReady = true;
  };

  const sanitizeTargets = (targets) => {
    if (!Array.isArray(targets)) return [];
    return targets
      .map((t) => ({
        name: String(t?.name || '').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_'),
        ip: String(t?.ip || '').trim()
      }))
      .filter((t) => t.name && t.ip);
  };

  const buildRdpFile = ({ ip }) => {
    const lines = [
      'screen mode id:i:2',
      'use multimon:i:0',
      'desktopwidth:i:1920',
      'desktopheight:i:1080',
      'session bpp:i:32',
      'compression:i:1',
      'keyboardhook:i:2',
      'audiomode:i:0',
      'redirectclipboard:i:1',
      'redirectprinters:i:1',
      'redirectdrives:i:1',
      'redirectcomports:i:0',
      'redirectsmartcards:i:1',
      'prompt for credentials:i:1',
      'authentication level:i:2',
      `full address:s:${ip}`
    ];
    return `${lines.join('\r\n')}\r\n`;
  };

  const buildSetupScript = ({ profileName, ovpnFileName, installerUrl, hasManyTargets }) => `
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$appName = "TicketApp VPN Setup"
$profileName = "${profileName}"
$ovpnFileName = "${ovpnFileName}"
$installerUrl = "${installerUrl}"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageRoot = Split-Path -Parent $scriptRoot
$logDir = Join-Path $env:ProgramData "TicketApp\\VpnSetupLogs"
$logFile = Join-Path $logDir ("vpn-setup-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
Start-Transcript -Path $logFile -Append | Out-Null

try {
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Richiesta permessi amministratore (UAC)..." -ForegroundColor Yellow
    $currentScript = $MyInvocation.MyCommand.Path
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $currentScript) -Verb RunAs
    exit 0
  }

  $openVpnGuiPath = "C:\\Program Files\\OpenVPN\\bin\\openvpn-gui.exe"
  $isOpenVpnInstalled = Test-Path $openVpnGuiPath

  if (-not $isOpenVpnInstalled) {
    Write-Host "OpenVPN Community non presente: download installer..." -ForegroundColor Cyan
    $installerPath = Join-Path $env:TEMP "openvpn-community-latest.msi"
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "Installazione OpenVPN Community..." -ForegroundColor Cyan
    Start-Process -FilePath "msiexec.exe" -ArgumentList @("/i", $installerPath, "/qn", "/norestart") -Wait -NoNewWindow
  } else {
    Write-Host "OpenVPN Community gia installato: skip installazione." -ForegroundColor Yellow
  }

  $userOpenVpnDir = Join-Path $env:USERPROFILE "OpenVPN\\config"
  if (-not (Test-Path $userOpenVpnDir)) {
    New-Item -ItemType Directory -Path $userOpenVpnDir -Force | Out-Null
  }

  $sourceOvpn = Join-Path $packageRoot ("files\\" + $ovpnFileName)
  $targetOvpn = Join-Path $userOpenVpnDir $ovpnFileName
  Copy-Item -Path $sourceOvpn -Destination $targetOvpn -Force
  Write-Host "Profilo OVPN copiato in: $targetOvpn" -ForegroundColor Green

  $desktopPath = [Environment]::GetFolderPath("Desktop")
  $launcherSource = Join-Path $packageRoot "launcher\\Start-VPN-RDP.ps1"
  $appDataDir = Join-Path $env:ProgramData "TicketApp\\VpnLauncher"
  if (-not (Test-Path $appDataDir)) {
    New-Item -ItemType Directory -Path $appDataDir -Force | Out-Null
  }
  $launcherTarget = Join-Path $appDataDir "Start-VPN-RDP.ps1"
  Copy-Item -Path $launcherSource -Destination $launcherTarget -Force

  $rdpSourceDir = Join-Path $packageRoot "rdp"
  $rdpTargetDir = Join-Path $appDataDir "RDP"
  if (-not (Test-Path $rdpTargetDir)) {
    New-Item -ItemType Directory -Path $rdpTargetDir -Force | Out-Null
  }
  Copy-Item -Path (Join-Path $rdpSourceDir "*.rdp") -Destination $rdpTargetDir -Force

  # Crea shortcut desktop verso il launcher
  $wsh = New-Object -ComObject WScript.Shell
  $shortcut = $wsh.CreateShortcut((Join-Path $desktopPath "VPN + RDP.lnk"))
  $shortcut.TargetPath = "powershell.exe"
  $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $launcherTarget + '"'
  $shortcut.WorkingDirectory = $desktopPath
  $shortcut.IconLocation = "C:\\Windows\\System32\\mstsc.exe,0"
  $shortcut.Save()

  # Pulisce elementi desktop non necessari per evitare confusione
  $oldLauncherDesktop = Join-Path $desktopPath "Avvia VPN e Desktop Remoto.ps1"
  if (Test-Path $oldLauncherDesktop) {
    Remove-Item -Path $oldLauncherDesktop -Force -ErrorAction SilentlyContinue
  }
  $oldRdpDesktopDir = Join-Path $desktopPath "DesktopRemoto-TicketApp"
  if (Test-Path $oldRdpDesktopDir) {
    Remove-Item -Path $oldRdpDesktopDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Get-ChildItem -Path $desktopPath -Filter "*OpenVPN*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -Path $_.FullName -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $openVpnGuiPath) {
    Start-Process -FilePath $openVpnGuiPath | Out-Null
    Write-Host "OpenVPN GUI avviato (icona tray)." -ForegroundColor Green
  }

  Write-Host "Setup completato." -ForegroundColor Green
  ${hasManyTargets ? 'Write-Host "Quando avvii VPN + RDP potrai scegliere il desktop remoto dalla lista."' : 'Write-Host "Quando avvii VPN + RDP parte direttamente il desktop remoto configurato."'}
  Write-Host "Log: $logFile"
} catch {
  Write-Host "Errore setup: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Controlla il log: $logFile" -ForegroundColor Yellow
  exit 1
} finally {
  Stop-Transcript | Out-Null
}
`;

  const buildLauncherScript = ({ profileName, ovpnFileName, targets }) => {
    const oneTarget = targets.length === 1;
    const targetEntries = targets
      .map((t, i) => `@{ Index = ${i + 1}; Name = "${t.name.replace(/"/g, '')}"; Ip = "${t.ip.replace(/"/g, '')}" }`)
      .join(",\n  ");

    return `
$ErrorActionPreference = "Continue"
$logDir = Join-Path $env:ProgramData "TicketApp\\VpnSetupLogs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir ("vpn-launcher-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
Start-Transcript -Path $logFile -Append | Out-Null

try {
$openVpnGuiPath = "C:\\Program Files\\OpenVPN\\bin\\openvpn-gui.exe"
$profileName = "${profileName}"
$ovpnFileName = "${ovpnFileName}"
$appDataDir = Join-Path $env:ProgramData "TicketApp\\VpnLauncher"
$rdpDir = Join-Path $appDataDir "RDP"
$userOpenVpnDir = Join-Path $env:USERPROFILE "OpenVPN\\config"
$ovpnPath = Join-Path $userOpenVpnDir $ovpnFileName

function Convert-SecureToPlain {
  param([SecureString]$SecureValue)
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Ensure-VpnCredentials {
  if (-not (Test-Path $ovpnPath)) {
    Write-Host "Profilo OVPN non trovato: $ovpnPath" -ForegroundColor Red
    return
  }

  $ovpnText = Get-Content -Path $ovpnPath -Raw
  if ($ovpnText -notmatch "(?im)^\\s*auth-user-pass\\b") {
    Write-Host "Profilo senza auth-user-pass: credenziali manuali non richieste." -ForegroundColor Gray
    return
  }

  $authFileName = [System.IO.Path]::GetFileNameWithoutExtension($ovpnFileName) + ".auth.txt"
  $authFilePath = Join-Path $userOpenVpnDir $authFileName
  $updatedOvpnText = [regex]::Replace(
    $ovpnText,
    "(?im)^\\s*auth-user-pass(?:\\s+.+)?\\s*$",
    "auth-user-pass $authFileName"
  )
  if ($updatedOvpnText -ne $ovpnText) {
    Set-Content -Path $ovpnPath -Value $updatedOvpnText -Encoding ascii -Force
  } else {
    Add-Content -Path $ovpnPath -Value ([Environment]::NewLine + "auth-user-pass " + $authFileName + [Environment]::NewLine)
  }

  $needPrompt = $true
  if (Test-Path $authFilePath) {
    $lines = Get-Content -Path $authFilePath -ErrorAction SilentlyContinue
    if ($lines -and $lines.Count -ge 2 -and $lines[0].Trim() -and $lines[1].Trim()) {
      $needPrompt = $false
    }
  }

  if ($needPrompt) {
    Write-Host "Prima esecuzione guidata VPN: inserisci credenziali una sola volta." -ForegroundColor Cyan
    $vpnUser = Read-Host "Username VPN"
    $vpnPassSecure = Read-Host "Password VPN" -AsSecureString
    $vpnPass = Convert-SecureToPlain -SecureValue $vpnPassSecure
    if (-not $vpnUser -or -not $vpnPass) {
      throw "Credenziali VPN non valide o vuote."
    }
    @($vpnUser, $vpnPass) | Set-Content -Path $authFilePath -Encoding ascii -Force
    Write-Host "Credenziali VPN salvate localmente sul PC utente." -ForegroundColor Green
  }
}

Ensure-VpnCredentials

if (Test-Path $openVpnGuiPath) {
  $guiAlreadyRunning = @(Get-Process -Name "openvpn-gui" -ErrorAction SilentlyContinue).Count -gt 0
  if (-not $guiAlreadyRunning) {
    Start-Process -FilePath $openVpnGuiPath | Out-Null
    Start-Sleep -Seconds 3
  }

  # Prova 1: nome profilo senza estensione
  & $openVpnGuiPath --command connect $profileName | Out-Null
  Start-Sleep -Seconds 3

  # Prova 2 (fallback): nome file .ovpn completo
  & $openVpnGuiPath --command connect $ovpnFileName | Out-Null
  Start-Sleep -Seconds 3
} else {
  Write-Host "OpenVPN GUI non trovato, avvio solo Desktop Remoto." -ForegroundColor Yellow
}

$targets = @(
  ${targetEntries}
)

function Open-RdpTarget {
  param([string]$Name)
  $rdpFile = Join-Path $rdpDir ($Name + ".rdp")
  if (Test-Path $rdpFile) {
    Start-Process "mstsc.exe" -ArgumentList $rdpFile
  } else {
    Write-Host "File RDP non trovato: $rdpFile" -ForegroundColor Red
  }
}

${oneTarget ? `
Open-RdpTarget -Name $targets[0].Name
` : `
Write-Host "Scegli il desktop remoto:" -ForegroundColor Cyan
foreach ($t in $targets) {
  Write-Host ("[{0}] {1} ({2})" -f $t.Index, $t.Name, $t.Ip)
}
$choice = Read-Host "Inserisci numero"
$selected = $targets | Where-Object { $_.Index -eq [int]$choice } | Select-Object -First 1
if ($selected) {
  Open-RdpTarget -Name $selected.Name
} else {
  Write-Host "Scelta non valida." -ForegroundColor Red
}
`}
} catch {
  Write-Host "Errore launcher: $($_.Exception.Message)" -ForegroundColor Red
} finally {
  Stop-Transcript | Out-Null
}
`;
  };

  router.get('/profiles', async (req, res) => {
    try {
      await ensureTables();
      const { rows } = await pool.query(`
        SELECT id, profile_name, customer_name, installer_url, ovpn_filename, rdp_targets, created_by, created_at, updated_at
        FROM vpn_profiles
        ORDER BY updated_at DESC
      `);
      return res.json(rows);
    } catch (err) {
      console.error('vpn profiles list error:', err);
      return res.status(500).json({ error: 'Errore caricamento profili VPN' });
    }
  });

  router.get('/profiles/:id', async (req, res) => {
    try {
      await ensureTables();
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
      const { rows } = await pool.query(`SELECT * FROM vpn_profiles WHERE id = $1 LIMIT 1`, [id]);
      if (!rows.length) return res.status(404).json({ error: 'Profilo non trovato' });
      return res.json(rows[0]);
    } catch (err) {
      console.error('vpn profile get error:', err);
      return res.status(500).json({ error: 'Errore caricamento profilo VPN' });
    }
  });

  router.post('/profiles', async (req, res) => {
    try {
      await ensureTables();
      const profileName = String(req.body?.profile_name || '').trim();
      const customerName = String(req.body?.customer_name || '').trim();
      const installerUrl = String(req.body?.installer_url || '').trim();
      const ovpnFileName = String(req.body?.ovpn_filename || '').trim() || 'client.ovpn';
      const ovpnContent = String(req.body?.ovpn_content || '').trim();
      const rdpTargets = sanitizeTargets(req.body?.rdp_targets);

      if (!profileName || !installerUrl || !ovpnContent || rdpTargets.length === 0) {
        return res.status(400).json({ error: 'Compila tutti i campi obbligatori (profilo, installer, .ovpn, almeno 1 RDP).' });
      }

      const query = `
        INSERT INTO vpn_profiles (profile_name, customer_name, installer_url, ovpn_filename, ovpn_content, rdp_targets, created_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
        RETURNING *
      `;
      const values = [profileName, customerName || null, installerUrl, ovpnFileName, ovpnContent, JSON.stringify(rdpTargets), req.user?.id || null];
      const { rows } = await pool.query(query, values);
      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error('vpn profile create error:', err);
      return res.status(500).json({ error: 'Errore creazione profilo VPN' });
    }
  });

  router.put('/profiles/:id', async (req, res) => {
    try {
      await ensureTables();
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

      const profileName = String(req.body?.profile_name || '').trim();
      const customerName = String(req.body?.customer_name || '').trim();
      const installerUrl = String(req.body?.installer_url || '').trim();
      const ovpnFileName = String(req.body?.ovpn_filename || '').trim() || 'client.ovpn';
      const ovpnContent = String(req.body?.ovpn_content || '').trim();
      const rdpTargets = sanitizeTargets(req.body?.rdp_targets);

      if (!profileName || !installerUrl || !ovpnContent || rdpTargets.length === 0) {
        return res.status(400).json({ error: 'Compila tutti i campi obbligatori (profilo, installer, .ovpn, almeno 1 RDP).' });
      }

      const { rows } = await pool.query(`
        UPDATE vpn_profiles
        SET profile_name = $1,
            customer_name = $2,
            installer_url = $3,
            ovpn_filename = $4,
            ovpn_content = $5,
            rdp_targets = $6::jsonb,
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [profileName, customerName || null, installerUrl, ovpnFileName, ovpnContent, JSON.stringify(rdpTargets), id]);

      if (!rows.length) return res.status(404).json({ error: 'Profilo non trovato' });
      return res.json(rows[0]);
    } catch (err) {
      console.error('vpn profile update error:', err);
      return res.status(500).json({ error: 'Errore aggiornamento profilo VPN' });
    }
  });

  router.delete('/profiles/:id', async (req, res) => {
    try {
      await ensureTables();
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
      const result = await pool.query('DELETE FROM vpn_profiles WHERE id = $1', [id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Profilo non trovato' });
      return res.json({ success: true });
    } catch (err) {
      console.error('vpn profile delete error:', err);
      return res.status(500).json({ error: 'Errore eliminazione profilo VPN' });
    }
  });

  router.get('/profiles/:id/package', async (req, res) => {
    try {
      await ensureTables();
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
      const { rows } = await pool.query(`SELECT * FROM vpn_profiles WHERE id = $1 LIMIT 1`, [id]);
      if (!rows.length) return res.status(404).json({ error: 'Profilo non trovato' });
      const profile = rows[0];
      const targets = sanitizeTargets(profile.rdp_targets);
      if (!targets.length) return res.status(400).json({ error: 'Profilo senza target RDP validi' });

      const fileSafeName = String(profile.profile_name || 'vpn-profile').replace(/[^a-zA-Z0-9-_]/g, '_');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="vpn-package-${fileSafeName}.zip"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        throw err;
      });
      archive.pipe(res);

      const ovpnFileName = String(profile.ovpn_filename || 'client.ovpn');
      const profileNameNoExt = ovpnFileName.replace(/\.ovpn$/i, '');
      const setupScript = buildSetupScript({
        profileName: profileNameNoExt,
        ovpnFileName,
        installerUrl: profile.installer_url,
        hasManyTargets: targets.length > 1
      });
      const launcherScript = buildLauncherScript({
        profileName: profileNameNoExt,
        ovpnFileName,
        targets
      });

      archive.append(profile.ovpn_content.endsWith('\n') ? profile.ovpn_content : `${profile.ovpn_content}\n`, { name: `files/${ovpnFileName}` });
      targets.forEach((t) => {
        archive.append(buildRdpFile({ ip: t.ip }), { name: `rdp/${t.name}.rdp` });
      });
      archive.append(setupScript, { name: 'setup/SetupVPN.ps1' });
      archive.append(launcherScript, { name: 'launcher/Start-VPN-RDP.ps1' });
      archive.append(
        [
          '@echo off',
          'set "SCRIPT_DIR=%~dp0"',
          'powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup\\SetupVPN.ps1"',
          'pause'
        ].join('\r\n') + '\r\n',
        { name: 'ESEGUI-SETUP.bat' }
      );
      archive.append(
        [
          '# Pacchetto VPN + RDP',
          '',
          '1) Estrai lo ZIP.',
          '2) Tasto destro su ESEGUI-SETUP.bat -> Esegui come amministratore.',
          '3) Sul desktop comparira "VPN + RDP".',
          '4) Primo avvio "VPN + RDP": inserisci credenziali VPN (una sola volta).',
          '5) Dai successivi avvii, parte OpenVPN e poi Desktop Remoto in automatico.',
          '',
          'I log setup sono in C:\\ProgramData\\TicketApp\\VpnSetupLogs'
        ].join('\r\n'),
        { name: 'README.txt' }
      );

      await archive.finalize();
    } catch (err) {
      console.error('vpn package error:', err);
      return res.status(500).json({ error: 'Errore generazione pacchetto VPN' });
    }
  });

  return router;
};
