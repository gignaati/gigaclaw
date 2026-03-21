# =============================================================================
#  Gigaclaw — One-Command Installer for Windows (PowerShell 5.1+)
#  Powered by Gignaati — https://gigaclaw.gignaati.com
#
#  Usage (run from any PowerShell prompt):
#    irm https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.ps1 | iex
#
#  With a custom project directory:
#    $env:GIGACLAW_DIR="my-project"; irm .../install.ps1 | iex
#
#  CI/CD (skip interactive wizard):
#    $env:GIGACLAW_SKIP_SETUP="1"; irm .../install.ps1 | iex
#
#  What this script does:
#    1. Self-bypasses execution policy for the current process (irm|iex users)
#    2. Augments PATH for nvm-windows, fnm, Scoop, Chocolatey, Volta, and
#       the default Node.js MSI install location
#    3. Checks prerequisites (Node.js ≥18, npm, Git, Ollama, Docker, ngrok)
#       — shows friendly messages and exact install commands for anything missing
#       — offers retry loops so you can install in another window and continue
#    4. Scaffolds the project with: npx gigaclaw@latest init
#    5. Installs npm dependencies
#    6. Auto-launches the interactive setup wizard: npm run setup
#    7. Prints next-steps instructions
# =============================================================================

#Requires -Version 5.1

# ─── Execution Policy Self-Bypass ────────────────────────────────────────────
# When piped via `irm ... | iex`, bypass only for this process — no permanent change.
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

$ErrorActionPreference = "Stop"

# ─── Colour helpers ──────────────────────────────────────────────────────────
function Write-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  Gigaclaw — Autonomous AI Agent  ·  Powered by Gignaati  ║" -ForegroundColor Cyan
    Write-Host "║  https://gigaclaw.gignaati.com                           ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Ok   { param($msg) Write-Host "  [OK]  $msg" -ForegroundColor Green  }
function Write-Warn { param($msg) Write-Host "  [!!]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [X]   $msg" -ForegroundColor Red    }
function Write-Info { param($msg) Write-Host "  [->]  $msg" -ForegroundColor Cyan   }
function Write-Step { param($msg) Write-Host "`n$msg" -ForegroundColor White        }
function Write-Cmd  { param($msg) Write-Host "        $msg" -ForegroundColor Cyan   }
function Write-Dim  { param($msg) Write-Host "        $msg" -ForegroundColor DarkGray }

function Wait-ForRetry {
    param([string]$Prompt = "Press Enter once you have installed it to retry, or Ctrl+C to abort.")
    Write-Host ""
    Write-Host "  $Prompt" -ForegroundColor DarkGray
    $null = Read-Host
    # Re-augment PATH in case user just installed something
    Invoke-PathAugmentation
}

# ─── PATH Augmentation (function so it can be called after installs) ─────────
function Invoke-PathAugmentation {
    $extraPaths = @(
        "C:\Program Files\nodejs",
        "C:\Program Files (x86)\nodejs",
        "$env:APPDATA\nvm",
        "$env:LOCALAPPDATA\fnm\aliases\default\bin",
        "$env:LOCALAPPDATA\Volta\bin",
        "$env:USERPROFILE\scoop\shims",
        "C:\ProgramData\chocolatey\bin",
        "$env:LOCALAPPDATA\Microsoft\WindowsApps"
    )
    foreach ($p in $extraPaths) {
        if ((Test-Path $p) -and ($env:PATH -notlike "*$p*")) {
            $env:PATH = "$p;$env:PATH"
        }
    }
    # nvm-windows: add all version subdirectories
    $nvmRoot = "$env:APPDATA\nvm"
    if (Test-Path $nvmRoot) {
        Get-ChildItem -Path $nvmRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^v?\d+\.\d+\.\d+$' } |
            ForEach-Object {
                if ($env:PATH -notlike "*$($_.FullName)*") {
                    $env:PATH = "$($_.FullName);$env:PATH"
                }
            }
    }
}

# ─── Banner ──────────────────────────────────────────────────────────────────
Invoke-PathAugmentation
Write-Banner

# =============================================================================
# STEP 1 — PREREQUISITE CHECKS
# =============================================================================
Write-Step "[ 1 / 6 ]  Checking prerequisites..."
Write-Host ""

$PrereqFailed = $false

# ── Node.js ──────────────────────────────────────────────────────────────────
function Check-Node {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    while (-not $nodeCmd) {
        Write-Fail "Node.js is not installed or not found in PATH."
        Write-Host ""
        Write-Host "  Gigaclaw requires Node.js 18 or higher." -ForegroundColor White
        Write-Host ""
        Write-Host "  Install options:" -ForegroundColor White
        Write-Cmd "winget install OpenJS.NodeJS.LTS          -- winget (recommended)"
        Write-Cmd "choco install nodejs-lts                  -- Chocolatey"
        Write-Cmd "scoop install nodejs-lts                  -- Scoop"
        Write-Cmd "winget install Schniz.fnm                 -- fnm (Node version manager)"
        Write-Cmd "https://nodejs.org/en/download            -- Official installer"
        Write-Cmd "https://github.com/coreybutler/nvm-windows -- nvm-windows"
        Write-Host ""
        Wait-ForRetry "Press Enter once Node.js is installed to retry, or Ctrl+C to abort."
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    }

    try {
        $rawVer    = (& node --version 2>&1).ToString().Trim()
        $majorStr  = $rawVer.TrimStart('v').Split('.')[0]
        $nodeMajor = [int]$majorStr
    } catch {
        Write-Fail "Could not determine Node.js version. Please reinstall from https://nodejs.org"
        $script:PrereqFailed = $true
        return
    }

    while ($nodeMajor -lt 18) {
        Write-Fail "Node.js $rawVer is too old. Version 18 or higher is required."
        Write-Host ""
        Write-Host "  Upgrade options:" -ForegroundColor White
        Write-Cmd "winget upgrade OpenJS.NodeJS.LTS"
        Write-Cmd "nvm install 18 && nvm use 18              -- if using nvm-windows"
        Write-Cmd "fnm install 18 && fnm use 18              -- if using fnm"
        Write-Cmd "https://nodejs.org/en/download            -- Official installer"
        Write-Host ""
        Wait-ForRetry "Press Enter once Node.js is upgraded to retry, or Ctrl+C to abort."
        try {
            $rawVer    = (& node --version 2>&1).ToString().Trim()
            $majorStr  = $rawVer.TrimStart('v').Split('.')[0]
            $nodeMajor = [int]$majorStr
        } catch {
            $nodeMajor = 0
        }
    }
    Write-Ok "Node.js $rawVer"
}
Check-Node

# ── npm ──────────────────────────────────────────────────────────────────────
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Fail "npm is not found. npm ships with Node.js — please reinstall from https://nodejs.org"
    Wait-ForRetry
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCmd) {
        Write-Fail "npm still not found. Please reinstall Node.js and re-run this script."
        $PrereqFailed = $true
    } else {
        $npmVer = (& npm --version 2>&1).ToString().Trim()
        Write-Ok "npm $npmVer"
    }
} else {
    $npmVer = (& npm --version 2>&1).ToString().Trim()
    Write-Ok "npm $npmVer"
}

# ── Git ───────────────────────────────────────────────────────────────────────
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Warn "Git is not installed."
    Write-Host ""
    Write-Host "  Git is required for Cloud Mode (GitHub Actions integration)." -ForegroundColor White
    Write-Host "  You can skip it now if you only plan to use Local Mode (Ollama only)." -ForegroundColor White
    Write-Host ""
    Write-Host "  Install options:" -ForegroundColor White
    Write-Cmd "winget install Git.Git"
    Write-Cmd "choco install git"
    Write-Cmd "scoop install git"
    Write-Cmd "https://git-scm.com/download/win              -- Official installer"
    Write-Host ""
    Write-Host "  Press Enter to continue without Git (Local Mode only)," -ForegroundColor DarkGray
    Write-Host "  or install Git first and press Enter to retry." -ForegroundColor DarkGray
    $null = Read-Host
    Invoke-PathAugmentation
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) {
        $gitVer = (& git --version 2>&1).ToString().Trim() -replace "git version ",""
        Write-Ok "git $gitVer"
    } else {
        Write-Warn "Continuing without Git. Cloud Mode will not be available."
    }
} else {
    $gitVer = (& git --version 2>&1).ToString().Trim() -replace "git version ",""
    Write-Ok "git $gitVer"
}

# ── Ollama ───────────────────────────────────────────────────────────────────
function Check-Ollama {
    $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
    if (-not $ollamaCmd) {
        Write-Warn "Ollama is not installed."
        Write-Host ""
        Write-Host "  Ollama is required for Local Mode (100% private, on-device AI inference)." -ForegroundColor White
        Write-Host "  You can skip it if you plan to use a cloud LLM provider (OpenAI, Claude, Gemini)." -ForegroundColor White
        Write-Host ""
        Write-Host "  Install Ollama:" -ForegroundColor White
        Write-Cmd "winget install Ollama.Ollama"
        Write-Cmd "https://ollama.com/download                -- Official Windows installer"
        Write-Host ""
        Write-Host "  Then start Ollama and pull a model:" -ForegroundColor White
        Write-Cmd "ollama serve                               -- start the Ollama server"
        Write-Cmd "ollama pull llama3                         -- Llama 3 (recommended)"
        Write-Cmd "ollama pull qwen2.5:3b                     -- lightweight (low-RAM devices)"
        Write-Cmd "ollama pull mistral                        -- Mistral 7B"
        Write-Host ""
        Write-Host "  Press Enter to continue without Ollama (cloud LLM only)," -ForegroundColor DarkGray
        Write-Host "  or install and start Ollama first and press Enter to retry." -ForegroundColor DarkGray
        $null = Read-Host
        Invoke-PathAugmentation
        $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
        if ($ollamaCmd) {
            try {
                $resp = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
                if ($resp.StatusCode -eq 200) {
                    Write-Ok "Ollama is installed and running at localhost:11434"
                } else {
                    Write-Warn "Ollama installed but not running. The setup wizard will check again."
                    Write-Info "Start it with: ollama serve"
                }
            } catch {
                Write-Warn "Ollama installed but not running. The setup wizard will check again."
                Write-Info "Start it with: ollama serve"
            }
        } else {
            Write-Warn "Continuing without Ollama. Install it later from https://ollama.com/download"
        }
        return
    }

    # Ollama binary found — check if server is reachable
    $ollamaRunning = $false
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) { $ollamaRunning = $true }
    } catch { }

    if ($ollamaRunning) {
        Write-Ok "Ollama is running at localhost:11434"
        return
    }

    Write-Warn "Ollama is installed but not running."
    Write-Host ""
    Write-Host "  Start Ollama in a new window:" -ForegroundColor White
    Write-Cmd "ollama serve"
    Write-Host ""

    $retries = 0
    while ($retries -lt 3) {
        Write-Host "  Press Enter once Ollama is running to retry (attempt $($retries+1)/3)," -ForegroundColor DarkGray
        Write-Host "  or type 'skip' and press Enter to continue:" -ForegroundColor DarkGray
        $userInput = Read-Host
        if ($userInput -eq "skip") {
            Write-Warn "Continuing without Ollama running. The setup wizard will prompt you again."
            return
        }
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                Write-Ok "Ollama is now running at localhost:11434"
                return
            }
        } catch { }
        $retries++
        Write-Warn "Ollama still not reachable on localhost:11434."
    }
    Write-Warn "Ollama not detected after 3 attempts. Continuing — start it later with: ollama serve"
}
Check-Ollama

# ── Docker (optional) ────────────────────────────────────────────────────────
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Warn "Docker is not installed (optional — needed for docker-compose deployment)."
    Write-Host ""
    Write-Host "  Docker is only required if you want to run Gigaclaw via docker-compose." -ForegroundColor White
    Write-Host "  The 'npm run dev' workflow does not need Docker." -ForegroundColor White
    Write-Host ""
    Write-Host "  Install Docker Desktop:" -ForegroundColor White
    Write-Cmd "winget install Docker.DockerDesktop"
    Write-Cmd "https://docs.docker.com/desktop/install/windows-install/"
    Write-Host ""
} else {
    $dockerVer = (& docker --version 2>&1).ToString().Trim() -replace "Docker version ",""
    Write-Ok "docker $dockerVer"
}

# ── ngrok (optional — Cloud Mode only) ───────────────────────────────────────
$ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokCmd) {
    Write-Warn "ngrok is not installed (optional — needed for Cloud Mode webhook tunnelling)."
    Write-Host ""
    Write-Host "  ngrok is only required if you choose Cloud Mode with Telegram or GitHub webhooks." -ForegroundColor White
    Write-Host "  Local Mode does not need ngrok." -ForegroundColor White
    Write-Host ""
    Write-Host "  Install ngrok:" -ForegroundColor White
    Write-Cmd "winget install ngrok.ngrok"
    Write-Cmd "choco install ngrok"
    Write-Cmd "https://ngrok.com/download                    -- Official installer"
    Write-Cmd "https://dashboard.ngrok.com/signup            -- Free account required"
    Write-Host ""
} else {
    try {
        $ngrokVer = (& ngrok version 2>&1).ToString().Trim() -replace "ngrok version ",""
        Write-Ok "ngrok $ngrokVer"
    } catch {
        Write-Ok "ngrok (installed)"
    }
}

# ── Abort if critical prerequisites failed ────────────────────────────────────
if ($PrereqFailed) {
    Write-Host ""
    Write-Fail "One or more required prerequisites could not be satisfied."
    Write-Host "  Please install the missing tools and re-run:" -ForegroundColor White
    Write-Cmd "irm https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.ps1 | iex"
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Ok "All required prerequisites satisfied."

# =============================================================================
# STEP 2 — CREATE PROJECT DIRECTORY
# =============================================================================
Write-Step "[ 2 / 6 ]  Creating project..."

$ProjectDir = if ($env:GIGACLAW_DIR) {
    $env:GIGACLAW_DIR
} elseif ($args.Count -gt 0) {
    $args[0]
} else {
    "my-gigaclaw"
}

$AbsProjectDir = Join-Path (Get-Location).Path $ProjectDir

Write-Host ""
Write-Info "Project directory: $ProjectDir\"
New-Item -ItemType Directory -Force -Path $AbsProjectDir | Out-Null

# =============================================================================
# STEP 3 — SCAFFOLD
# =============================================================================
Write-Step "[ 3 / 6 ]  Scaffolding Gigaclaw project..."
Write-Host ""

Push-Location $AbsProjectDir
try {
    # --yes suppresses the "Ok to proceed? (y)" prompt that hangs irm|iex.
    & npx --yes gigaclaw@latest init
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npx gigaclaw@latest init failed (exit code $LASTEXITCODE)."
        Pop-Location
        exit $LASTEXITCODE
    }
} catch {
    Write-Fail "Scaffolding failed: $_"
    Pop-Location
    exit 1
}

Write-Host ""
Write-Ok "Gigaclaw scaffolded successfully!"
Write-Host ""

# =============================================================================
# STEP 4 — INSTALL DEPENDENCIES
# =============================================================================
Write-Step "[ 4 / 6 ]  Installing npm dependencies..."
try {
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "npm install exited with code $LASTEXITCODE. Setup may fail."
    }
} catch {
    Write-Warn "npm install encountered an error: $_"
}
# Verify gigaclaw package resolved correctly (guards against ERR_MODULE_NOT_FOUND on Node v24+)
$GigaclawModulePath = Join-Path (Get-Location).Path "node_modules" "gigaclaw"
if (-not (Test-Path $GigaclawModulePath)) {
    Write-Warn "node_modules/gigaclaw not found after npm install — retrying with --prefer-online..."
    try {
        & npm install --prefer-online
    } catch {
        Write-Warn "Retry failed: $_"
    }
    if (-not (Test-Path $GigaclawModulePath)) {
        Write-Fail "gigaclaw package still not found in node_modules."
        Write-Host ""
        Write-Host "  Please run these commands manually, then start the dev server:" -ForegroundColor Yellow
        Write-Cmd "cd `"$AbsProjectDir`""
        Write-Cmd "npm install"
        Write-Cmd "npm run dev"
        Pop-Location
        exit 1
    }
}
Write-Host ""
Write-Ok "Dependencies installed."

# =============================================================================
# STEP 5 — SETUP WIZARD
# =============================================================================
Write-Step "[ 5 / 6 ]  Launching setup wizard..."
Write-Host ""

if ($env:GIGACLAW_SKIP_SETUP -eq '1') {
    Write-Warn "Skipping setup wizard (GIGACLAW_SKIP_SETUP=1)"
    Write-Info "Run 'npm run setup' manually to configure Gigaclaw."
} else {
    try {
        & npm run setup
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Setup wizard exited with code $LASTEXITCODE."
            Write-Dim "You can re-run it later with: npm run setup"
        }
    } catch {
        Write-Warn "Setup wizard encountered an error: $_"
        Write-Dim "You can re-run it later with: npm run setup"
    }
}

Pop-Location

# =============================================================================
# STEP 6 — DONE
# =============================================================================
Write-Step "[ 6 / 6 ]  Done!"
Write-Host ""
Write-Host "  Gigaclaw is ready." -ForegroundColor Green
Write-Host ""
Write-Host "  Start your agent:" -ForegroundColor White
Write-Cmd "cd $ProjectDir"
Write-Cmd "npm run dev"
Write-Dim "-- Next.js dev server (recommended for development)"
Write-Host ""
Write-Cmd "docker compose -f docker-compose.local.yml up -d"
Write-Dim "-- Docker (Local Mode, requires Ollama running)"
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor White
Write-Cmd "ollama pull llama3     -- download Llama 3 model"
Write-Cmd "ollama serve           -- start Ollama server"
Write-Cmd "npm run setup          -- re-run setup wizard"
Write-Host ""
Write-Host "  Docs   : https://github.com/gignaati/gigaclaw" -ForegroundColor White
Write-Host "  Support: support@gignaati.com" -ForegroundColor White
Write-Host "  Website: https://gigaclaw.gignaati.com" -ForegroundColor White
Write-Host ""
