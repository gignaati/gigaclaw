# =============================================================================
#  Giga Bot — One-Command Installer for Windows (PowerShell 5.1+)
#  Powered by Gignaati — https://www.gignaati.com
#
#  Usage (run from an elevated or standard PowerShell prompt):
#    irm https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.ps1 | iex
#
#  Or with a custom project directory name:
#    $env:GIGACLAW_DIR="my-project"; irm .../install.ps1 | iex
#
#  What this script does:
#    1. Self-bypasses execution policy for the current process (irm|iex users)
#    2. Augments PATH for nvm-windows, fnm, Scoop, Chocolatey, Volta, and
#       the default Node.js MSI install location
#    3. Checks Node.js (18+), npm, Git (optional), Docker (optional)
#    4. Scaffolds the project with: npx gigaclaw@latest init
#    5. Auto-launches the interactive setup wizard: npm run setup
#    6. Prints next-steps instructions
# =============================================================================

#Requires -Version 5.1

# ─── Execution Policy Self-Bypass ────────────────────────────────────────────
# When piped via `irm ... | iex`, PowerShell runs the script in the current
# process scope. If the machine policy is Restricted or AllSigned the script
# would be blocked. We bypass only for this process — no permanent policy change.
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

$ErrorActionPreference = "Stop"

# ─── Colour helpers ──────────────────────────────────────────────────────────
function Write-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║         Giga Bot — Powered by Gignaati                  ║" -ForegroundColor Cyan
    Write-Host "║         https://www.gignaati.com                        ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Ok   { param($msg) Write-Host "  ✓ $msg" -ForegroundColor Green  }
function Write-Warn { param($msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  ✗ $msg" -ForegroundColor Red    }
function Write-Step { param($msg) Write-Host "`n$msg" -ForegroundColor White    }

# ─── PATH Augmentation ───────────────────────────────────────────────────────
# When running via irm|iex the process inherits a minimal PATH.
# We add the most common Windows Node.js install locations so the checks below
# can find node/npm regardless of how the user installed Node.js.
#
# Locations covered:
#   • Node.js MSI default  — C:\Program Files\nodejs
#   • nvm-windows          — %APPDATA%\nvm  (active version symlink)
#   • fnm                  — %LOCALAPPDATA%\fnm\aliases\default\bin
#   • Volta                — %LOCALAPPDATA%\Volta\bin
#   • Scoop                — %USERPROFILE%\scoop\shims
#   • Chocolatey           — C:\ProgramData\chocolatey\bin
#   • winget / Microsoft Store Node — %LOCALAPPDATA%\Microsoft\WindowsApps

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
    if (Test-Path $p) {
        $env:PATH = "$p;$env:PATH"
    }
}

# nvm-windows stores the active version under %APPDATA%\nvm\<version>
# Add all version subdirectories so the current one is found even if the
# top-level symlink is missing (common in non-admin installs).
$nvmRoot = "$env:APPDATA\nvm"
if (Test-Path $nvmRoot) {
    Get-ChildItem -Path $nvmRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^v?\d+\.\d+\.\d+$' } |
        ForEach-Object { $env:PATH = "$($_.FullName);$env:PATH" }
}

# ─── Banner ──────────────────────────────────────────────────────────────────
Write-Banner

# ─── Node.js check ───────────────────────────────────────────────────────────
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Fail "Node.js is not installed or not found in PATH."
    Write-Host ""
    Write-Host "  Install Node.js 18 LTS (or higher) from one of these sources:" -ForegroundColor White
    Write-Host "    Official installer : https://nodejs.org/en/download" -ForegroundColor Cyan
    Write-Host "    winget             : winget install OpenJS.NodeJS.LTS" -ForegroundColor Cyan
    Write-Host "    Chocolatey         : choco install nodejs-lts" -ForegroundColor Cyan
    Write-Host "    Scoop              : scoop install nodejs-lts" -ForegroundColor Cyan
    Write-Host "    nvm-windows        : https://github.com/coreybutler/nvm-windows" -ForegroundColor Cyan
    Write-Host "    fnm                : winget install Schniz.fnm" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  After installing Node.js, open a new PowerShell window and re-run:" -ForegroundColor White
    Write-Host "    irm https://raw.githubusercontent.com/gignaati/gigaclaw/main/install.ps1 | iex" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

try {
    $rawVer    = (& node --version 2>&1).ToString().Trim()          # e.g. "v20.11.0"
    $majorStr  = $rawVer.TrimStart('v').Split('.')[0]
    $nodeMajor = [int]$majorStr
} catch {
    Write-Fail "Could not determine Node.js version. Please reinstall from https://nodejs.org"
    exit 1
}

if ($nodeMajor -lt 18) {
    Write-Fail "Node.js $rawVer is too old. Version 18 or higher is required."
    Write-Host "  Upgrade: https://nodejs.org/en/download" -ForegroundColor White
    exit 1
}
Write-Ok "Node.js $rawVer"

# ─── npm check ───────────────────────────────────────────────────────────────
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Fail "npm is not found. npm ships with Node.js — please reinstall from https://nodejs.org"
    exit 1
}
$npmVer = (& npm --version 2>&1).ToString().Trim()
Write-Ok "npm $npmVer"

# ─── Git check (optional — Cloud Mode only) ──────────────────────────────────
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($gitCmd) {
    $gitVer = (& git --version 2>&1).ToString().Trim() -replace "git version ",""
    Write-Ok "git $gitVer"
} else {
    Write-Warn "Git is not installed (optional — only needed for Cloud Mode)."
    Write-Host "    Install: winget install Git.Git  or  https://git-scm.com/download/win" -ForegroundColor DarkGray
}

# ─── Docker check (optional — docker-compose mode) ───────────────────────────
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    $dockerVer = (& docker --version 2>&1).ToString().Trim() -replace "Docker version ",""
    Write-Ok "docker $dockerVer"
} else {
    Write-Warn "Docker is not installed (optional — needed for docker-compose mode)."
    Write-Host "    Install: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor DarkGray
}

# ─── Project directory ───────────────────────────────────────────────────────
# Precedence: $env:GIGACLAW_DIR > first positional arg > default "my-gigaclaw"
$ProjectDir = if ($env:GIGACLAW_DIR) {
    $env:GIGACLAW_DIR
} elseif ($args.Count -gt 0) {
    $args[0]
} else {
    "my-gigaclaw"
}

$AbsProjectDir = Join-Path (Get-Location).Path $ProjectDir

Write-Step "Creating project in: $ProjectDir\"
New-Item -ItemType Directory -Force -Path $AbsProjectDir | Out-Null

# ─── Scaffold ────────────────────────────────────────────────────────────────
Write-Step "Scaffolding Giga Bot project..."
Write-Host ""

Push-Location $AbsProjectDir
try {
    # --% passes --yes literally to npx, suppressing the "Ok to proceed? (y)" prompt
    # that would hang non-interactive / piped invocations.
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
Write-Ok "Giga Bot scaffolded successfully!"
Write-Host ""

# ─── Install npm dependencies ────────────────────────────────────────────────
# The scaffolded project needs its deps installed before npm run setup can run.
Write-Step "Installing dependencies..."
try {
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "npm install exited with code $LASTEXITCODE. Setup may fail."
    }
} catch {
    Write-Warn "npm install encountered an error: $_"
}
Write-Host ""

# ─── Auto-launch setup wizard ────────────────────────────────────────────────
# Mirrors install.sh behaviour: cd into the project and run npm run setup
# immediately so the user never has to type a second command.
# Set $env:GIGACLAW_SKIP_SETUP = '1' to bypass the wizard (useful in CI/CD
# pipelines or automated provisioning where interactive prompts are not desired).
if ($env:GIGACLAW_SKIP_SETUP -eq '1') {
    Write-Host "⚡ Skipping setup wizard (GIGACLAW_SKIP_SETUP=1)" -ForegroundColor Yellow
    Write-Host "  Run 'npm run setup' manually to configure Giga Bot." -ForegroundColor DarkGray
} else {
    Write-Step "Launching setup wizard..."
    Write-Host ""
    try {
        & npm run setup
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Setup wizard exited with code $LASTEXITCODE."
            Write-Host "  You can re-run it later with: npm run setup" -ForegroundColor DarkGray
        }
    } catch {
        Write-Warn "Setup wizard encountered an error: $_"
        Write-Host "  You can re-run it later with: npm run setup" -ForegroundColor DarkGray
    }
}

Pop-Location

# ─── Post-setup instructions ─────────────────────────────────────────────────
Write-Host ""
Write-Ok "Setup complete!"
Write-Host ""
Write-Host "  To start Giga Bot:" -ForegroundColor White
Write-Host "    cd $ProjectDir" -ForegroundColor Cyan
Write-Host "    npm run dev" -ForegroundColor Cyan
Write-Host "      — Next.js dev server (recommended for development)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "    docker compose -f docker-compose.local.yml up -d" -ForegroundColor Cyan
Write-Host "      — Docker (Local Mode, Ollama required)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Docs   : https://github.com/gignaati/gigaclaw" -ForegroundColor White
Write-Host "  Support: support@gignaati.com" -ForegroundColor White
Write-Host "  Website: https://gigaclaw.gignaati.com" -ForegroundColor White
Write-Host ""
