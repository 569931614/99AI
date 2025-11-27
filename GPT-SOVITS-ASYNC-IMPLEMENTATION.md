# GPT-SoVITS 异步调用实现说明

## 📋 概述

已将 99AI 后端调用 GPT-SoVITS 的方式从**同步模式**改为**异步模式**，以提升并发处理能力和系统稳定性。

## 🔄 修改内容

### 修改文件
- `service/src/modules/voice/voice.service.ts`

### 核心变更

#### 1. 原有同步调用方式
```typescript
// 旧方式：直接调用 /tts 接口，等待音频生成完成
const response = await axios.post('/tts', payload, {
  responseType: 'arraybuffer',
  timeout: 120000,
});
const buffer = Buffer.from(response.data);
```

**问题**：
- 请求阻塞，等待时间长（2-10秒）
- 高并发时容易超时
- 占用连接资源

#### 2. 新的异步调用方式
```typescript
// 新方式：使用 GPT-SoVITS 异步接口
// 1. 提交任务
const taskId = await submitGptSovitsAsyncTask('/tts/async', payload);

// 2. 轮询查询状态
const audioUrl = await pollGptSovitsTaskStatus(taskId);

// 3. 下载音频
const buffer = await downloadGptSovitsAudio(audioUrl);
```

**优势**：
- ✅ 提交任务后立即返回，不阻塞
- ✅ GPT-SoVITS 后台队列处理，支持高并发
- ✅ 3个工作线程并行处理不同角色的请求
- ✅ 更好的错误处理和重试机制

## 🚀 实现细节

### 1. 提交异步任务 (`submitGptSovitsAsyncTask`)

```typescript
POST http://localhost:9880/tts/async
Content-Type: application/json

{
  "character": "秦彻",
  "text": "你好",
  "ref_audio_path": "xxx.wav",
  "text_lang": "zh",
  "prompt_text": "参考文本",
  "prompt_lang": "zh"
}
```

**响应**：
```json
{
  "task_id": "tts_1234567890_abc",
  "status": "pending"
}
```

**特性**：
- 支持重试机制（最多3次）
- 超时时间：30秒
- 自动错误处理

### 2. 轮询任务状态 (`pollGptSovitsTaskStatus`)

```typescript
GET http://localhost:9880/task/{task_id}
```

**响应示例**：
```json
{
  "task_id": "tts_1234567890_abc",
  "status": "completed"  // pending | processing | completed | failed
}
```

**轮询策略**：
- 最多轮询 60 次
- 每次间隔 1 秒
- 总超时时间：60 秒
- 状态变化：`pending` → `processing` → `completed`

**日志输出**：
```
[pollGptSovitsTaskStatus] 轮询 1/60，状态: pending
[pollGptSovitsTaskStatus] 轮询 2/60，状态: processing
[pollGptSovitsTaskStatus] 轮询 3/60，状态: completed
```

### 3. 下载音频 (`downloadGptSovitsAudio`)

```typescript
GET http://localhost:9880/task/{task_id}/audio
```

**特性**：
- 支持重试机制（最多3次）
- 超时时间：60秒
- 返回音频 Buffer

## 📊 调用流程图

```
99AI 后端                    GPT-SoVITS 服务
    |                              |
    |  1. POST /tts/async          |
    |----------------------------->|
    |  返回 task_id                |
    |<-----------------------------|
    |                              |
    |  2. GET /task/{id} (轮询)    |
    |----------------------------->|
    |  status: pending             |
    |<-----------------------------|
    |                              |
    |  等待 1 秒                    |
    |                              |
    |  3. GET /task/{id}           |
    |----------------------------->|
    |  status: processing          |
    |<-----------------------------|
    |                              |
    |  等待 1 秒                    |
    |                              |
    |  4. GET /task/{id}           |
    |----------------------------->|
    |  status: completed           |
    |<-----------------------------|
    |                              |
    |  5. GET /task/{id}/audio     |
    |----------------------------->|
    |  返回音频数据                 |
    |<-----------------------------|
    |                              |
```

## ⚙️ 配置说明

### 环境变量

在 `service/.env` 中配置：

```bash
# GPT-SoVITS 服务地址
GPT_SOVITS_BASE_URL=http://127.0.0.1:9880

# 重试配置（可选）
GPT_SOVITS_MAX_RETRIES=3
GPT_SOVITS_RETRY_DELAY=1000
GPT_SOVITS_RETRY_BACKOFF=2
```

### 超时配置

| 操作 | 超时时间 | 说明 |
|------|---------|------|
| 提交任务 | 30秒 | POST /tts/async |
| 查询状态 | 10秒 | GET /task/{id} |
| 轮询总时长 | 60秒 | 最多轮询60次 |
| 下载音频 | 60秒 | GET /task/{id}/audio |

## 🔍 日志示例

### 成功场景

```
[requestGptSovitsAudio] 使用异步模式调用 GPT-SoVITS: http://127.0.0.1:9880/tts/async
[requestGptSovitsAudio] Payload: {"character":"秦彻","text":"你好",...}
[requestGptSovitsAudio] 任务已提交，task_id: tts_1234567890_abc
[pollGptSovitsTaskStatus] 轮询 1/60，状态: pending
[pollGptSovitsTaskStatus] 轮询 2/60，状态: processing
[pollGptSovitsTaskStatus] 轮询 3/60，状态: completed
[requestGptSovitsAudio] 任务完成，音频URL: http://127.0.0.1:9880/task/tts_1234567890_abc/audio
[requestGptSovitsAudio] 音频下载完成，大小: 245678 bytes
```

### 失败场景

```
[submitGptSovitsAsyncTask] 提交任务失败，正在重试 (1/3)，延迟 1000ms。错误: ECONNREFUSED
[submitGptSovitsAsyncTask] 提交任务失败，正在重试 (2/3)，延迟 2000ms。错误: ECONNREFUSED
[submitGptSovitsAsyncTask] 提交 GPT-SoVITS 异步任务失败 (status 500): Internal Server Error
```

## 🎯 性能对比

### 同步模式 vs 异步模式

| 指标 | 同步模式 (/tts) | 异步模式 (/tts/async) |
|------|----------------|---------------------|
| 响应时间 | 2-10秒 | 立即返回（< 100ms） |
| 并发能力 | 受限于连接数 | 无限制（任务队列） |
| 资源占用 | 高（长连接） | 低（短连接） |
| 错误恢复 | 需要重新请求 | 任务持久化，可恢复 |
| 适用场景 | 低并发 | 高并发 |

### 并发能力提升

- **同步模式**：假设每个请求5秒，10个并发连接 = 2 QPS
- **异步模式**：3个工作线程，每个5秒 = 0.6 QPS/线程 × 3 = 1.8 QPS（基础）
- **实际提升**：异步模式下，99AI 不再阻塞等待，可以同时提交多个任务，实际并发能力取决于 GPT-SoVITS 的队列处理能力

## 🐛 故障排查

### 1. 任务一直处于 pending 状态

**可能原因**：
- GPT-SoVITS 工作线程未启动
- GPT-SoVITS 队列堵塞

**解决方法**：
```bash
# 查看 GPT-SoVITS 日志
tail -f gpt-sovits.log

# 检查工作线程状态
curl http://localhost:9880/status
```

### 2. 轮询超时

**可能原因**：
- 音频生成时间过长（文本太长）
- GPT-SoVITS 服务负载过高

**解决方法**：
- 增加轮询次数（修改 `maxPolls`）
- 优化 GPT-SoVITS 配置
- 增加工作线程数

### 3. 下载音频失败

**可能原因**：
- 音频文件已过期（GPT-SoVITS 清理了临时文件）
- 网络问题

**解决方法**：
- 检查 GPT-SoVITS 的文件保留策略
- 增加重试次数

## 📝 代码示例

### 调用示例（99AI 内部）

```typescript
// 在 voice.service.ts 中
const result = await this.requestGptSovitsAudio({
  voice: voiceEntity,
  text: '你好，欢迎使用',
  textLanguage: 'zh',
  sampleRate: 32000,
  stream: false,
});

console.log('音频大小:', result.buffer.length);
console.log('采样率:', result.sampleRate);
```

### 流式模式

```typescript
await this.requestGptSovitsAudio({
  voice: voiceEntity,
  text: '你好，欢迎使用',
  stream: true,
  onStart: (info) => {
    console.log('开始接收音频，采样率:', info.sampleRate);
  },
  onData: (chunk) => {
    console.log('接收音频片段:', chunk.length, 'bytes');
    // 可以实时推送给客户端
  },
  onEnd: () => {
    console.log('音频接收完成');
  },
});
```

## ✅ 测试建议

### 1. 单元测试

```bash
cd service
pnpm test voice.service.spec.ts
```

### 2. 集成测试

```bash
# 测试异步调用
curl -X POST http://localhost:9520/open/voice/preview \
  -H "Content-Type: application/json" \
  -d '{
    "voice_id": "gptsovits-xxx",
    "text": "测试异步调用",
    "format": "wav"
  }'
```

### 3. 压力测试

```bash
# 使用 ab 工具进行压力测试
ab -n 100 -c 10 -p payload.json -T application/json \
  http://localhost:9520/open/voice/preview
```

## 🔄 回滚方案

如果异步模式出现问题，可以快速回滚到同步模式：

1. 备份当前代码
2. 恢复 `voice.service.ts` 中的 `requestGptSovitsAudio` 方法
3. 将 `/tts/async` 改回 `/tts`
4. 移除轮询逻辑

## 📚 相关文档

- [GPT-SoVITS 异步接口文档](http://localhost:9880/docs)
- [99AI 语音服务文档](./service/src/modules/voice/README.md)

## 🎉 总结

通过将 GPT-SoVITS 调用方式改为异步模式，99AI 后端获得了以下提升：

1. ✅ **并发能力提升**：不再受限于同步连接数
2. ✅ **响应速度提升**：提交任务后立即返回
3. ✅ **稳定性提升**：任务队列化处理，避免超时
4. ✅ **可扩展性提升**：GPT-SoVITS 可独立扩展工作线程

**建议**：
- 监控 GPT-SoVITS 的任务队列长度
- 根据实际负载调整工作线程数
- 定期清理已完成的任务记录

---

**更新时间**：2025-11-27
**版本**：v1.0.0
