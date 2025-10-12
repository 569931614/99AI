# 本地音频声音复刻测试指南

## 📋 准备工作

### 1. 准备音频文件

您需要准备一个符合以下要求的音频文件：

#### 音频要求

- **时长**: 3-10 秒（推荐）
- **内容**: 清晰的人声，无背景噪音
- **语言**: 中文或英文
- **录制环境**: 安静的环境
- **格式**: WAV、MP3、M4A 等常见格式均可（推荐 WAV）

#### 录制建议

1. **使用手机录音**：
   - 打开手机录音应用
   - 在安静的环境中录制
   - 说一段 5-10 秒的话（例如："你好，这是我的声音测试"）
   - 导出音频文件

2. **使用电脑录音**：
   - Windows: 使用"录音机"应用
   - Mac: 使用"语音备忘录"
   - 录制 5-10 秒的清晰人声

3. **下载示例音频**：
   - 如果您没有合适的音频，可以从网上下载一段清晰的人声音频
   - 确保音频时长在 3-10 秒之间

### 2. 放置音频文件

将准备好的音频文件放置到以下位置：

```
f:\智能体定制\20250911roleChat\99AI\service\test-audio.wav
```

**或者**，您可以使用任意文件名和路径，然后修改测试脚本中的 `$localAudioPath` 变量。

## 🚀 运行测试

### 方法 1: 使用默认文件名

1. 将音频文件重命名为 `test-audio.wav`
2. 放置到 `service` 目录
3. 运行测试脚本：

```powershell
cd service
.\test-voice-local.ps1
```

### 方法 2: 使用自定义文件名

1. 将音频文件放置到任意位置
2. 编辑 `test-voice-local.ps1` 脚本
3. 修改第 10 行的 `$localAudioPath` 变量：

```powershell
$localAudioPath = "C:\Users\YourName\Desktop\my-voice.wav"
```

4. 运行测试脚本：

```powershell
cd service
.\test-voice-local.ps1
```

## 📊 测试流程

测试脚本将执行以下步骤：

1. **[1/4] 上传本地音频文件**
   - 将本地音频文件上传到服务器
   - 获取音频 URL

2. **[2/4] 发送声音复刻请求**
   - 调用 `/api/open/voice/enroll` 接口
   - 音频将自动进行预处理（转换为 16kHz 单声道 WAV）

3. **[3/4] 检查声音创建状态**
   - 查询声音创建状态
   - 显示当前状态（PENDING/CREATED/FAILED）

4. **[4/4] 查询声音详情**
   - 获取完整的声音信息
   - 显示 Voice ID、名称、状态等

## ✅ 预期结果

### 成功的输出示例

```
========================================
  Local Audio Voice Cloning Test
========================================

Local Audio File: test-audio.wav
File Size: 245.67 KB
FFmpeg: Available (ffmpeg version 8.0)

Analyzing audio parameters...
Original Audio Parameters:
  - Sample Rate: 48000 Hz (WILL BE CONVERTED to 16000 Hz)
  - Channels: 2 (Stereo, WILL BE CONVERTED to Mono)
  - Duration: 8.5 seconds (OK)

Starting test...

[1/4] Uploading local audio file...
SUCCESS - Audio uploaded
Audio URL: https://...

[2/4] Sending voice enrollment request...
SUCCESS - Voice enrollment initiated
Voice ID: cosyvoice-v2#local123456

[3/4] Checking voice creation status...
SUCCESS - Voice status: CREATED
Voice created successfully!

[4/4] Querying voice details...
SUCCESS - Voice details retrieved

Voice Details:
  Voice ID: cosyvoice-v2#local123456
  Name: Local Audio Test Voice
  Status: CREATED
  Target Model: cosyvoice-v2
  Created At: 2025-10-08T20:45:00.000Z

========================================
  TEST COMPLETED
========================================
```

### 失败的输出示例

如果仍然出现 `Audio.AudioSilentError`，输出将显示：

```
[2/4] Sending voice enrollment request...
FAILED - Request failed
Error: 音频预处理失败: Audio.AudioSilentError - silent audio error!
```

## 🔍 故障排除

### 问题 1: 找不到音频文件

**错误信息**：
```
ERROR: Local audio file not found: test-audio.wav
```

**解决方法**：
1. 确认音频文件已放置到 `service` 目录
2. 确认文件名为 `test-audio.wav`
3. 或修改脚本中的 `$localAudioPath` 变量

### 问题 2: 上传失败

**错误信息**：
```
FAILED - Upload failed
```

**解决方法**：
1. 确认服务正在运行（`http://localhost:9520`）
2. 检查音频文件大小（建议小于 10MB）
3. 检查音频文件格式（推荐使用 WAV）

### 问题 3: 仍然出现 AudioSilentError

**可能原因**：
1. 音频内容质量不符合要求
2. 音频包含过多背景噪音
3. 音频不是清晰的人声

**解决方法**：
1. 使用更高质量的音频文件
2. 在安静的环境中重新录制
3. 确保音频内容是清晰的人声

## 📝 查看详细日志

测试过程中，服务会输出详细的日志。您可以在服务终端中查看：

```
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [enroll] 收到请求
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [enroll] 开始预处理音频文件
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [preprocessAudio] 开始下载音频
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [preprocessAudio] 音频下载完成，开始转换
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [preprocessAudio] FFmpeg 命令: ffmpeg -i ...
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [preprocessAudio] 音频转换完成
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [preprocessAudio] 开始上传转换后的音频
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [preprocessAudio] 音频上传成功
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [enroll] 音频预处理成功
[Nest] 52880  - 2025/10/08 20:45:00     LOG [VoiceService] [enroll] 准备调用阿里云API
```

## 🎯 下一步

如果测试成功：
- ✅ 音频预处理功能正常工作
- ✅ 可以开始使用声音复刻功能

如果测试失败：
- 尝试使用不同的音频文件
- 检查音频质量和内容
- 查看服务日志获取更多信息
- 联系技术支持

---

**祝您测试顺利！** 🎉

