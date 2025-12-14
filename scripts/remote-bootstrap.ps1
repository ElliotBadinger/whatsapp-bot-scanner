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

function Refresh-Path {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    if ($machine -and $user) {
        $env:Path = "$machine;$user"
    } elseif ($machine) {
        $env:Path = $machine
    } elseif ($user) {
        $env:Path = $user
    }
}

function Try-AddGitToPathFromKnownLocations {
    $candidates = @(
        "$env:ProgramFiles\Git\cmd\git.exe",
        "$env:ProgramFiles\Git\bin\git.exe",
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
        "${env:ProgramFiles(x86)}\Git\bin\git.exe"
    )

    foreach ($exe in $candidates) {
        if (Test-Path $exe) {
            $gitDir = Split-Path -Parent $exe
            if (-not ($env:Path -split ';' | Where-Object { $_ -eq $gitDir })) {
                $env:Path = "$env:Path;$gitDir"
            }
            return $true
        }
    }
    return $false
}

function Ensure-Git {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        return $true
    }

    Write-Warning "Git not found. Attempting to install..."

    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    if ($hasWinget) {
        Write-Host "Installing Git via winget..."

        $installed = $false
        try {
            winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
            $installed = $true
        } catch {
            try {
                winget install Git.Git --accept-package-agreements --accept-source-agreements
                $installed = $true
            } catch {
                $installed = $false
            }
        }

        if ($installed) {
            Refresh-Path
            if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
                Try-AddGitToPathFromKnownLocations | Out-Null
            }
        }

        if (Get-Command git -ErrorAction SilentlyContinue) {
            return $true
        }

        Write-Warning "Git install completed but git is still not available in this session."
        return $false
    }

    return $false
}

function Get-GitHubArchiveZipUrl {
    param(
        [Parameter(Mandatory=$true)][string]$RepoUrl,
        [Parameter(Mandatory=$true)][string]$Branch
    )

    $clean = $RepoUrl.Trim()
    $clean = $clean -replace '\.git$',''

    if ($clean -notmatch '^https://github\.com/') {
        return $null
    }

    return "$clean/archive/refs/heads/$Branch.zip"
}

function Install-RepoFromZip {
    param(
        [Parameter(Mandatory=$true)][string]$RepoUrl,
        [Parameter(Mandatory=$true)][string]$Branch,
        [Parameter(Mandatory=$true)][string]$InstallDir
    )

    $zipUrl = Get-GitHubArchiveZipUrl -RepoUrl $RepoUrl -Branch $Branch
    if (-not $zipUrl) {
        Write-ErrorMsg "Git is not available and the repository URL is not a supported GitHub HTTPS URL for zip download. Please install Git and re-run."
    }

    $tmpRoot = Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString())
    $tmpZip = Join-Path $tmpRoot "repo.zip"
    $tmpExtract = Join-Path $tmpRoot "extract"
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $tmpExtract -Force | Out-Null

    Write-Host "Downloading repository zip..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip
    Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

    $extractedRoot = Get-ChildItem -Path $tmpExtract | Where-Object { $_.PSIsContainer } | Select-Object -First 1
    if (-not $extractedRoot) {
        Write-ErrorMsg "Failed to extract repository zip."
    }

    if (Test-Path $InstallDir) {
        Write-Warning "Directory $InstallDir already exists"
        $response = Read-Host "Remove and re-install from zip? [y/N]"
        if ($response -match '^[Yy]') {
            Remove-Item -Recurse -Force $InstallDir
        } else {
            Write-ErrorMsg "Cannot continue without installing the repository into $InstallDir."
        }
    }

    Move-Item -Path $extractedRoot.FullName -Destination $InstallDir
    Remove-Item -Recurse -Force $tmpRoot
    Write-Success "Repository installed to $InstallDir"
}

function Install-Or-UpdateRepo {
    param(
        [Parameter(Mandatory=$true)][string]$RepoUrl,
        [Parameter(Mandatory=$true)][string]$Branch,
        [Parameter(Mandatory=$true)][string]$InstallDir
    )

    $hasGit = Get-Command git -ErrorAction SilentlyContinue
    if (-not $hasGit) {
        Install-RepoFromZip -RepoUrl $RepoUrl -Branch $Branch -InstallDir $InstallDir
        return
    }

    if (Test-Path $InstallDir) {
        Write-Warning "Directory $InstallDir already exists"
        if (Test-Path "$InstallDir\.git") {
            Set-Location $InstallDir
            try {
                git fetch origin $Branch 2>&1 | Out-Null
                git reset --hard "origin/$Branch" 2>&1 | Out-Null
                Write-Success "Repository updated"
                return
            } catch {
                Write-Warning "Git update failed. Falling back to zip download."
                Set-Location $env:USERPROFILE
                Install-RepoFromZip -RepoUrl $RepoUrl -Branch $Branch -InstallDir $InstallDir
                return
            }
        }

        $response = Read-Host "Remove and re-clone? [y/N]"
        if ($response -match '^[Yy]') {
            Remove-Item -Recurse -Force $InstallDir
        } else {
            Write-ErrorMsg "Cannot continue without a clean install directory."
        }
    }

    try {
        git clone --depth 1 --branch $Branch $RepoUrl $InstallDir
        Write-Success "Repository cloned to $InstallDir"
    } catch {
        Write-Warning "Git clone failed. Falling back to zip download."
        Install-RepoFromZip -RepoUrl $RepoUrl -Branch $Branch -InstallDir $InstallDir
    }
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  WhatsApp Bot Scanner - Remote Bootstrap (Windows)              ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# Step 1: Ensure Git is available
# -----------------------------------------------------------------------------
Write-Step "Step 1/2: Checking Git..."

if (Ensure-Git) {
    Write-Success "Git available"
} else {
    Write-Warning "Git not available. Will try to install the repository without Git (zip download)."
}

# -----------------------------------------------------------------------------
# Step 2: Clone Repository
# -----------------------------------------------------------------------------
Write-Step "Step 2/2: Cloning repository..."

Install-Or-UpdateRepo -RepoUrl $RepoUrl -Branch $Branch -InstallDir $InstallDir

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
    try {
        try {
            Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction Stop
        } catch {
        }

        & "$InstallDir\bootstrap.ps1" @args
    } catch [System.Management.Automation.PSSecurityException] {
        Write-Warning "PowerShell execution policy blocked running bootstrap.ps1. Retrying in a child PowerShell process with -ExecutionPolicy Bypass..."

        $psExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }
        $forwardArgs = @()
        if ($args) {
            $forwardArgs = $args | ForEach-Object { "$_" }
        }

        $proc = Start-Process -FilePath $psExe -ArgumentList (@("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$InstallDir\bootstrap.ps1") + $forwardArgs) -Wait -PassThru
        if ($proc.ExitCode -ne 0) {
            Write-Host "";
            Write-Host "If this still fails, your machine may enforce ExecutionPolicy via Group Policy." -ForegroundColor Yellow
            Write-Host "Workarounds:" -ForegroundColor Yellow
            Write-Host "  1) Try Windows Terminal -> PowerShell (Admin)" -ForegroundColor Yellow
            Write-Host "  2) Or use WSL2 (Ubuntu) and run scripts/remote-bootstrap.sh" -ForegroundColor Yellow
            Write-ErrorMsg "bootstrap.ps1 failed (exit code $($proc.ExitCode))."
        }
    }
} else {
    Write-ErrorMsg "bootstrap.ps1 not found. Please run manually from $InstallDir"
}
