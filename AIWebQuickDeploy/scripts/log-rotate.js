/**
 * 日志轮转脚本
 *
 * 功能：
 * - 每小时将当前日志归档到按日期/小时组织的目录结构
 * - 目录结构：logs/archive/YYYY-MM-DD/HH/{type}-{instance}_{timestamp}.log
 * - 支持多实例（默认8个实例）
 * - 保留所有历史日志，不删除
 *
 * 用法：
 * - 手动运行: node scripts/log-rotate.js
 * - 定时任务: 配合 PM2 cron 或系统 crontab 每小时运行
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  logsDir: path.join(__dirname, '..', 'logs'),
  archiveDir: path.join(__dirname, '..', 'logs', 'archive'),
  // 要归档的日志文件模式
  logPatterns: [
    { pattern: /^out-(\d+)\.log$/, type: 'out' },
    { pattern: /^err-(\d+)\.log$/, type: 'err' },
    { pattern: /^out\.log$/, type: 'out', instance: 0 },
    { pattern: /^err\.log$/, type: 'err', instance: 0 }
  ],
  // 最小归档文件大小（字节），小于此大小不归档
  minArchiveSize: 1024, // 1KB
  // 时区
  timezone: 'Asia/Shanghai'
};

/**
 * 获取当前时间（上海时区）
 */
function getNow() {
  const now = new Date();
  // 转换到上海时区
  const shanghaiOffset = 8 * 60; // UTC+8
  const localOffset = now.getTimezoneOffset();
  const shanghaiTime = new Date(now.getTime() + (shanghaiOffset + localOffset) * 60 * 1000);
  return shanghaiTime;
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化小时为 HH
 */
function formatHour(date) {
  return String(date.getHours()).padStart(2, '0');
}

/**
 * 格式化完整时间戳
 */
function formatTimestamp(date) {
  const dateStr = formatDate(date);
  const hour = formatHour(date);
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${dateStr}_${hour}-${minute}-${second}`;
}

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[LogRotate] 创建目录: ${dir}`);
  }
}

/**
 * 获取文件大小
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (e) {
    return 0;
  }
}

/**
 * 复制并清空日志文件
 */
function rotateLogFile(srcPath, destPath) {
  try {
    // 复制文件内容
    const content = fs.readFileSync(srcPath);
    fs.writeFileSync(destPath, content);

    // 清空源文件（保持文件句柄有效）
    fs.writeFileSync(srcPath, '');

    console.log(`[LogRotate] 归档完成: ${path.basename(srcPath)} -> ${destPath}`);
    return true;
  } catch (e) {
    console.error(`[LogRotate] 归档失败: ${srcPath}`, e.message);
    return false;
  }
}

/**
 * 主轮转函数
 */
function rotate() {
  const now = getNow();
  const dateStr = formatDate(now);
  const hourStr = formatHour(now);
  const timestamp = formatTimestamp(now);

  console.log(`\n[LogRotate] 开始日志轮转 - ${timestamp}`);
  console.log(`[LogRotate] 日期: ${dateStr}, 小时: ${hourStr}`);

  // 确保归档目录存在
  ensureDir(config.archiveDir);

  // 创建日期目录
  const datePath = path.join(config.archiveDir, dateStr);
  ensureDir(datePath);

  // 创建小时目录
  const hourPath = path.join(datePath, hourStr);
  ensureDir(hourPath);

  // 扫描日志目录
  let files;
  try {
    files = fs.readdirSync(config.logsDir);
  } catch (e) {
    console.error(`[LogRotate] 无法读取日志目录: ${config.logsDir}`, e.message);
    return;
  }

  let archivedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    // 跳过 archive 目录和其他子目录
    if (file === 'archive') continue;

    const filePath = path.join(config.logsDir, file);

    // 跳过目录
    if (fs.statSync(filePath).isDirectory()) continue;

    // 匹配日志文件
    for (const { pattern, type, instance: fixedInstance } of config.logPatterns) {
      const match = file.match(pattern);
      if (match) {
        const instance = fixedInstance !== undefined ? fixedInstance : parseInt(match[1], 10);
        const fileSize = getFileSize(filePath);

        // 跳过太小的文件
        if (fileSize < config.minArchiveSize) {
          console.log(`[LogRotate] 跳过 (文件太小 ${fileSize} bytes): ${file}`);
          skippedCount++;
          break;
        }

        // 生成归档文件名: {type}-{instance}_{timestamp}.log (所有实例在同一文件夹)
        const archiveFileName = `${type}-${instance}_${timestamp}.log`;
        const archivePath = path.join(hourPath, archiveFileName);

        if (rotateLogFile(filePath, archivePath)) {
          archivedCount++;
        }

        break;
      }
    }
  }

  console.log(`[LogRotate] 轮转完成 - 归档: ${archivedCount}, 跳过: ${skippedCount}`);
}

/**
 * 清理旧日志（可选功能）
 * 保留指定天数的日志
 */
function cleanOldLogs(retainDays = 30) {
  console.log(`\n[LogRotate] 清理 ${retainDays} 天前的日志...`);

  const now = getNow();
  const cutoffDate = new Date(now.getTime() - retainDays * 24 * 60 * 60 * 1000);
  const cutoffDateStr = formatDate(cutoffDate);

  try {
    const dateDirs = fs.readdirSync(config.archiveDir);
    let deletedCount = 0;

    for (const dateDir of dateDirs) {
      // 比较日期字符串
      if (dateDir < cutoffDateStr) {
        const dirPath = path.join(config.archiveDir, dateDir);
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`[LogRotate] 删除旧日志目录: ${dateDir}`);
        deletedCount++;
      }
    }

    console.log(`[LogRotate] 清理完成 - 删除 ${deletedCount} 个目录`);
  } catch (e) {
    console.error(`[LogRotate] 清理失败:`, e.message);
  }
}

/**
 * 显示帮助
 */
function showHelp() {
  console.log(`
日志轮转脚本使用方法:

  node scripts/log-rotate.js [命令]

命令:
  rotate              执行日志轮转（默认）
  clean [天数]        清理指定天数前的日志（默认30天）
  help                显示此帮助信息

目录结构 (支持多实例):
  logs/
  ├── out-0.log              # 实例0 当前输出日志
  ├── err-0.log              # 实例0 当前错误日志
  ├── out-1.log              # 实例1 当前输出日志
  ├── err-1.log              # 实例1 当前错误日志
  ├── ...                    # 实例2-7
  └── archive/               # 归档目录
      └── YYYY-MM-DD/        # 日期目录
          └── HH/            # 小时目录 (所有实例日志都在此)
              ├── out-0_YYYY-MM-DD_HH-MM-SS.log
              ├── err-0_YYYY-MM-DD_HH-MM-SS.log
              ├── out-1_YYYY-MM-DD_HH-MM-SS.log
              ├── err-1_YYYY-MM-DD_HH-MM-SS.log
              └── ...        # 实例2-7

示例:
  node scripts/log-rotate.js              # 执行轮转
  node scripts/log-rotate.js clean        # 清理30天前的日志
  node scripts/log-rotate.js clean 7      # 清理7天前的日志
`);
}

// 主程序
const command = process.argv[2] || 'rotate';

switch (command) {
  case 'rotate':
    rotate();
    break;
  case 'clean':
    const days = parseInt(process.argv[3], 10) || 30;
    cleanOldLogs(days);
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    console.error(`未知命令: ${command}`);
    showHelp();
    process.exit(1);
}
