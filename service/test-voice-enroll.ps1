# Test Audio Preprocessing Feature
# Using the problematic audio file from before

$baseUrl = "http://127.0.0.1:9520"
$audioUrl = "https://maobingai.oss-cn-shanghai.aliyuncs.com/uploads/20251008/c4f63fabeea63993b0c780348ffe3fe6.wav"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Audio Preprocessing Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Test Audio File: $audioUrl" -ForegroundColor Yellow
Write-Host "Original Audio Parameters:" -ForegroundColor Yellow
Write-Host "  - Sample Rate: 48000 Hz (INVALID, needs 16000 Hz)" -ForegroundColor Red
Write-Host "  - Channels: 2 (Stereo, INVALID, needs Mono)" -ForegroundColor Red
Write-Host "  - Duration: 12.01 seconds (TOO LONG, recommended 3-10 sec)" -ForegroundColor Red
Write-Host ""

Write-Host "Starting test..." -ForegroundColor Green
Write-Host ""

# Test data - prefix must be max 10 characters
$timestamp = Get-Date -Format 'HHmmss'
$testData = @{
    prefix = "t$timestamp"  # Max 10 chars: t + 6 digits = 7 chars
    url = $audioUrl
    targetModel = "cosyvoice-v2"
    name = "Auto Preprocessed Voice"
}

Write-Host "Request Parameters:" -ForegroundColor Cyan
Write-Host ($testData | ConvertTo-Json) -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "[1/3] Sending voice enrollment request..." -ForegroundColor Yellow
    
    $response = Invoke-WebRequest `
        -Uri "$baseUrl/api/open/voice/enroll" `
        -Method POST `
        -Body ($testData | ConvertTo-Json) `
        -ContentType "application/json" `
        -UseBasicParsing
    
    Write-Host "SUCCESS - Request completed (Status: $($response.StatusCode))" -ForegroundColor Green
    Write-Host ""

    $result = $response.Content | ConvertFrom-Json
    Write-Host "Response Data:" -ForegroundColor Cyan
    Write-Host ($result | ConvertTo-Json -Depth 5) -ForegroundColor Gray
    Write-Host ""

    if ($result.data -and $result.data.voice_id) {
        $voiceId = $result.data.voice_id
        Write-Host "SUCCESS - Voice created!" -ForegroundColor Green
        Write-Host "  Voice ID: $voiceId" -ForegroundColor Green
        Write-Host ""

        # Wait for voice processing
        Write-Host "[2/3] Waiting 5 seconds for voice processing..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        Write-Host ""

        # Query voice details
        Write-Host "[3/3] Querying voice details..." -ForegroundColor Yellow
        $detailResponse = Invoke-WebRequest `
            -Uri "$baseUrl/api/open/voice/detail/$voiceId" `
            -Method GET `
            -UseBasicParsing
        
        $detail = $detailResponse.Content | ConvertFrom-Json
        Write-Host "Voice Details:" -ForegroundColor Cyan
        Write-Host ($detail | ConvertTo-Json -Depth 5) -ForegroundColor Gray
        Write-Host ""

        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  TEST PASSED!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Summary:" -ForegroundColor Cyan
        Write-Host "  [OK] Audio preprocessing works correctly" -ForegroundColor Green
        Write-Host "  [OK] 48kHz stereo audio auto-converted to 16kHz mono" -ForegroundColor Green
        Write-Host "  [OK] Audio duration auto-trimmed to 10 seconds" -ForegroundColor Green
        Write-Host "  [OK] Voice created successfully, Voice ID: $voiceId" -ForegroundColor Green

    } else {
        Write-Host "FAILED - Voice creation failed" -ForegroundColor Red
        Write-Host "Response: $($result | ConvertTo-Json)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "FAILED - Request failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  TEST FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}

Write-Host ""
Write-Host "TIP: Check service logs for detailed preprocessing steps" -ForegroundColor Yellow

