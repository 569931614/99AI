# Audio File Checker
$audioUrl = "https://maobingai.oss-cn-shanghai.aliyuncs.com/uploads/20251008/c4f63fabeea63993b0c780348ffe3fe6.wav"

Write-Host "Downloading audio file..." -ForegroundColor Cyan
try {
    $tempFile = "$env:TEMP\test-audio.wav"
    Invoke-WebRequest -Uri $audioUrl -OutFile $tempFile -UseBasicParsing

    $fileInfo = Get-Item $tempFile
    Write-Host "`nFile Info:" -ForegroundColor Green
    Write-Host "  Size: $($fileInfo.Length) bytes ($([math]::Round($fileInfo.Length/1KB, 2)) KB)"
    Write-Host "  Path: $tempFile"

    # Read WAV header
    $bytes = [System.IO.File]::ReadAllBytes($tempFile)

    if ($bytes.Length -lt 44) {
        Write-Host "`nError: File too small, not a valid WAV file" -ForegroundColor Red
        exit
    }

    # Check RIFF header
    $riff = [System.Text.Encoding]::ASCII.GetString($bytes[0..3])
    $wave = [System.Text.Encoding]::ASCII.GetString($bytes[8..11])

    if ($riff -ne "RIFF" -or $wave -ne "WAVE") {
        Write-Host "`nError: Not a valid WAV file" -ForegroundColor Red
        Write-Host "  RIFF: $riff (should be RIFF)" -ForegroundColor Yellow
        Write-Host "  WAVE: $wave (should be WAVE)" -ForegroundColor Yellow
        exit
    }

    # Read audio parameters
    $audioFormat = [BitConverter]::ToUInt16($bytes, 20)
    $numChannels = [BitConverter]::ToUInt16($bytes, 22)
    $sampleRate = [BitConverter]::ToUInt32($bytes, 24)
    $bitsPerSample = [BitConverter]::ToUInt16($bytes, 34)

    Write-Host "`nWAV Parameters:" -ForegroundColor Green
    Write-Host "  Format: $audioFormat (1=PCM)"
    Write-Host "  Channels: $numChannels"
    Write-Host "  Sample Rate: $sampleRate Hz"
    Write-Host "  Bit Depth: $bitsPerSample bits"

    # Calculate duration
    $dataSize = $fileInfo.Length - 44
    $duration = $dataSize / ($sampleRate * $numChannels * ($bitsPerSample / 8))
    Write-Host "  Duration: $([math]::Round($duration, 2)) seconds"

    # Check requirements
    Write-Host "`nAliyun CosyVoice Requirements:" -ForegroundColor Cyan

    $issues = @()

    if ($sampleRate -ne 16000) {
        $issues += "  [X] Sample rate should be 16000 Hz, current: $sampleRate Hz"
    } else {
        Write-Host "  [OK] Sample Rate: 16000 Hz" -ForegroundColor Green
    }

    if ($duration -lt 3) {
        $issues += "  [X] Duration should be at least 3 seconds, current: $([math]::Round($duration, 2)) seconds"
    } elseif ($duration -gt 10) {
        $issues += "  [!] Duration recommended under 10 seconds, current: $([math]::Round($duration, 2)) seconds"
    } else {
        Write-Host "  [OK] Duration: $([math]::Round($duration, 2)) seconds (3-10s)" -ForegroundColor Green
    }

    if ($audioFormat -ne 1) {
        $issues += "  [X] Format should be PCM (1), current: $audioFormat"
    } else {
        Write-Host "  [OK] Format: PCM" -ForegroundColor Green
    }

    if ($numChannels -ne 1) {
        $issues += "  [!] Mono recommended, current: $numChannels channels"
    } else {
        Write-Host "  [OK] Channels: Mono" -ForegroundColor Green
    }

    if ($issues.Count -gt 0) {
        Write-Host "`nIssues Found:" -ForegroundColor Red
        $issues | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
        Write-Host "`nSuggestion: Convert audio to:" -ForegroundColor Cyan
        Write-Host "  - Format: WAV (PCM)"
        Write-Host "  - Sample Rate: 16000 Hz"
        Write-Host "  - Channels: Mono"
        Write-Host "  - Duration: 3-10 seconds"
        Write-Host "  - Content: Clear voice, no background noise"
    } else {
        Write-Host "`n[OK] Audio file meets basic requirements" -ForegroundColor Green
        Write-Host "`nIf still getting 'silent audio error', possible reasons:" -ForegroundColor Yellow
        Write-Host "  1. Audio quality issues (too much noise, volume too low)"
        Write-Host "  2. Too many silent segments"
        Write-Host "  3. Not clear human voice"
        Write-Host "  4. Unsupported encoding"
    }

    Write-Host "`nAudio saved to: $tempFile" -ForegroundColor Cyan
    Write-Host "You can play this file to verify the content." -ForegroundColor Cyan

} catch {
    Write-Host "`nError: $_" -ForegroundColor Red
}

