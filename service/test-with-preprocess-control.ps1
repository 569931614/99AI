# 声音复刻测试脚本 - 支持预处理控制
# 演示如何使用 enablePreprocess 参数

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Voice Cloning Test - Preprocess Control" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 配置
$apiUrl = "http://localhost:9520/api/open/voice/enroll"
$audioUrl = "https://maobingai.oss-cn-shanghai.aliyuncs.com/uploads/20251008/c4f63fabeea63993b0c780348ffe3fe6.wav"

# 生成唯一的 prefix（最多10个字符）
$timestamp = Get-Date -Format "HHmmss"
$prefixWithPreprocess = "pre$timestamp"
$prefixWithoutPreprocess = "raw$timestamp"

Write-Host "Audio URL: $audioUrl" -ForegroundColor Gray
Write-Host ""

# ========================================
# 测试 1: 启用预处理（默认行为）
# ========================================
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Test 1: WITH Audio Preprocessing" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Prefix: $prefixWithPreprocess" -ForegroundColor Gray
Write-Host "Enable Preprocess: true (default)" -ForegroundColor Gray
Write-Host ""

$requestBody1 = @{
    prefix = $prefixWithPreprocess
    url = $audioUrl
    name = "Test Voice (With Preprocessing)"
    targetModel = "cosyvoice-v2"
    enablePreprocess = $true  # 显式启用预处理
} | ConvertTo-Json

Write-Host "Sending request..." -ForegroundColor Cyan

try {
    $response1 = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $requestBody1 -ContentType "application/json"
    
    if ($response1.success) {
        Write-Host "SUCCESS - Voice enrollment initiated" -ForegroundColor Green
        Write-Host "Voice ID: $($response1.data.voice_id)" -ForegroundColor White
        Write-Host "Status: $($response1.data.status)" -ForegroundColor White
        $global:voiceId1 = $response1.data.voice_id
    } else {
        Write-Host "FAILED - Request failed" -ForegroundColor Red
        Write-Host "Error: $($response1.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "FAILED - Request failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.ErrorDetails) {
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "Details: $($errorDetails.message)" -ForegroundColor Red
        } catch {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Waiting 3 seconds before next test..." -ForegroundColor Gray
Start-Sleep -Seconds 3
Write-Host ""

# ========================================
# 测试 2: 禁用预处理
# ========================================
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Test 2: WITHOUT Audio Preprocessing" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Prefix: $prefixWithoutPreprocess" -ForegroundColor Gray
Write-Host "Enable Preprocess: false" -ForegroundColor Gray
Write-Host ""

$requestBody2 = @{
    prefix = $prefixWithoutPreprocess
    url = $audioUrl
    name = "Test Voice (Without Preprocessing)"
    targetModel = "cosyvoice-v2"
    enablePreprocess = $false  # 禁用预处理
} | ConvertTo-Json

Write-Host "Sending request..." -ForegroundColor Cyan

try {
    $response2 = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $requestBody2 -ContentType "application/json"
    
    if ($response2.success) {
        Write-Host "SUCCESS - Voice enrollment initiated" -ForegroundColor Green
        Write-Host "Voice ID: $($response2.data.voice_id)" -ForegroundColor White
        Write-Host "Status: $($response2.data.status)" -ForegroundColor White
        $global:voiceId2 = $response2.data.voice_id
    } else {
        Write-Host "FAILED - Request failed" -ForegroundColor Red
        Write-Host "Error: $($response2.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "FAILED - Request failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.ErrorDetails) {
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "Details: $($errorDetails.message)" -ForegroundColor Red
        } catch {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""

# ========================================
# 总结
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Test 1 (With Preprocessing):" -ForegroundColor Yellow
if ($global:voiceId1) {
    Write-Host "  Voice ID: $voiceId1" -ForegroundColor Green
    Write-Host "  Audio was preprocessed (16kHz, mono, max 10s)" -ForegroundColor White
} else {
    Write-Host "  Failed" -ForegroundColor Red
}

Write-Host ""

Write-Host "Test 2 (Without Preprocessing):" -ForegroundColor Yellow
if ($global:voiceId2) {
    Write-Host "  Voice ID: $voiceId2" -ForegroundColor Green
    Write-Host "  Original audio URL was used directly" -ForegroundColor White
} else {
    Write-Host "  Failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "TIP: Check service logs to see the difference in processing" -ForegroundColor Yellow
Write-Host "  - With preprocessing: You'll see FFmpeg conversion logs" -ForegroundColor Gray
Write-Host "  - Without preprocessing: Direct API call with original URL" -ForegroundColor Gray
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Check voice status: GET /api/open/voice/detail/:voiceId" -ForegroundColor White
Write-Host "  2. Compare the results of both tests" -ForegroundColor White
Write-Host "  3. Use the one that works better for your audio" -ForegroundColor White
Write-Host ""

