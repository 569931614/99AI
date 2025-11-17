# Add open chat cookie deduction

## Why
- 外部调用 99AI 的开放聊天接口需要实时扣除猫饼用户饼干，确保与管理后台账务一致
- maobing 已提供 `/api/open/user/cookie` 接口按 userId 进行增减，需要 99AI 在调用前校验并扣费
- 域名（maobingBaseUrl）及 userId 将由外部合作方传入，需要 SDK 自动处理

## What Changes
- 开放聊天入口 (`POST /open/chat/chat-process`、`POST /open/chat/chat-process-voice`) 新增 maobing 域名参数并调用猫饼扣费接口
- 根据请求内容自动识别消息类型（文字/语音/图片）并映射到约定的饼干消耗规则（1 文本=1 枚、语音/图片=2 枚）
- 扣费失败或余额不足时返回错误并阻止 AI 对话；对话失败时退还已扣饼干
- 统一封装 Maobing API HTTP 客户端，便于未来扩展/配置

## Impact
- 涉及 service 模块（NestJS），新增对猫饼接口的 HTTP 依赖
- 需配置默认 maobing 域名，同时兼容外部传入的自定义域名
- OpenSpec delta 记录开放聊天扣费规则
