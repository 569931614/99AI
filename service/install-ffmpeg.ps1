# Install FFmpeg on Windows
# This script downloads and installs FFmpeg automatically

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FFmpeg Installation Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if FFmpeg is already installed
try {
    $ffmpegVersion = ffmpeg -version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "FFmpeg is already installed!" -ForegroundColor Green
        Write-Host $ffmpegVersion[0] -ForegroundColor Gray
        Write-Host ""
        Write-Host "Do you want to reinstall? (Y/N)" -ForegroundColor Yellow
        $response = Read-Host
        if ($response -ne 'Y' -and $response -ne 'y') {
            Write-Host "Installation cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
} catch {
    Write-Host "FFmpeg not found. Starting installation..." -ForegroundColor Yellow
}

Write-Host ""

# Define paths
$ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$downloadPath = "$env:TEMP\ffmpeg-$timestamp.zip"
$extractPath = "$env:LOCALAPPDATA\ffmpeg"  # Install to user directory (no admin needed)

Write-Host "[1/5] Downloading FFmpeg..." -ForegroundColor Yellow
Write-Host "URL: $ffmpegUrl" -ForegroundColor Gray

try {
    # Download FFmpeg
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "SUCCESS - Downloaded to $downloadPath" -ForegroundColor Green
} catch {
    Write-Host "FAILED - Download failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/5] Extracting FFmpeg..." -ForegroundColor Yellow

try {
    # Remove old installation if exists
    if (Test-Path $extractPath) {
        Write-Host "Removing old installation..." -ForegroundColor Gray
        Remove-Item -Path $extractPath -Recurse -Force
    }

    # Extract the zip file
    Expand-Archive -Path $downloadPath -DestinationPath "$env:TEMP\ffmpeg-temp" -Force
    
    # Find the extracted folder (it has a version number in the name)
    $extractedFolder = Get-ChildItem -Path "$env:TEMP\ffmpeg-temp" -Directory | Select-Object -First 1
    
    # Move to C:\ffmpeg
    Move-Item -Path $extractedFolder.FullName -Destination $extractPath -Force
    
    Write-Host "SUCCESS - Extracted to $extractPath" -ForegroundColor Green
} catch {
    Write-Host "FAILED - Extraction failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[3/5] Adding FFmpeg to PATH..." -ForegroundColor Yellow

try {
    $ffmpegBinPath = "$extractPath\bin"

    # Get current user PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)

    # Check if already in PATH
    if ($currentPath -notlike "*$ffmpegBinPath*") {
        # Add to user PATH (no admin needed)
        $newPath = "$currentPath;$ffmpegBinPath"
        [Environment]::SetEnvironmentVariable("Path", $newPath, [System.EnvironmentVariableTarget]::User)

        # Also update current session PATH
        $env:Path += ";$ffmpegBinPath"

        Write-Host "SUCCESS - Added to user PATH" -ForegroundColor Green
    } else {
        Write-Host "Already in PATH" -ForegroundColor Gray
    }
} catch {
    Write-Host "FAILED - Could not update PATH: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/5] Cleaning up temporary files..." -ForegroundColor Yellow

try {
    Remove-Item -Path $downloadPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$env:TEMP\ffmpeg-temp" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "SUCCESS - Cleanup complete" -ForegroundColor Green
} catch {
    Write-Host "WARNING - Cleanup failed (not critical)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/5] Verifying installation..." -ForegroundColor Yellow

try {
    $version = ffmpeg -version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS - FFmpeg installed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Version Information:" -ForegroundColor Cyan
        Write-Host $version[0] -ForegroundColor Gray
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Installation Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "FFmpeg is now available at: $extractPath\bin" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Note: You may need to restart your terminal or IDE" -ForegroundColor Yellow
        Write-Host "      for the PATH changes to take effect." -ForegroundColor Yellow
    } else {
        throw "FFmpeg command failed"
    }
} catch {
    Write-Host "FAILED - Installation verification failed" -ForegroundColor Red
    Write-Host "Please restart your terminal and try running 'ffmpeg -version'" -ForegroundColor Yellow
    exit 1
}

