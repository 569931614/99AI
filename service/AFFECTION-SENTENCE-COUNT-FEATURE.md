# 好感度句数统计功能说明

## 📋 功能概述

本次更新为好感度管理系统添加了**句数统计**功能，现在好感度阶段的判定不仅基于分数，还需要满足聊天句数的要求。

## 🎯 主要变更

### 1. 数据库变更

#### `affection_rule` 表（好感度规则）
- **新增字段**: `sentenceCount` (INT, DEFAULT 0)
- **说明**: 需要聊满多少句才能达到该阶段

#### `user_app_affection` 表（用户好感度记录）
- **新增字段**: `sentenceCount` (INT, DEFAULT 0)
- **说明**: 用户已经聊了多少句

### 2. 代码变更

#### Entity 层 (`affection.entity.ts`)
```typescript
// AffectionRuleEntity 新增字段
@Column({ type: 'int', default: 0 })
sentenceCount: number; // 需要聊满多少句才能达到该阶段

// UserAppAffectionEntity 新增字段
@Column({ type: 'int', default: 0 })
sentenceCount: number; // 用户已经聊了多少句
```

#### Service 层 (`affection.service.ts`)
- **`increment()` 方法**: 每次聊天时，句数自动 +1
- **`resolveStage()` 方法**: 同时检查分数和句数条件
- **`getUserAffection()` 方法**: 返回结果包含句数信息

#### Controller 层
- **`upsertRule()` 接口**: 支持设置 `sentenceCount` 参数
- **API 文档**: 更新了 Swagger 示例

## 🚀 使用方法

### 1. 数据库迁移

执行以下 SQL 脚本添加新字段：

```bash
mysql -u root -p chatgpt < service/migrations/add-sentence-count-to-affection.sql
```

或者手动执行：

```sql
-- 为规则表添加句数字段
ALTER TABLE `affection_rule` 
ADD COLUMN `sentenceCount` INT NOT NULL DEFAULT 0 COMMENT '需要聊满多少句才能达到该阶段' 
AFTER `maxScore`;

-- 为用户好感度表添加句数字段
ALTER TABLE `user_app_affection` 
ADD COLUMN `sentenceCount` INT NOT NULL DEFAULT 0 COMMENT '用户已经聊了多少句' 
AFTER `score`;
```

### 2. 配置好感度规则

#### 方法 1: 通过管理后台 API

```bash
POST /api/affection/rule
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "appId": 123,
  "stageName": "初见",
  "minScore": 0,
  "maxScore": 30,
  "sentenceCount": 10,  // 新增：需要聊满10句
  "behaviors": "保持礼貌和距离感..."
}
```

#### 方法 2: 通过开放 API（无需鉴权）

```bash
POST /api/open/affection/rule
Content-Type: application/json

{
  "appId": 123,
  "stageName": "暧昧",
  "minScore": 30,
  "maxScore": 60,
  "sentenceCount": 50,  // 新增：需要聊满50句
  "behaviors": "可以适当亲密..."
}
```

### 3. 查询用户好感度状态

```bash
GET /api/affection/status?userId=1&appId=123
Authorization: Bearer <your-token>
```

**返回示例**:
```json
{
  "score": 25,
  "sentenceCount": 8,  // 新增：已聊天句数
  "stage": {
    "id": 1,
    "name": "初见",
    "behaviors": "保持礼貌和距离感...",
    "min": 0,
    "max": 30,
    "requiredSentences": 10  // 新增：需要的句数
  }
}
```

## 📊 工作原理

### 阶段判定逻辑

用户进入某个好感度阶段需要**同时满足**以下条件：

1. **分数条件**: `score >= minScore && score < maxScore`
2. **句数条件**: `sentenceCount >= requiredSentences`

### 示例场景

假设有以下规则配置：

| 阶段 | minScore | maxScore | sentenceCount |
|------|----------|----------|---------------|
| 初见 | 0        | 30       | 10            |
| 暧昧 | 30       | 60       | 50            |
| 恋人 | 60       | null     | 100           |

**场景 1**: 用户分数 25，聊天句数 8
- ❌ 不满足"初见"阶段（分数满足，但句数不足 10）
- 结果：无匹配阶段（返回 null）

**场景 2**: 用户分数 25，聊天句数 15
- ✅ 满足"初见"阶段（分数和句数都满足）
- 结果：进入"初见"阶段

**场景 3**: 用户分数 35，聊天句数 20
- ❌ 不满足"暧昧"阶段（分数满足，但句数不足 50）
- 结果：无匹配阶段（返回 null）

**场景 4**: 用户分数 35，聊天句数 60
- ✅ 满足"暧昧"阶段（分数和句数都满足）
- 结果：进入"暧昧"阶段

### 聊天时的自动更新

每次用户发送消息时（通过 `/api/chat/completions` 接口）：

1. 好感度分数 +1（默认值，可配置）
2. 聊天句数 +1（固定增量）
3. 重新计算当前阶段

代码位置：`service/src/modules/chat/chat.service.ts` 第 875-882 行

```typescript
// 聊天成功后自动增加好感度
try {
  if (appId) {
    await this.affectionService.increment(req.user.id, Number(appId));
    // 这会同时增加 score 和 sentenceCount
  }
} catch (e) {
  Logger.warn(`Affection increment failed: ${e?.message || e}`, 'ChatService');
}
```

## 🔧 配置建议

### 推荐配置示例

```json
[
  {
    "stageName": "初见",
    "minScore": 0,
    "maxScore": 30,
    "sentenceCount": 10,
    "behaviors": "保持礼貌和距离感，称呼对方为'您'..."
  },
  {
    "stageName": "熟悉",
    "minScore": 30,
    "maxScore": 60,
    "sentenceCount": 30,
    "behaviors": "可以使用更亲切的称呼，分享日常..."
  },
  {
    "stageName": "暧昧",
    "minScore": 60,
    "maxScore": 100,
    "sentenceCount": 80,
    "behaviors": "可以适当撒娇，表达关心..."
  },
  {
    "stageName": "恋人",
    "minScore": 100,
    "maxScore": null,
    "sentenceCount": 150,
    "behaviors": "亲密称呼，深度情感交流..."
  }
]
```

### 配置原则

1. **句数要求递增**: 后续阶段的句数要求应该更高
2. **合理设置门槛**: 避免句数要求过高导致用户难以进入下一阶段
3. **分数与句数平衡**: 确保分数和句数的增长速度相匹配
4. **测试验证**: 配置后进行实际测试，调整参数

## 📝 API 接口变更

### 1. 创建/更新规则

**接口**: `POST /api/affection/rule` 或 `POST /api/open/affection/rule`

**新增参数**:
- `sentenceCount` (number, optional, default: 0): 需要聊满多少句

### 2. 查询用户好感度

**接口**: `GET /api/affection/status`

**返回值变更**:
- 新增 `sentenceCount`: 用户已聊天句数
- `stage.requiredSentences`: 该阶段需要的句数

### 3. 查询规则列表

**接口**: `GET /api/affection/rules`

**返回值变更**:
- 每条规则新增 `sentenceCount` 字段

## 🧪 测试建议

### 1. 单元测试

```typescript
// 测试句数不足的情况
const result = await affectionService.getUserAffection(userId, appId);
expect(result.sentenceCount).toBe(5);
expect(result.stage).toBeNull(); // 句数不足，无匹配阶段

// 测试句数满足的情况
await affectionService.increment(userId, appId); // 多次调用
const result2 = await affectionService.getUserAffection(userId, appId);
expect(result2.sentenceCount).toBeGreaterThanOrEqual(10);
expect(result2.stage.name).toBe('初见');
```

### 2. 集成测试

1. 创建测试规则（sentenceCount = 5）
2. 发送 5 条聊天消息
3. 查询好感度状态，验证阶段是否正确

## ⚠️ 注意事项

1. **向后兼容**: 现有规则的 `sentenceCount` 默认为 0，不影响现有功能
2. **数据迁移**: 执行 SQL 迁移后，现有用户的 `sentenceCount` 为 0
3. **性能影响**: 每次聊天都会更新数据库，高并发场景需要注意性能
4. **阶段匹配**: 如果分数和句数不匹配，可能导致用户无法进入任何阶段

## 🔍 故障排除

### 问题 1: 用户分数足够但未进入阶段

**原因**: 句数不足

**解决方案**: 检查 `sentenceCount` 是否满足要求

### 问题 2: 数据库字段不存在

**原因**: 未执行数据库迁移

**解决方案**: 执行 `add-sentence-count-to-affection.sql` 脚本

### 问题 3: API 返回错误

**原因**: 代码未重启

**解决方案**: 重启 NestJS 服务

## 📚 相关文件

- **Entity**: `service/src/modules/affection/affection.entity.ts`
- **Service**: `service/src/modules/affection/affection.service.ts`
- **Controller**: `service/src/modules/affection/affection.controller.ts`
- **Open Controller**: `service/src/modules/affection/open-affection.controller.ts`
- **Migration**: `service/migrations/add-sentence-count-to-affection.sql`
- **Chat Service**: `service/src/modules/chat/chat.service.ts` (第 875-882 行)

## 🎉 总结

本次更新为好感度系统添加了句数统计功能，使得阶段判定更加合理和可控。通过同时考虑分数和句数，可以更好地模拟真实的情感发展过程。

