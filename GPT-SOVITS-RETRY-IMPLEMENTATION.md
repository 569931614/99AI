# GPT-SoVITS 请求重试功能实现文档

## 概述

为 99AI 与 GPT-SoVITS 服务的通信添加了完善的重试机制，提高系统的稳定性和容错能力。

## 实现位置

**文件**: `service/src/modules/voice/voice.service.ts`

## 功能特性

### 1. 通用重试工具函数 `retryWithBackoff`

**位置**: `voice.service.ts:49-105`

**特性**:
- 支持指数退避策略（Exponential Backoff）
- 智能错误判断（仅重试可恢复的错误）
- 灵活的配置选项
- 详细的重试日志

**可重试的错误类型**:
- 网络连接错误 (`ECONNREFUSED`)
- 超时错误 (`ETIMEDOUT`)
- DNS 解析失败 (`ENOTFOUND`)
- 5xx 服务器错误 (500-599)
- 503 服务不可用

**不可重试的错误类型**:
- 4xx 客户端错误（400, 401, 403, 404 等）
- 业务逻辑错误

### 2. 环境变量配置

**文件**: `service/.env.example`

```bash
# GPT-SoVITS 重试配置
# 最大重试次数（默认: 3）
GPT_SOVITS_MAX_RETRIES=3
# 初始重试延迟（毫秒，默认: 1000）
GPT_SOVITS_RETRY_DELAY=1000
# 指数退避倍数（默认: 2）
GPT_SOVITS_RETRY_BACKOFF=2
```

### 3. 应用重试逻辑的方法

所有与 GPT-SoVITS 服务通信的关键方法都已应用重试逻辑：

#### 3.1 音频合成请求 (`requestGptSovitsAudio`)
- **位置**: `voice.service.ts:2588-2700`
- **支持**: 流式和非流式模式
- **重试策略**: 网络错误和 5xx 错误自动重试

#### 3.2 角色列表查询 (`listGptSovitsCharacters`)
- **位置**: `voice.service.ts:289-316`
- **功能**: 获取 GPT-SoVITS 角色列表
- **重试策略**: 连接失败自动重试

#### 3.3 角色信息查询 (`getGptSovitsCharacterInfo`)
- **位置**: `voice.service.ts:318-347`
- **功能**: 获取指定角色的详细信息
- **重试策略**: 连接失败自动重试

#### 3.4 模型加载 (`ensureGptSovitsModelLoaded`)
- **位置**: `voice.service.ts:2410-2457`
- **功能**: 加载 GPT-SoVITS 模型
- **重试策略**: 模型加载失败自动重试

#### 3.5 音频上传 (`uploadAudioToGptSovits`)
- **位置**: `voice.service.ts:2516-2586`
- **功能**: 上传音频文件到 GPT-SoVITS 服务器
- **重试策略**: 上传失败自动重试

## 重试行为示例

### 场景 1: 默认配置（3次重试，1秒初始延迟，2倍退避）

```
第1次尝试: 立即执行
↓ 失败
等待 1000ms
↓
第2次尝试: 1秒后执行
↓ 失败
等待 2000ms
↓
第3次尝试: 2秒后执行
↓ 失败
等待 4000ms
↓
第4次尝试: 4秒后执行（最后一次）
↓ 失败
抛出错误
```

**总重试时间**: 约 7 秒

### 场景 2: 自定义配置（5次重试，500ms初始延迟，1.5倍退避）

```env
GPT_SOVITS_MAX_RETRIES=5
GPT_SOVITS_RETRY_DELAY=500
GPT_SOVITS_RETRY_BACKOFF=1.5
```

```
第1次尝试: 立即执行
↓ 失败
等待 500ms
↓
第2次尝试: 0.5秒后执行
↓ 失败
等待 750ms
↓
第3次尝试: 0.75秒后执行
↓ 失败
等待 1125ms
↓
第4次尝试: 1.125秒后执行
↓ 失败
等待 1687ms
↓
第5次尝试: 1.687秒后执行
↓ 失败
等待 2531ms
↓
第6次尝试: 2.531秒后执行（最后一次）
↓ 失败
抛出错误
```

**总重试时间**: 约 7.6 秒

## 日志示例

### 成功场景（无重试）
```log
[VoiceService] [requestGptSovitsAudio] Calling GPT-SoVITS at http://47.100.209.118:9880/tts
[VoiceService] [requestGptSovitsAudio] Payload: {...}
```

### 重试场景
```log
[VoiceService] [requestGptSovitsAudio] Calling GPT-SoVITS at http://47.100.209.118:9880/tts
[VoiceService] [requestGptSovitsAudio] Payload: {...}
[VoiceService] [requestGptSovitsAudio] 请求失败，正在重试 (1/3)，延迟 1000ms。错误: connect ECONNREFUSED 47.100.209.118:9880
[VoiceService] [requestGptSovitsAudio] 请求失败，正在重试 (2/3)，延迟 2000ms。错误: connect ECONNREFUSED 47.100.209.118:9880
[VoiceService] [requestGptSovitsAudio] 请求成功（第3次尝试）
```

### 最终失败场景
```log
[VoiceService] [requestGptSovitsAudio] Calling GPT-SoVITS at http://47.100.209.118:9880/tts
[VoiceService] [requestGptSovitsAudio] Payload: {...}
[VoiceService] [requestGptSovitsAudio] 请求失败，正在重试 (1/3)，延迟 1000ms。错误: connect ETIMEDOUT
[VoiceService] [requestGptSovitsAudio] 请求失败，正在重试 (2/3)，延迟 2000ms。错误: connect ETIMEDOUT
[VoiceService] [requestGptSovitsAudio] 请求失败，正在重试 (3/3)，延迟 4000ms。错误: connect ETIMEDOUT
[VoiceService] [requestGptSovitsAudio] 请求失败: connect ETIMEDOUT
Error: 请求失败: connect ETIMEDOUT
```

## 配置建议

### 生产环境配置
```bash
# 生产环境：更多重试次数，更长的初始延迟
GPT_SOVITS_MAX_RETRIES=5
GPT_SOVITS_RETRY_DELAY=2000
GPT_SOVITS_RETRY_BACKOFF=2
```

### 开发环境配置
```bash
# 开发环境：快速失败，便于调试
GPT_SOVITS_MAX_RETRIES=2
GPT_SOVITS_RETRY_DELAY=500
GPT_SOVITS_RETRY_BACKOFF=1.5
```

### 高流量场景配置
```bash
# 高流量：减少重试，避免雪崩
GPT_SOVITS_MAX_RETRIES=2
GPT_SOVITS_RETRY_DELAY=1000
GPT_SOVITS_RETRY_BACKOFF=1.5
```

## 优势

1. **提高稳定性**: 自动处理临时网络故障
2. **降低错误率**: 瞬时错误不会直接导致请求失败
3. **优化用户体验**: 用户无需手动重试
4. **灵活配置**: 可根据不同环境调整重试策略
5. **详细日志**: 便于问题排查和监控
6. **智能重试**: 仅对可恢复错误重试，避免无效重试

## 注意事项

1. **不要设置过多重试次数**: 可能导致请求排队，影响系统性能
2. **注意超时时间**: 总超时时间 = 单次请求超时 × (重试次数 + 1) + 重试延迟累计
3. **监控重试率**: 如果重试率过高，应检查 GPT-SoVITS 服务状态
4. **幂等性**: 确保重试操作是幂等的（音频合成天然幂等）

## 测试验证

### 测试场景
1. ✅ 正常请求（无重试）
2. ✅ 瞬时网络故障（自动重试成功）
3. ✅ 服务临时不可用（自动重试成功）
4. ✅ 服务完全不可用（重试后失败，抛出错误）
5. ✅ 客户端错误（不重试，直接失败）

### 测试方法
```bash
# 1. 启动服务
cd service
pnpm dev

# 2. 模拟网络故障（暂停 GPT-SoVITS 服务）
# 观察日志中的重试行为

# 3. 恢复服务
# 观察请求是否成功
```

## 更新日志

**日期**: 2025-11-27

**修改内容**:
- ✅ 添加通用重试工具函数 `retryWithBackoff`
- ✅ 为 `requestGptSovitsAudio` 添加重试逻辑（流式和非流式）
- ✅ 为 `listGptSovitsCharacters` 添加重试逻辑
- ✅ 为 `getGptSovitsCharacterInfo` 添加重试逻辑
- ✅ 为 `ensureGptSovitsModelLoaded` 添加重试逻辑
- ✅ 为 `uploadAudioToGptSovits` 添加重试逻辑
- ✅ 添加环境变量配置文档

**相关文件**:
- `service/src/modules/voice/voice.service.ts`
- `service/.env.example`

## 后续优化建议

1. **添加监控指标**: 记录重试次数、成功率等指标
2. **熔断机制**: 当错误率过高时，暂停请求一段时间
3. **降级策略**: 当 GPT-SoVITS 不可用时，切换到备用服务或返回默认响应
4. **分布式追踪**: 在分布式系统中追踪重试行为
5. **健康检查**: 定期检查 GPT-SoVITS 服务健康状态

## 参考资料

- [Exponential Backoff - AWS](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Retry Pattern - Microsoft](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)
- [axios-retry](https://github.com/softonic/axios-retry)
