---
title: 开放接口说明
---

# 开放接口说明（/api/open/\*）

本页为对外开放接口的字段说明清单。建议对接方同时参考在线文档：

- OpenAPI JSON：`/open-api.json`
- Swagger UI：`/open-api-docs`

以下仅列出“角色管理”相关的关键接口与字段释义。

## 角色创建（POST /api/open/app/createApp）

请求体字段：

- name：App 应用名称（必填）
- catId：分类 ID 列表（逗号分隔，必填）
- preset：角色设定/预设场景信息（推荐）
- coverImg：封面图片 URL（可选）
- voiceId：角色默认音色 ID（可选，DashScope/CosyVoice voice_id）
- emotionVoices：情绪-音色映射数组（可选）。元素结构：
  - emotionId：全局情绪 ID（必填）
  - voiceId：音色 ID（必填）

返回体：

- code：状态码，200 表示成功
- message：消息文本
- data：创建后的角色对象

## 角色更新（POST /api/open/app/updateApp）

请求体字段：

- id：角色 ID（必填）
- name：App 应用名称（可选）
- catId：分类 ID 列表（逗号分隔，可选）
- preset：角色设定/预设场景信息（可选）
- coverImg：封面图片 URL（可选）
- voiceId：角色默认音色 ID（可选）
- emotionVoices：情绪-音色映射数组，仅传 {emotionId, voiceId} 且 voiceId 非空（可选）

返回体：

- code：状态码
- message：消息文本（如“修改角色信息成功”）
- data：无或变更后的信息

## 角色列表（GET /api/open/app/list）

查询参数：

- page：页码（可选）
- size：每页数量（可选）
- name：按名称模糊搜索（可选）
- status：状态过滤 1 启用、0 禁用（可选）
- catId：分类 ID 过滤（可选）

返回体：

- code：状态码
- message：消息文本
- data：{ rows, count }

> 其他模块（聊天、音色、好感度）的字段释义，可在 `/open-api-docs` 中查看各接口的参数与示例。
