# 语音通话系统自测报告

**测试时间**: 2025-10-01 01:30
**测试范围**: 语音识别 ASR 配置完整性检查
**测试状态**: ✅ 通过

---

## 📋 测试项目总览

| 测试项 | 状态 | 说明 |
|--------|------|------|
| 前端采样率配置 | ✅ 通过 | 8000 Hz |
| 后端默认采样率 | ✅ 通过 | 8000 Hz |
| 模型选择逻辑 | ✅ 通过 | 自动匹配 |
| Authorization Header | ✅ 通过 | Bearer 大写 |
| 配置链路一致性 | ✅ 通过 | 完整匹配 |

---

## 🔍 详细测试结果

### 1. 前端配置检查 ✅

**文件**: `chat/src/views/chat/components/VoiceCall.vue`

```typescript
// 第 23 行
const sampleRate = 8000
```

**结果**: ✅ 采样率配置为 8000 Hz，与 8k 模型匹配

---

### 2. 后端 WebSocket 处理器配置 ✅

**文件**: `service/src/main.ts`

#### 问题修复前:
```typescript
// ❌ 第 211 行 - 默认值错误
let cfg = { sampleRate: 16000, ... }

// ❌ 第 529 行 - 默认值错误
cfg.sampleRate = Number(msg.sampleRate || 16000);

// ❌ 第 555 行 - 默认值错误
cfg.sampleRate = Number(msg.sampleRate || 16000);
```

**问题**: 默认采样率 16000 Hz 与前端 8000 Hz 不匹配，会导致使用错误的模型

#### 修复后:
```typescript
// ✅ 第 211 行
let cfg = { sampleRate: 8000, ... }

// ✅ 第 529 行
cfg.sampleRate = Number(msg.sampleRate || 8000);

// ✅ 第 555 行
cfg.sampleRate = Number(msg.sampleRate || 8000);
```

**结果**: ✅ 所有默认采样率统一为 8000 Hz

---

### 3. 模型选择逻辑检查 ✅

**文件**: `service/src/modules/voice/voice.service.ts`

#### 问题修复前:
```typescript
// ❌ 第 494-495 行 - 固定使用 8k 模型
const sampleRate = Number(body.sample_rate ?? 16000);  // 默认 16k 采样率
const requestedModel = body.model || 'paraformer-realtime-8k-v2';  // 固定 8k 模型
// 矛盾: 16k 采样率配 8k 模型 = 识别失败
```

**问题**: 采样率和模型不匹配，16k 采样率强制使用 8k 模型会导致识别失败

#### 修复后:
```typescript
// ✅ 第 494-497 行 - 智能选择模型
const sampleRate = Number(body.sample_rate ?? 16000);
const defaultModel = sampleRate <= 8000 ? 'paraformer-realtime-8k-v2' : 'paraformer-realtime-v2';
const requestedModel = body.model || defaultModel;
```

**结果**: ✅ 根据实际采样率自动选择合适的模型

#### 模型候选列表:
```typescript
// ✅ 第 662-670 行
const candidates = Array.from(new Set([
  requestedModel,
  sampleRate <= 8000 ? 'paraformer-realtime-8k-v2' : 'paraformer-realtime-v2',
  'paraformer-realtime-v2',       // 16k 模型
  'paraformer-realtime-8k-v2',    // 8k 模型
  'paraformer-realtime-v1',       // 旧版 16k
  'paraformer-realtime-8k-v1',    // 旧版 8k
]));
```

**结果**: ✅ 完整的模型回退链，支持所有可用模型

---

### 4. Authorization Header 修复 ✅

**文件**: `service/src/modules/voice/voice.service.ts`

#### 修复前:
```typescript
// ❌ 第 525 行
Authorization: `bearer ${apiKey}`  // 小写
```

#### 修复后:
```typescript
// ✅ 第 525 行
Authorization: `Bearer ${apiKey}`  // 大写 B（标准格式）
```

**结果**: ✅ 符合 HTTP 标准规范

---

### 5. main.ts 中的 ASR 调用检查 ✅

**文件**: `service/src/main.ts`

#### 修复前:
```typescript
// ❌ 第 349 行 - 硬编码 8k 模型
model: 'paraformer-realtime-8k-v2',
```

**问题**: 硬编码模型名称，不够灵活

#### 修复后:
```typescript
// ✅ 第 349 行 - 移除硬编码，自动选择
// 不指定 model，让 voice.service 根据采样率自动选择
```

**结果**: ✅ 让 voice.service 根据采样率智能选择模型

---

## 🔗 配置链路验证

### 完整数据流:

```
1. 前端发送
   VoiceCall.vue (line 23)
   sampleRate = 8000
   ↓
   connectWS() (line 267)
   { type: 'start', sampleRate: 8000, format: 'pcm', voice_id: '...' }

2. 后端接收
   main.ts (line 553-560)
   msg.type === 'start'
   cfg.sampleRate = Number(msg.sampleRate || 8000)
   → cfg.sampleRate = 8000 ✅

3. ASR 调用
   main.ts (line 344-352)
   voiceService.asr({
     sample_rate: cfg.sampleRate,  // 8000
     format: 'pcm',
     // 不指定 model
   })

4. 模型选择
   voice.service.ts (line 494-497)
   sampleRate = 8000
   defaultModel = sampleRate <= 8000
     ? 'paraformer-realtime-8k-v2'  ← 选择这个 ✅
     : 'paraformer-realtime-v2'

5. WebSocket API 调用
   voice.service.ts (line 535-554)
   {
     header: { action: 'run-task', ... },
     payload: {
       model: 'paraformer-realtime-8k-v2',  ✅
       parameters: {
         format: 'pcm',
         sample_rate: 8000,  ✅
       }
     }
   }
```

**结果**: ✅ 配置链路完整一致，8000 Hz 采样率正确匹配 8k 模型

---

## 🎯 已修复的问题清单

| # | 文件 | 行号 | 问题 | 修复 |
|---|------|------|------|------|
| 1 | service/src/main.ts | 211 | 默认采样率 16000 | ✅ 改为 8000 |
| 2 | service/src/main.ts | 529 | 默认采样率 16000 | ✅ 改为 8000 |
| 3 | service/src/main.ts | 555 | 默认采样率 16000 | ✅ 改为 8000 |
| 4 | service/src/main.ts | 349 | 硬编码 8k 模型 | ✅ 移除，自动选择 |
| 5 | voice.service.ts | 495 | 固定 8k 模型 | ✅ 智能选择 |
| 6 | voice.service.ts | 525 | bearer 小写 | ✅ 改为 Bearer |
| 7 | voice.service.ts | 662-670 | 模型候选列表不完整 | ✅ 添加所有模型 |

---

## ✅ 测试结论

### 配置状态
- ✅ **前端采样率**: 8000 Hz
- ✅ **后端默认采样率**: 8000 Hz
- ✅ **自动模型选择**: paraformer-realtime-8k-v2
- ✅ **模型回退链**: 完整
- ✅ **Authorization**: 标准格式

### 预期行为

当用户使用语音通话功能时：

1. ✅ 前端发送 8000 Hz 采样率配置
2. ✅ 后端接收并使用 8000 Hz
3. ✅ 自动选择 `paraformer-realtime-8k-v2` 模型
4. ✅ 如果该模型失败，自动回退到其他可用模型
5. ✅ WebSocket API 调用参数正确匹配

### 兼容性

系统现在支持两种采样率模式：

| 采样率 | 使用的模型 | 适用场景 |
|--------|-----------|---------|
| 8000 Hz | paraformer-realtime-8k-v2 | 当前配置，节省带宽 |
| 16000 Hz | paraformer-realtime-v2 | 可选升级，更好识别 |

如果将来需要提升识别效果，只需修改前端采样率：
```typescript
// VoiceCall.vue line 23
const sampleRate = 16000  // 从 8000 改为 16000
```

系统会自动使用 `paraformer-realtime-v2` 模型，无需修改其他代码。

---

## 🚀 下一步操作

### 1. 立即测试
```bash
cd service
pnpm dev
```

### 2. 测试步骤
1. 打开聊天界面
2. 点击语音通话按钮
3. 点击"连接通话"
4. 按住"按住说话"按钮
5. 说话："你好，测试语音识别"
6. 松开按钮
7. 观察识别结果

### 3. 观察日志
应该看到：
```
[DEBUG] ASR调用参数 (尝试 1/3): format=pcm, sampleRate=8000, audioSize=xxxxx
[DEBUG] ASR服务调用成功
[DEBUG] ASR识别结果: "你好，测试语音识别"
[DEBUG] [ASR.final] 你好，测试语音识别
```

### 4. 如果仍有问题
检查：
- ✅ DashScope API Key 是否正确配置
- ✅ 网络是否能访问阿里云服务
- ✅ 是否开通了 Paraformer 实时识别服务
- ✅ 麦克风权限是否授予

---

## 📚 相关文档

- [语音通话修复文档](./VOICE_CALL_FIX.md)
- [ASR 模型修复文档](./ASR_MODEL_FIX.md)
- [阿里云 Paraformer 文档](https://help.aliyun.com/zh/model-studio/websocket-for-paraformer-real-time-service)

---

**测试人员**: Claude Code (Sonnet 4.5)
**测试日期**: 2025-10-01
**测试状态**: ✅ 所有检查项通过，可以进行实际测试
