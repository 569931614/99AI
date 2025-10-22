# 语音通话快速上手指南

## 5 分钟快速集成

### 第一步：准备工作

1. **获取必要信息**
   ```javascript
   const API_BASE_URL = 'https://your-domain';  // 你的服务器地址
   const USER_ID = 1;                           // 你的用户ID
   const APP_ID = 10;                           // 要对话的角色ID
   ```

2. **查询可用角色**
   ```javascript
   const response = await fetch(`${API_BASE_URL}/api/open/app/cats?page=1&size=10`);
   const { data } = await response.json();

   console.log('可用角色：', data.rows);
   // 选择一个角色，记录它的 id 和 voiceId
   ```

---

### 第二步：HTML 页面（最简实现）

```html
<!DOCTYPE html>
<html>
<head>
  <title>语音通话测试</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    button { padding: 10px 20px; margin: 5px; font-size: 16px; cursor: pointer; }
    .recording { background: #ef4444; color: white; }
    .normal { background: #3b82f6; color: white; }
    #log { background: #f3f4f6; padding: 15px; margin-top: 20px; height: 400px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>🎙️ 语音通话测试</h1>

  <div>
    <button id="connectBtn" class="normal">连接</button>
    <button id="startBtn" class="normal" disabled>开始通话</button>
    <button id="stopBtn" class="recording" disabled>停止通话</button>
  </div>

  <div id="status">状态：未连接</div>
  <div id="log"></div>

  <script>
    // ==================== 配置 ====================
    const WS_URL = 'ws://localhost:9520/api/realtime/voice-call';
    const USER_ID = 1;
    const APP_ID = 10;  // 改为你的角色ID

    // ==================== 全局变量 ====================
    let ws = null;
    let audioContext = null;
    let stream = null;
    let processor = null;
    let source = null;
    let isRecording = false;
    let isSpeaking = false;
    let silenceStartTime = 0;

    // VAD 配置
    const VAD_CONFIG = {
      silenceThreshold: 100,    // 静音阈值
      voiceThreshold: 200,      // 有声阈值
      silenceDuration: 1500     // 静音持续1.5秒触发
    };

    // ==================== UI 元素 ====================
    const connectBtn = document.getElementById('connectBtn');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusDiv = document.getElementById('status');
    const logDiv = document.getElementById('log');

    // ==================== 工具函数 ====================
    function log(msg, type = 'info') {
      const time = new Date().toLocaleTimeString();
      const color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'black';
      logDiv.innerHTML += `<div style="color: ${color}">[${time}] ${msg}</div>`;
      logDiv.scrollTop = logDiv.scrollHeight;
    }

    function updateStatus(text) {
      statusDiv.textContent = '状态：' + text;
    }

    // 下采样
    function downsample(buffer, inputRate, outputRate) {
      if (inputRate === outputRate) return buffer;
      const ratio = inputRate / outputRate;
      const newLength = Math.floor(buffer.length / ratio);
      const result = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        result[i] = buffer[Math.floor(i * ratio)];
      }
      return result;
    }

    // Float32 转 Int16 PCM
    function floatTo16BitPCM(float32Array) {
      const int16 = new Int16Array(float32Array.length);
      for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return int16;
    }

    // 计算 RMS（音量）
    function calculateRMS(pcm16) {
      let sumSq = 0;
      for (let i = 0; i < pcm16.length; i++) {
        sumSq += pcm16[i] * pcm16[i];
      }
      return Math.sqrt(sumSq / pcm16.length);
    }

    // ==================== WebSocket ====================
    function connect() {
      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        log('WebSocket 已连接', 'success');
        updateStatus('已连接');
        connectBtn.disabled = true;
        startBtn.disabled = false;

        // 发送启动消息
        ws.send(JSON.stringify({
          type: 'start_call',
          sampleRate: 8000,
          format: 'pcm',
          userId: USER_ID,
          appId: APP_ID
        }));
        log('已发送 start_call');
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } else {
          // TTS 音频数据
          playAudio(event.data);
        }
      };

      ws.onerror = (e) => {
        log('WebSocket 错误', 'error');
        updateStatus('连接错误');
      };

      ws.onclose = () => {
        log('WebSocket 已断开', 'error');
        updateStatus('未连接');
        connectBtn.disabled = false;
        startBtn.disabled = true;
        stopBtn.disabled = true;
      };
    }

    function handleMessage(msg) {
      switch (msg.type) {
        case 'call_started':
          log(`✅ 通话已启动 (${msg.sampleRate}Hz, ${msg.format})`, 'success');
          break;
        case 'asr.partial':
          log(`🎤 识别中: ${msg.text}`);
          break;
        case 'asr.final':
          log(`🎤 识别完成: ${msg.text}`, 'success');
          break;
        case 'llm.start':
          log(`💬 AI 开始思考...`);
          break;
        case 'llm.partial':
          log(`💬 AI: ${msg.text}`);
          break;
        case 'llm.final':
          log(`💬 AI 回复完成: ${msg.text}`, 'success');
          break;
        case 'emotion.detected':
          log(`😊 检测到情绪: ${msg.emotion}`, 'success');
          break;
        case 'tts.start':
          log(`🔊 开始播报`);
          break;
        case 'tts.end':
          log(`🔊 播报结束`);
          break;
        case 'error':
          log(`❌ 错误 (${msg.stage}): ${msg.message}`, 'error');
          break;
      }
    }

    // ==================== 音频录制 ====================
    async function startRecording() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();

        source = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(8192, 1, 1);

        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const downsampled = downsample(input, audioContext.sampleRate, 8000);
          const pcm16 = floatTo16BitPCM(downsampled);

          // VAD（语音活动检测）
          const rms = calculateRMS(pcm16);
          const now = Date.now();

          if (rms > VAD_CONFIG.voiceThreshold) {
            // 检测到说话
            if (!isSpeaking) {
              isSpeaking = true;
              log(`🗣️ 开始说话 (RMS: ${Math.round(rms)})`);
              updateStatus('正在说话...');
            }
            silenceStartTime = now;
          } else if (rms < VAD_CONFIG.silenceThreshold) {
            // 检测到静音
            if (isSpeaking) {
              if (silenceStartTime === 0) {
                silenceStartTime = now;
              } else {
                const silenceDuration = now - silenceStartTime;
                if (silenceDuration >= VAD_CONFIG.silenceDuration) {
                  // 静音超过阈值，自动发送
                  log(`⏸️ 说话结束（静音 ${silenceDuration}ms）`);
                  updateStatus('已连接（等待说话）');
                  ws.send(JSON.stringify({ type: 'stop' }));
                  isSpeaking = false;
                  silenceStartTime = 0;
                }
              }
            }
          } else {
            silenceStartTime = now;
          }

          // 发送音频数据
          if (rms >= 3) {
            ws.send(pcm16.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        isRecording = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        updateStatus('已连接（等待说话）');
        log('✅ 开始录音（自动检测说话停顿）', 'success');

      } catch (e) {
        log('❌ 无法访问麦克风: ' + e.message, 'error');
      }
    }

    function stopRecording() {
      if (processor) processor.disconnect();
      if (source) source.disconnect();
      if (audioContext) audioContext.close();
      if (stream) stream.getTracks().forEach(t => t.stop());

      isRecording = false;
      isSpeaking = false;
      silenceStartTime = 0;

      startBtn.disabled = false;
      stopBtn.disabled = true;
      updateStatus('已连接');
      log('⏹️ 已停止录音');
    }

    // ==================== 音频播放 ====================
    let mediaSource = null;
    let sourceBuffer = null;
    let audioEl = null;
    const audioQueue = [];

    function initMediaSource() {
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      }

      mediaSource = new MediaSource();
      audioEl.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', () => {
        sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        sourceBuffer.mode = 'sequence';

        sourceBuffer.addEventListener('updateend', () => {
          if (audioQueue.length > 0 && !sourceBuffer.updating) {
            const chunk = audioQueue.shift();
            try {
              sourceBuffer.appendBuffer(chunk);
            } catch (e) {
              console.error('appendBuffer error:', e);
            }
          }
        });
      });
    }

    function playAudio(chunk) {
      if (!mediaSource || !sourceBuffer) {
        initMediaSource();
        audioQueue.push(chunk);
      } else {
        if (sourceBuffer.updating) {
          audioQueue.push(chunk);
        } else {
          try {
            sourceBuffer.appendBuffer(chunk);
          } catch (e) {
            console.error('appendBuffer error:', e);
          }
        }
      }
    }

    // ==================== 事件监听 ====================
    connectBtn.onclick = connect;
    startBtn.onclick = startRecording;
    stopBtn.onclick = stopRecording;

    log('👋 欢迎使用语音通话测试！点击"连接"开始。');
  </script>
</body>
</html>
```

---

### 第三步：保存并测试

1. **保存文件**
   - 将上面的 HTML 保存为 `voice-call-test.html`
   - 修改第 19 行的 `WS_URL`、`USER_ID`、`APP_ID`

2. **运行测试**
   - 用浏览器打开 `voice-call-test.html`
   - 点击"连接"按钮
   - 点击"开始通话"
   - **直接说话即可**，系统会自动检测你停止说话并触发回复

3. **查看效果**
   - 日志区域会显示实时进度
   - 说话 → 自动识别 → AI 回复 → 语音播报

---

## 常见问题排查

### ❌ 无法连接 WebSocket

**检查清单：**
```bash
# 1. 确认服务端已启动
curl http://localhost:9520/api/open/app/cats

# 2. 检查防火墙
# Windows: 允许端口 9520
# Linux: sudo ufw allow 9520

# 3. 查看服务端日志
# 应该看到 "Realtime WS ready at /api/realtime/voice-call"
```

### ❌ 麦克风无法访问

**解决方案：**
- Chrome：设置 → 隐私和安全 → 网站设置 → 麦克风 → 允许
- 需要 HTTPS 或 localhost（HTTP 不安全环境无法访问麦克风）

### ❌ 没有声音播放

**检查清单：**
1. 打开浏览器控制台，查看是否有错误
2. 确认角色已配置 `voiceId`
3. 检查系统音量未静音

---

## 下一步

🎉 **恭喜！你已经成功集成语音通话功能。**

**进阶学习：**
1. 📖 阅读完整文档：[VOICE_CALL_API.md](./VOICE_CALL_API.md)
2. 🎨 自定义 UI：参考 `chat/src/views/chat/components/VoiceCall.vue`
3. 🔧 调整参数：修改 VAD 阈值、采样率等
4. 🚀 生产部署：添加鉴权、限流、监控

**需要帮助？**
- 技术问题：提交 [GitHub Issue]
- 商业合作：联系 support@99ai.com
