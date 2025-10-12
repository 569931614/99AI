# ASR 模型名称修复（已更正）

## 问题
所有 Paraformer ASR 模型都报错 "Model not found"，原因是使用了错误的模型名称。

## 根本原因
代码中使用的模型名称与阿里云 DashScope API 的实际模型名称不匹配：

### 错误的模型名称（修复前）
- ❌ `paraformer-realtime-16k-v2` (此模型不存在)
- ❌ `paraformer-v1` (此模型不存在)
- ❌ `paraformer` (此模型不存在)

### 正确的模型名称（修复后）
根据阿里云 DashScope 2025 年最新模型列表：

- ✅ **paraformer-realtime-8k-v2** (8kHz 采样率，**推荐用于 8k 音频**)
- ✅ **paraformer-realtime-v2** (16kHz 采样率，**推荐用于 16k 音频**)
- ✅ `paraformer-realtime-v1` (旧版，16k 采样率)
- ✅ `paraformer-realtime-8k-v1` (旧版，8k 采样率)

**注意**：不存在 `paraformer-realtime-16k-v2` 这个模型名称！

## 修改的文件

### 1. service/src/modules/voice/voice.service.ts (第 655-670 行)
**修改**：更新模型候选列表，根据采样率智能选择
```typescript
// 修复前
const candidates = Array.from(new Set([
  requestedModel,
  'paraformer-realtime-16k-v2',  // ❌ 错误 - 此模型不存在
  'paraformer-realtime-v1',
  'paraformer-v1',                // ❌ 错误
  'paraformer',                   // ❌ 错误
]));

// 修复后
const candidates = Array.from(new Set([
  requestedModel,
  // 根据采样率智能选择模型
  sampleRate <= 8000 ? 'paraformer-realtime-8k-v2' : 'paraformer-realtime-v2',
  'paraformer-realtime-v2',       // ✅ 正确（16k）
  'paraformer-realtime-8k-v2',    // ✅ 正确（8k）
  'paraformer-realtime-v1',       // ✅ 正确（旧版16k）
  'paraformer-realtime-8k-v1',    // ✅ 正确（旧版8k）
]));
```

### 2. service/src/main.ts (第 349 行)
**修改**：使用 8k 模型（因为前端采样率是 8000 Hz）
```typescript
// 修复后
model: 'paraformer-realtime-8k-v2',  // ✅ 匹配 8kHz 采样率
```

### 3. service/src/modules/test/test.controller.ts (第 97 行)
**修改**：更新默认测试模型
```typescript
// 修复后
const model = body?.model || 'paraformer-realtime-8k-v2';  // ✅ 匹配 8kHz 采样率
```

## 关于采样率

### 当前配置
- 前端：8000 Hz
- 后端：动态（从前端接收）

### 官方建议
根据阿里云文档，`paraformer-realtime-v2` 支持：
- 8000 Hz (8k 采样率)
- 16000 Hz (16k 采样率，**推荐**）

### 优化建议
如果需要更好的识别效果，可以考虑将前端采样率提升到 16000 Hz：

**chat/src/views/chat/components/VoiceCall.vue (第 23 行)**
```typescript
// 当前
const sampleRate = 8000

// 推荐（可选优化）
const sampleRate = 16000  // 更好的识别效果
```

## 测试步骤

1. **重启服务**
   ```bash
   cd service
   pnpm dev
   ```

2. **测试语音识别**
   - 打开聊天界面
   - 点击语音通话按钮
   - 按住说话："你好，测试语音识别"
   - 松开按钮

3. **检查日志**
   应该看到类似：
   ```
   [DEBUG] ASR调用参数 (尝试 1/3): format=pcm, sampleRate=8000, audioSize=xxxxx
   [DEBUG] ASR服务调用成功
   [DEBUG] ASR识别结果: "你好，测试语音识别"
   ```

## 常见问题排查

### 问题 1：仍然报 "Model not found"
**原因**：可能 API Key 没有开通 Paraformer 实时识别服务

**解决方案**：
1. 登录阿里云控制台
2. 进入 DashScope 模型服务
3. 确认已开通 "Paraformer 实时语音识别" 服务
4. 文档：https://help.aliyun.com/zh/model-studio/getting-started/first-api-call-to-qwen

### 问题 2：识别效果不佳
**可能原因**：
- 采样率较低（8k）
- 环境噪音
- 音量过小

**优化方案**：
1. 提升采样率到 16k（见上方优化建议）
2. 在安静环境测试
3. 调整麦克风音量
4. 启用降噪功能（disfluency_removal_enabled: true）

### 问题 3：延迟较高
这已经在之前的修复中优化过，如果仍有延迟问题：

1. 检查网络连接速度
2. 确认使用最新的 `paraformer-realtime-v2` 模型
3. 查看服务器负载

## 相关文档

- [Paraformer 实时识别 WebSocket API](https://help.aliyun.com/zh/model-studio/websocket-for-paraformer-real-time-service)
- [DashScope 入门指南](https://help.aliyun.com/zh/model-studio/getting-started/first-api-call-to-qwen)
- [音频格式说明](https://help.aliyun.com/zh/model-studio/developer-reference/api-details-9)

## 更新日志

### 2025-10-01 01:30
- ✅ 修复 voice.service.ts 中的模型名称列表
- ✅ 修复 test.controller.ts 中的默认模型名称
- ✅ 添加详细注释说明正确的模型名称
- ✅ 更新文档和测试步骤
