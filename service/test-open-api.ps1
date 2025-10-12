# 99AI 对外接口测试脚本
$ErrorActionPreference = "Continue"
$baseUrl = "http://127.0.0.1:9520/api/open"
$testUserId = 1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  99AI 对外接口测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$totalTests = 0
$passedTests = 0
$failedTests = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url
    )
    
    $script:totalTests++
    Write-Host "[$script:totalTests] $Name" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✓ 成功" -ForegroundColor Green
            $script:passedTests++
            return $true
        }
    }
    catch {
        Write-Host "  ✗ 失败: $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return $false
    }
    Write-Host ""
}

function Test-PostEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [object]$Body
    )
    
    $script:totalTests++
    Write-Host "[$script:totalTests] $Name" -ForegroundColor Yellow
    
    try {
        $jsonBody = $Body | ConvertTo-Json -Depth 10
        $response = Invoke-WebRequest -Uri $Url -Method POST -Body $jsonBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201) {
            Write-Host "  ✓ 成功" -ForegroundColor Green
            $script:passedTests++
            return $true
        }
    }
    catch {
        Write-Host "  ✗ 失败: $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return $false
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Voice 音色接口测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Test-Endpoint -Name "查询音色列表" -Url "$baseUrl/voice/list?page_index=1`&page_size=10"
Test-PostEndpoint -Name "同步PENDING状态音色" -Url "$baseUrl/voice/sync-pending-status" -Body @{}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "2. App 角色接口测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Test-Endpoint -Name "查询角色列表" -Url "$baseUrl/app/list?page=1`&size=10"
Test-Endpoint -Name "查询角色分类" -Url "$baseUrl/app/cats?page=1`&size=10"
Test-Endpoint -Name "获取全局情绪配置" -Url "$baseUrl/app/emotions"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "3. Affection 好感度接口测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Test-Endpoint -Name "查询好感度规则" -Url "$baseUrl/affection/rules"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "4. ChatLog 聊天记录接口测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Test-Endpoint -Name "查询聊天记录列表" -Url "$baseUrl/chatLog/chatList?userId=$testUserId"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  测试总结" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "总测试数: $totalTests" -ForegroundColor White
Write-Host "通过: $passedTests" -ForegroundColor Green
Write-Host "失败: $failedTests" -ForegroundColor Red
Write-Host ""

if ($failedTests -gt 0) {
    Write-Host "部分接口测试失败，请检查服务状态" -ForegroundColor Red
    exit 1
} else {
    Write-Host "所有接口测试通过！" -ForegroundColor Green
    exit 0
}

