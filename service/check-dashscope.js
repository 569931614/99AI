#!/usr/bin/env node

/**
 * 阿里云 DashScope ASR 诊断工具
 * 用于测试 API Key 是否有效以及能否访问 Paraformer 实时识别服务
 */

const ws = require('ws');
const crypto = require('crypto');

// 从环境变量或命令行参数获取 API Key
const apiKey = process.env.DASHSCOPE_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('❌ 错误：未提供 API Key');
  console.error('用法：');
  console.error('  1. 设置环境变量: export DASHSCOPE_API_KEY=your_key');
  console.error('  2. 命令行参数: node check-dashscope.js your_key');
  process.exit(1);
}

console.log('🔍 开始诊断 DashScope ASR 服务...\n');
console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);

const WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
const taskId = crypto.randomUUID();

const testModels = [
  'paraformer-realtime-8k-v2',
  'paraformer-realtime-v2',
  'paraformer-realtime-v1',
  'paraformer-realtime-8k-v1'
];

let currentModelIndex = 0;

function testModel(modelName) {
  return new Promise((resolve, reject) => {
    console.log(`\n📡 测试模型: ${modelName}`);
    console.log(`   连接到: ${WS_URL}`);

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable'
    };

    const socket = new ws.WebSocket(WS_URL, { headers });

    let timeout = setTimeout(() => {
      console.log('   ⏱️  超时 (10秒)');
      socket.close();
      reject(new Error('连接超时'));
    }, 10000);

    socket.on('open', () => {
      console.log('   ✅ WebSocket 已连接');

      const payload = {
        header: {
          action: 'run-task',
          task_id: taskId,
          streaming: 'duplex'
        },
        payload: {
          task_group: 'audio',
          task: 'asr',
          function: 'recognition',
          model: modelName,
          parameters: {
            format: 'pcm',
            sample_rate: 8000,
            disfluency_removal_enabled: false
          },
          input: {}
        }
      };

      console.log('   📤 发送 run-task 请求...');
      socket.send(JSON.stringify(payload));
    });

    socket.on('message', (data, isBinary) => {
      if (isBinary) return;

      try {
        const msg = JSON.parse(data.toString());
        const event = msg?.header?.event;

        console.log(`   📨 收到事件: ${event}`);

        if (event === 'task-started') {
          console.log('   ✅ 任务启动成功！模型可用！');
          clearTimeout(timeout);
          socket.close();
          resolve({ model: modelName, status: 'success' });
        } else if (event === 'task-failed') {
          const errorCode = msg?.header?.error_code;
          const errorMsg = msg?.header?.error_message || msg?.header?.message;
          console.log(`   ❌ 任务失败: [${errorCode}] ${errorMsg}`);
          console.log(`   完整错误: ${JSON.stringify(msg.header, null, 2)}`);
          clearTimeout(timeout);
          socket.close();
          reject(new Error(`${errorCode}: ${errorMsg}`));
        }
      } catch (e) {
        console.log(`   ⚠️  解析消息失败: ${e.message}`);
      }
    });

    socket.on('error', (err) => {
      console.log(`   ❌ WebSocket 错误: ${err.message}`);
      clearTimeout(timeout);
      reject(err);
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      console.log('   🔌 连接已关闭');
    });
  });
}

async function runDiagnostics() {
  console.log('\n═══════════════════════════════════════');
  console.log('  开始测试所有可用的模型');
  console.log('═══════════════════════════════════════\n');

  const results = [];

  for (const model of testModels) {
    try {
      const result = await testModel(model);
      results.push({ ...result, error: null });
    } catch (error) {
      results.push({ model, status: 'failed', error: error.message });
    }
    // 避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n\n═══════════════════════════════════════');
  console.log('  诊断结果汇总');
  console.log('═══════════════════════════════════════\n');

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  results.forEach(r => {
    const icon = r.status === 'success' ? '✅' : '❌';
    console.log(`${icon} ${r.model.padEnd(30)} ${r.status === 'success' ? '可用' : '失败: ' + r.error}`);
  });

  console.log(`\n统计: ${successCount} 成功 / ${failedCount} 失败\n`);

  if (successCount === 0) {
    console.log('⚠️  所有模型都失败了！可能的原因:');
    console.log('   1. API Key 无效或过期');
    console.log('   2. 未开通 Paraformer 实时识别服务');
    console.log('   3. 账号余额不足');
    console.log('   4. 网络连接问题');
    console.log('\n请检查:');
    console.log('   - 登录阿里云控制台: https://dashscope.console.aliyun.com/');
    console.log('   - 检查 API Key 状态');
    console.log('   - 确认已开通服务: 模型广场 > Paraformer > 立即使用');
  } else {
    console.log('✅ 诊断完成！至少有一个模型可用。');
    const successModels = results.filter(r => r.status === 'success').map(r => r.model);
    console.log(`\n推荐使用: ${successModels[0]}`);
  }
}

runDiagnostics().catch(err => {
  console.error('\n❌ 诊断失败:', err);
  process.exit(1);
});
