# GPT-SoVITS 异步调用改造总结

## ✅ 已完成

已成功将 99AI 后端调用 GPT-SoVITS 的方式从**同步模式**改为**异步模式**。

## 📝 修改内容

### 修改的文件
- `service/src/modules/voice/voice.service.ts`

### 核心变更

#### 修改前（同步模式）
```typescript
// 直接调用 /tts 接口，阻塞等待音频生成完成（2-10秒）
const response = await axios.post('/tts', payload, {
  responseType: 'arraybuffer',
  timeout: 120000,
});
```

#### 修改后（异步模式）
```typescript
// 1. 提交任务到 /tts/async
const taskId = await submitGptSovitsAsyncTask('/tts/async', payload);

// 2. 轮询查询状态 /task/{task_id}
const audioUrl = await pollGptSovitsTaskStatus(taskId);

// 3. 下载音频 /task/{task_id}/audio
const buffer = await downloadGptSovitsAudio(audioUrl);
```

## 🎯 改进效果

| 对比项 | 同步模式 | 异步模式 |
|--------|---------|---------|
| **响应方式** | 阻塞等待 | 立即返回 task_id |
| **并发能力** | 受限于连接数 | 支持任务队列 |
| **资源占用** | 高（长连接） | 低（短连接） |
| **稳定性** | 容易超时 | 队列化处理 |
| **可扩展性** | 差 | 好（3个工作线程） |

## 🔄 调用流程

```
99AI 后端                    GPT-SoVITS 服务
    |                              |
    |  POST /tts/async             |
    |----------------------------->|
    |  返回 task_id                |
    |<-----------------------------|
    |                              |
    |  轮询 GET /task/{id}         |
    |----------------------------->|
    |  status: pending/processing  |
    |<-----------------------------|
    |                              |
    |  GET /task/{id}              |
    |----------------------------->|
    |  status: completed           |
    |<-----------------------------|
    |                              |
    |  GET /task/{id}/audio        |
    |----------------------------->|
    |  返回音频数据                 |
    |<-----------------------------|
```

## ⚙️ 配置说明

### 环境变量（service/.env）
```bash
# GPT-SoVITS 服务地址
GPT_SOVITS_BASE_URL=http://127.0.0.1:9880

# 重试配置（可选）
GPT_SOVITS_MAX_RETRIES=3
GPT_SOVITS_RETRY_DELAY=1000
GPT_SOVITS_RETRY_BACKOFF=2
```

### 超时配置
- 提交任务：30秒
- 查询状态：10秒/次
- 轮询总时长：60秒（最多60次）
- 下载音频：60秒

## 📊 日志示例

### 成功场景
```
[requestGptSovitsAudio] 使用异步模式调用 GPT-SoVITS: http://127.0.0.1:9880/tts/async
[requestGptSovitsAudio] 任务已提交，task_id: tts_1234567890_abc
[pollGptSovitsTaskStatus] 轮询 1/60，状态: pending
[pollGptSovitsTaskStatus] 轮询 2/60，状态: processing
[pollGptSovitsTaskStatus] 轮询 3/60，状态: completed
[requestGptSovitsAudio] 任务完成，音频URL: http://127.0.0.1:9880/task/tts_1234567890_abc/audio
[requestGptSovitsAudio] 音频下载完成，大小: 245678 bytes
```

## 🚀 使用方式

### 对用户透明
99AI 的 API 接口**保持不变**，用户调用方式完全一致：

```bash
# 调用方式不变
curl -X POST http://localhost:9520/open/voice/preview \
  -H "Content-Type: application/json" \
  -d '{
    "voice_id": "gptsovits-xxx",
    "text": "你好",
    "format": "wav"
  }'
```

### 内部流程变化
- **旧流程**：99AI → GPT-SoVITS `/tts`（阻塞等待）→ 返回音频
- **新流程**：99AI → GPT-SoVITS `/tts/async`（提交任务）→ 轮询状态 → 下载音频 → 返回音频

## 🔍 故障排查

### 1. 轮询超时
**现象**：`GPT-SoVITS 任务超时（60秒）`

**原因**：
- 文本太长，生成时间超过60秒
- GPT-SoVITS 服务负载过高

**解决**：
- 增加轮询次数（修改 `maxPolls`）
- 优化 GPT-SoVITS 配置
- 增加工作线程数

### 2. 任务失败
**现象**：`GPT-SoVITS 任务失败: xxx`

**原因**：
- 模型加载失败
- 音频文件路径错误
- 参数配置错误

**解决**：
- 查看 GPT-SoVITS 日志
- 检查模型文件是否存在
- 验证参数配置

### 3. 下载音频失败
**现象**：`下载 GPT-SoVITS 音频失败`

**原因**：
- 音频文件已过期
- 网络问题

**解决**：
- 检查 GPT-SoVITS 文件保留策略
- 增加重试次数

## 📚 相关文档

详细文档请查看：`GPT-SOVITS-ASYNC-IMPLEMENTATION.md`

## 🎉 总结

通过改造为异步模式，99AI 后端获得了：
- ✅ 更好的并发处理能力
- ✅ 更低的资源占用
- ✅ 更高的系统稳定性
- ✅ 更好的可扩展性

**重要**：此改造对用户完全透明，API 接口保持不变！

---

**更新时间**：2025-11-27
**版本**：v1.0.0
