# 本地音频文件声音复刻测试脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Local Audio Voice Cloning Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 配置
$apiUrl = "http://localhost:9520/api/open/voice/enroll"
$localAudioPath = "test-audio.wav"

# 检查本地音频文件是否存在
if (-not (Test-Path $localAudioPath)) {
    Write-Host "ERROR: Local audio file not found: $localAudioPath" -ForegroundColor Red
    exit 1
}

# 获取音频文件信息
Write-Host "Local Audio File: $localAudioPath" -ForegroundColor Green
$audioFile = Get-Item $localAudioPath
Write-Host "File Size: $([math]::Round($audioFile.Length / 1KB, 2)) KB" -ForegroundColor White

# 检查 FFmpeg 是否可用
try {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "FFmpeg: Available" -ForegroundColor Green
    
    # 获取音频参数
    Write-Host ""
    Write-Host "Analyzing audio parameters..." -ForegroundColor Cyan
    $ffprobeOutput = ffprobe -v error -show_entries stream=sample_rate,channels,duration -of default=noprint_wrappers=1 $localAudioPath 2>&1
    
    $sampleRate = ($ffprobeOutput | Select-String "sample_rate=(\d+)").Matches.Groups[1].Value
    $channels = ($ffprobeOutput | Select-String "channels=(\d+)").Matches.Groups[1].Value
    $duration = ($ffprobeOutput | Select-String "duration=([\d.]+)").Matches.Groups[1].Value
    
    Write-Host "Original Audio Parameters:" -ForegroundColor Yellow
    if ($sampleRate) {
        Write-Host "  - Sample Rate: $sampleRate Hz" -ForegroundColor White
    }
    if ($channels) {
        Write-Host "  - Channels: $channels" -ForegroundColor White
    }
    if ($duration) {
        Write-Host "  - Duration: $([math]::Round([double]$duration, 2)) seconds" -ForegroundColor White
    }
} catch {
    Write-Host "FFmpeg: Not available" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting test..." -ForegroundColor Cyan
Write-Host ""

# 第一步：上传本地音频文件到服务器
Write-Host "[1/4] Uploading local audio file..." -ForegroundColor Cyan

try {
    # 使用 curl 上传文件
    $uploadUrl = "http://localhost:9520/api/upload/file"
    $curlCommand = "curl -X POST -F `"file=@$localAudioPath`" $uploadUrl"
    $uploadResult = Invoke-Expression $curlCommand | ConvertFrom-Json
    
    if ($uploadResult.success) {
        $audioUrl = $uploadResult.data
        Write-Host "SUCCESS - Audio uploaded" -ForegroundColor Green
        Write-Host "Audio URL: $audioUrl" -ForegroundColor Gray
    } else {
        Write-Host "FAILED - Upload failed" -ForegroundColor Red
        Write-Host "Error: $($uploadResult.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "FAILED - Upload failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 第二步：发送声音复刻请求
Write-Host "[2/4] Sending voice enrollment request..." -ForegroundColor Cyan

$prefix = "local$(Get-Date -Format 'HHmmss')"
$requestBody = @{
    prefix = $prefix
    url = $audioUrl
    name = "Local Audio Test Voice"
    targetModel = "cosyvoice-v2"
} | ConvertTo-Json

Write-Host "Request Parameters:" -ForegroundColor Gray
Write-Host $requestBody -ForegroundColor Gray
Write-Host ""

try {
    $enrollResponse = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $requestBody -ContentType "application/json"
    
    if ($enrollResponse.success) {
        $voiceId = $enrollResponse.data.voice_id
        Write-Host "SUCCESS - Voice enrollment initiated" -ForegroundColor Green
        Write-Host "Voice ID: $voiceId" -ForegroundColor Gray
    } else {
        Write-Host "FAILED - Request failed" -ForegroundColor Red
        Write-Host "Error: $($enrollResponse.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "FAILED - Request failed" -ForegroundColor Red
    try {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Error: $($errorDetails.message)" -ForegroundColor Red
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""

# 第三步：检查声音创建状态
Write-Host "[3/4] Checking voice creation status..." -ForegroundColor Cyan

Start-Sleep -Seconds 2

try {
    $statusUrl = "http://localhost:9520/api/open/voice/detail/$voiceId"
    $statusResponse = Invoke-RestMethod -Uri $statusUrl -Method Get
    
    if ($statusResponse.success) {
        $status = $statusResponse.data.status
        Write-Host "SUCCESS - Voice status: $status" -ForegroundColor Green
        
        if ($status -eq "CREATED") {
            Write-Host "Voice created successfully!" -ForegroundColor Green
        } elseif ($status -eq "PENDING") {
            Write-Host "Voice is being created, please wait..." -ForegroundColor Yellow
        } else {
            Write-Host "Voice status: $status" -ForegroundColor Yellow
        }
    } else {
        Write-Host "FAILED - Status check failed" -ForegroundColor Red
        Write-Host "Error: $($statusResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "FAILED - Status check failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""

# 第四步：查询声音详情
Write-Host "[4/4] Querying voice details..." -ForegroundColor Cyan

try {
    $detailResponse = Invoke-RestMethod -Uri $statusUrl -Method Get
    
    if ($detailResponse.success) {
        Write-Host "SUCCESS - Voice details retrieved" -ForegroundColor Green
        Write-Host ""
        Write-Host "Voice Details:" -ForegroundColor Cyan
        Write-Host "  Voice ID: $($detailResponse.data.voiceId)" -ForegroundColor White
        Write-Host "  Name: $($detailResponse.data.name)" -ForegroundColor White
        Write-Host "  Status: $($detailResponse.data.status)" -ForegroundColor White
        Write-Host "  Target Model: $($detailResponse.data.targetModel)" -ForegroundColor White
        Write-Host "  Created At: $($detailResponse.data.createdAt)" -ForegroundColor White
    } else {
        Write-Host "FAILED - Query failed" -ForegroundColor Red
        Write-Host "Error: $($detailResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "FAILED - Query failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST COMPLETED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "TIP: Check service logs for detailed preprocessing steps" -ForegroundColor Yellow
Write-Host ""

