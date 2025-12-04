# Remote Bootstrap Script for Windows PowerShell
# Usage: irm https://raw.githubusercontent.com/ElliotBadinger/whatsapp-bot-scanner/main/scripts/remote-bootstrap.ps1 | iex
#
# This script:
# 1. Checks prerequisites (Node.js, Docker, Git)
# 2. Provides installation guidance for missing tools
# 3. Clones the repository
# 4. Runs the full setup wizard

$ErrorActionPreference = "Stop"

$RepoUrl = if ($env:WBSCANNER_REPO) { $env:WBSCANNER_REPO } else { "https://github.com/ElliotBadinger/whatsapp-bot-scanner.git" }
$InstallDir = if ($env:WBSCANNER_DIR) { $env:WBSCANNER_DIR } else { "$env:USERPROFILE\whatsapp-bot-scanner" }
$Branch = if ($env:WBSCANNER_BRANCH) { $env:WBSCANNER_BRANCH } else { "main" }

function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Step { param([string]$Message) Write-Host "▶ $Message" -ForegroundColor Magenta }
function Write-ErrorMsg { param([string]$Message) Write-Host "❌ Error: $Message" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  WhatsApp Bot Scanner - Remote Bootstrap (Windows)              ║" -ForegroundColor Cyan
Write-Host "║  One-liner installation for fresh systems                        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Warning "For the best experience, we recommend using WSL2 (Ubuntu)."
Write-Warning "This PowerShell script is for native Windows environments."
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Not running as Administrator. Some installations may require elevation."
}

# -----------------------------------------------------------------------------
# Prerequisite Checks
# -----------------------------------------------------------------------------

$missingPrereqs = @()

Write-Step "Step 1/5: Checking Git..."
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Success "Git is installed."
} else {
    $missingPrereqs += "Git"
    Write-Warning "Git not found."
}

Write-Step "Step 2/5: Checking Node.js..."
$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = (node --version) -replace 'v', ''
    $nodeMajor = [int]($nodeVersion -split '\.')[0]
    if ($nodeMajor -ge 20) {
        Write-Success "Node.js $nodeVersion is installed."
        $nodeOk = $true
    } else {
        Write-Warning "Node.js $nodeVersion is too old (requires 20+)."
        $missingPrereqs += "Node.js 20+"
    }
} else {
    $missingPrereqs += "Node.js 20+"
    Write-Warning "Node.js not found."
}

Write-Step "Step 3/5: Checking Docker..."
$dockerOk = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker is available and running."
            $dockerOk = $true
        } else {
            Write-Warning "Docker is installed but daemon is not running."
            Write-Info "Please start Docker Desktop."
            $missingPrereqs += "Docker Desktop (running)"
        }
    } catch {
        Write-Warning "Docker is installed but daemon is not running."
        $missingPrereqs += "Docker Desktop (running)"
    }
} else {
    $missingPrereqs += "Docker Desktop"
    Write-Warning "Docker not found."
}

# -----------------------------------------------------------------------------
# Handle Missing Prerequisites
# -----------------------------------------------------------------------------

if ($missingPrereqs.Count -gt 0) {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║  Missing Prerequisites                                           ║" -ForegroundColor Yellow
    Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($prereq in $missingPrereqs) {
        Write-Host "  • $prereq" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Installation Options:" -ForegroundColor Cyan
    Write-Host ""
    
    # Check for winget
    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    
    if ($hasWinget) {
        Write-Host "Using winget (recommended):" -ForegroundColor Green
        if ($missingPrereqs -contains "Git") {
            Write-Host "  winget install Git.Git"
        }
        if ($missingPrereqs -contains "Node.js 20+") {
            Write-Host "  winget install OpenJS.NodeJS.LTS"
        }
        if ($missingPrereqs -contains "Docker Desktop" -or $missingPrereqs -contains "Docker Desktop (running)") {
            Write-Host "  winget install Docker.DockerDesktop"
        }
        Write-Host ""
    }
    
    # Check for Chocolatey
    $hasChoco = Get-Command choco -ErrorAction SilentlyContinue
    
    if ($hasChoco) {
        Write-Host "Using Chocolatey:" -ForegroundColor Green
        if ($missingPrereqs -contains "Git") {
            Write-Host "  choco install git -y"
        }
        if ($missingPrereqs -contains "Node.js 20+") {
            Write-Host "  choco install nodejs-lts -y"
        }
        if ($missingPrereqs -contains "Docker Desktop" -or $missingPrereqs -contains "Docker Desktop (running)") {
            Write-Host "  choco install docker-desktop -y"
        }
        Write-Host ""
    }
    
    Write-Host "Manual Downloads:" -ForegroundColor Green
    if ($missingPrereqs -contains "Git") {
        Write-Host "  Git: https://git-scm.com/download/win"
    }
    if ($missingPrereqs -contains "Node.js 20+") {
        Write-Host "  Node.js: https://nodejs.org/ (LTS version)"
    }
    if ($missingPrereqs -contains "Docker Desktop" -or $missingPrereqs -contains "Docker Desktop (running)") {
        Write-Host "  Docker: https://www.docker.com/products/docker-desktop/"
    }
    Write-Host ""
    
    Write-Host "WSL2 Alternative (Recommended):" -ForegroundColor Green
    Write-Host "  1. Install WSL2: wsl --install -d Ubuntu"
    Write-Host "  2. Open Ubuntu terminal"
    Write-Host "  3. Run: curl -fsSL https://raw.githubusercontent.com/ElliotBadinger/whatsapp-bot-scanner/main/scripts/remote-bootstrap.sh | bash"
    Write-Host ""
    
    # Offer to install via winget if available
    if ($hasWinget -and $missingPrereqs.Count -gt 0) {
        $response = Read-Host "Would you like to install missing prerequisites via winget? [y/N]"
        if ($response -match '^[Yy]') {
            if ($missingPrereqs -contains "Git") {
                Write-Info "Installing Git..."
                winget install Git.Git --accept-package-agreements --accept-source-agreements
            }
            if ($missingPrereqs -contains "Node.js 20+") {
                Write-Info "Installing Node.js LTS..."
                winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            }
            if ($missingPrereqs -contains "Docker Desktop") {
                Write-Info "Installing Docker Desktop..."
                winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
                Write-Warning "Docker Desktop requires a restart. Please restart and run this script again."
            }
            
            Write-Host ""
            Write-Warning "Please restart your terminal/PowerShell session for PATH changes to take effect."
            Write-Warning "Then run this script again."
            exit 0
        }
    }
    
    # Check if we can continue without all prerequisites
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-ErrorMsg "Git is required to clone the repository. Please install it and try again."
    }
    
    if (-not $nodeOk) {
        Write-ErrorMsg "Node.js 20+ is required. Please install it and try again."
    }
    
    Write-Warning "Continuing without Docker. The setup wizard will provide guidance."
}

# -----------------------------------------------------------------------------
# Clone Repository
# -----------------------------------------------------------------------------

Write-Step "Step 4/5: Cloning repository..."

if (Test-Path $InstallDir) {
    Write-Info "Directory $InstallDir already exists."
    $response = Read-Host "Remove and re-clone? [y/N]"
    if ($response -match '^[Yy]') {
        Remove-Item -Recurse -Force $InstallDir
        git clone --depth 1 --branch $Branch $RepoUrl $InstallDir
    } else {
        Write-Info "Using existing directory."
        Set-Location $InstallDir
        git pull origin $Branch 2>&1 | Out-Null
    }
} else {
    git clone --depth 1 --branch $Branch $RepoUrl $InstallDir
}

Set-Location $InstallDir
Write-Success "Repository cloned to $InstallDir"

# -----------------------------------------------------------------------------
# Install Dependencies and Launch Setup
# -----------------------------------------------------------------------------

Write-Step "Step 5/5: Installing dependencies and launching setup..."

if (Get-Command npm -ErrorAction SilentlyContinue) {
    npm install
} else {
    Write-Warning "npm not found. Setup wizard will handle dependencies."
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Prerequisites Ready!                                            ║" -ForegroundColor Green
Write-Host "║  Launching interactive setup wizard...                           ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Launch the setup wizard
if (Test-Path "$InstallDir\scripts\unified-cli.mjs") {
    & node "$InstallDir\scripts\unified-cli.mjs" setup @args
} elseif (Test-Path "$InstallDir\bootstrap.ps1") {
    & "$InstallDir\bootstrap.ps1" @args
} else {
    Write-ErrorMsg "Could not find setup wizard. Please run manually from $InstallDir"
}
