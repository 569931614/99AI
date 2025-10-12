# FFmpeg 安装指南

## 📋 为什么需要 FFmpeg？

音频预处理功能需要 FFmpeg 来转换音频文件，使其符合阿里云 CosyVoice 的要求：
- 采样率: 16000 Hz
- 声道: 单声道 (Mono)
- 时长: 最多 10 秒
- 格式: WAV (PCM 16-bit)

## 🚀 快速安装方法（推荐）

### 方法 1: 使用 Chocolatey（最简单）

1. 以**管理员身份**打开 PowerShell
2. 运行以下命令：

```powershell
choco install ffmpeg -y
```

3. 安装完成后，重启终端即可使用

### 方法 2: 手动下载安装

1. **下载 FFmpeg**
   - 访问: https://www.gyan.dev/ffmpeg/builds/
   - 下载: `ffmpeg-release-essentials.zip` (约 80MB)
   - 或直接下载: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip

2. **解压文件**
   - 解压到任意目录，例如: `C:\ffmpeg`
   - 解压后的目录结构应该是: `C:\ffmpeg\bin\ffmpeg.exe`

3. **添加到系统 PATH**
   
   **选项 A: 使用 PowerShell（推荐）**
   ```powershell
   # 以管理员身份运行
   $ffmpegPath = "C:\ffmpeg\bin"
   $currentPath = [Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::Machine)
   [Environment]::SetEnvironmentVariable("Path", "$currentPath;$ffmpegPath", [System.EnvironmentVariableTarget]::Machine)
   ```

   **选项 B: 使用图形界面**
   - 右键点击"此电脑" → "属性"
   - 点击"高级系统设置"
   - 点击"环境变量"
   - 在"系统变量"中找到"Path"，点击"编辑"
   - 点击"新建"，添加: `C:\ffmpeg\bin`
   - 点击"确定"保存

4. **验证安装**
   ```powershell
   # 重启终端后运行
   ffmpeg -version
   ```

   如果看到版本信息，说明安装成功！

### 方法 3: 使用便携版（无需安装）

如果您不想修改系统 PATH，可以将 FFmpeg 放在项目目录中：

1. 下载 FFmpeg 并解压
2. 将 `ffmpeg.exe` 复制到项目的 `service` 目录
3. 修改代码以使用本地 FFmpeg（已在代码中实现自动查找）

## ✅ 验证安装

安装完成后，运行以下命令验证：

```powershell
cd service
ffmpeg -version
```

应该看到类似输出：
```
ffmpeg version 2024-10-08-git-... Copyright (c) 2000-2024 the FFmpeg developers
built with gcc ...
```

## 🧪 测试音频预处理功能

安装 FFmpeg 后，运行测试脚本：

```powershell
cd service
.\test-voice-enroll.ps1
```

预期结果：
- ✅ 音频自动下载
- ✅ FFmpeg 转换音频（16kHz, 单声道, 最多10秒）
- ✅ 转换后的音频上传到 OSS
- ✅ 使用转换后的 URL 调用阿里云 API
- ✅ 音色创建成功！

## 🔧 故障排除

### 问题 1: "Cannot find ffmpeg"

**原因**: FFmpeg 未安装或未添加到 PATH

**解决方案**:
1. 确认 FFmpeg 已安装: `ffmpeg -version`
2. 如果未安装，按照上述方法安装
3. 如果已安装但仍报错，重启终端或 IDE

### 问题 2: "Access Denied" 或权限错误

**原因**: 需要管理员权限

**解决方案**:
- 以管理员身份运行 PowerShell
- 或使用方法 2 的选项 B（图形界面）

### 问题 3: 下载速度慢

**原因**: 网络连接问题

**解决方案**:
- 使用国内镜像下载
- 或使用 Chocolatey 安装（自动处理下载）

## 📝 注意事项

1. **重启终端**: 修改 PATH 后需要重启终端才能生效
2. **重启 IDE**: 如果在 VS Code 中运行，可能需要重启 IDE
3. **管理员权限**: 某些安装方法需要管理员权限
4. **防火墙**: 确保防火墙允许 FFmpeg 访问网络（用于下载音频）

## 🎯 下一步

安装完成后：
1. 重启终端
2. 验证安装: `ffmpeg -version`
3. 运行测试: `.\test-voice-enroll.ps1`
4. 查看日志确认音频预处理成功

## 💡 提示

如果您不想安装 FFmpeg，系统会自动回退到使用原始音频 URL。但是，由于原始音频不符合阿里云要求，可能会导致 API 调用失败。

强烈建议安装 FFmpeg 以获得最佳体验！

