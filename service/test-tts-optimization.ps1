# TTS 优化功能测试脚本
# 测试括号过滤和智能情绪识别功能

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TTS 优化功能测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 配置
$baseUrl = "http://localhost:9520"

# 获取认证 token
Write-Host "[提示] 请确保已经登录并获取了 JWT token" -ForegroundColor Yellow
$token = Read-Host "请输入您的 JWT token"

if (-not $token) {
    Write-Host "✗ 未提供 token，测试终止" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

Write-Host ""

# 测试用例
$testCases = @(
    @{
        name = "测试1: 基本括号过滤"
        prompt = "你好啊！（内心充满喜悦）今天天气真不错呢~"
        expectedEmotion = "happy"
        expectedText = "你好啊！今天天气真不错呢~"
    },
    @{
        name = "测试2: 中文方括号"
        prompt = "我明白了【点头】，那我们开始吧！"
        expectedEmotion = "calm"
        expectedText = "我明白了，那我们开始吧！"
    },
    @{
        name = "测试3: 情绪与对话不一致"
        prompt = "没关系的...（内心非常生气）我不在意。"
        expectedEmotion = "angry"
        expectedText = "没关系的...我不在意。"
    },
    @{
        name = "测试4: 多个括号"
        prompt = "真的吗？（惊讶）【睁大眼睛】这太不可思议了！"
        expectedEmotion = "happy"
        expectedText = "真的吗？这太不可思议了！"
    },
    @{
        name = "测试5: 花括号"
        prompt = "谢谢你！{开心地笑着}你真是太好了~"
        expectedEmotion = "happy"
        expectedText = "谢谢你！你真是太好了~"
    },
    @{
        name = "测试6: 悲伤情绪"
        prompt = "我...【哭泣】我真的很难过..."
        expectedEmotion = "sad"
        expectedText = "我...我真的很难过..."
    },
    @{
        name = "测试7: 温柔情绪"
        prompt = "别担心（温柔地抚摸头发），一切都会好起来的。"
        expectedEmotion = "gentle"
        expectedText = "别担心，一切都会好起来的。"
    }
)

Write-Host "开始测试 TTS 优化功能..." -ForegroundColor Green
Write-Host ""

# 注意：实际测试需要先创建一个聊天记录
Write-Host "[准备] 创建测试聊天记录..." -ForegroundColor Yellow

# 这里需要先调用聊天接口创建一条记录
# 为了简化，我们假设已经有一个 chatId
$chatId = Read-Host "请输入一个有效的 chatId（或按回车跳过实际API测试）"

if ($chatId) {
    Write-Host ""
    Write-Host "开始执行 API 测试..." -ForegroundColor Green
    Write-Host ""

    foreach ($test in $testCases) {
        Write-Host "----------------------------------------" -ForegroundColor Cyan
        Write-Host $test.name -ForegroundColor Cyan
        Write-Host "----------------------------------------" -ForegroundColor Cyan
        Write-Host "输入文本: $($test.prompt)" -ForegroundColor White
        Write-Host "预期情绪: $($test.expectedEmotion)" -ForegroundColor White
        Write-Host "预期朗读: $($test.expectedText)" -ForegroundColor White
        Write-Host ""

        $body = @{
            chatId = [int]$chatId
            prompt = $test.prompt
        } | ConvertTo-Json

        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/api/chat/tts" -Method Post -Headers $headers -Body $body
            Write-Host "✓ TTS 请求成功" -ForegroundColor Green
            Write-Host "  音频 URL: $($response.ttsUrl)" -ForegroundColor Gray
            Write-Host ""
        } catch {
            Write-Host "✗ TTS 请求失败: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
        }

        Start-Sleep -Seconds 1
    }
} else {
    Write-Host ""
    Write-Host "跳过 API 测试，仅展示测试用例..." -ForegroundColor Yellow
    Write-Host ""

    foreach ($test in $testCases) {
        Write-Host "----------------------------------------" -ForegroundColor Cyan
        Write-Host $test.name -ForegroundColor Cyan
        Write-Host "----------------------------------------" -ForegroundColor Cyan
        Write-Host "输入文本: $($test.prompt)" -ForegroundColor White
        Write-Host "预期情绪: $($test.expectedEmotion)" -ForegroundColor White
        Write-Host "预期朗读: $($test.expectedText)" -ForegroundColor White
        Write-Host ""
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  测试完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📝 功能说明：" -ForegroundColor Yellow
Write-Host "1. 括号内容过滤：TTS 会自动移除括号内的心理描述" -ForegroundColor White
Write-Host "2. 智能情绪识别：优先从括号内容识别情绪，选择合适音色" -ForegroundColor White
Write-Host "3. 支持的括号：()、（）、[]、【】、{}、「」、『』" -ForegroundColor White
Write-Host ""

Write-Host "🔍 查看日志：" -ForegroundColor Yellow
Write-Host "在服务端日志中可以看到详细的处理过程：" -ForegroundColor White
Write-Host "  - 提取的心理描述" -ForegroundColor Gray
Write-Host "  - 移除括号后的文本" -ForegroundColor Gray
Write-Host "  - 识别的情绪" -ForegroundColor Gray
Write-Host "  - 选择的音色" -ForegroundColor Gray
Write-Host ""

Write-Host "📚 详细文档：service/TTS-OPTIMIZATION-FEATURE.md" -ForegroundColor Yellow
Write-Host ""

