# 语音通话 API 集成文档

## 概述

99AI 提供完整的实时语音通话能力，支持：
- **实时语音识别（ASR）** - 将用户语音转为文字
- **AI 对话（LLM）** - 基于角色预设的智能回复
- **语音合成（TTS）** - 将 AI 回复转为语音播报
- **情绪识别** - 自动检测情绪并切换音色
- **好感度系统** - 根据用户互动调整角色行为

## 接口类型

### 1. WebSocket 实时语音通话（推荐）

**适用场景**：微信语音通话式的实时对话，支持随时打断

**WebSocket 地址**
```
ws://your-domain/api/realtime/voice-call
```

**连接流程**

#### 步骤1：建立 WebSocket 连接
```javascript
const ws = new WebSocket('ws://your-domain/api/realtime/voice-call');
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
  console.log('WebSocket 已连接');
  // 发送启动消息
  ws.send(JSON.stringify({
    type: 'start_call',
    sampleRate: 8000,        // 音频采样率
    format: 'pcm',           // 音频格式：pcm/wav
    voice_id: 'xxx',         // 使用的音色ID（可选）
    userId: 1,               // 用户ID（必填）
    appId: 10,               // 角色应用ID（必填）
    model: 'gpt-4o-mini',    // LLM模型（可选）
    modelName: '小助手',      // 模型名称（可选）
    prompt: '',              // 角色预设（可选，优先使用appId对应的预设）
    temperature: 1,          // 温度参数（可选）
    config: {}               // 扩展配置（可选）
  }));
};
```

#### 步骤2：发送音频数据

**连续录音模式**（推荐）
```javascript
// 开始录音
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
const processor = audioContext.createScriptProcessor(8192, 1, 1);

processor.onaudioprocess = (e) => {
  const inputData = e.inputBuffer.getChannelData(0);

  // 下采样到 8000Hz
  const downsampled = downsample(inputData, audioContext.sampleRate, 8000);

  // 转为 Int16 PCM
  const pcm16 = floatTo16BitPCM(downsampled);

  // 发送二进制音频数据
  ws.send(pcm16.buffer);
};

source.connect(processor);
processor.connect(audioContext.destination);

// VAD（语音活动检测）：检测到用户停止说话1.5秒后自动触发识别
// 可通过 RMS 值判断静音，自动发送 stop 消息

// 手动触发识别与回复
ws.send(JSON.stringify({ type: 'stop' }));
```

**按住说话模式**
```javascript
// 用户按下按钮时发送音频
// 用户松开按钮时发送 stop
ws.send(JSON.stringify({ type: 'stop' }));
```

#### 步骤3：接收服务端消息

```javascript
ws.onmessage = async (event) => {
  // 处理文本消息（JSON）
  if (typeof event.data === 'string') {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case 'call_started':
        // 通话已启动
        console.log('通话已启动', msg.sampleRate, msg.format);
        break;

      case 'asr.partial':
        // 实时语音识别（部分结果）
        console.log('语音识别中：', msg.text, msg.begin, msg.end);
        break;

      case 'asr.final':
        // 语音识别完成（最终结果）
        console.log('语音识别完成：', msg.text);
        break;

      case 'llm.start':
        // AI 开始生成回复
        console.log('AI 开始回复');
        break;

      case 'llm.partial':
        // AI 流式回复（部分内容）
        console.log('AI 回复中：', msg.text);
        break;

      case 'llm.final':
        // AI 回复完成（完整内容）
        console.log('AI 回复完成：', msg.text);
        break;

      case 'emotion.detected':
        // 检测到情绪（自动切换音色）
        console.log('检测到情绪：', msg.emotion);
        break;

      case 'tts.start':
        // 开始语音播报
        console.log('开始语音播报');
        break;

      case 'tts.info':
        // TTS 音频格式信息
        console.log('TTS 格式：', msg.format, msg.sample_rate);
        break;

      case 'tts.end':
        // 语音播报结束
        console.log('语音播报结束');
        break;

      case 'done':
        // 本轮对话完成
        console.log('本轮对话完成');
        break;

      case 'canceled':
        // 已取消当前操作
        console.log('操作已取消');
        break;

      case 'error':
        // 错误信息
        console.error('错误：', msg.stage, msg.message);
        // msg.stage 可能的值：'asr', 'llm', 'tts'
        break;

      case 'probe.resp':
        // 诊断信息（用于调试）
        console.log('诊断信息：', {
          sampleRate: msg.sampleRate,
          format: msg.format,
          recvBytesTotal: msg.recvBytesTotal,
          recvChunkCount: msg.recvChunkCount,
          bufferedChunks: msg.bufferedChunks,
          isProcessing: msg.isProcessing,
          ttsActive: msg.ttsActive,
          lastRms: msg.lastRms,
          lastRecvAt: msg.lastRecvAt
        });
        break;
    }
  }

  // 处理二进制消息（TTS 音频流）
  else if (event.data instanceof ArrayBuffer) {
    // 使用 MediaSource 实现边收边播
    appendAudioChunk(event.data);
  }
};
```

#### 步骤4：智能打断（可选）

```javascript
// 检测到用户开始说话时，立即取消当前播放
ws.send(JSON.stringify({ type: 'cancel' }));
```

#### 步骤5：发送诊断消息（可选）

```javascript
// 获取当前会话的诊断信息
ws.send(JSON.stringify({ type: 'probe' }));

// 服务端会返回 probe.resp 消息，包含：
// - 音频格式和采样率
// - 接收的音频字节数和块数
// - 缓冲的音频块数量
// - 是否正在处理
// - TTS 是否激活
// - 最后一次接收的音频 RMS 值
// - 最后一次接收时间
```

#### 步骤6：结束通话

```javascript
// 方式1：发送结束消息（推荐）
ws.send(JSON.stringify({ type: 'end_call' }));

// 方式2：直接关闭连接
ws.close();
```

---

### 2. HTTP 语音对话接口（简化版）

**适用场景**：一问一答式的语音对话，不需要实时交互

#### 接口：POST `/api/open/chat/chat-process-voice`

**请求示例**
```javascript
const response = await fetch('https://your-domain/api/open/chat/chat-process-voice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 1,                    // 必填：用户ID
    appId: 10,                    // 可选：角色应用ID
    audioUrl: 'https://...',      // 方式1：音频URL
    // audioBase64: 'data:audio/wav;base64,...', // 方式2：Base64音频
    model: 'gpt-4o-mini',         // 可选：指定模型
    modelName: '小助手',           // 可选：模型名称
    options: {}                   // 可选：对话选项
  })
});

// 流式响应
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  console.log('AI回复：', chunk);
}
```

**响应格式**
```json
{
  "code": 200,
  "data": {
    "text": "AI的回复内容"
  },
  "success": true
}
```

---

### 3. HTTP TTS 文字转语音接口

#### 接口：POST `/api/open/chat/tts-process`

**请求示例**
```javascript
const response = await fetch('https://your-domain/api/open/chat/tts-process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 1,                    // 必填：用户ID
    prompt: '你好，欢迎使用',      // 必填：要合成的文本
    chatId: 123                   // 可选：继续某个会话
  })
});

// 返回音频流
const audioBlob = await response.blob();
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();
```

---

## 辅助接口

### 1. 查询角色列表

**接口**：GET `/api/open/app/cats`

**请求示例**
```javascript
const response = await fetch('https://your-domain/api/open/app/cats?page=1&size=10');
const data = await response.json();

// 返回角色列表
console.log(data.data.rows);
```

**响应示例**
```json
{
  "code": 200,
  "data": {
    "rows": [
      {
        "id": 10,
        "name": "小助手",
        "des": "智能助手",
        "coverImg": "https://...",
        "voiceId": "cosyvoice-v2-xxx",
        "preset": "你是一个友好的AI助手...",
        "enableRealTime": true,
        "enableLongTermMemory": true
      }
    ],
    "count": 1
  }
}
```

### 2. 查询角色详情

**接口**：GET `/api/open/app/cats/:id`

```javascript
const response = await fetch('https://your-domain/api/open/app/cats/10');
const data = await response.json();

console.log(data.data); // 角色详细信息
```

### 3. 查询音色列表

**接口**：GET `/api/open/voice/list`

```javascript
const response = await fetch('https://your-domain/api/open/voice/list?page_index=1&page_size=10');
const data = await response.json();

console.log(data.data.voices); // 音色列表
```

### 4. 音色试听

**接口**：POST `/api/open/voice/preview`

```javascript
const response = await fetch('https://your-domain/api/open/voice/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    voice_id: 'cosyvoice-v2-xxx',
    text: '你好，这是试听',
    format: 'mp3'
  })
});

const data = await response.json();
console.log(data.data.audioUrl); // 音频URL
```

### 5. 语音识别（ASR）

**接口**：POST `/api/open/voice/asr`

```javascript
const response = await fetch('https://your-domain/api/open/voice/asr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    audioBase64: 'data:audio/wav;base64,...',
    format: 'wav',
    sample_rate: 16000
  })
});

const data = await response.json();
console.log(data.data.text); // 识别的文字
```

### 6. 查询好感度

**接口**：GET `/api/open/chat/affection/status`

```javascript
const response = await fetch('https://your-domain/api/open/chat/affection/status?userId=1&appId=10');
const data = await response.json();

console.log(data.data.score);      // 好感度分数
console.log(data.data.stage.name); // 当前阶段名称
```

---

## WebSocket 消息类型完整参考

### 客户端发送的消息

| 消息类型 | 说明 | 参数 |
|---------|------|------|
| `start_call` | 开始语音通话 | `sampleRate`, `format`, `voice_id`, `userId`, `appId`, `model`, `modelName`, `prompt`, `temperature`, `config` |
| `stop` | 结束本轮录音并触发识别 | 无 |
| `cancel` | 取消当前 LLM/TTS | 无 |
| `end_call` | 结束整个通话 | 无 |
| `probe` | 请求诊断信息 | 无 |
| 音频数据（二进制） | 实时音频流 | PCM/WAV 音频数据 |

### 服务端发送的消息

| 消息类型 | 说明 | 字段 |
|---------|------|------|
| `call_started` | 通话已启动 | `sampleRate`, `format` |
| `asr.partial` | 实时语音识别（部分） | `text`, `begin`, `end` |
| `asr.final` | 语音识别完成 | `text` |
| `llm.start` | AI 开始回复 | 无 |
| `llm.partial` | AI 流式回复（部分） | `text` |
| `llm.final` | AI 回复完成 | `text` |
| `emotion.detected` | 检测到情绪 | `emotion` |
| `tts.start` | 开始语音播报 | 无 |
| `tts.info` | TTS 格式信息 | `format`, `sample_rate` |
| `tts.end` | 语音播报结束 | 无 |
| `done` | 本轮对话完成 | 无 |
| `canceled` | 操作已取消 | 无 |
| `error` | 错误信息 | `stage`, `message` |
| `probe.resp` | 诊断信息响应 | `sampleRate`, `format`, `recvBytesTotal`, `recvChunkCount`, `bufferedChunks`, `isProcessing`, `ttsActive`, `lastRms`, `lastRecvAt` |
| 音频数据（二进制） | TTS 音频流 | MP3 音频数据 |

---

## 完整示例代码

### Vue 3 + TypeScript 示例

```typescript
import { ref, onUnmounted } from 'vue';

export function useVoiceCall(appId: number, userId: number) {
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const isRecording = ref(false);
  const asrText = ref('');
  const llmText = ref('');

  // 连接 WebSocket
  const connect = () => {
    ws.value = new WebSocket('ws://your-domain/api/realtime/voice-call');
    ws.value.binaryType = 'arraybuffer';

    ws.value.onopen = () => {
      isConnected.value = true;
      ws.value?.send(JSON.stringify({
        type: 'start_call',
        sampleRate: 8000,
        format: 'pcm',
        userId,
        appId
      }));
    };

    ws.value.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'asr.final') asrText.value = msg.text;
        if (msg.type === 'llm.partial') llmText.value += msg.text;
      } else {
        // 播放 TTS 音频
        playAudio(event.data);
      }
    };

    ws.value.onclose = () => {
      isConnected.value = false;
    };
  };

  // 开始录音
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // ... 录音逻辑（参见上面的代码）
    isRecording.value = true;
  };

  // 停止录音
  const stopRecording = () => {
    ws.value?.send(JSON.stringify({ type: 'stop' }));
    isRecording.value = false;
  };

  // 断开连接
  const disconnect = () => {
    ws.value?.close();
  };

  onUnmounted(() => {
    disconnect();
  });

  return {
    connect,
    disconnect,
    startRecording,
    stopRecording,
    isConnected,
    isRecording,
    asrText,
    llmText
  };
}
```

### React + TypeScript 示例

```typescript
import { useState, useEffect, useCallback } from 'react';

export function useVoiceCall(appId: number, userId: number) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [asrText, setAsrText] = useState('');
  const [llmText, setLlmText] = useState('');

  const connect = useCallback(() => {
    const socket = new WebSocket('ws://your-domain/api/realtime/voice-call');
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      setIsConnected(true);
      socket.send(JSON.stringify({
        type: 'start_call',
        sampleRate: 8000,
        format: 'pcm',
        userId,
        appId
      }));
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'asr.final') setAsrText(msg.text);
        if (msg.type === 'llm.partial') setLlmText(prev => prev + msg.text);
      }
    };

    socket.onclose = () => setIsConnected(false);

    setWs(socket);
  }, [appId, userId]);

  useEffect(() => {
    return () => ws?.close();
  }, [ws]);

  return { connect, ws, isConnected, asrText, llmText };
}
```

---

## 音频处理工具函数

### 下采样
```javascript
function downsample(buffer, inputSampleRate, outputSampleRate) {
  if (outputSampleRate === inputSampleRate) return buffer;

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.floor(buffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    result[offsetResult++] = buffer[Math.floor(offsetBuffer)];
    offsetBuffer += ratio;
  }

  return result;
}
```

### Float32 转 Int16 PCM
```javascript
function floatTo16BitPCM(float32Array) {
  const len = float32Array.length;
  const result = new Int16Array(len);

  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  return result;
}
```

### VAD（语音活动检测）
```javascript
function calculateRMS(pcm16Array) {
  let sumSq = 0;
  for (let i = 0; i < pcm16Array.length; i++) {
    sumSq += pcm16Array[i] * pcm16Array[i];
  }
  return Math.sqrt(sumSq / pcm16Array.length);
}

// 使用示例
const rms = calculateRMS(pcm16);
const isSpeaking = rms > 200;  // 阈值可调
const isSilent = rms < 100;
```

---

## 常见问题

### 1. WebSocket 连接失败

**问题**：无法建立 WebSocket 连接

**解决方案**：
- 检查服务器是否正确启动（默认端口 9520）
- 检查防火墙设置
- 使用 `wss://` (HTTPS) 或 `ws://` (HTTP) 协议
- 确认路径为 `/api/realtime/voice-call`

### 2. 音频无法识别

**问题**：发送音频后没有识别结果

**解决方案**：
- 确认音频格式正确（推荐 PCM 8000Hz）
- 检查音频数据不为空
- 查看服务端日志中的错误信息
- 确认 RMS 值不为 0（静音）

### 3. TTS 没有声音

**问题**：收到 TTS 数据但无法播放

**解决方案**：
- 使用 MediaSource API 实现边收边播
- 检查 MIME 类型设置正确（audio/mpeg）
- 确认 `voice_id` 已正确配置
- 查看浏览器控制台错误

### 4. 好感度不生效

**问题**：角色行为没有随好感度变化

**解决方案**：
- 确认 `appId` 和 `userId` 正确传入
- 检查后端是否配置了好感度规则
- 查看接口 `/api/open/chat/affection/status` 返回值

---

## API 限流与配额

当前开放接口**暂无鉴权**，生产环境建议：
1. 添加 API Key 认证
2. 设置 IP 限流
3. 配置请求配额
4. 启用日志审计

---

## 技术支持

- 文档问题：查看 [完整文档](https://docs.99ai.com)
- API 问题：提交 [GitHub Issue](https://github.com/your-repo/issues)
- 商业合作：联系 support@99ai.com

---

## 更新日志

### v1.0.0 (2025-01-21)
- ✅ 发布 WebSocket 实时语音通话接口
- ✅ 发布 HTTP 语音对话接口
- ✅ 支持情绪识别与多音色切换
- ✅ 集成好感度系统
- ✅ 支持 VAD 智能打断

---

## 开源协议

Apache 2.0 License - 允许商业使用，需保留版权声明
