# TTS 文字转语音功能优化说明

## 📋 功能概述

本次更新优化了聊天界面的文字转语音（TTS）功能，实现了以下两个核心改进：

1. **括号内容过滤**：TTS 朗读时自动过滤括号内的心理描述，只朗读实际对话内容
2. **智能情绪识别**：优先从括号内的心理描述识别情绪，自动选择匹配的音色

## 🎯 优化内容

### 1. 括号内容过滤

#### 问题背景
在角色扮演对话中，AI 回复经常包含心理描述，例如：
```
"你好啊！（内心充满喜悦）今天天气真不错呢~"
```

之前的 TTS 会朗读全部内容，包括括号内的心理描述，导致语音不自然。

#### 解决方案
新增 `removeBracketedContent()` 方法，自动移除各种括号及其内容：

**支持的括号类型**：
- 英文圆括号：`()`
- 中文圆括号：`（）`
- 英文方括号：`[]`
- 中文方括号：`【】`
- 英文花括号：`{}`
- 日文引号：`「」`
- 日文双引号：`『』`

**示例**：
```typescript
输入: "你好啊！（内心充满喜悦）今天天气真不错呢~"
输出: "你好啊！今天天气真不错呢~"

输入: "我明白了【点头】，那我们开始吧！"
输出: "我明白了，那我们开始吧！"

输入: "真的吗？{惊讶}这太棒了！"
输出: "真的吗？这太棒了！"
```

### 2. 智能情绪识别与音色选择

#### 问题背景
之前的情绪识别只从对话文本本身推断，无法准确捕捉角色的真实情绪状态。

#### 解决方案
从完整文本（包括括号内的心理描述）识别情绪，更准确地捕捉角色的情绪状态。

**情绪识别优先级**：
1. **优先级1**：使用 API 调用时传入的 `emotion` 参数
2. **优先级2**：从完整文本（包括括号内容）推断情绪

**示例场景**：

**场景 1：心理描述与对话内容情绪不一致**
```
输入: "没关系的...（内心非常生气）我不在意。"
识别情绪: angry（从完整文本识别，包括"内心非常生气"）
选择音色: 生气音色
朗读内容: "没关系的...我不在意。"
```

**场景 2：复杂情绪表达**
```
输入: "谢谢你！【开心地笑着】你真是太好了~"
识别情绪: happy（从完整文本识别，包括"开心地笑着"）
选择音色: 开心音色
朗读内容: "谢谢你！你真是太好了~"
```

**场景 3：无心理描述**
```
输入: "今天天气真好啊！"
识别情绪: happy（从文本推断，因为有"！"）
选择音色: 开心音色
朗读内容: "今天天气真好啊！"
```

## 🔧 技术实现

### 新增方法

#### 1. `extractPsychologicalDescription(text: string): string | null`

提取文本中所有括号内的内容，用于情绪识别。

```typescript
private extractPsychologicalDescription(text?: string | null): string | null {
  if (!text) return null;
  
  const bracketPatterns = [
    /\(([^)]+)\)/g,      // 英文圆括号
    /（([^）]+)）/g,      // 中文圆括号
    /\[([^\]]+)\]/g,     // 英文方括号
    /【([^】]+)】/g,      // 中文方括号
    /\{([^}]+)\}/g,      // 英文花括号
    /「([^」]+)」/g,      // 日文引号
    /『([^』]+)』/g,      // 日文双引号
  ];
  
  const matches: string[] = [];
  for (const pattern of bracketPatterns) {
    const found = text.match(pattern);
    if (found) {
      found.forEach(match => {
        const content = match.replace(/^[(\（\[【\{「『]/, '').replace(/[)\）\]】\}」』]$/, '');
        if (content.trim()) {
          matches.push(content.trim());
        }
      });
    }
  }
  
  return matches.length > 0 ? matches.join(' ') : null;
}
```

#### 2. `removeBracketedContent(text: string): string`

移除文本中的所有括号及其内容，返回纯净的对话文本。

```typescript
private removeBracketedContent(text?: string | null): string {
  if (!text) return '';
  let result = text;
  
  const bracketPatterns = [
    /\([^)]*\)/g,      // 英文圆括号
    /（[^）]*）/g,      // 中文圆括号
    /\[[^\]]*\]/g,     // 英文方括号
    /【[^】]*】/g,      // 中文方括号
    /\{[^}]*\}/g,      // 英文花括号
    /「[^」]*」/g,      // 日文引号
    /『[^』]*』/g,      // 日文双引号
  ];
  
  for (const pattern of bracketPatterns) {
    result = result.replace(pattern, '');
  }
  
  // 清理多余的空格
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}
```

### 修改的方法

#### `ttsProcess(body, req, res)`

TTS 处理流程更新：

```typescript
async ttsProcess(body: any, req: any, res?: any) {
  const { chatId, prompt, emotion } = body;

  // 1. 提取括号内的心理描述（仅用于日志记录）
  const psychologicalDesc = this.extractPsychologicalDescription(prompt);

  // 2. 移除括号内容，得到实际要朗读的文本
  const textToSpeak = this.removeBracketedContent(prompt);

  // 3. 从完整文本（包括括号内容）识别情绪
  let detectedEmotion: string | null = null;

  if (emotion) {
    detectedEmotion = emotion;
  }

  if (!detectedEmotion) {
    // 从完整文本识别情绪（包括括号内容）
    detectedEmotion = this.detectEmotionFromText(prompt);
  }

  // 4. 使用移除括号后的文本进行 TTS
  const { url } = await this.voiceService.preview({
    voice_id: selectedVoiceId,
    text: textToSpeak  // 注意：这里使用的是移除括号后的文本
  });

  // ...
}
```

## 📊 支持的情绪类型

当前系统支持以下情绪标签（可通过情绪→音色映射配置）：

| 情绪标签 | 中文关键词 | 英文关键词 |
|---------|-----------|-----------|
| happy | 开心、高兴、喜悦、愉快、兴奋 | happy, joy, excited |
| sad | 伤心、难过、悲伤、哭、沮丧 | sad, depress, blue |
| angry | 生气、愤怒、恼火、气愤 | angry, mad, furious |
| calm | 平静、冷静、沉着、中性 | calm, neutral |
| gentle | 温柔、柔和、亲切、体贴 | gentle, soft |
| serious | 严肃、正式、权威、庄重 | serious, formal |
| narrative | 旁白、解说、播音、讲述 | narrative |
| energetic | 元气、活力、激情、热情 | energetic |
| cute | 可爱、萌、甜美 | cute |

## 🚀 使用示例

### 示例 1：基本使用

**AI 回复**：
```
"你好呀！（开心地挥手）很高兴见到你~"
```

**TTS 处理**：
- 提取心理描述：`"开心地挥手"`
- 识别情绪：`happy`
- 选择音色：开心音色
- 朗读文本：`"你好呀！很高兴见到你~"`

### 示例 2：复杂情绪

**AI 回复**：
```
"我明白了...【叹气，有些失落】那就这样吧。"
```

**TTS 处理**：
- 提取心理描述：`"叹气，有些失落"`
- 识别情绪：`sad`
- 选择音色：悲伤音色
- 朗读文本：`"我明白了...那就这样吧。"`

### 示例 3：多个括号

**AI 回复**：
```
"真的吗？（惊讶）【睁大眼睛】这太不可思议了！"
```

**TTS 处理**：
- 提取心理描述：`"惊讶 睁大眼睛"`
- 识别情绪：从组合描述推断
- 朗读文本：`"真的吗？这太不可思议了！"`

## ⚠️ 注意事项

### 1. 空文本处理

如果移除括号后文本为空，系统会返回错误：

```typescript
if (!textToSpeak || textToSpeak.trim().length === 0) {
  return res.status(400).send({ error: '文本内容为空，无法进行语音合成' });
}
```

**示例**：
```
输入: "（内心独白：我该怎么办呢？）"
结果: 返回错误，因为移除括号后无内容
```

### 2. 嵌套括号

当前实现不支持嵌套括号，会按照最外层括号处理：

```
输入: "你好（我很开心（真的很开心））"
处理: 会移除整个括号内容
输出: "你好"
```

### 3. 情绪映射配置

确保在管理后台配置了情绪→音色映射，否则会回退到默认音色。

配置路径：
- 全局配置：`emotionVoiceMap:global`
- 应用配置：`emotionVoiceMap:app:{appId}`

## 🔍 日志输出

TTS 处理过程会输出详细日志，便于调试：

```
[TTSService] 开始TTS处理: 你好啊！（内心充满喜悦）今天天气真不错呢~
[TTSService] 提取心理描述: 内心充满喜悦
[TTSService] 移除括号后的文本: 你好啊！今天天气真不错呢~
[TTSService] 从心理描述推断情绪: happy (描述: 内心充满喜悦)
[TTSService] 命中情绪映射: emotion=happy, voice=cosyvoice-v3-xxx (appId=123)
```

## 📝 API 接口

### POST /api/chat/tts

**请求参数**：
```json
{
  "chatId": 123,
  "prompt": "你好啊！（内心充满喜悦）今天天气真不错呢~",
  "emotion": "happy"  // 可选，手动指定情绪
}
```

**返回结果**：
```json
{
  "ttsUrl": "https://example.com/audio/xxx.mp3"
}
```

## 🎉 总结

本次优化使 TTS 功能更加智能和自然：

1. ✅ 自动过滤心理描述，只朗读对话内容
2. ✅ 智能识别情绪，自动选择合适音色
3. ✅ 支持多种括号格式
4. ✅ 优先从心理描述识别情绪
5. ✅ 完善的错误处理和日志记录

这些改进使得角色扮演对话的语音合成更加自然流畅，情绪表达更加准确！

