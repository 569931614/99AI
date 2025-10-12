# 好感度系统更新总结

## 📅 更新日期
2025-01-XX

## 🎯 更新目标
为好感度管理系统添加**句数统计**功能，使好感度阶段的判定同时基于分数和聊天句数。

## ✅ 已完成的修改

### 1. 数据库实体层修改

#### 文件: `service/src/modules/affection/affection.entity.ts`

**修改内容**:
- `AffectionRuleEntity` 添加 `sentenceCount` 字段（需要聊满多少句）
- `UserAppAffectionEntity` 添加 `sentenceCount` 字段（用户已聊多少句）

**代码变更**:
```typescript
// AffectionRuleEntity
@Column({ type: 'int', default: 0 })
sentenceCount: number; // 需要聊满多少句才能达到该阶段

// UserAppAffectionEntity
@Column({ type: 'int', default: 0 })
sentenceCount: number; // 用户已经聊了多少句
```

### 2. 服务层修改

#### 文件: `service/src/modules/affection/affection.service.ts`

**修改内容**:

1. **`getUserAffection()` 方法**
   - 初始化时设置 `sentenceCount: 0`
   - 调用 `resolveStage()` 时传入句数参数
   - 返回结果包含 `sentenceCount` 字段

2. **`increment()` 方法**
   - 每次调用时句数自动 +1
   - 返回结果包含 `sentenceCount` 字段
   - 日志记录包含句数信息

3. **`resolveStage()` 方法**
   - 新增 `sentenceCount` 参数
   - 同时检查分数和句数条件
   - 返回结果包含 `requiredSentences` 字段

**核心逻辑**:
```typescript
async resolveStage(appId: number | null, score: number, sentenceCount: number = 0) {
  const rules = await this.listRules(appId || undefined);
  const matched = rules.find((r) => {
    const scoreMatch = score >= r.minScore && (r.maxScore == null || score < r.maxScore);
    const sentenceMatch = sentenceCount >= (r.sentenceCount || 0);
    return scoreMatch && sentenceMatch; // 同时满足分数和句数条件
  });
  // ...
}
```

### 3. 控制器层修改

#### 文件: `service/src/modules/affection/affection.controller.ts`

**修改内容**:
- `upsertRule()` 方法的 body 参数添加 `sentenceCount?: number`

#### 文件: `service/src/modules/affection/open-affection.controller.ts`

**修改内容**:
- `upsertRule()` 方法的 `@ApiBody` 装饰器添加 `sentenceCount` 字段
- 更新 Swagger 示例，包含 `sentenceCount: 10`

### 4. 数据库迁移脚本

#### 文件: `service/migrations/add-sentence-count-to-affection.sql`

**内容**:
```sql
-- 为 affection_rule 表添加 sentenceCount 字段
ALTER TABLE `affection_rule` 
ADD COLUMN `sentenceCount` INT NOT NULL DEFAULT 0 COMMENT '需要聊满多少句才能达到该阶段' 
AFTER `maxScore`;

-- 为 user_app_affection 表添加 sentenceCount 字段
ALTER TABLE `user_app_affection` 
ADD COLUMN `sentenceCount` INT NOT NULL DEFAULT 0 COMMENT '用户已经聊了多少句' 
AFTER `score`;
```

### 5. 文档

#### 文件: `service/AFFECTION-SENTENCE-COUNT-FEATURE.md`
- 详细的功能说明文档
- 使用方法和示例
- API 接口变更说明
- 测试建议和故障排除

#### 文件: `service/test-affection-sentence-count.ps1`
- PowerShell 测试脚本
- 自动化测试流程
- 验证阶段判定逻辑

## 🔄 工作流程

### 聊天时的自动更新流程

```
用户发送消息
    ↓
chat.service.ts 处理聊天
    ↓
聊天成功后调用 affectionService.increment(userId, appId)
    ↓
affection.service.ts 执行更新
    ├─ score += 1 (默认增量)
    └─ sentenceCount += 1 (固定增量)
    ↓
保存到数据库
    ↓
重新计算当前阶段 (resolveStage)
    ├─ 检查分数条件: score >= minScore && score < maxScore
    └─ 检查句数条件: sentenceCount >= requiredSentences
    ↓
返回当前阶段信息
```

### 阶段判定逻辑

```
用户请求查询好感度状态
    ↓
getUserAffection(userId, appId)
    ↓
从数据库获取 score 和 sentenceCount
    ↓
resolveStage(appId, score, sentenceCount)
    ↓
遍历所有规则，查找匹配的阶段
    ├─ 条件1: score >= minScore && score < maxScore
    └─ 条件2: sentenceCount >= requiredSentences
    ↓
返回匹配的阶段（或 null）
```

## 📋 部署清单

### 1. 代码部署
- [x] 修改 `affection.entity.ts`
- [x] 修改 `affection.service.ts`
- [x] 修改 `affection.controller.ts`
- [x] 修改 `open-affection.controller.ts`
- [x] 创建迁移脚本
- [x] 创建文档

### 2. 数据库迁移
- [ ] 执行 SQL 迁移脚本
- [ ] 验证字段已添加
- [ ] （可选）为现有规则设置默认句数

### 3. 服务重启
- [ ] 重启 NestJS 服务
- [ ] 验证服务正常启动
- [ ] 检查日志无错误

### 4. 功能测试
- [ ] 测试创建规则（包含 sentenceCount）
- [ ] 测试查询用户好感度（返回 sentenceCount）
- [ ] 测试聊天自动增加句数
- [ ] 测试阶段判定逻辑

## 🚀 部署步骤

### 步骤 1: 停止服务
```bash
cd service
# 如果使用 PM2
pm2 stop all
# 或者直接 Ctrl+C 停止开发服务器
```

### 步骤 2: 执行数据库迁移
```bash
mysql -u root -p chatgpt < migrations/add-sentence-count-to-affection.sql
```

或者手动执行 SQL：
```bash
mysql -u root -p
use chatgpt;
source migrations/add-sentence-count-to-affection.sql;
```

### 步骤 3: 验证数据库变更
```sql
-- 检查 affection_rule 表结构
DESC affection_rule;

-- 检查 user_app_affection 表结构
DESC user_app_affection;

-- 应该看到新增的 sentenceCount 字段
```

### 步骤 4: 启动服务
```bash
cd service
pnpm dev
# 或使用 PM2
pm2 start
```

### 步骤 5: 验证功能
```bash
# 运行测试脚本
.\test-affection-sentence-count.ps1

# 或手动测试 API
curl http://localhost:9520/api/open/affection/rules?appId=1
```

## 🧪 测试用例

### 测试用例 1: 创建规则
```bash
POST /api/open/affection/rule
{
  "appId": 1,
  "stageName": "初见",
  "minScore": 0,
  "maxScore": 30,
  "sentenceCount": 10,
  "behaviors": "保持礼貌..."
}
```

**预期结果**: 规则创建成功，返回包含 `sentenceCount: 10`

### 测试用例 2: 查询用户状态（句数不足）
```bash
GET /api/open/affection/status?userId=1&appId=1
```

**假设**: 用户分数 15，句数 5

**预期结果**: 
```json
{
  "score": 15,
  "sentenceCount": 5,
  "stage": null  // 句数不足10，无匹配阶段
}
```

### 测试用例 3: 查询用户状态（条件满足）
**假设**: 用户分数 15，句数 12

**预期结果**:
```json
{
  "score": 15,
  "sentenceCount": 12,
  "stage": {
    "id": 1,
    "name": "初见",
    "behaviors": "保持礼貌...",
    "min": 0,
    "max": 30,
    "requiredSentences": 10
  }
}
```

## ⚠️ 注意事项

1. **向后兼容性**: 
   - 现有规则的 `sentenceCount` 默认为 0
   - 现有用户的 `sentenceCount` 默认为 0
   - 不影响现有功能

2. **数据一致性**:
   - 迁移后需要验证所有表都已更新
   - 建议在测试环境先验证

3. **性能考虑**:
   - 每次聊天都会更新数据库
   - 高并发场景需要监控性能

4. **业务逻辑**:
   - 确保分数和句数的增长速度合理
   - 避免句数要求过高导致用户体验不佳

## 📊 影响范围

### 受影响的模块
- ✅ `affection` 模块（核心修改）
- ✅ `chat` 模块（调用 increment 方法）
- ❌ 其他模块（无影响）

### 受影响的 API
- `POST /api/affection/rule` - 新增参数
- `POST /api/open/affection/rule` - 新增参数
- `GET /api/affection/status` - 返回值变更
- `GET /api/open/affection/status` - 返回值变更
- `GET /api/affection/rules` - 返回值变更
- `GET /api/open/affection/rules` - 返回值变更

### 数据库表
- `affection_rule` - 新增字段
- `user_app_affection` - 新增字段

## 🔍 验证清单

- [ ] 代码编译无错误
- [ ] TypeScript 类型检查通过
- [ ] 数据库迁移成功
- [ ] 服务启动无错误
- [ ] API 接口正常响应
- [ ] 创建规则功能正常
- [ ] 查询状态功能正常
- [ ] 聊天自动增加句数
- [ ] 阶段判定逻辑正确
- [ ] 日志记录完整

## 📚 相关文档

- [功能详细说明](./AFFECTION-SENTENCE-COUNT-FEATURE.md)
- [数据库迁移脚本](./migrations/add-sentence-count-to-affection.sql)
- [测试脚本](./test-affection-sentence-count.ps1)

## 🎉 总结

本次更新成功为好感度系统添加了句数统计功能，使得阶段判定更加合理和可控。所有代码修改已完成，数据库迁移脚本已准备就绪，文档和测试脚本已创建。

**下一步**: 执行数据库迁移并重启服务即可使用新功能。

