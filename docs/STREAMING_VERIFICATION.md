# 语音通话流式实现验证指南

**日期**: 2025-10-01
**状态**: 已修复，待测试验证

---

## 📊 修复内容总结

### 问题分析

**旧实现问题**：
- 每次LLM产生几个字就创建一个新的TTS WebSocket连接
- 每个连接只发送一次文本后立即关闭
- 导致大量短连接，音频播放不连贯

**修复方案**：
- 创建 `TTSStreamSession` 类：一次连接，多次发送文本
- LLM开始前建立持久TTS会话
- LLM每产生文本就通过 `sendText()` 流式发送
- LLM结束后调用 `finish()` 结束会话

---

## ✅ 当前流式实现状态

| 阶段 | 流式类型 | 实现方式 | 代码位置 |
|------|---------|---------|---------|
| **ASR** | 句子流式 | WebSocket duplex | voice.service.ts:479-704 |
| **LLM** | 文本流式 | SSE (Server-Sent Events) | chat.service.ts:781-938 |
| **TTS** | 真正流式 | WebSocket duplex (持久会话) | voice.service.ts:1021-1282 + main.ts:401-498 |

---

## 🔍 流式验证要点

### 1. ASR 阶段（语音识别）

**流式特征**：
- ✅ WebSocket 双向流式
- ✅ 音频数据实时传输（每块约85ms）
- ✅ 识别结果以句子为单位流式返回

**验证方式**：
```
[DEBUG] 收到音频数据: 2730 bytes, 累积: 1 块
[DEBUG] 收到音频数据: 2730 bytes, 累积: 2 块
...
[DEBUG] 触发音频处理
[DEBUG] ASR识别结果: "你好，请介绍一下自己"
```

**前端接收事件**：
- `type: 'asr.partial'` - 实时识别片段
- `type: 'asr.final'` - 完整识别结果

---

### 2. LLM 阶段（对话生成）

**流式特征**：
- ✅ SSE (Server-Sent Events) 流式传输
- ✅ `incrementalOutput: true` 启用增量输出
- ✅ 每个文本块立即回调

**验证方式**：
```
[DEBUG] 开始LLM处理
[DEBUG] [LLM] 你好
[DEBUG] [LLM] ！
[DEBUG] [LLM] 我是
[DEBUG] [LLM] AI助手
...
[LOG] [LLM.final] 完整回复
```

**前端接收事件**：
- `type: 'llm.start'` - LLM开始
- `type: 'llm.partial'` - 实时文本片段
- `type: 'llm.final'` - 完整回复

---

### 3. TTS 阶段（语音合成）⭐ **关键修复**

**流式特征**：
- ✅ **一次连接，多次发送文本**
- ✅ LLM每产生文本立即发送给TTS
- ✅ 音频数据实时流式返回

**验证方式**（后端日志）：
```
[DEBUG] 创建流式TTS会话 (VoiceCall)
[DEBUG] TTS会话已连接: taskId=xxx (TTSStreamSession)
[DEBUG] TTS任务已启动: taskId=xxx (TTSStreamSession)
[DEBUG] TTS会话已启动 (VoiceCall)

# LLM每产生文本，就通过同一连接发送
[DEBUG] TTS发送文本 (3字): "你好" (TTSStreamSession)
[DEBUG] TTS发送文本 (2字): "！" (TTSStreamSession)
[DEBUG] TTS发送文本 (4字): "我是AI" (TTSStreamSession)
...

[DEBUG] 结束TTS会话 (VoiceCall)
[DEBUG] TTS发送结束信号: taskId=xxx (TTSStreamSession)
[DEBUG] TTS任务已完成: taskId=xxx (TTSStreamSession)
[DEBUG] TTS会话已关闭: taskId=xxx (TTSStreamSession)
```

**前端接收事件**：
- `type: 'tts.start'` - TTS开始（只触发一次）
- `二进制音频数据` - 实时音频流
- `type: 'tts.end'` - TTS结束（只触发一次）

**关键差异**（修复前 vs 修复后）：

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| WebSocket连接数 | 每个文本片段一个连接（~50+个） | 一个连接 |
| `tts.start` 触发次数 | ~50次 | 1次 |
| `tts.end` 触发次数 | ~50次 | 1次 |
| 音频连贯性 | 多个独立片段 | 连续流式音频 |

---

## 🧪 测试步骤

### 步骤 1: 启动服务

```bash
cd service
pnpm dev
```

### 步骤 2: 打开前端语音通话界面

1. 访问聊天界面
2. 点击语音通话图标
3. 确认连接成功（状态显示"已连接"）
4. 确保已配置 `voice_id`

### 步骤 3: 测试完整对话流程

**测试输入**：说一段较长的句子
```
"你好，请介绍一下自己，包括你的能力和特点"
```

**预期观察**：

#### 前端界面
1. **ASR阶段**：
   - 日志显示: `[ASR] 你好，请介绍...`
   - 日志显示: `[ASR.final] 你好，请介绍一下自己，包括你的能力和特点`

2. **LLM阶段**：
   - 日志显示多行: `[LLM] 你好` `[LLM] ！` `[LLM] 我是` ...
   - 文字逐字显示（流式效果）
   - 日志显示: `[LLM.final] <完整回复>`

3. **TTS阶段**：
   - 日志显示: `[TTS] start` **（只出现1次）**
   - 音频控件开始播放
   - 日志显示: `[TTS] end` **（只出现1次）**

#### 后端日志
```
[DEBUG] ASR识别结果: "你好，请介绍一下自己，包括你的能力和特点"
[DEBUG] 开始LLM处理
[DEBUG] 创建流式TTS会话
[DEBUG] TTS会话已连接: taskId=xxxxxxxx
[DEBUG] TTS任务已启动: taskId=xxxxxxxx
[DEBUG] TTS会话已启动
[DEBUG] 星尘SSE请求 - Payload: {...}

# LLM和TTS同步进行（流式）
[DEBUG] TTS发送文本 (3字): "你好"
[DEBUG] TTS发送文本 (2字): "！"
[DEBUG] TTS发送文本 (4字): "我是AI"
...

[DEBUG] 结束TTS会话
[DEBUG] TTS发送结束信号: taskId=xxxxxxxx
[DEBUG] TTS任务已完成: taskId=xxxxxxxx
[DEBUG] TTS会话已关闭: taskId=xxxxxxxx
```

---

## 🎯 验证标准

### ✅ 成功标准

1. **ASR流式**：
   - 音频数据实时发送
   - 识别结果及时返回

2. **LLM流式**：
   - 文字逐个字/词显示
   - 无明显卡顿

3. **TTS真正流式**（关键验证点）：
   - ✅ 前端日志 `[TTS] start` **只出现1次**
   - ✅ 前端日志 `[TTS] end` **只出现1次**
   - ✅ 后端日志显示多次 `TTS发送文本` 但**使用同一个 taskId**
   - ✅ 音频播放连贯，无中断
   - ✅ LLM说话同时就能听到声音（延迟<1秒）

### ❌ 失败标准（旧实现特征）

如果看到以下情况，说明流式TTS实现有问题：
- ❌ 前端日志 `[TTS] start` 出现**多次**
- ❌ 前端日志 `[TTS] end` 出现**多次**
- ❌ 后端日志每次 `TTS发送文本` 都有**不同的 taskId**
- ❌ 音频播放有明显间断或多个短片段
- ❌ 需要等LLM完全说完才开始播放音频

---

## 🔧 代码修改位置

### 1. voice.service.ts

**新增**:
- `createTTSStreamSession()` 方法 (line 1021-1092)
- `TTSStreamSession` 类 (line 1096-1282)

**保留**:
- `ttsStream()` 方法标记为 `@deprecated`

### 2. main.ts

**修改**:
- `processLLMStream()` 函数 (line 401-498)
  - 移除 `processTTSStream()` 函数
  - LLM开始前创建 `TTSStreamSession`
  - `onProgress` 中调用 `ttsSession.sendText(t)`
  - LLM结束后调用 `ttsSession.finish()`

---

## 📝 技术细节

### CosyVoice WebSocket 流式协议

**正确的流式使用**：
```javascript
// 1. 建立连接
ws.connect()

// 2. 发送 run-task
ws.send({ action: 'run-task', ... })

// 3. 等待 task-started
ws.on('message', (msg) => {
  if (msg.event === 'task-started') {
    // 4. 多次发送 continue-task（流式关键）
    ws.send({ action: 'continue-task', text: '第一段' })
    ws.send({ action: 'continue-task', text: '第二段' })
    ws.send({ action: 'continue-task', text: '第三段' })
    // ...

    // 5. 最后发送 finish-task
    ws.send({ action: 'finish-task' })
  }
})

// 6. 实时接收音频
ws.on('message', (data, isBinary) => {
  if (isBinary) {
    // 音频数据，边收边播
  }
})
```

**错误的使用**（旧实现）：
```javascript
// ❌ 每个文本片段都创建新连接
for (const text of textChunks) {
  const ws = new WebSocket(...)
  ws.send({ action: 'run-task', ... })
  ws.send({ action: 'continue-task', text })
  ws.send({ action: 'finish-task' })  // 立即结束
  ws.close()
}
```

---

## 🚀 下一步

1. **测试验证**：按照上述步骤测试完整对话流程
2. **性能监控**：观察WebSocket连接数和音频播放延迟
3. **用户体验**：确认音频播放连贯性
4. **错误处理**：测试取消、网络中断等异常情况

---

**准备好后，请启动服务并测试，然后反馈结果！**

特别注意观察：
- 前端日志中 `[TTS] start` 和 `[TTS] end` 的出现次数
- 后端日志中是否只有一个 TTS taskId
- 音频播放是否连贯流畅
