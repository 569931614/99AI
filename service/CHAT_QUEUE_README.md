# 聊天队列异步接口使用文档

## 概述

为解决多用户并发聊天时的线程占用问题，新增了基于消息队列的异步聊天接口。

## 问题背景

原有的同步接口 `/api/open/chat/chat-process-sync` 存在以下问题：
- AI 模型响应时间长（5-30秒），期间线程一直被占用
- 高并发时可能导致资源耗尽、响应变慢、请求超时
- 无法有效控制并发处理数量

## 解决方案

使用 **Bull 消息队列 + Redis** 实现异步任务处理：
1. 用户提交聊天请求，立即返回任务ID（<100ms）
2. 后台队列异步处理任务
3. 客户端轮询查询任务状态和结果

## 新增接口

### 1. 提交异步聊天任务

**接口地址：** `POST /api/open/chat/chat-process-async`

**请求参数：**
```json
{
  "token": "string (可选)",
  "userId": "number (可选，优先使用token)",
  "prompt": "string (必填)",
  "appId": "number (可选，角色ID)",
  "audioUrl": "string (可选，音频URL自动ASR)",
  "imageUrl": "string (可选)",
  "options": {
    "parentMessageId": "string (可选，上一条消息ID)",
    "groupId": "number (可选，会话组ID)"
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "taskId": "a1b2c3d4e5f6g7h8",
  "status": "pending",
  "createdAt": "2025-11-20T14:00:00.000Z"
}
```

### 2. 查询任务状态

**接口地址：** `GET /api/open/chat/task-status/:taskId`

**响应示例 - 处理中：**
```json
{
  "success": true,
  "taskId": "a1b2c3d4e5f6g7h8",
  "status": "processing",
  "progress": 65,
  "updatedAt": "2025-11-20T14:00:15.000Z"
}
```

**响应示例 - 已完成：**
```json
{
  "success": true,
  "taskId": "a1b2c3d4e5f6g7h8",
  "status": "completed",
  "progress": 100,
  "data": {
    "text": "你好！我是AI助手...",
    "chatId": 12345,
    "emotion": "happy",
    "psychologicalDesc": "积极友好",
    "audioUrl": "https://example.com/audio.mp3",
    "voiceDuration": 5.2,
    "imageUrl": "https://example.com/sticker.png"
  },
  "updatedAt": "2025-11-20T14:00:30.000Z"
}
```

**响应示例 - 失败：**
```json
{
  "success": true,
  "taskId": "a1b2c3d4e5f6g7h8",
  "status": "failed",
  "error": "token 无效或已过期",
  "updatedAt": "2025-11-20T14:00:10.000Z"
}
```

### 3. 队列统计信息（监控用）

**接口地址：** `GET /api/open/chat/queue-stats`

**响应示例：**
```json
{
  "success": true,
  "data": {
    "waiting": 5,      // 等待处理
    "active": 3,       // 正在处理
    "completed": 128,  // 已完成
    "failed": 2,       // 失败
    "delayed": 0,      // 延迟任务
    "total": 8         // 总计（waiting + active + delayed）
  }
}
```

## 任务状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 任务已提交，等待处理 |
| `processing` | 任务正在处理中 |
| `completed` | 任务处理完成 |
| `failed` | 任务处理失败 |

## 使用示例

### JavaScript/TypeScript

```typescript
// 1. 提交任务
async function submitChatTask(token: string, prompt: string, appId?: number) {
  const response = await fetch('http://192.168.10.17:9520/api/open/chat/chat-process-async', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, prompt, appId })
  });
  const result = await response.json();
  return result.taskId;
}

// 2. 轮询查询结果
async function pollTaskResult(taskId: string, maxAttempts = 60): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`http://192.168.10.17:9520/api/open/chat/task-status/${taskId}`);
    const result = await response.json();

    if (result.status === 'completed') {
      return result.data; // 返回聊天结果
    }

    if (result.status === 'failed') {
      throw new Error(result.error);
    }

    // 等待2秒后重试
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('任务超时');
}

// 3. 完整使用流程
async function chat(token: string, prompt: string, appId?: number) {
  console.log('提交聊天任务...');
  const taskId = await submitChatTask(token, prompt, appId);
  console.log(`任务ID: ${taskId}`);

  console.log('等待AI响应...');
  const result = await pollTaskResult(taskId);
  console.log('回复:', result.text);

  if (result.audioUrl) {
    console.log('语音URL:', result.audioUrl);
  }

  return result;
}
```

### 微信小程序

```javascript
// 提交任务并轮询结果
function asyncChat(token, prompt, appId) {
  return new Promise((resolve, reject) => {
    // 1. 提交任务
    wx.request({
      url: 'http://192.168.10.17:9520/api/open/chat/chat-process-async',
      method: 'POST',
      data: { token, prompt, appId },
      success: (res) => {
        const taskId = res.data.taskId;

        // 2. 轮询查询结果
        const timer = setInterval(() => {
          wx.request({
            url: `http://192.168.10.17:9520/api/open/chat/task-status/${taskId}`,
            success: (statusRes) => {
              const result = statusRes.data;

              if (result.status === 'completed') {
                clearInterval(timer);
                resolve(result.data);
              } else if (result.status === 'failed') {
                clearInterval(timer);
                reject(new Error(result.error));
              }

              // 更新进度UI
              if (result.progress) {
                console.log(`处理进度: ${result.progress}%`);
              }
            },
            fail: reject
          });
        }, 2000); // 每2秒查询一次

        // 超时处理（2分钟）
        setTimeout(() => {
          clearInterval(timer);
          reject(new Error('任务超时'));
        }, 120000);
      },
      fail: reject
    });
  });
}

// 使用示例
asyncChat(userToken, '你好', 123)
  .then(result => {
    console.log('AI回复:', result.text);
    // 播放语音
    if (result.audioUrl) {
      wx.createInnerAudioContext().src = result.audioUrl;
    }
  })
  .catch(err => {
    console.error('聊天失败:', err);
  });
```

## 性能优势

| 指标 | 同步接口 | 异步接口 |
|------|---------|---------|
| 响应时间 | 5-30秒 | <100ms |
| 线程占用 | 长时间占用 | 立即释放 |
| 并发能力 | 受限于线程池 | 队列控制，可扩展 |
| 容错性 | 无重试 | 自动重试3次 |
| 可监控性 | 差 | 支持队列监控 |

## 配置说明

确保 `.env` 文件中 Redis 配置正确：

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## 注意事项

1. **任务过期时间**：任务结果在 Redis 中保存 10 分钟，请及时查询
2. **轮询间隔**：建议 2-3 秒轮询一次，避免频繁请求
3. **超时处理**：建议设置 2 分钟超时，超时后可重新提交任务
4. **错误重试**：任务失败会自动重试最多 3 次，3 次后标记为 failed
5. **并发限制**：队列可配置并发处理数量，默认根据服务器性能自动调整

## 原有接口对比

### 原同步接口（仍可使用）
- `POST /api/open/chat/chat-process-sync`
- 适用场景：低并发、实时要求高的场景
- 缺点：高并发时可能阻塞

### 新异步接口（推荐）
- `POST /api/open/chat/chat-process-async`
- 适用场景：高并发、多用户同时聊天
- 优点：不阻塞、支持监控、自动重试

## 技术实现

- **消息队列**：Bull (基于 Redis)
- **任务存储**：Redis (10分钟过期)
- **并发控制**：队列自动管理
- **进度追踪**：实时更新处理进度 (0-100%)
- **容错机制**：失败自动重试，指数退避策略

## 监控建议

定期调用 `/api/open/chat/queue-stats` 接口监控队列状态：
- `waiting` 过高：考虑增加处理并发数
- `failed` 过高：检查错误日志，排查问题
- `active` 持续高位：正常，说明系统繁忙

## 版本信息

- **添加时间**：2025-11-20
- **版本**：v4.3.0+
- **依赖**：
  - @nestjs/bull: ^11.0.4
  - bull: ^4.16.5
  - Redis: 需已配置

---

如有问题，请查看服务日志或联系技术支持。
