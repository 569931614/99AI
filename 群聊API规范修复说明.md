# 群聊API规范修复说明

## 问题描述

根据阿里云星尘官方API文档，群聊模式下的消息格式有严格的要求，但项目中的实现与官方规范不一致。

## 官方API规范

根据官方示例（https://help.aliyun.com/document_detail/2861866.html），群聊模式下需要满足以下要求：

### 1. 消息角色规则
- **其他聊天对象的role为user**：包括真实用户和其他AI角色
- **当前角色的role为assistant**：只有当前角色自己的历史消息才是assistant

### 2. 说话人标识
- **每个message需要在content的开始标识说话人名**
- **真实用户的消息也需要添加用户名前缀**（如"用户名：内容"）
- **AI角色的消息需要添加角色名前缀**（如"角色名：内容"）

### 3. Prefill机制
- **调用时，需要以当前角色名作为prefill输入**
- 最后一条消息应该是 `{"role": "assistant", "content": "角色名："}`
- 这样AI会自动以这个角色的身份继续回复

## 官方API示例

```json
{
  "messages": [
    {
      "role": "system",
      "content": "在音乐人群聊场景中，凌路是25岁的天才音乐人..."
    },
    {
      "role": "user",
      "content": "程毅：周末你们有空不？新歌想听听意见。"
    },
    {
      "role": "assistant",
      "content": "凌路：哼，又来蹭我们专业水平？行吧，别太难听就行。"
    },
    {
      "role": "user",
      "content": "程毅：终于等到你发歌，必须第一个听！"
    },
    {
      "role": "user",
      "content": "陶乐：宝贝说得对，不过别熬夜改歌啊，心疼。"
    },
    {
      "role": "user",
      "content": "马晖：哥几个聚个餐边吃边聊呗，我请客！"
    },
    {
      "role": "assistant",
      "content": "凌路：改天搞个即兴合作直播？有没有兴趣呢？"
    },
    {
      "role": "assistant",
      "content": "凌路："
    }
  ]
}
```

**关键点**：
1. 真实用户"程毅"、"陶乐"、"马晖"的消息都是 `role: 'user'`，并且有说话人前缀
2. 当前角色"凌路"的历史消息是 `role: 'assistant'`，也有说话人前缀
3. 最后一条消息是prefill：`"凌路："`，让AI以凌路的身份继续回复

## 项目中的问题

### 问题1：真实用户的消息没有添加用户名前缀 ❌

**错误的实现**（第1130-1136行）：
```typescript
if (msg.role === 'user') {
  // 真实用户消息：role为user
  messages.push({
    role: 'user',
    content: msg.content  // ❌ 没有添加用户名前缀
  });
}
```

**正确的实现**：
```typescript
if (msg.role === 'user') {
  // 真实用户消息：role为user，需要添加用户名前缀
  let userContent = msg.content;
  
  // 检查是否已经有说话人前缀
  const hasSpeakerPrefix = typeof userContent === 'string' && /^[^：]+：/.test(userContent);
  
  if (!hasSpeakerPrefix && typeof userContent === 'string') {
    // 获取真实用户名称
    const user = await this.userEntity.findOne({ where: { id: req.user.id } });
    const userName = user?.username || user?.nickname || `用户${user.id}`;
    
    // 添加用户名前缀
    userContent = `${userName}：${userContent}`;
  }
  
  messages.push({
    role: 'user',
    content: userContent
  });
}
```

### 问题2：当前用户提问没有添加用户名前缀 ❌

**错误的实现**（第1324-1346行）：
```typescript
if (!isLastMessageCurrentPrompt) {
  // 群聊模式下，真实用户的消息不添加说话人前缀
  let userPrompt = prompt;  // ❌ 没有添加用户名前缀
  
  const currentUserMessage: any = {
    role: 'user',
    content: userPrompt,
  };
  
  messages.push(currentUserMessage);
}
```

**正确的实现**：
```typescript
if (!isLastMessageCurrentPrompt) {
  // 群聊模式下，真实用户的消息也需要添加用户名前缀
  let userPrompt = prompt;
  
  // 如果是群聊模式，添加用户名前缀
  if (isGroupChat) {
    const hasSpeakerPrefix = typeof userPrompt === 'string' && /^[^：]+：/.test(userPrompt);
    
    if (!hasSpeakerPrefix && typeof userPrompt === 'string') {
      userPrompt = `${realUserName}：${userPrompt}`;
    }
  }
  
  const currentUserMessage: any = {
    role: 'user',
    content: userPrompt,
  };
  
  messages.push(currentUserMessage);
}
```

### 问题3：没有实现prefill机制 ❌

**缺失的功能**：
项目中没有在消息数组的最后添加prefill消息。

**正确的实现**（新增代码）：
```typescript
// 群聊模式：添加prefill消息（根据星尘API文档）
// 最后一条消息应该是 {"role": "assistant", "content": "角色名："}
if (isGroupChat && groupId && appId) {
  const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
  if (groupInfo?.members) {
    const members = JSON.parse(groupInfo.members);
    const currentMember = members.find(m => m.appId === appId || m.userId === appId);
    if (currentMember) {
      const roleName = currentMember.appName || currentMember.name || `角色${currentMember.appId}`;
      // 添加prefill消息
      messages.push({
        role: 'assistant',
        content: `${roleName}：`
      });
    }
  }
}
```

## 修复方案

### 修改的文件

#### 1. service/src/modules/chat/chat.service.ts

**修改1：添加UserEntity注入**（第27-56行）
```typescript
import { UserEntity } from '../user/user.entity';

@Injectable()
export class ChatService {
  constructor(
    // ... 其他注入
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    // ... 其他注入
  ) {}
}
```

**修改2：获取真实用户名称**（第494-507行）
```typescript
// 群聊模式：获取真实用户的名称（用于添加说话人前缀）
let realUserName = '用户';
if (isGroupChat && groupId) {
  try {
    const user = await this.userEntity.findOne({ where: { id: req.user.id } });
    if (user) {
      realUserName = user.username || user.nickname || `用户${user.id}`;
    }
    Logger.debug(`[群聊] 真实用户名称: ${realUserName}`, 'ChatService');
  } catch (error) {
    Logger.debug(`获取真实用户名称失败: ${error.message}`, 'ChatService');
  }
}
```

**修改3：保存用户消息时使用真实用户名**（第536行和557行）
```typescript
// 群聊模式
modelName: realUserName,

// 普通模式
modelName: '我',
```

**修改4：为历史用户消息添加用户名前缀**（第1127-1157行）
```typescript
if (msg.role === 'user') {
  // 真实用户消息：role为user，需要添加用户名前缀
  let userContent = msg.content;
  
  const hasSpeakerPrefix = typeof userContent === 'string' && /^[^：]+：/.test(userContent);
  
  if (!hasSpeakerPrefix && typeof userContent === 'string') {
    // 从数据库获取真实用户名称
    let userName = '用户';
    try {
      const user = await this.userEntity.findOne({ where: { id: req.user.id } });
      if (user) {
        userName = user.username || user.nickname || `用户${user.id}`;
      }
    } catch (error) {
      Logger.debug(`获取用户名称失败: ${error.message}`, 'ChatService');
    }
    
    // 添加用户名前缀
    userContent = `${userName}：${userContent}`;
    Logger.debug(`[群聊历史] 为用户消息添加说话人标识: ${userName}`, 'ChatService');
  }
  
  messages.push({
    role: 'user',
    content: userContent
  });
}
```

**修改5：为当前用户提问添加用户名前缀**（第1324-1356行）
```typescript
if (!isLastMessageCurrentPrompt) {
  // 群聊模式下，真实用户的消息也需要添加用户名前缀
  let userPrompt = prompt;
  
  // 如果是群聊模式，添加用户名前缀
  if (isGroupChat) {
    const hasSpeakerPrefix = typeof userPrompt === 'string' && /^[^：]+：/.test(userPrompt);
    
    if (!hasSpeakerPrefix && typeof userPrompt === 'string') {
      userPrompt = `${realUserName}：${userPrompt}`;
      Logger.debug(`[群聊历史] 为当前用户提问添加说话人标识: ${realUserName}`, 'ChatService');
    }
  }
  
  const currentUserMessage: any = {
    role: 'user',
    content: userPrompt,
  };
  
  messages.push(currentUserMessage);
}
```

**修改6：添加prefill机制**（第1359-1381行）
```typescript
// 群聊模式：添加prefill消息（根据星尘API文档）
// 最后一条消息应该是 {"role": "assistant", "content": "角色名："}
if (isGroupChat && groupId && appId) {
  try {
    const groupInfo = await this.chatGroupService.getGroupInfoFromId(groupId);
    if (groupInfo?.members) {
      const members = JSON.parse(groupInfo.members);
      const currentMember = members.find(m => m.appId === appId || m.userId === appId);
      if (currentMember) {
        const roleName = currentMember.appName || currentMember.name || `角色${currentMember.appId || currentMember.userId}`;
        // 添加prefill消息
        messages.push({
          role: 'assistant',
          content: `${roleName}：`
        });
        Logger.debug(`[群聊] 添加prefill消息: ${roleName}：`, 'ChatService');
      }
    }
  } catch (error) {
    Logger.debug(`添加prefill消息失败: ${error.message}`, 'ChatService');
  }
}
```

## 修复后的效果

### 消息格式示例

假设有两个角色：小明（角色1）和小红（角色2），真实用户名为"张三"

#### 角色1（小明）的请求
```json
{
  "messages": [
    {"role": "system", "content": "你是小明..."},
    {"role": "user", "content": "张三：你好，大家好！"},
    {"role": "assistant", "content": "小明："}
  ]
}
```

#### 角色2（小红）的请求
```json
{
  "messages": [
    {"role": "system", "content": "你是小红..."},
    {"role": "user", "content": "张三：你好，大家好！"},
    {"role": "user", "content": "小明：你好！很高兴见到你。"},
    {"role": "assistant", "content": "小红："}
  ]
}
```

**关键改进**：
1. ✅ 真实用户的消息有用户名前缀："张三：你好，大家好！"
2. ✅ 其他角色的消息转换为user并有角色名前缀："小明：你好！很高兴见到你。"
3. ✅ 最后添加了prefill消息："小红："

### 对话效果

```
用户（张三）: "你好，大家好！"

角色1（小明）看到:
- 张三：你好，大家好！

角色1（小明）回复: "你好！很高兴见到你。"

角色2（小红）看到:
- 张三：你好，大家好！
- 小明：你好！很高兴见到你。

角色2（小红）回复: "我也很高兴见到你，张三！小明说得对。"
```

## 测试建议

1. **基本测试**：
   - 创建群聊，添加2-3个角色
   - 发送消息，观察每个角色的回复
   - 检查后端日志，确认消息格式正确

2. **验证点**：
   - 真实用户的消息是否有用户名前缀
   - 其他角色的消息是否有角色名前缀
   - 最后是否有prefill消息
   - 角色之间的对话是否连贯

3. **日志检查**：
   ```
   [群聊] 真实用户名称: 张三
   [群聊历史] 为用户消息添加说话人标识: 张三
   [群聊历史] 为其他角色消息添加说话人标识: 小明
   [群聊] 添加prefill消息: 小红：
   ```

## 总结

本次修复完全按照阿里云星尘官方API文档的规范实现了群聊功能：

1. ✅ **真实用户的消息添加用户名前缀**
2. ✅ **AI角色的消息添加角色名前缀**
3. ✅ **实现prefill机制**
4. ✅ **消息角色正确（user/assistant）**
5. ✅ **添加详细的日志输出**

修复后的系统能够正确处理群聊场景，符合星尘API的规范要求，为用户提供更好的多角色对话体验。

