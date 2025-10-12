# Check Converted Audio File
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Checking Converted Audio File" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# The converted audio URL from the logs
$convertedUrl = "https://roleaudio.oss-cn-beijing.aliyuncs.com/dev/dev/others/1759926073189_ljyu.wav"

Write-Host "Converted Audio URL: $convertedUrl" -ForegroundColor Yellow
Write-Host ""

# Download the converted audio
$outputFile = "$env:TEMP\converted-audio.wav"
Write-Host "[1/2] Downloading converted audio..." -ForegroundColor Yellow

try {
    Invoke-WebRequest -Uri $convertedUrl -OutFile $outputFile -UseBasicParsing
    Write-Host "✓ Downloaded to: $outputFile" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to download: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/2] Analyzing audio file..." -ForegroundColor Yellow

# Use ffprobe to check audio properties
try {
    $ffprobeOutput = & ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=sample_rate,channels,codec_name -of default=noprint_wrappers=1 $outputFile 2>&1
    
    Write-Host "Audio Properties:" -ForegroundColor Cyan
    Write-Host $ffprobeOutput -ForegroundColor Gray
    
    # Check file size
    $fileInfo = Get-Item $outputFile
    Write-Host ""
    Write-Host "File Size: $($fileInfo.Length) bytes ($([math]::Round($fileInfo.Length/1KB, 2)) KB)" -ForegroundColor Cyan
    
    if ($fileInfo.Length -lt 1000) {
        Write-Host ""
        Write-Host "WARNING: File is very small, might be corrupted!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "✗ Failed to analyze: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "File location: $outputFile" -ForegroundColor Yellow
Write-Host "You can play this file to verify the audio content" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

