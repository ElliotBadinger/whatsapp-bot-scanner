# =============================================================================
# WhatsApp Bot Scanner - Bootstrap (Windows)
# =============================================================================
# Ensures prerequisites are installed, then runs: npx whatsapp-bot-scanner setup
#
# Usage:
#   .\bootstrap.ps1              # Interactive setup
#   .\bootstrap.ps1 --hobby-mode # Hobby/personal mode
# =============================================================================

param(
    [switch]$SkipDocker,
    [switch]$SkipNode
)

$ErrorActionPreference = "Stop"

$ROOT_DIR = $PSScriptRoot
$hasWinget = Get-Command winget -ErrorAction SilentlyContinue

function Write-Step { param([string]$Message) Write-Host "▶ $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-ErrorMsg { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  WhatsApp Bot Scanner - Bootstrap                                ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# Step 1: Node.js
# -----------------------------------------------------------------------------
Write-Step "Step 1/4: Checking Node.js..."

$nodeOk = $false
if (-not $SkipNode) {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = (node --version) -replace 'v', ''
        $nodeMajor = [int]($nodeVersion -split '\.')[0]
        
        if ($nodeMajor -ge 20) {
            Write-Success "Node.js $nodeVersion ready"
            $nodeOk = $true
        } else {
            Write-Warning "Node.js $nodeVersion too old (need 20+)"
        }
    }
    
    if (-not $nodeOk) {
        if ($hasWinget) {
            Write-Host "Installing Node.js via winget..."
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            
            if (Get-Command node -ErrorAction SilentlyContinue) {
                Write-Success "Node.js installed"
                $nodeOk = $true
            } else {
                Write-Warning "Node.js installed but not in PATH. Restart terminal after setup."
            }
        } else {
            Write-Host ""
            Write-Host "Node.js 20+ required. Install from:" -ForegroundColor Yellow
            Write-Host "  https://nodejs.org/ (LTS version)"
            Write-Host ""
            Write-ErrorMsg "Node.js 20+ is required."
        }
    }
} else {
    Write-Success "Skipping Node.js check"
}

# -----------------------------------------------------------------------------
# Step 2: Docker
# -----------------------------------------------------------------------------
Write-Step "Step 2/4: Checking Docker..."

$dockerOk = $false
if (-not $SkipDocker) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        try {
            docker info 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Docker ready"
                $dockerOk = $true
            } else {
                Write-Warning "Docker installed but daemon not running"
            }
        } catch {
            Write-Warning "Docker installed but daemon not running"
        }
    }
    
    if (-not $dockerOk) {
        if ($hasWinget) {
            $response = Read-Host "Docker not found. Install Docker Desktop via winget? [y/N]"
            if ($response -match '^[Yy]') {
                Write-Host "Installing Docker Desktop via winget..."
                winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
                Write-Warning "Docker Desktop installed. Please restart your computer, start Docker Desktop, then run this script again."
                exit 0
            }
        }
        Write-Warning "Docker not available - setup wizard will provide guidance"
    }
} else {
    Write-Success "Skipping Docker check"
}

# -----------------------------------------------------------------------------
# Step 3: Dependencies
# -----------------------------------------------------------------------------
Write-Step "Step 3/4: Installing dependencies..."

Set-Location $ROOT_DIR

if (Test-Path "$ROOT_DIR\package.json") {
    if (-not (Test-Path "$ROOT_DIR\node_modules") -or -not (Test-Path "$ROOT_DIR\node_modules\.package-lock.json")) {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            npm install --silent 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Dependencies installed"
            } else {
                npm install
            }
        }
    } else {
        Write-Success "Dependencies ready"
    }
}

# -----------------------------------------------------------------------------
# Step 4: Launch npx setup
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Prerequisites complete! Launching setup wizard...               ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Step "Step 4/4: Running npx whatsapp-bot-scanner setup..."

Set-Location $ROOT_DIR

if (Get-Command npx -ErrorAction SilentlyContinue) {
    & npx whatsapp-bot-scanner setup @args
} elseif (Test-Path "$ROOT_DIR\scripts\unified-cli.mjs") {
    & node "$ROOT_DIR\scripts\unified-cli.mjs" setup @args
} else {
    Write-ErrorMsg "Could not find setup wizard."
}

