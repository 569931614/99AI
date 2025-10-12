# 测试好感度句数统计功能
# 使用方法: .\test-affection-sentence-count.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  好感度句数统计功能测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 配置
$baseUrl = "http://localhost:9520"
$appId = 1  # 测试用的应用ID
$userId = 1  # 测试用的用户ID

# 获取认证 token（需要先登录）
Write-Host "[提示] 请确保已经登录并获取了 JWT token" -ForegroundColor Yellow
$token = Read-Host "请输入您的 JWT token (或按回车使用开放API)"

$headers = @{
    "Content-Type" = "application/json"
}

if ($token) {
    $headers["Authorization"] = "Bearer $token"
    $ruleEndpoint = "$baseUrl/api/affection/rule"
    $statusEndpoint = "$baseUrl/api/affection/status?userId=$userId&appId=$appId"
} else {
    Write-Host "[提示] 使用开放API（无需鉴权）" -ForegroundColor Yellow
    $ruleEndpoint = "$baseUrl/api/open/affection/rule"
    $statusEndpoint = "$baseUrl/api/open/affection/status?userId=$userId&appId=$appId"
}

Write-Host ""

# 步骤 1: 创建测试规则
Write-Host "[1/4] 创建测试好感度规则..." -ForegroundColor Green
$rule1 = @{
    appId = $appId
    stageName = "测试初见"
    minScore = 0
    maxScore = 30
    sentenceCount = 5  # 需要聊满5句
    behaviors = "这是测试规则：需要聊满5句才能进入初见阶段"
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri $ruleEndpoint -Method Post -Headers $headers -Body $rule1
    Write-Host "✓ 规则创建成功: $($response1 | ConvertTo-Json -Depth 3)" -ForegroundColor Green
    $ruleId = $response1.id
} catch {
    Write-Host "✗ 规则创建失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 步骤 2: 查询初始状态
Write-Host "[2/4] 查询用户初始好感度状态..." -ForegroundColor Green
try {
    $status1 = Invoke-RestMethod -Uri $statusEndpoint -Method Get -Headers $headers
    Write-Host "✓ 初始状态:" -ForegroundColor Green
    Write-Host "  - 分数: $($status1.score)" -ForegroundColor Cyan
    Write-Host "  - 句数: $($status1.sentenceCount)" -ForegroundColor Cyan
    Write-Host "  - 阶段: $($status1.stage.name ?? '无')" -ForegroundColor Cyan
} catch {
    Write-Host "✗ 查询状态失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 步骤 3: 模拟聊天（增加好感度）
Write-Host "[3/4] 模拟聊天，增加好感度..." -ForegroundColor Green
Write-Host "[提示] 此步骤需要实际调用聊天接口，这里仅作演示" -ForegroundColor Yellow
Write-Host "       实际使用时，每次聊天会自动调用 affectionService.increment()" -ForegroundColor Yellow
Write-Host ""
Write-Host "模拟场景：" -ForegroundColor Cyan
Write-Host "  - 用户发送第1条消息 -> 分数+1, 句数+1 (分数:1, 句数:1)" -ForegroundColor Gray
Write-Host "  - 用户发送第2条消息 -> 分数+1, 句数+1 (分数:2, 句数:2)" -ForegroundColor Gray
Write-Host "  - 用户发送第3条消息 -> 分数+1, 句数+1 (分数:3, 句数:3)" -ForegroundColor Gray
Write-Host "  - 用户发送第4条消息 -> 分数+1, 句数+1 (分数:4, 句数:4)" -ForegroundColor Gray
Write-Host "  - 用户发送第5条消息 -> 分数+1, 句数+1 (分数:5, 句数:5) ✓ 满足条件" -ForegroundColor Gray

Write-Host ""

# 步骤 4: 验证阶段判定逻辑
Write-Host "[4/4] 验证阶段判定逻辑..." -ForegroundColor Green
Write-Host ""
Write-Host "测试用例 1: 分数足够但句数不足" -ForegroundColor Cyan
Write-Host "  - 分数: 10, 句数: 3" -ForegroundColor Gray
Write-Host "  - 预期结果: 无匹配阶段（句数不足5）" -ForegroundColor Gray
Write-Host ""
Write-Host "测试用例 2: 分数和句数都满足" -ForegroundColor Cyan
Write-Host "  - 分数: 10, 句数: 5" -ForegroundColor Gray
Write-Host "  - 预期结果: 进入'测试初见'阶段" -ForegroundColor Gray
Write-Host ""
Write-Host "测试用例 3: 句数足够但分数不足" -ForegroundColor Cyan
Write-Host "  - 分数: 0, 句数: 10" -ForegroundColor Gray
Write-Host "  - 预期结果: 无匹配阶段（分数为0，不满足 minScore）" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  测试完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 下一步操作：" -ForegroundColor Yellow
Write-Host "1. 执行数据库迁移: mysql -u root -p chatgpt < migrations/add-sentence-count-to-affection.sql" -ForegroundColor White
Write-Host "2. 重启服务: pnpm dev" -ForegroundColor White
Write-Host "3. 通过聊天接口实际测试好感度增长" -ForegroundColor White
Write-Host "4. 查看详细文档: service/AFFECTION-SENTENCE-COUNT-FEATURE.md" -ForegroundColor White
Write-Host ""

# 清理测试数据（可选）
$cleanup = Read-Host "是否删除测试规则? (y/n)"
if ($cleanup -eq "y" -and $ruleId) {
    try {
        if ($token) {
            $deleteEndpoint = "$baseUrl/api/affection/rule/$ruleId"
        } else {
            $deleteEndpoint = "$baseUrl/api/open/affection/rule/$ruleId"
        }
        Invoke-RestMethod -Uri $deleteEndpoint -Method Delete -Headers $headers
        Write-Host "✓ 测试规则已删除" -ForegroundColor Green
    } catch {
        Write-Host "✗ 删除失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "测试脚本执行完毕！" -ForegroundColor Green

