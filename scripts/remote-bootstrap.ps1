# =============================================================================
# WhatsApp Bot Scanner - Remote Bootstrap (Windows)
# =============================================================================
# One-liner installation for fresh Windows systems.
#
# Usage:
#   irm https://raw.githubusercontent.com/ElliotBadinger/whatsapp-bot-scanner/main/scripts/remote-bootstrap.ps1 | iex
#
# Flow:
#   1. Check/install Git (via winget if available)
#   2. Clone the repository
#   3. Delegate to bootstrap.ps1 (which handles Node.js, Docker, and npx setup)
# =============================================================================

$ErrorActionPreference = "Stop"

$RepoUrl = if ($env:WBSCANNER_REPO) { $env:WBSCANNER_REPO } else { "https://github.com/ElliotBadinger/whatsapp-bot-scanner.git" }
$InstallDir = if ($env:WBSCANNER_DIR) { $env:WBSCANNER_DIR } else { "$env:USERPROFILE\whatsapp-bot-scanner" }
$Branch = if ($env:WBSCANNER_BRANCH) { $env:WBSCANNER_BRANCH } else { "main" }

function Write-Success { param([string]$Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Step { param([string]$Message) Write-Host "▶ $Message" -ForegroundColor Cyan }
function Write-ErrorMsg { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  WhatsApp Bot Scanner - Remote Bootstrap (Windows)              ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# Step 1: Ensure Git is available
# -----------------------------------------------------------------------------
Write-Step "Step 1/2: Checking Git..."

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warning "Git not found. Attempting to install..."
    
    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    if ($hasWinget) {
        Write-Host "Installing Git via winget..."
        winget install Git.Git --accept-package-agreements --accept-source-agreements
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
            Write-ErrorMsg "Git installation completed but not in PATH. Please restart your terminal and try again."
        }
    } else {
        Write-Host ""
        Write-Host "Please install Git manually:" -ForegroundColor Yellow
        Write-Host "  • Download: https://git-scm.com/download/win"
        Write-Host "  • Or install winget first, then run this script again"
        Write-Host ""
        Write-Host "WSL2 Alternative (Recommended):" -ForegroundColor Green
        Write-Host "  1. wsl --install -d Ubuntu"
        Write-Host "  2. Open Ubuntu terminal"
        Write-Host "  3. curl -fsSL .../remote-bootstrap.sh | bash"
        Write-Host ""
        Write-ErrorMsg "Git is required. Please install and try again."
    }
}
Write-Success "Git available"

# -----------------------------------------------------------------------------
# Step 2: Clone Repository
# -----------------------------------------------------------------------------
Write-Step "Step 2/2: Cloning repository..."

if (Test-Path $InstallDir) {
    Write-Warning "Directory $InstallDir already exists"
    
    if (Test-Path "$InstallDir\.git") {
        Set-Location $InstallDir
        git fetch origin $Branch 2>&1 | Out-Null
        git reset --hard "origin/$Branch" 2>&1 | Out-Null
        Write-Success "Repository updated"
    } else {
        $response = Read-Host "Remove and re-clone? [y/N]"
        if ($response -match '^[Yy]') {
            Remove-Item -Recurse -Force $InstallDir
            git clone --depth 1 --branch $Branch $RepoUrl $InstallDir
            Write-Success "Repository cloned to $InstallDir"
        }
    }
} else {
    git clone --depth 1 --branch $Branch $RepoUrl $InstallDir
    Write-Success "Repository cloned to $InstallDir"
}

Set-Location $InstallDir

# -----------------------------------------------------------------------------
# Delegate to local bootstrap.ps1
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Repository ready! Running local bootstrap...                    ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

if (Test-Path "$InstallDir\bootstrap.ps1") {
    & "$InstallDir\bootstrap.ps1" @args
} else {
    Write-ErrorMsg "bootstrap.ps1 not found. Please run manually from $InstallDir"
}
