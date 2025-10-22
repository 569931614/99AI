# 开放 API 接入指南

## 概述

本文档提供完整的对话系统开放 API 接入流程，所有接口无需用户认证，不检查额度，不扣费。

**基础地址：** `http://your-domain:9520/api/open`

**认证方式：** 无需认证，通过 `userId` 参数区分不同用户

## 核心概念

### 1. 用户标识 (userId)
- 任意数字即可，用于区分不同用户的会话
- 不需要在系统中真实存在
- 建议使用您系统中的用户 ID

### 2. 对话组 (ChatGroup)
- 每个对话需要属于一个对话组
- 对话组可以绑定角色 (App)
- 对话组包含模型配置和上下文

### 3. 上下文管理（重要）
- **只需使用 `options.groupId`** 即可自动保持对话上下文
- 系统会自动查询该对话组的历史记录
- 不需要手动管理 `parentMessageId`
- 返回的 `chatId` 是当前对话记录ID

## 完整对话流程

### 流程图

```
1. 创建对话组（获得 groupId）
   ↓
2. 发起对话（带 groupId）
   ↓
3. 系统自动查询历史对话，构建上下文
   ↓
4. 继续对话（带相同的 groupId）
   ↓
5. 系统自动加载上下文
   ↓
6. 查询对话历史（可选）
   ↓
7. 删除对话组（可选）
```

---

## 接口详细说明

### 1. 创建对话组

**接口：** `POST /open/group/create`

**用途：** 创建一个新的对话组，可选绑定角色

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 外部用户ID |
| appId | number | 否 | 角色ID（不传则创建默认对话） |
| modelConfig | object | 否 | 模型配置（不传则使用系统默认） |
| params | string | 否 | 对话组参数JSON字符串 |

**示例 1：创建默认对话组**

```bash
curl -X POST http://localhost:9520/api/open/group/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001
  }'
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "userId": 1001,
    "appId": null,
    "title": "新对话",
    "config": "{\"modelInfo\":{\"model\":\"gpt-3.5-turbo\",\"modelName\":\"GPT-3.5\",...}}",
    "isSticky": false,
    "isDelete": false,
    "createdAt": "2025-10-22T08:30:20.000Z",
    "updatedAt": "2025-10-22T08:30:20.000Z"
  }
}
```

**示例 2：创建带角色的对话组**

```bash
curl -X POST http://localhost:9520/api/open/group/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "appId": 123
  }'
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 457,
    "userId": 1001,
    "appId": 123,
    "title": "智能助手",
    "config": "{\"modelInfo\":{...}}",
    "isSticky": false,
    "isDelete": false,
    "createdAt": "2025-10-22T08:30:25.000Z",
    "updatedAt": "2025-10-22T08:30:25.000Z"
  }
}
```

---

### 2. 发起对话（首次）

**接口：** `POST /open/chat/chat-process`

**用途：** 发起对话，支持流式返回

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 外部用户ID |
| prompt | string | 是 | 用户提问内容 |
| options.groupId | number | 推荐 | 对话组ID（推荐传递，用于自动管理上下文） |
| appId | number | 否 | 角色ID |
| model | string | 否 | 模型标识（如 gpt-3.5-turbo） |
| imageUrl | string | 否 | 图片URL |
| fileUrl | string | 否 | 文件URL |
| audioUrl | string | 否 | 音频URL（自动ASR识别） |

**示例 1：首次对话**

```bash
curl -X POST http://localhost:9520/api/open/chat/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "prompt": "你好，请介绍一下你自己",
    "options": {
      "groupId": 456
    }
  }'
```

**响应（流式）：**
```
data: 你好
data: ！我是
data: 一个AI
data: 助手

{"text":"你好！我是一个AI助手...","chatId":789,"userBalance":{...}}
```

**响应说明：**
- 流式返回：每个 `data:` 行包含一个文本片段
- 最后一行返回完整的 JSON 对象
- `chatId` - 当前对话记录的ID
- `userBalance` - 用户余额信息（visitor角色为null）

---

### 3. 继续对话（自动带上下文）

**接口：** `POST /open/chat/chat-process`

**示例：带上下文的对话**

```bash
curl -X POST http://localhost:9520/api/open/chat/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "prompt": "你刚才说了什么？",
    "options": {
      "groupId": 456
    }
  }'
```

**响应（流式）：**
```
data: 我刚才
data: 介绍了
data: 自己

{"text":"我刚才介绍了自己...","chatId":790,"userBalance":{...}}
```

**重要提示：**
- **只需传递 `options.groupId`** 即可保持上下文
- 系统会自动查询该对话组的历史记录
- 默认加载最近 12 轮对话作为上下文
- 无需手动管理消息ID

---

### 4. 查询对话组列表

**接口：** `POST /open/group/query`

**用途：** 查询用户的所有对话组

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 外部用户ID |

**示例：**

```bash
curl -X POST http://localhost:9520/api/open/group/query \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001
  }'
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 457,
      "userId": 1001,
      "appId": 123,
      "title": "智能助手",
      "config": "{...}",
      "isSticky": false,
      "isDelete": false,
      "appLogo": "https://example.com/avatar.png",
      "createdAt": "2025-10-22T08:30:25.000Z",
      "updatedAt": "2025-10-22T09:15:30.000Z"
    },
    {
      "id": 456,
      "userId": 1001,
      "appId": null,
      "title": "新对话",
      "config": "{...}",
      "isSticky": false,
      "isDelete": false,
      "appLogo": null,
      "createdAt": "2025-10-22T08:30:20.000Z",
      "updatedAt": "2025-10-22T08:35:10.000Z"
    }
  ]
}
```

---

### 5. 查询对话历史

**接口：** `POST /open/chatLog/query`

**用途：** 查询指定对话组的历史记录

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 外部用户ID |
| groupId | number | 是 | 对话组ID |
| page | number | 否 | 页码（默认1） |
| size | number | 否 | 每页条数（默认20） |

**示例：**

```bash
curl -X POST http://localhost:9520/api/open/chatLog/query \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "groupId": 456,
    "page": 1,
    "size": 20
  }'
```

**响应：**
```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": 789,
        "userId": 1001,
        "groupId": 456,
        "appId": null,
        "prompt": "你好，请介绍一下你自己",
        "answer": "你好！我是一个AI助手...",
        "model": "gpt-3.5-turbo",
        "modelName": "GPT-3.5",
        "parentMessageId": null,
        "messageId": "chatcmpl-abc123xyz",
        "createdAt": "2025-10-22T08:31:00.000Z"
      },
      {
        "id": 790,
        "userId": 1001,
        "groupId": 456,
        "appId": null,
        "prompt": "你刚才说了什么？",
        "answer": "我刚才介绍了自己...",
        "model": "gpt-3.5-turbo",
        "modelName": "GPT-3.5",
        "parentMessageId": "chatcmpl-abc123xyz",
        "messageId": "chatcmpl-def456uvw",
        "createdAt": "2025-10-22T08:32:00.000Z"
      }
    ],
    "count": 2,
    "page": 1,
    "size": 20
  }
}
```

---

### 6. 删除对话组

**接口：** `POST /open/group/del`

**用途：** 删除指定对话组

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 外部用户ID |
| groupId | number | 是 | 对话组ID |

**示例：**

```bash
curl -X POST http://localhost:9520/api/open/group/del \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "groupId": 456
  }'
```

**响应：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

---

### 7. 删除所有非置顶对话组

**接口：** `POST /open/group/delAll`

**用途：** 删除用户的所有非置顶对话组

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 外部用户ID |

**示例：**

```bash
curl -X POST http://localhost:9520/api/open/group/delAll \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001
  }'
```

**响应：**
```json
{
  "success": true,
  "message": "批量删除成功"
}
```

---

## 完整对话示例

### 场景：创建对话组 → 多轮对话 → 查询历史

```bash
# Step 1: 创建对话组
curl -X POST http://localhost:9520/api/open/group/create \
  -H "Content-Type: application/json" \
  -d '{"userId": 1001}'

# 响应: {"success":true,"data":{"id":456,...}}

# Step 2: 第一轮对话
curl -X POST http://localhost:9520/api/open/chat/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "prompt": "什么是人工智能？",
    "options": {"groupId": 456}
  }'

# 响应流式输出，最后返回:
# {"text":"人工智能是...","chatId":789}

# Step 3: 第二轮对话（自动带上下文）
curl -X POST http://localhost:9520/api/open/chat/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "prompt": "它有哪些应用场景？",
    "options": {"groupId": 456}
  }'

# 系统会自动加载之前的对话上下文
# 响应: {"text":"根据刚才的介绍，人工智能的应用场景有...","chatId":790}

# Step 4: 第三轮对话（继续上下文）
curl -X POST http://localhost:9520/api/open/chat/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "prompt": "能举个例子吗？",
    "options": {"groupId": 456}
  }'

# Step 5: 查询对话历史
curl -X POST http://localhost:9520/api/open/chatLog/query \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "groupId": 456
  }'

# 响应: {"success":true,"data":{"rows":[...],"count":3}}
```

---

## 高级功能

### 1. 语音对话

**接口：** `POST /open/chat/chat-process-voice`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 外部用户ID |
| audioUrl | string | 条件 | 音频URL（与audioBase64二选一） |
| audioBase64 | string | 条件 | 音频Base64（与audioUrl二选一） |
| options.groupId | number | 推荐 | 对话组ID（用于自动管理上下文） |
| appId | number | 否 | 角色ID |

**示例：使用音频URL**

```bash
curl -X POST http://localhost:9520/api/open/chat/chat-process-voice \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "audioUrl": "https://example.com/audio.mp3",
    "options": {"groupId": 456}
  }'
```

**流程：**
1. 系统自动下载音频
2. ASR 识别为文字
3. 发送给 AI 模型
4. 流式返回文字回复

---

### 2. TTS 文字转语音

**接口：** `POST /open/chat/tts-process`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 外部用户ID |
| prompt | string | 是 | 要合成的文本 |
| chatId | number | 否 | 对话记录ID |

**示例：**

```bash
curl -X POST http://localhost:9520/api/open/chat/tts-process \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1001,
    "prompt": "你好，欢迎使用AI助手"
  }'
```

**响应：**
```json
{
  "ttsUrl": "https://example.com/audio/tts-output.mp3"
}
```

---

### 3. 好感度系统（角色对话）

**查询好感度状态**

**接口：** `GET /open/affection/status?userId=1001&appId=123`

**示例：**

```bash
curl -X GET "http://localhost:9520/api/open/affection/status?userId=1001&appId=123"
```

**响应：**
```json
{
  "userId": 1001,
  "appId": 123,
  "affectionLevel": 75,
  "stage": 2,
  "stageName": "好感",
  "interactionCount": 15,
  "lastInteractionTime": "2025-10-22T09:15:30.000Z"
}
```

**查询好感度规则**

**接口：** `GET /open/affection/rules?appId=123`

**示例：**

```bash
curl -X GET "http://localhost:9520/api/open/affection/rules?appId=123"
```

**响应：**
```json
{
  "appId": 123,
  "rules": [
    {
      "stage": 1,
      "stageName": "陌生",
      "minLevel": 0,
      "maxLevel": 30,
      "behaviors": ["礼貌但疏远", "回答简短"]
    },
    {
      "stage": 2,
      "stageName": "好感",
      "minLevel": 31,
      "maxLevel": 70,
      "behaviors": ["友好热情", "主动关心"]
    },
    {
      "stage": 3,
      "stageName": "亲密",
      "minLevel": 71,
      "maxLevel": 100,
      "behaviors": ["非常亲密", "分享隐私"]
    }
  ]
}
```

---

## 错误处理

### 常见错误码

| HTTP状态码 | 说明 | 处理方式 |
|-----------|------|---------|
| 400 | 请求参数错误 | 检查必填参数 |
| 402 | 额度不足（不应出现在开放API） | 联系管理员 |
| 404 | 资源不存在 | 检查 groupId/appId 是否有效 |
| 500 | 服务器内部错误 | 重试或联系管理员 |

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述信息"
}
```

**示例：**

```json
{
  "success": false,
  "message": "userId 必填"
}
```

---

## 最佳实践

### 1. 上下文管理

**推荐做法：**
```javascript
// 维护对话状态
const conversation = {
  userId: 1001,
  groupId: 456
};

// 第一次对话
await chat({
  userId: conversation.userId,
  prompt: "你好",
  options: { groupId: conversation.groupId }
});

// 第二次对话（自动带上下文）
await chat({
  userId: conversation.userId,
  prompt: "继续",
  options: { groupId: conversation.groupId }
});

// 系统会自动加载之前的对话历史，无需手动管理
```

### 2. 对话组管理

**推荐做法：**
- 为每个独立的对话主题创建新的对话组
- 定期清理不需要的对话组
- 使用有意义的 `title` 便于管理
- 同一个对话组内会自动保持上下文（最近12轮）

### 3. 错误重试

**推荐做法：**
```javascript
async function chatWithRetry(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chat(params);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // 指数退避
    }
  }
}
```

### 4. 流式响应处理

**推荐做法：**
```javascript
const response = await fetch('/api/open/chat/chat-process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 1001,
    prompt: '你好',
    options: { groupId: 456 }
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullText = '';
let chatId = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const text = line.slice(6);
      fullText += text;
      console.log(text); // 实时显示
    } else if (line.trim() && line.startsWith('{')) {
      // 最后一行是完整的 JSON
      const result = JSON.parse(line);
      chatId = result.chatId;
    }
  }
}

console.log('完整回复:', fullText);
console.log('对话记录ID:', chatId);
```

---

## 完整 Node.js 示例

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:9520/api/open';
const USER_ID = 1001;

class ChatClient {
  constructor(userId) {
    this.userId = userId;
    this.groupId = null;
  }

  // 创建对话组
  async createGroup(appId = null) {
    const response = await axios.post(`${API_BASE}/group/create`, {
      userId: this.userId,
      appId
    });
    this.groupId = response.data.data.id;
    return response.data;
  }

  // 发起对话（自动带上下文）
  async chat(prompt) {
    const response = await axios.post(`${API_BASE}/chat/chat-process`, {
      userId: this.userId,
      prompt,
      options: {
        groupId: this.groupId
      }
    }, {
      responseType: 'stream'
    });

    let fullText = '';
    let chatId = null;

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const text = line.slice(6);
            fullText += text;
            process.stdout.write(text); // 实时输出
          } else if (line.trim() && line.startsWith('{')) {
            try {
              const result = JSON.parse(line);
              chatId = result.chatId;
              console.log('\n');
              resolve({ text: fullText, chatId });
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      response.data.on('error', reject);
    });
  }

  // 查询历史
  async getHistory(page = 1, size = 20) {
    const response = await axios.post(`${API_BASE}/chatLog/query`, {
      userId: this.userId,
      groupId: this.groupId,
      page,
      size
    });
    return response.data;
  }

  // 删除对话组
  async deleteGroup() {
    const response = await axios.post(`${API_BASE}/group/del`, {
      userId: this.userId,
      groupId: this.groupId
    });
    return response.data;
  }
}

// 使用示例
async function main() {
  const client = new ChatClient(USER_ID);

  // 1. 创建对话组
  console.log('创建对话组...');
  await client.createGroup();

  // 2. 第一轮对话
  console.log('用户: 什么是人工智能？');
  console.log('AI: ');
  await client.chat('什么是人工智能？');
  // 系统自动管理上下文

  // 3. 第二轮对话（自动带上下文）
  console.log('用户: 它有哪些应用？');
  console.log('AI: ');
  await client.chat('它有哪些应用？');
  // 无需传递 parentMessageId，系统自动加载历史

  // 4. 查询历史
  console.log('\n查询对话历史...');
  const history = await client.getHistory();
  console.log(`共 ${history.data.count} 条对话记录`);

  // 5. 删除对话组
  console.log('删除对话组...');
  await client.deleteGroup();
  console.log('完成！');
}

main().catch(console.error);
```

---

## 总结

### 核心流程
1. **创建对话组** → 获得 `groupId`
2. **首次对话** → 传递 `groupId`，系统自动管理上下文
3. **继续对话** → 继续传递**相同的 `groupId`**，系统自动加载历史
4. **查询历史** → 使用 `groupId` 查询
5. **删除对话** → 清理不需要的对话组

### 关键要点
- ✅ 所有接口无需认证
- ✅ 不检查额度，不扣费
- ✅ `userId` 可以是任意数字
- ✅ **只需使用 `groupId` 即可自动保持上下文**
- ✅ 系统自动查询历史对话（默认最近12轮）
- ✅ 返回的 `chatId` 是对话记录ID
- ✅ 支持流式响应
- ✅ 支持语音、图片、文件

### 与 parentMessageId 的区别

**旧方式（不推荐）：**
```javascript
// 需要手动管理 parentMessageId
let parentMessageId = null;
const res1 = await chat({ prompt: '你好' });
parentMessageId = res1.parentMessageId;

const res2 = await chat({ prompt: '继续', parentMessageId });
// 需要不断更新 parentMessageId
```

**新方式（推荐）：**
```javascript
// 系统自动管理上下文
const groupId = 456;
await chat({ prompt: '你好', options: { groupId } });
await chat({ prompt: '继续', options: { groupId } });
// 系统自动加载历史，无需手动管理
```

### 技术支持
如有问题，请访问：
- Swagger 文档：`http://your-domain:9520/api-docs`
- GitHub Issues: [项目地址]
