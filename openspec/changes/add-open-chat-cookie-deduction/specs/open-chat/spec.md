# Open Chat Cookie Charging

## ADDED Requirements

### Requirement: Deduct Maobing cookies before open chat
99AI 开放聊天接口在调用内部 AI 逻辑前 MUST 先调用 Maobing 的 `/api/open/user/cookie` 接口，确保用户有足够饼干并完成扣费。

#### Scenario: Text prompt consumes 1 cookie
- **GIVEN** 调用 `POST /open/chat/chat-process`，仅包含文本 prompt
- **WHEN** 接口确定消息类型为文字
- **THEN** 它调用 Maobing 接口 `type=2, num=1` 扣减饼干
- **AND** 若扣费成功才继续聊天流程

#### Scenario: Voice prompt consumes 2 cookies
- **GIVEN** 请求包含 `audioUrl` 或直接调用 `POST /open/chat/chat-process-voice`
- **THEN** 系统以语音规则扣费 `num=2`

#### Scenario: Image prompt consumes 2 cookies
- **GIVEN** 请求包含 `imageUrl`
- **THEN** 系统扣费 `num=2` 并附带 `remark` 标识

#### Scenario: Custom Maobing domain
- **GIVEN** 调用方传入 `maobingBaseUrl`
- **THEN** 99AI SHALL 使用 `{maobingBaseUrl}/api/open/user/cookie` 作为目标地址
- **ELSE** 默认使用预设域名

#### Scenario: Handle insufficient balance or user errors
- **GIVEN** Maobing 返回余额不足/用户不存在
- **THEN** 99AI SHALL 中断聊天并返回相同的错误提示
- **AND** 不会调用 ChatService

#### Scenario: Refund when downstream fails
- **GIVEN** 扣费成功但聊天流程抛出异常
- **THEN** 99AI SHALL 调用 Maobing 接口 `type=1` 退回相同数量的饼干
- **AND** 记录错误日志
