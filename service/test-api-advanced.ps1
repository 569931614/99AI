# 99AI Open API Advanced Test Script
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
            return ($r.Content | ConvertFrom-Json)
        }
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $null
    }
}

function Test-Post {
    param([string]$Name, [string]$Url, [hashtable]$Body)
    $script:total++
    Write-Host "[$script:total] Testing: $Name" -ForegroundColor Yellow
    try {
        $json = $Body | ConvertTo-Json -Depth 10
        $r = Invoke-WebRequest -Uri $Url -Method POST -Body $json -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 201) {
            Write-Host "  PASS" -ForegroundColor Green
            $script:passed++
            return ($r.Content | ConvertFrom-Json)
        }
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $null
    }
}

function Test-Delete {
    param([string]$Name, [string]$Url)
    $script:total++
    Write-Host "[$script:total] Testing: $Name" -ForegroundColor Yellow
    try {
        $r = Invoke-WebRequest -Uri $Url -Method DELETE -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 204) {
            Write-Host "  PASS" -ForegroundColor Green
            $script:passed++
            return $true
        }
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

Write-Host "`n========== App Category CRUD Test ==========" -ForegroundColor Cyan

# Create category
$catData = Test-Post "Create App Category" "$baseUrl/app/createAppCats" @{
    name = "Test Category $(Get-Date -Format 'HHmmss')"
}

if ($catData -and $catData.data -and $catData.data.id) {
    $catId = $catData.data.id
    Write-Host "  Created category ID: $catId" -ForegroundColor Gray
    
    # Update category
    Test-Post "Update App Category" "$baseUrl/app/updateAppCats" @{
        id = $catId
        name = "Updated Test Category"
    }
    
    # Delete category
    Test-Delete "Delete App Category" "$baseUrl/app/delAppCats/$catId"
} else {
    Write-Host "  Skipping update/delete tests (create failed)" -ForegroundColor Yellow
}

Write-Host "`n========== App CRUD Test ==========" -ForegroundColor Cyan

# Get first category for app creation
$cats = Test-Get "Get Categories for App" "$baseUrl/app/cats?page=1&size=1"
if ($cats -and $cats.data -and $cats.data.rows -and $cats.data.rows.Count -gt 0) {
    $firstCatId = $cats.data.rows[0].id
    
    # Create app
    $appData = Test-Post "Create App" "$baseUrl/app/createApp" @{
        name = "Test App $(Get-Date -Format 'HHmmss')"
        catId = "$firstCatId"
        preset = "This is a test app"
    }
    
    if ($appData -and $appData.data -and $appData.data.id) {
        $appId = $appData.data.id
        Write-Host "  Created app ID: $appId" -ForegroundColor Gray
        
        # Update app
        Test-Post "Update App" "$baseUrl/app/updateApp" @{
            id = $appId
            name = "Updated Test App"
            preset = "Updated preset"
        }
        
        # Get app detail
        Test-Get "Get App Detail" "$baseUrl/app/detail/$appId"
        
        # Delete app
        Test-Delete "Delete App" "$baseUrl/app/delApp/$appId"
    }
}

Write-Host "`n========== Affection Rule Test ==========" -ForegroundColor Cyan

# Create affection rule
$ruleData = Test-Post "Create Affection Rule" "$baseUrl/affection/rule" @{
    stageName = "Test Stage"
    minScore = 0
    maxScore = 50
    behaviors = "Test behaviors"
}

if ($ruleData -and $ruleData.data -and $ruleData.data.id) {
    $ruleId = $ruleData.data.id
    Write-Host "  Created rule ID: $ruleId" -ForegroundColor Gray
    
    # Delete rule
    Test-Delete "Delete Affection Rule" "$baseUrl/affection/rule/$ruleId"
}

Write-Host "`n========== Voice Params Test ==========" -ForegroundColor Cyan

# Get first voice
$voices = Test-Get "Get Voices for Params Test" "$baseUrl/voice/list?page_index=1&page_size=1"
if ($voices -and $voices.data -and $voices.data.rows -and $voices.data.rows.Count -gt 0) {
    $voiceId = $voices.data.rows[0].voice_id
    Write-Host "  Using voice ID: $voiceId" -ForegroundColor Gray
    
    # Get voice params
    Test-Get "Get Voice Params" "$baseUrl/voice/params/$voiceId"
    
    # Set voice params
    Test-Post "Set Voice Params" "$baseUrl/voice/params" @{
        voice_id = $voiceId
        params = @{
            rate = 1.0
            pitch = 1.0
            volume = 50
        }
    }
    
    # Get voice meta
    Test-Get "Get Voice Meta" "$baseUrl/voice/meta/$voiceId"
    
    # Set voice meta
    Test-Post "Set Voice Meta" "$baseUrl/voice/meta" @{
        voice_id = $voiceId
        meta = @{
            name = "Test Voice Name"
        }
    }
}

Write-Host "`n========== Summary ==========" -ForegroundColor Cyan
Write-Host "Total: $total | Passed: $passed | Failed: $failed"

if ($failed -gt 0) { 
    Write-Host "`nSome tests failed. Please check the errors above." -ForegroundColor Red
    exit 1 
} else { 
    Write-Host "`nAll tests passed!" -ForegroundColor Green
    exit 0 
}

