# =============================================================================
#  Giga Bot — One-Command Installer for Windows (PowerShell)
#  Powered by Gignaati — https://www.gignaati.com
#  Usage: irm https://raw.githubusercontent.com/gignaati/gigabot/main/install.ps1 | iex
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Giga Bot — Powered by Gignaati                  ║" -ForegroundColor Cyan
Write-Host "║         https://www.gignaati.com                        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = (node --version 2>&1).ToString().TrimStart('v').Split('.')[0]
    if ([int]$nodeVersion -lt 18) {
        Write-Host "✗ Node.js version $nodeVersion is too old. Version 18+ is required." -ForegroundColor Red
        Write-Host "  Install the latest LTS from https://nodejs.org" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Node.js $(node --version)" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js is not installed." -ForegroundColor Red
    Write-Host "  Install it from https://nodejs.org (version 18 or higher required)" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version 2>&1
    Write-Host "✓ npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm is not installed. Install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check Git
try {
    git --version | Out-Null
} catch {
    Write-Host "⚠ Git is not installed. Install from https://git-scm.com" -ForegroundColor Yellow
}

# Check GitHub CLI
try {
    gh --version | Out-Null
} catch {
    Write-Host "⚠ GitHub CLI (gh) is not installed. Install from https://cli.github.com" -ForegroundColor Yellow
}

# Determine project directory
$ProjectDir = if ($args[0]) { $args[0] } else { "my-gigabot" }
Write-Host ""
Write-Host "Creating project in: $ProjectDir/" -ForegroundColor White
New-Item -ItemType Directory -Force -Path $ProjectDir | Out-Null
Set-Location $ProjectDir

# Scaffold the project
Write-Host ""
Write-Host "Scaffolding Giga Bot project..." -ForegroundColor White
npx gigabot@latest init

Write-Host ""
Write-Host "✅ Giga Bot scaffolded successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor White
Write-Host "  1. cd $ProjectDir" -ForegroundColor Cyan
Write-Host "  2. npm run setup  — run the interactive setup wizard" -ForegroundColor Cyan
Write-Host "  3. npm run dev    — start the development server" -ForegroundColor Cyan
Write-Host ""
Write-Host "Docs:    https://github.com/gignaati/gigabot" -ForegroundColor White
Write-Host "Support: support@gignaati.com" -ForegroundColor White
Write-Host "Website: https://www.gignaati.com" -ForegroundColor White
Write-Host ""
