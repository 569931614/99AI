# 语音对话完整流程测试指南

**日期**: 2025-10-01
**状态**: ASR 识别✅ | LLM 对话❓ | TTS 合成❓

---

## 🎯 当前状态

### ✅ 已完成
- **ASR 语音识别**: 完全工作，识别准确
- **WebSocket 连接**: 稳定可靠
- **模型配置**: 正确使用 `paraformer-realtime-8k-v2`

### ❓ 待测试
- **LLM 对话生成**: 需要确认配置
- **TTS 语音合成**: 需要确认 voice_id

---

## 📊 完整对话流程

```
用户说话
   ↓
1. 前端录音 (8000 Hz PCM)
   ↓
2. WebSocket 发送音频数据
   ↓
3. 【✅ 已工作】ASR 识别语音 → 文字
   "你好，请介绍一下自己"
   ↓
4. 【❓ 待确认】LLM 生成回复
   OpenAIChatService.chat()
   ↓
5. 【❓ 待确认】TTS 合成语音
   VoiceService.ttsStream()
   ↓
6. 前端播放语音
```

---

## 🔧 必需的配置

### 1. LLM 配置（数据库或环境变量）

需要在**系统配置**中设置以下参数：

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| `openaiBaseKey` | OpenAI API Key | `sk-xxxxx` |
| `openaiBaseUrl` | API 地址 | `https://api.openai.com/v1` |
| `openaiBaseModel` | 默认模型 | `gpt-4o-mini` 或 `gpt-3.5-turbo` |

**检查方法**：
1. 登录后台管理系统
2. 进入"系统配置" → "基础配置"
3. 查看或设置以上三项

### 2. TTS 音色配置

**方式 1: 应用级别配置（推荐）**
1. 进入"应用管理"
2. 编辑你要使用的应用/角色
3. 设置"音色 ID" (voiceId)
4. 示例：`cosyvoice-v2-ll-6a82f87c3e964b96afc85072c4331d66`

**方式 2: 前端手动输入**
- 在语音通话界面，手动输入 voice_id

**方式 3: 环境变量（仅作为后备）**
- `.env` 文件中的 `vedio_id` (已配置)

---

## 🧪 测试步骤

### 步骤 1: 验证 LLM 配置

```bash
# 检查数据库配置
# 登录后台 → 系统配置 → 查看 openaiBaseKey 是否已设置
```

**或使用 API 测试**：
```bash
curl http://localhost:9520/api/test/simple
```

### 步骤 2: 启动服务

```bash
cd service
pnpm dev
```

### 步骤 3: 测试完整对话

1. **打开聊天界面**
   - 访问 http://localhost:xxxx

2. **进入语音通话**
   - 点击语音通话图标
   - 等待连接成功（状态显示"已连接"）

3. **配置音色（如果需要）**
   - 在界面中输入 voice_id
   - 或确保应用已配置音色

4. **开始对话**
   - 点击"按住说话"
   - 清晰地说："你好，请介绍一下自己"
   - 松开按钮

5. **观察日志**
   观察服务端日志输出，应该看到：

```
[DEBUG] ASR识别结果: "你好，请介绍一下自己" (VoiceCall)
[DEBUG] 开始LLM处理 (VoiceCall)
[DEBUG] [LLM] <回复内容> (VoiceCall)
[LOG] [TTS] start (VoiceCall)
[LOG] [TTS] end (VoiceCall)
```

6. **检查前端**
   - 应该看到识别的文字
   - 应该看到 AI 的回复文字
   - 应该听到 AI 的语音回复

---

## 🔍 问题诊断

### 问题 1: LLM 没有响应

**症状**：
- ASR 识别成功
- 日志显示"开始LLM处理"
- 但没有后续输出或报错

**可能原因**：
1. ❌ 未配置 `openaiBaseKey`
2. ❌ API Key 无效或过期
3. ❌ `openaiBaseUrl` 配置错误
4. ❌ 网络无法访问 OpenAI API

**解决方法**：
1. 检查系统配置中的 LLM 相关配置
2. 测试 API Key 是否有效：
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```
3. 检查日志中的详细错误信息

### 问题 2: LLM 响应但没有语音

**症状**：
- ASR 识别成功 ✅
- LLM 生成回复 ✅
- 但没有听到语音播放

**可能原因**：
1. ❌ 未配置 voice_id
2. ❌ voice_id 无效
3. ❌ TTS 服务异常

**解决方法**：
1. 检查是否发送了 voice_id：
   - 查看日志是否有 `[TTS] start`
   - 如果没有，说明 voice_id 为空

2. 配置 voice_id：
   - 在前端界面输入
   - 或在应用管理中设置

3. 验证 voice_id 有效性：
   - 登录阿里云控制台
   - 检查音色是否已创建且状态为 SUCCESS

### 问题 3: TTS 调用失败

**症状**：
- 日志显示 `[TTS] start`
- 但随后报错

**可能原因**：
1. ❌ DashScope API Key 无效
2. ❌ 音色 ID 不存在
3. ❌ 账号余额不足

**解决方法**：
1. 确认使用的是同一个 API Key
2. 检查音色列表：登录后台 → 音色管理
3. 查看阿里云账号余额

---

## 📝 配置检查清单

### 环境变量 (.env)
```bash
✅ DASHSCOPE_API_KEY=sk-bdd1b48d01e442019d144f0ee01fb44d
✅ vedio_id=cosyvoice-v2-ll-6a82f87c3e964b96afc85072c4331d66
```

### 系统配置（数据库）
```
❓ openaiBaseKey = ?
❓ openaiBaseUrl = ?
❓ openaiBaseModel = ?
```

### 应用配置
```
❓ 当前应用的 voiceId = ?
```

---

## 🎯 预期日志输出（成功场景）

```
[DEBUG] WS client connected (VoiceCall)
[DEBUG] 收到音频数据: 2730 bytes, 累积: 1 块 (VoiceCall)
...
[DEBUG] 触发音频处理 (VoiceCall)
[LOG] WebSocket 已连接到 wss://dashscope.aliyuncs.com/... (VoiceService)
[DEBUG] 发送 run-task: model=paraformer-realtime-8k-v2... (VoiceService)
[DEBUG] 收到 WebSocket 消息: event=task-started (VoiceService)
[DEBUG] ASR识别结果: "你好，请介绍一下自己" (VoiceCall)
[DEBUG] 开始LLM处理 (VoiceCall)
[DEBUG] [LLM] 你好！ (VoiceCall)
[DEBUG] [LLM] 我是AI助手... (VoiceCall)
[LOG] [TTS] start (VoiceCall)
[LOG] [TTS] end (VoiceCall)
```

---

## 🚀 快速测试命令

### 测试 LLM 配置

创建测试接口或直接在代码中打印配置：

```typescript
// 临时测试代码（可选）
const testConfig = await this.globalConfigService.getConfigs([
  'openaiBaseKey',
  'openaiBaseUrl',
  'openaiBaseModel'
]);
console.log('LLM Config:', testConfig);
```

### 测试 TTS 配置

```bash
# 检查音色列表
curl http://localhost:9520/api/voice/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📚 相关代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| ASR 调用 | service/src/main.ts | 344-376 |
| LLM 调用 | service/src/main.ts | 402-448 |
| TTS 调用 | service/src/main.ts | 451-468 |
| OpenAIChatService | service/src/modules/aiTool/chat/chat.service.ts | 457+ |
| VoiceService.ttsStream | service/src/modules/voice/voice.service.ts | 916+ |

---

## ✅ 下一步

1. **检查配置**：
   - 登录后台查看 LLM 配置
   - 确认应用的 voice_id

2. **启动测试**：
   ```bash
   cd service
   pnpm dev
   ```

3. **测试对话**：
   - 按照上述步骤测试
   - 观察日志输出

4. **反馈结果**：
   - 如果 LLM 没响应，提供日志
   - 如果 TTS 没声音，提供日志
   - 如果全部正常，确认对话成功 🎉

---

**准备好后，请启动服务并测试，然后告诉我结果！**
