# 99AI 开放接口概览

## 🎯 快速导航

| 功能 | 文档 | 适用场景 |
|------|------|---------|
| 📖 **接口参数参考** | [完整参数文档](./OPEN_API_REFERENCE.md) | 所有接口的详细参数、示例、类型定义 |
| 🎙️ **语音通话** | [完整文档](./VOICE_CALL_API.md) \| [快速开始](./VOICE_CALL_QUICK_START.md) \| [参数参考](./OPEN_API_REFERENCE.md#websocket-实时语音通话) | 实时语音对话、智能客服、语音助手 |
| 💬 **文字对话** | [参数参考](./OPEN_API_REFERENCE.md#文字对话接口) \| [Swagger UI](/open-api-docs) | 聊天机器人、AI 助手、问答系统 |
| 🎭 **角色管理** | [参数参考](./OPEN_API_REFERENCE.md#角色管理接口) \| [Swagger UI](/open-api-docs) | 创建/管理对话角色、配置角色属性 |
| 🔊 **音色管理** | [参数参考](./OPEN_API_REFERENCE.md#音色管理接口) \| [Swagger UI](/open-api-docs) | 声音复刻、TTS、语音合成 |
| ❤️ **好感度系统** | [参数参考](./OPEN_API_REFERENCE.md#好感度系统接口) \| [Swagger UI](/open-api-docs) | 角色扮演、互动养成 |
| 📝 **聊天记录** | [参数参考](./OPEN_API_REFERENCE.md#聊天记录接口) \| [Swagger UI](/open-api-docs) | 查询对话历史、导出记录 |

---

## 🚀 5 分钟快速开始

### 方式一：体验语音通话（最快）

1. **下载测试页面**
   ```bash
   # 下载快速开始指南
   wget https://your-domain/VOICE_CALL_QUICK_START.md
   ```

2. **修改配置并运行**
   - 打开文档中的 HTML 代码
   - 修改 `WS_URL`、`USER_ID`、`APP_ID`
   - 保存为 `.html` 文件并用浏览器打开

3. **开始对话**
   - 点击"连接" → "开始通话"
   - 直接说话，系统自动识别并回复

### 方式二：调用 HTTP 接口

**1. 查询可用角色**
```bash
curl https://your-domain/api/open/app/cats?page=1&size=10
```

**2. 文字对话**
```bash
curl -X POST https://your-domain/api/open/chat/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "appId": 10,
    "prompt": "你好"
  }'
```

**3. 语音对话**
```bash
curl -X POST https://your-domain/api/open/chat/chat-process-voice \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "appId": 10,
    "audioUrl": "https://your-audio-url.wav"
  }'
```

---

## 📚 完整接口列表

### 🎙️ 语音通话接口

| 接口 | 类型 | 说明 |
|------|------|------|
| `ws://your-domain/api/realtime/voice-call` | WebSocket | 实时语音通话（推荐） |
| `POST /api/open/chat/chat-process-voice` | HTTP | 语音对话（一问一答） |
| `POST /api/open/chat/tts-process` | HTTP | 文字转语音 |
| `POST /api/open/voice/asr` | HTTP | 语音识别 |
| `POST /api/open/voice/preview` | HTTP | 音色试听 |

📖 **详细文档**：[VOICE_CALL_API.md](./VOICE_CALL_API.md)

---

### 💬 文字对话接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/open/chat/chat-process` | POST | 文字对话 |
| `/api/open/chat/affection/status` | GET | 查询好感度 |

---

### 🎭 角色管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/open/app/cats` | GET | 查询角色列表 |
| `/api/open/app/cats/:id` | GET | 查询角色详情 |
| `/api/open/app/cats` | POST | 创建角色 |
| `/api/open/app/cats/:id` | PUT | 更新角色 |
| `/api/open/app/cats/:id` | DELETE | 删除角色 |
| `/api/open/app/categories` | GET | 查询分类列表 |
| `/api/open/affection/rules` | GET | 查询好感度规则 |

---

### 🔊 音色管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/open/voice/list` | GET | 查询音色列表 |
| `/api/open/voice/detail/:voiceId` | GET | 查询音色详情 |
| `/api/open/voice/enroll` | POST | 声音复刻（创建音色） |
| `/api/open/voice/update` | POST | 更新音色 |
| `/api/open/voice/delete` | POST | 删除音色 |
| `/api/open/voice/params` | POST | 设置合成参数 |
| `/api/open/voice/preview` | POST | 试听音色 |
| `/api/open/voice/asr` | POST | 语音识别 |

---

### 📝 聊天记录接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/open/chatLog/list` | GET | 查询对话列表 |
| `/api/open/chatLog/by-app` | GET | 按应用查询 |
| `/api/open/chatLog/message/:id` | GET | 查询单条消息 |

---

## 🔐 认证说明

**当前状态**：所有开放接口**暂无鉴权**（方便测试）

**生产环境建议**：
```javascript
// 添加 API Key 认证
fetch('/api/open/chat/chat-process', {
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'  // 建议添加
  },
  body: JSON.stringify({...})
});
```

---

## 📊 请求响应格式

### HTTP 接口

#### 成功响应
```json
{
  "code": 200,
  "success": true,
  "message": "请求成功",
  "data": {
    // 业务数据
  }
}
```

#### 错误响应
```json
{
  "code": 400,
  "success": false,
  "message": "错误描述"
}
```

### WebSocket 接口

#### 文本消息（JSON）
```javascript
// 客户端发送
{
  "type": "start_call",  // 消息类型
  "sampleRate": 8000,    // 采样率
  "format": "pcm",       // 音频格式
  "userId": 1,           // 用户ID
  "appId": 10            // 角色ID
  // ... 其他参数
}

// 服务端响应
{
  "type": "asr.final",   // 消息类型
  "text": "识别的文字"    // 数据
}
```

#### 二进制消息
- **客户端发送**：PCM/WAV 音频数据（ArrayBuffer）
- **服务端发送**：MP3 音频数据（ArrayBuffer）

---

## 🌐 在线文档

启动服务后，访问以下地址查看完整 API 文档：

- **开放接口文档**（推荐）：http://localhost:9520/open-api-docs
- **完整接口文档**（开发环境）：http://localhost:9520/api-docs
- **JSON 格式**：http://localhost:9520/open-api.json

---

## 💻 SDK 与示例代码

### JavaScript / TypeScript

```javascript
// WebSocket 语音通话
import { useVoiceCall } from './hooks/useVoiceCall';

const { connect, startRecording, stopRecording } = useVoiceCall({
  appId: 10,
  userId: 1
});

connect();
startRecording();
// ... 用户说话
stopRecording();
```

### Python

```python
import requests

# 文字对话
response = requests.post('https://your-domain/api/open/chat/chat-process', json={
    'userId': 1,
    'appId': 10,
    'prompt': '你好'
})

print(response.json())
```

### cURL

```bash
# 查询角色列表
curl https://your-domain/api/open/app/cats

# 文字对话
curl -X POST https://your-domain/api/open/chat/chat-process \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "appId": 10, "prompt": "你好"}'

# 语音识别
curl -X POST https://your-domain/api/open/voice/asr \
  -H "Content-Type: application/json" \
  -d '{"audioBase64": "data:audio/wav;base64,..."}'
```

---

## 🎨 前端集成示例

### Vue 3
```vue
<template>
  <button @click="startCall">开始语音通话</button>
</template>

<script setup>
import { useVoiceCall } from '@/hooks/useVoiceCall';

const { connect, startRecording } = useVoiceCall({
  appId: 10,
  userId: 1
});

const startCall = async () => {
  await connect();
  await startRecording();
};
</script>
```

### React
```jsx
import { useVoiceCall } from './hooks/useVoiceCall';

function VoiceCallButton() {
  const { connect, startRecording } = useVoiceCall({
    appId: 10,
    userId: 1
  });

  const handleStart = async () => {
    await connect();
    await startRecording();
  };

  return <button onClick={handleStart}>开始语音通话</button>;
}
```

---

## 📱 移动端集成

### 微信小程序

```javascript
// WebSocket 连接
const socket = wx.connectSocket({
  url: 'wss://your-domain/api/realtime/voice-call'
});

// 开始录音
const recorderManager = wx.getRecorderManager();
recorderManager.start({
  format: 'mp3',
  sampleRate: 16000
});

recorderManager.onFrameRecorded((res) => {
  // 发送音频帧
  socket.send({ data: res.frameBuffer });
});
```

### React Native

```javascript
import AudioRecord from 'react-native-audio-record';

// 开始录音
AudioRecord.start();

// 监听音频数据
AudioRecord.on('data', (data) => {
  ws.send(data);
});
```

---

## ⚡ 性能优化建议

### WebSocket 连接池
```javascript
class VoiceCallPool {
  constructor(maxConnections = 10) {
    this.pool = [];
    this.maxConnections = maxConnections;
  }

  acquire() {
    return this.pool.pop() || this.createNew();
  }

  release(ws) {
    if (this.pool.length < this.maxConnections) {
      this.pool.push(ws);
    } else {
      ws.close();
    }
  }
}
```

### 音频缓存
```javascript
const audioCache = new Map();

function getCachedAudio(text, voiceId) {
  const key = `${voiceId}_${text}`;
  if (audioCache.has(key)) {
    return audioCache.get(key);
  }
  // ... 请求 TTS
}
```

---

## 🆕 最新更新

### v1.1.0 (2025-01-21)

**新增功能：**
- ✅ WebSocket 诊断消息（`probe`）
- ✅ 完善的消息类型文档
- ✅ 更详细的 Swagger 文档说明

**优化改进：**
- 🔧 改进 LLM 返回值结构（支持 usage 统计）
- 🔧 优化 WebSocket 消息处理逻辑
- 🔧 增强错误提示信息

**文档更新：**
- 📖 新增 WebSocket 消息类型完整参考表
- 📖 更新 Swagger API 文档描述
- 📖 完善快速上手指南

---

## 🛠️ 常见问题

### Q1: 如何获取 `userId`？

A: `userId` 是你系统中的用户ID。可以通过用户注册接口创建，或使用现有用户。

```bash
# 查询现有用户（需要管理员权限）
curl https://your-domain/api/user/list
```

### Q2: 如何获取 `appId`？

A: `appId` 是角色应用的ID。

```bash
# 查询所有角色
curl https://your-domain/api/open/app/cats

# 创建新角色
curl -X POST https://your-domain/api/open/app/cats \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的AI助手",
    "des": "智能客服",
    "preset": "你是一个友好的AI助手"
  }'
```

### Q3: WebSocket 连接超时？

A: 检查防火墙设置和网络配置。

```bash
# 测试连接
telnet your-domain 9520

# 查看服务日志
tail -f logs/app.log
```

### Q4: 如何调试音频问题？

A: 使用浏览器开发者工具和诊断消息。

```javascript
// 1. 检查音频数据
processor.onaudioprocess = (e) => {
  const input = e.inputBuffer.getChannelData(0);
  console.log('RMS:', calculateRMS(input));
};

// 2. 请求服务端诊断信息
ws.send(JSON.stringify({ type: 'probe' }));

// 3. 接收诊断响应
ws.onmessage = (event) => {
  if (typeof event.data === 'string') {
    const msg = JSON.parse(event.data);
    if (msg.type === 'probe.resp') {
      console.log('诊断信息：', {
        接收字节数: msg.recvBytesTotal,
        接收块数: msg.recvChunkCount,
        缓冲块数: msg.bufferedChunks,
        正在处理: msg.isProcessing,
        TTS活跃: msg.ttsActive,
        最后RMS: msg.lastRms
      });
    }
  }
};
```

### Q5: 支持哪些音频格式？

A:

**录音输入：**
- PCM（推荐，8000Hz/16000Hz）
- WAV
- MP3
- AAC
- AMR
- Opus

**TTS 输出：**
- MP3（默认，22050Hz）
- WAV
- PCM

---

## 📞 技术支持

- **文档问题**：查看 [在线文档](https://docs.99ai.com)
- **Bug 反馈**：提交 [GitHub Issue](https://github.com/your-repo/issues)
- **功能建议**：发送邮件至 feedback@99ai.com
- **商业合作**：联系 bd@99ai.com

---

## 📄 开源协议

Apache 2.0 License

- ✅ 允许商业使用
- ✅ 允许修改代码
- ✅ 允许分发
- ⚠️ 需保留版权声明
- ⚠️ 需声明修改内容

---

## 🎉 开始使用

1. **快速体验**：查看 [5分钟快速开始](./VOICE_CALL_QUICK_START.md)
2. **深入学习**：阅读 [完整API文档](./VOICE_CALL_API.md)
3. **生产部署**：参考 [部署指南](./CLAUDE.md)

**祝你使用愉快！** 🚀
