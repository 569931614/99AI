# 99AI Open API Test Script
$baseUrl = "http://127.0.0.1:9520/api/open"
$userId = 1

$passed = 0
$failed = 0
$total = 0

function Test-Get {
    param([string]$Name, [string]$Url)
    $script:total++
    Write-Host "[$script:total] Testing: $Name" -ForegroundColor Yellow
    try {
        $r = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200) {
            Write-Host "  PASS" -ForegroundColor Green
            $script:passed++
        }
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

function Test-Post {
    param([string]$Name, [string]$Url, [hashtable]$Body)
    $script:total++
    Write-Host "[$script:total] Testing: $Name" -ForegroundColor Yellow
    try {
        $json = $Body | ConvertTo-Json
        $r = Invoke-WebRequest -Uri $Url -Method POST -Body $json -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 201) {
            Write-Host "  PASS" -ForegroundColor Green
            $script:passed++
        }
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "`n========== Voice API ==========" -ForegroundColor Cyan
Test-Get "Voice List" "$baseUrl/voice/list?page_index=1&page_size=10"
Test-Post "Sync Pending" "$baseUrl/voice/sync-pending-status" @{}

Write-Host "`n========== App API ==========" -ForegroundColor Cyan
Test-Get "App List" "$baseUrl/app/list?page=1&size=10"
Test-Get "App Categories" "$baseUrl/app/cats?page=1&size=10"
Test-Get "Global Emotions" "$baseUrl/app/emotions"

Write-Host "`n========== Affection API ==========" -ForegroundColor Cyan
Test-Get "Affection Rules" "$baseUrl/affection/rules"

Write-Host "`n========== ChatLog API ==========" -ForegroundColor Cyan
Test-Get "Chat List" "$baseUrl/chatLog/chatList?userId=$userId"

Write-Host "`n========== Summary ==========" -ForegroundColor Cyan
Write-Host "Total: $total | Passed: $passed | Failed: $failed"

if ($failed -gt 0) { exit 1 } else { exit 0 }

