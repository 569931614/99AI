# 🎛️ 音频预处理控制参数说明

## 📋 概述

声音复刻 API 现在支持通过 `enablePreprocess` 参数来控制是否对音频进行预处理。

## 🔧 参数说明

### `enablePreprocess` (可选)

- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否启用音频预处理

#### 启用预处理 (`enablePreprocess: true`)

当启用预处理时，系统会自动：

1. **下载原始音频** - 从提供的 URL 下载音频文件
2. **转换音频格式** - 使用 FFmpeg 转换为符合阿里云 CosyVoice 要求的格式：
   - 采样率: 16000 Hz
   - 声道: 1 (单声道)
   - 编码: PCM 16-bit
   - 格式: WAV
   - 时长: 最多 10 秒
3. **上传转换后的音频** - 将转换后的音频上传到 OSS
4. **调用阿里云 API** - 使用转换后的音频 URL

**适用场景**:
- ✅ 音频格式不符合要求（如 MP3、M4A 等）
- ✅ 采样率不是 16kHz
- ✅ 音频是立体声（需要转换为单声道）
- ✅ 音频时长超过 10 秒（需要截断）
- ✅ 不确定音频格式是否符合要求

**优点**:
- 自动处理格式转换
- 确保音频参数符合要求
- 减少 API 调用失败的可能性

**缺点**:
- 增加处理时间（下载 + 转换 + 上传）
- 可能会改变音频内容（截断、重采样等）
- 消耗服务器资源

#### 禁用预处理 (`enablePreprocess: false`)

当禁用预处理时，系统会：

1. **直接使用原始 URL** - 不进行任何处理
2. **调用阿里云 API** - 直接使用提供的音频 URL

**适用场景**:
- ✅ 音频已经符合阿里云 CosyVoice 的要求
- ✅ 音频已经是 16kHz 单声道 WAV 格式
- ✅ 音频时长在 3-10 秒之间
- ✅ 需要快速处理，不想等待转换

**优点**:
- 处理速度快
- 不改变原始音频内容
- 节省服务器资源

**缺点**:
- 如果音频格式不符合要求，API 调用会失败
- 需要用户自行确保音频格式正确

## 📝 API 使用示例

### 示例 1: 启用预处理（默认）

```bash
POST /api/open/voice/enroll
Content-Type: application/json

{
  "prefix": "test01",
  "url": "https://example.com/audio.mp3",
  "targetModel": "cosyvoice-v2",
  "name": "测试音色",
  "enablePreprocess": true
}
```

**说明**: 即使音频是 MP3 格式，系统也会自动转换为 WAV 格式。

### 示例 2: 禁用预处理

```bash
POST /api/open/voice/enroll
Content-Type: application/json

{
  "prefix": "test02",
  "url": "https://example.com/audio.wav",
  "targetModel": "cosyvoice-v2",
  "name": "测试音色",
  "enablePreprocess": false
}
```

**说明**: 直接使用原始音频 URL，不进行任何转换。

### 示例 3: 使用默认值（启用预处理）

```bash
POST /api/open/voice/enroll
Content-Type: application/json

{
  "prefix": "test03",
  "url": "https://example.com/audio.wav",
  "targetModel": "cosyvoice-v2",
  "name": "测试音色"
}
```

**说明**: 不指定 `enablePreprocess` 时，默认启用预处理。

## 🧪 测试脚本

我们提供了一个测试脚本来演示两种模式的区别：

```powershell
cd service
.\test-with-preprocess-control.ps1
```

这个脚本会：
1. 使用相同的音频 URL 进行两次测试
2. 第一次启用预处理
3. 第二次禁用预处理
4. 对比两次测试的结果

## 📊 日志对比

### 启用预处理时的日志

```
[VoiceService] [enroll] 收到请求: {"prefix":"test01","url":"https://...","enablePreprocess":true}
[VoiceService] [enroll] 参数验证: prefix=test01, url=https://..., enablePreprocess=true
[VoiceService] [enroll] 开始预处理音频文件
[VoiceService] [preprocessAudio] 开始下载音频: https://...
[VoiceService] [preprocessAudio] 音频下载完成，开始转换
[VoiceService] [preprocessAudio] FFmpeg 命令: ffmpeg -i ... -ar 16000 -ac 1 ...
[VoiceService] [preprocessAudio] 音频转换完成
[VoiceService] [preprocessAudio] 开始上传转换后的音频
[UploadService] 文件已上传到阿里云 OSS。访问 URL: https://...
[VoiceService] [enroll] 音频预处理成功，新URL: https://...
[VoiceService] [enroll] 准备调用阿里云API
```

### 禁用预处理时的日志

```
[VoiceService] [enroll] 收到请求: {"prefix":"test02","url":"https://...","enablePreprocess":false}
[VoiceService] [enroll] 参数验证: prefix=test02, url=https://..., enablePreprocess=false
[VoiceService] [enroll] 预处理已禁用，直接使用原始URL
[VoiceService] [enroll] 准备调用阿里云API
```

## 🎯 使用建议

### 何时启用预处理？

1. **不确定音频格式** - 如果不确定音频是否符合要求，建议启用
2. **用户上传的音频** - 用户上传的音频格式可能各不相同
3. **第三方音频源** - 从第三方获取的音频，格式可能不可控
4. **音频时长较长** - 音频超过 10 秒，需要自动截断

### 何时禁用预处理？

1. **音频已经符合要求** - 如果音频已经是 16kHz 单声道 WAV 格式
2. **需要快速处理** - 不想等待转换过程
3. **音频质量要求高** - 不希望重采样影响音频质量
4. **批量处理** - 批量处理大量音频时，可以先批量转换，然后禁用预处理

### 推荐流程

1. **首次测试** - 使用启用预处理模式测试
2. **检查结果** - 如果成功，检查音频质量是否满意
3. **优化选择** - 根据实际情况选择是否启用预处理
4. **生产环境** - 根据音频来源和质量要求，选择合适的模式

## ⚠️ 注意事项

1. **预处理失败** - 如果预处理失败（如 FFmpeg 不可用），系统会自动回退到使用原始 URL
2. **音频质量** - 预处理可能会改变音频质量（重采样、截断等）
3. **处理时间** - 启用预处理会增加处理时间（通常 2-5 秒）
4. **存储空间** - 启用预处理会在 OSS 中存储转换后的音频文件

## 🔍 故障排查

### 问题 1: 启用预处理后仍然失败

**可能原因**:
- 原始音频内容质量不佳（背景噪音过大、人声不清晰等）
- 音频时长被截断后，有效人声内容不足
- OSS 区域配置问题

**解决方案**:
- 使用高质量的音频样本
- 确保音频前 10 秒包含足够的清晰人声
- 检查 OSS 区域配置

### 问题 2: 禁用预处理后失败

**可能原因**:
- 音频格式不符合要求
- 采样率不是 16kHz
- 音频不是单声道
- 音频时长不在 3-10 秒范围内

**解决方案**:
- 启用预处理，让系统自动转换
- 或者手动转换音频为符合要求的格式

### 问题 3: FFmpeg 不可用

**错误信息**: `音频预处理失败，使用原始URL`

**解决方案**:
- 安装 FFmpeg（参考 `FFMPEG-INSTALL-GUIDE.md`）
- 或者禁用预处理，使用已经符合要求的音频

## 📚 相关文档

- **FFmpeg 安装指南**: `FFMPEG-INSTALL-GUIDE.md`
- **音频预处理总结**: `AUDIO-PREPROCESSING-SUMMARY.md`
- **最终测试总结**: `FINAL-TEST-SUMMARY.md`
- **测试脚本**: `test-with-preprocess-control.ps1`

---

**更新日期**: 2025年10月8日

