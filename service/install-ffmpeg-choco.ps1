# Install FFmpeg using Chocolatey
# This script must be run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FFmpeg Installation via Chocolatey" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Right-click on PowerShell" -ForegroundColor Yellow
    Write-Host "2. Select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "3. Navigate to this directory and run the script again" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or run this command in an elevated PowerShell:" -ForegroundColor Cyan
    Write-Host "  Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File `"$PSCommandPath`"' -Verb RunAs" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✓ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Check if Chocolatey is installed
try {
    $chocoVersion = choco --version 2>&1
    Write-Host "✓ Chocolatey is installed (version $chocoVersion)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Chocolatey is not installed!" -ForegroundColor Red
    Write-Host "Please install Chocolatey first: https://chocolatey.org/install" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if FFmpeg is already installed
Write-Host "[1/3] Checking if FFmpeg is already installed..." -ForegroundColor Yellow

try {
    $ffmpegVersion = ffmpeg -version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ FFmpeg is already installed!" -ForegroundColor Green
        Write-Host ""
        Write-Host $ffmpegVersion[0] -ForegroundColor Gray
        Write-Host ""
        Write-Host "Do you want to reinstall/upgrade? (Y/N)" -ForegroundColor Yellow
        $response = Read-Host
        if ($response -ne 'Y' -and $response -ne 'y') {
            Write-Host "Installation cancelled." -ForegroundColor Yellow
            exit 0
        }
        Write-Host ""
        Write-Host "Upgrading FFmpeg..." -ForegroundColor Yellow
        choco upgrade ffmpeg -y
    }
} catch {
    Write-Host "FFmpeg not found. Installing..." -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "[2/3] Installing FFmpeg via Chocolatey..." -ForegroundColor Yellow
    Write-Host "This may take a few minutes..." -ForegroundColor Gray
    Write-Host ""
    
    choco install ffmpeg -y
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: FFmpeg installation failed!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "[3/3] Verifying installation..." -ForegroundColor Yellow

# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

try {
    $version = ffmpeg -version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ FFmpeg installed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Version Information:" -ForegroundColor Cyan
        Write-Host $version[0] -ForegroundColor Gray
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Installation Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Cyan
        Write-Host "1. Close and reopen your terminal/IDE" -ForegroundColor White
        Write-Host "2. Run the test script:" -ForegroundColor White
        Write-Host "   cd service" -ForegroundColor Gray
        Write-Host "   .\test-voice-enroll.ps1" -ForegroundColor Gray
        Write-Host ""
    } else {
        throw "FFmpeg command failed"
    }
} catch {
    Write-Host "WARNING: Installation completed but verification failed" -ForegroundColor Yellow
    Write-Host "Please close and reopen your terminal, then run: ffmpeg -version" -ForegroundColor Yellow
    Write-Host ""
}

