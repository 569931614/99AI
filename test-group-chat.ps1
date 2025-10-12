# 测试群聊功能
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJ0ZXN0IiwicGxhdGZvcm0iOiJvZmZpY2lhbCIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzM4NTg4NzY5LCJleHAiOjE3Mzg2NzUxNjl9.xxx"  # 需要替换为真实token

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    model = "gpt-4o-mini"
    modelName = "秦彻"
    modelType = 1
    prompt = "测试消息"
    imageUrl = ""
    fileUrl = ""
    appId = 4
    groupId = 87
    options = @{
        appId = 4
    }
    usingPluginId = 0
    modelAvatar = ""
} | ConvertTo-Json

Write-Host "发送群聊测试请求..."
Write-Host "Body: $body"

try {
    $response = Invoke-WebRequest -Uri "http://localhost:9520/api/chatgpt/chat-process" -Method POST -Headers $headers -Body $body -UseBasicParsing
    Write-Host "响应状态: $($response.StatusCode)"
    Write-Host "响应内容: $($response.Content)"
} catch {
    Write-Host "请求失败: $_"
    Write-Host "错误详情: $($_.Exception.Message)"
}

