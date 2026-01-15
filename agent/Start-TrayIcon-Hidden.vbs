Option Explicit
'
' Start-TrayIcon-Hidden.vbs
' Avvia NetworkMonitorTrayIcon.ps1 in modo realmente nascosto (senza finestre visibili),
' anche quando il "default terminal" è Windows Terminal.
'

Dim fso, baseDir, ps, tray, cfg, statusFile, ipsFile, cmd
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps = "powershell.exe"

tray = baseDir & "\NetworkMonitorTrayIcon.ps1"
cfg = baseDir & "\config.json"
statusFile = baseDir & "\.agent_status.json"
ipsFile = baseDir & "\.current_scan_ips.json"

cmd = ps & " -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & tray & """ -ConfigPath """ & cfg & """ -StatusFilePath """ & statusFile & """ -CurrentScanIPsPath """ & ipsFile & """"

CreateObject("WScript.Shell").Run cmd, 0, False

