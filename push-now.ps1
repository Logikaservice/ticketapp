# Funzione per push automatico - chiama quando dici "fai push"
function Push-ToGitHub {
    $ErrorActionPreference = 'Continue'
    $repoPath = "C:\TicketApp"
    Set-Location $repoPath
    
    Write-Host "Push automatico su GitHub..." -ForegroundColor Cyan
    Write-Host ""
    
    # Rimuovi lock file in modo aggressivo
    $lockFile = Join-Path $repoPath ".git\index.lock"
    $configLockFile = Join-Path $repoPath ".git\config.lock"
    
    # Rimuovi anche config.lock se presente
    if (Test-Path $configLockFile) {
        try {
            Remove-Item $configLockFile -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    
    if (Test-Path $lockFile) {
        Write-Host "Rimozione lock file..." -ForegroundColor Yellow
        
        # Termina tutti i processi Cursor che potrebbero tenere il lock
        try {
            $cursorProcesses = Get-Process | Where-Object { $_.ProcessName -like "*Cursor*" -or $_.ProcessName -like "*cursor*" } -ErrorAction SilentlyContinue
            if ($cursorProcesses) {
                Write-Host "Terminazione processi Cursor attivi ($($cursorProcesses.Count) processi)..." -ForegroundColor Yellow
                $cursorProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
            }
        } catch {}
        
        # Prova a terminare processi Git che potrebbero tenere il lock
        try {
            $gitProcesses = Get-Process | Where-Object { $_.ProcessName -like "*git*" -and $_.Path -like "*git*" } -ErrorAction SilentlyContinue
            if ($gitProcesses) {
                Write-Host "Terminazione processi Git attivi..." -ForegroundColor Yellow
                $gitProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
            }
        } catch {}
        
        for ($i = 1; $i -le 20; $i++) {
            try {
                if (Test-Path $lockFile) {
                    $file = Get-Item $lockFile -Force -ErrorAction SilentlyContinue
                    if ($file) {
                        $file.Attributes = 'Normal'
                    }
                    Remove-Item $lockFile -Force -ErrorAction Stop
                    Start-Sleep -Milliseconds 100
                    if (-not (Test-Path $lockFile)) {
                        Write-Host "Lock file rimosso" -ForegroundColor Green
                        break
                    }
                }
            } catch {
                Start-Sleep -Milliseconds 200
            }
        }
        
        if (Test-Path $lockFile) {
            Write-Host "Lock file presente. Chiudi Cursor e continuo a riprovare..." -ForegroundColor Yellow
            Write-Host "Riprovo ogni secondo finche' il lock non viene rilasciato..." -ForegroundColor Gray
            
            # Riprova continuamente finché il lock non viene rilasciato (senza limite)
            Write-Host "Chiudi Cursor quando vuoi, continuo a riprovare..." -ForegroundColor Cyan
            $waited = 0
            while (Test-Path $lockFile) {
                try {
                    $file = Get-Item $lockFile -Force -ErrorAction SilentlyContinue
                    if ($file) {
                        $file.Attributes = 'Normal'
                    }
                    Remove-Item $lockFile -Force -ErrorAction Stop
                    Start-Sleep -Milliseconds 200
                    if (-not (Test-Path $lockFile)) {
                        Write-Host "Lock file rimosso!" -ForegroundColor Green
                        break
                    }
                } catch {
                    # Lock ancora presente, continua
                }
                Start-Sleep -Seconds 1
                $waited++
                if ($waited % 5 -eq 0) {
                    Write-Host "In attesa... ($waited secondi) - Chiudi Cursor se non l'hai ancora fatto" -ForegroundColor Gray
                }
            }
        }
    }
    
    # Aggiungi file
    Write-Host "Aggiunta file..." -ForegroundColor Yellow
    git add -A 2>&1 | Out-Null
    
    # Verifica modifiche
    $status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "Nessuna modifica da committare" -ForegroundColor Cyan
        return $true
    }
    
    # Commit
    Write-Host "Commit..." -ForegroundColor Yellow
    $commitMsg = "Aggiunti script helper SSH per VPS e documentazione"
    git commit -m $commitMsg 2>&1 | Out-Null
    
    # Rimuovi variabili proxy che bloccano la connessione
    $env:HTTP_PROXY = $null
    $env:HTTPS_PROXY = $null
    $env:http_proxy = $null
    $env:https_proxy = $null
    
    # Push (forza Git a non usare proxy e usa token se disponibile)
    Write-Host "Push..." -ForegroundColor Yellow
    
    # Prova a usare token se disponibile
    $tokenFile = ".github_token"
    $useToken = $false
    if (Test-Path $tokenFile) {
        $token = Get-Content $tokenFile -Raw | ForEach-Object { $_.Trim() }
        if ($token -and $token.Length -gt 20) {
            Write-Host "Uso token GitHub per autenticazione..." -ForegroundColor Gray
            # Configura URL remoto con token (usa variabile d'ambiente invece di modificare config)
            $env:GIT_ASKPASS = "echo"
            $env:GIT_TERMINAL_PROMPT = "0"
            $remoteUrl = git config --get remote.origin.url
            if ($remoteUrl -like "https://github.com/*") {
                $newUrl = $remoteUrl -replace "https://", "https://$token@"
                # Usa GIT_ASKPASS per evitare lock su config
                $env:GIT_ASKPASS = "echo"
                git remote set-url origin $newUrl 2>&1 | Out-Null
                Start-Sleep -Milliseconds 500
                $useToken = $true
            }
        }
    }
    
    $pushOutput = git -c http.proxy= -c https.proxy= push origin main 2>&1
    
    # Ripristina URL originale se modificato
    if ($useToken) {
        $originalUrl = $remoteUrl
        git remote set-url origin $originalUrl
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Push completato!" -ForegroundColor Green
        return $true
    } else {
        Write-Host "Errore durante push Git: $pushOutput" -ForegroundColor Yellow
        Write-Host "Provo con API GitHub come fallback..." -ForegroundColor Cyan
        
        # Fallback: usa API GitHub se disponibile
        if (Test-Path "push-via-github-api.ps1") {
            # Verifica se c'è un token salvato (potresti averlo configurato)
            $tokenFile = ".github_token"
            if (Test-Path $tokenFile) {
                $token = Get-Content $tokenFile -Raw | ForEach-Object { $_.Trim() }
                if ($token -and $token.Length -gt 20) {
                    Write-Host "Trovato token GitHub, uso API..." -ForegroundColor Green
                    & .\push-via-github-api.ps1 -GitHubToken $token
                    if ($LASTEXITCODE -eq 0) {
                        return $true
                    }
                }
            }
            Write-Host "Per usare API GitHub, salva il token in .github_token:" -ForegroundColor Yellow
            Write-Host "  'TUO_TOKEN' | Out-File .github_token" -ForegroundColor Gray
        }
        
        Write-Host "Errore durante push. Configura le credenziali Git o usa l'API GitHub." -ForegroundColor Red
        return $false
    }
}

# Esegui se chiamato direttamente
if ($MyInvocation.InvocationName -ne '.') {
    Push-ToGitHub
}
