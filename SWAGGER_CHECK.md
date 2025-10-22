# Swagger 配置检查清单

## ✅ 已配置的开放接口标签

| Tag 名称 | 控制器文件 | 描述 | 状态 |
|---------|-----------|------|------|
| `open-app` | `open-app.controller.ts` | 【角色管理】角色列表/详情、分类CRUD、角色CRUD、全局情绪映射 | ✅ 已配置 |
| `open-voice` | `open-voice.controller.ts` | 【语音管理】音色列表/详情、声音复刻、参数设置、试听、ASR 语音识别 | ✅ 已配置 |
| `open-affection` | `open-affection.controller.ts` | 【好感度系统】规则查询/维护、用户好感度状态查询 | ✅ 已配置 |
| `open-chat` | `open-chat.controller.ts` | 【对话接口】文字对话、语音对话（ASR+LLM）、TTS 文字转语音 | ✅ 已配置 |
| `open-chatLog` | `open-chatLog.controller.ts` | 【聊天记录】查询对话列表、按应用查询、查询单条消息 | ✅ 已配置 |

---

## 🆕 本次更新内容

### 1. Swagger 文档标题和描述优化

**修改位置**: `service/src/main.ts:126-182`

**变更对比**:

#### 之前（Git 版本）
```typescript
.setTitle('开放 API')
.setDescription('99AI服务API文档（含 /api/open/* 开放接口：对外可直接调用）')
.setVersion('1.0')
.addTag('open-app', '开放的角色管理接口（读写）：...')
.addTag('open-voice', '开放的语音管理接口（读写）：...')
```

#### 现在（已更新）
```typescript
.setTitle('99AI 开放 API')
.setDescription(`
# 99AI 服务 API 文档

## 开放接口说明
所有 /api/open/* 路径下的接口均为**开放接口**...

## WebSocket 实时语音通话
地址: ws://your-domain/api/realtime/voice-call

### 功能特性
- ✅ 实时语音识别（ASR）
- ✅ AI 智能对话（LLM）
...

### 详细文档
- VOICE_CALL_API.md
- VOICE_CALL_QUICK_START.md
- API_OVERVIEW.md
`)
.setVersion('1.0.0')
.addTag('open-app', '【角色管理】...')
.addTag('open-voice', '【语音管理】...')
```

---

## 🔍 其他控制器（非开放接口）

以下控制器**不在开放 API 文档中显示**（需要鉴权）:

| Tag | 控制器 | 说明 |
|-----|--------|------|
| `auth` | auth.controller.ts | 认证相关 |
| `user` | user.controller.ts | 用户管理 |
| `app` | app.controller.ts | 应用管理（需鉴权） |
| `chatgpt` | chat.controller.ts | 聊天（需鉴权） |
| `group` | chatGroup.controller.ts | 群组管理 |
| `models` | models.controller.ts | 模型管理 |
| `config` | globalConfig.controller.ts | 全局配置 |
| `upload` | upload.controller.ts | 文件上传 |
| `voice` | voice.controller.ts | 语音管理（需鉴权） |
| `affection` | affection.controller.ts | 好感度（需鉴权） |
| `chatLog` | chatLog.controller.ts | 聊天记录（需鉴权） |
| `balance` | userBalance.controller.ts | 余额管理 |
| `crami` | crami.controller.ts | 卡密管理 |
| `order` | order.controller.ts | 订单管理 |
| `pay` | pay.controller.ts | 支付管理 |
| `plugin` | plugin.controller.ts | 插件管理 |
| `badWords` | badWords.controller.ts | 敏感词管理 |
| `autoReply` | autoReply.controller.ts | 自动回复 |
| `statistic` | statistic.controller.ts | 统计数据 |
| `signIn` | signin.controller.ts | 签到 |
| `share` | share.controller.ts | 分享 |
| `official` | official.controller.ts | 官方接口 |
| `spa` | spa.controller.ts | SPA 路由 |

---

## 📋 验证清单

访问以下地址验证配置：

### 本地开发环境
- [ ] http://localhost:9520/open-api-docs - 开放接口文档
- [ ] http://localhost:9520/open-api.json - 开放接口 JSON
- [ ] http://localhost:9520/api-docs - 完整接口文档（仅开发环境）

### 生产环境
- [ ] https://role.aivip1.top/open-api-docs
- [ ] https://role.aivip1.top/open-api.json

### 验证要点
- [ ] 是否只显示 5 个 open-* 标签
- [ ] 描述中是否包含 WebSocket 说明
- [ ] 每个接口是否有清晰的参数说明
- [ ] 响应示例是否正确

---

## 🚀 部署建议

### 1. 检查环境变量
```bash
# service/.env
ISDEV=true  # 开发环境显示完整文档
ISDEV=false # 生产环境只显示开放接口
```

### 2. 重启服务
```bash
cd service
pnpm build
pm2 restart all
```

### 3. 验证访问
```bash
# 检查开放接口文档
curl https://role.aivip1.top/open-api.json | jq '.info.title'
# 应该返回: "99AI 开放 API"

# 检查 tags 数量
curl https://role.aivip1.top/open-api.json | jq '.tags | length'
# 应该返回: 5
```

---

## 📝 注意事项

1. **不要删除任何 open-* 控制器的 @ApiTags 注解**
2. **不要修改 @Controller 路径中的 'open/' 前缀**
3. **确保所有 open-* 接口都有 @ApiOperation 描述**
4. **生产环境不应暴露非 open-* 的接口文档**

---

## 🔗 相关文档

- [VOICE_CALL_API.md](./VOICE_CALL_API.md) - 完整技术文档
- [API_OVERVIEW.md](./API_OVERVIEW.md) - 接口总览
- [VOICE_CALL_QUICK_START.md](./VOICE_CALL_QUICK_START.md) - 快速上手

---

**最后更新**: 2025-01-21
**版本**: v1.1.0
