/**
 * 诊断脚本：检查角色的音色配置
 * 用于诊断为什么语音通话没有返回语音
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function diagnoseVoiceConfig() {
  console.log('======================================');
  console.log('角色音色配置诊断工具');
  console.log('======================================\n');

  // 数据库连接配置
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_DATABASE || 'chatgpt',
  };

  console.log('📊 数据库配置:');
  console.log(`   主机: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   数据库: ${dbConfig.database}`);
  console.log(`   用户: ${dbConfig.user}\n`);

  let connection;

  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 获取命令行参数中的 appId，默认为 10023
    const appId = process.argv[2] || '10023';
    console.log(`🔍 查询角色 ID: ${appId}\n`);

    // 1. 查询角色基本信息
    console.log('1️⃣ 角色基本信息:');
    console.log('========================================');
    const [apps] = await connection.execute(
      'SELECT id, name, des, preset, status, createdAt FROM app WHERE id = ?',
      [appId]
    );

    if (apps.length === 0) {
      console.error(`❌ 未找到角色 ID: ${appId}`);
      console.log('\n💡 提示: 请检查角色ID是否正确');
      process.exit(1);
    }

    const app = apps[0];
    console.log(`   ID: ${app.id}`);
    console.log(`   名称: ${app.name}`);
    console.log(`   描述: ${app.des || '(无)'}`);
    console.log(`   状态: ${app.status === 1 ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`   预设长度: ${app.preset?.length || 0} 字符`);
    console.log(`   创建时间: ${app.createdAt}\n`);

    // 2. 检查 app_voice 表中的默认音色配置
    console.log('2️⃣ 默认音色配置 (app_voice 表):');
    console.log('========================================');
    const [appVoices] = await connection.execute(
      'SELECT voiceId, isDefault FROM app_voice WHERE appId = ?',
      [appId]
    );

    let defaultVoiceId = null;

    if (appVoices.length === 0) {
      console.error('   ❌ 未在 app_voice 表中找到音色配置\n');
    } else {
      console.log(`   找到 ${appVoices.length} 个音色配置:`);
      appVoices.forEach(av => {
        const isDefault = av.isDefault === 1;
        console.log(`      ${av.voiceId} ${isDefault ? '(默认)' : ''}`);
        if (isDefault) defaultVoiceId = av.voiceId;
      });
      console.log('');
    }

    // 3. 检查默认音色是否存在于 voice 表
    if (defaultVoiceId) {
      console.log('3️⃣ 音色详情检查:');
      console.log('========================================');
      const [voices] = await connection.execute(
        'SELECT voiceId, name, prefix, model, status, rate, pitch, volume, sampleRate, format FROM voice WHERE voiceId = ?',
        [defaultVoiceId]
      );

      if (voices.length === 0) {
        console.error(`   ❌ 音色不存在: ${defaultVoiceId}`);
        console.log(`   💡 该音色ID在 voice 表中未找到，可能已被删除或ID错误\n`);
      } else {
        const voice = voices[0];
        console.log(`   ✅ 音色已配置:`);
        console.log(`      音色ID: ${voice.voiceId}`);
        console.log(`      名称: ${voice.name || '(无)'}`);
        console.log(`      前缀: ${voice.prefix || '(无)'}`);
        console.log(`      模型: ${voice.model || '(无)'}`);
        console.log(`      状态: ${voice.status || '(无)'}`);
        console.log(`      参数: rate=${voice.rate}, pitch=${voice.pitch}, volume=${voice.volume}`);
        console.log(`      采样率: ${voice.sampleRate}Hz`);
        console.log(`      格式: ${voice.format}\n`);
      }
    } else {
      console.log('3️⃣ 音色详情检查:');
      console.log('========================================');
      console.error('   ❌ 角色未配置默认音色\n');
    }

    // 4. 查询情绪音色映射
    console.log('4️⃣ 情绪音色映射:');
    console.log('========================================');
    const [emotionVoices] = await connection.execute(
      'SELECT id, emotion, voiceId, status FROM app_emotion_voice WHERE appId = ?',
      [appId]
    );

    if (emotionVoices.length === 0) {
      console.log('   ⚠️  未配置情绪音色映射');
      console.log('   💡 这是正常的，系统会使用角色的默认音色\n');
    } else {
      console.log(`   ✅ 已配置 ${emotionVoices.length} 个情绪音色:`);
      for (const ev of emotionVoices) {
        const statusText = ev.status === 1 ? '✅ 启用' : '❌ 禁用';
        console.log(`      - ${ev.emotion}: ${ev.voiceId} (${statusText})`);
      }
      console.log('');
    }

    // 4. 诊断结果
    console.log('========================================');
    console.log('📋 诊断结果:');
    console.log('========================================\n');

    const issues = [];
    const warnings = [];

    if (app.status !== 1) {
      issues.push('角色已被禁用');
    }

    if (!defaultVoiceId) {
      issues.push('角色未配置默认音色（app_voice 表为空）');
    } else {
      const [voices] = await connection.execute(
        'SELECT voiceId FROM voice WHERE voiceId = ?',
        [defaultVoiceId]
      );
      if (voices.length === 0) {
        issues.push(`配置的音色 ${defaultVoiceId} 不存在`);
      }
    }

    if (emotionVoices.length === 0) {
      warnings.push('未配置情绪音色映射（可选）');
    }

    if (issues.length > 0) {
      console.log('❌ 发现问题:');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      console.log('');
    }

    if (warnings.length > 0) {
      console.log('⚠️  注意事项:');
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
      console.log('');
    }

    if (issues.length === 0) {
      console.log('✅ 音色配置正常！\n');
      console.log('💡 如果语音通话仍无语音返回，请检查:');
      console.log('   1. DashScope API Key 是否配置（.env: DASHSCOPE_API_KEY）');
      console.log('   2. 网络是否可以访问 dashscope.aliyuncs.com');
      console.log('   3. 服务端日志中是否有错误信息');
      console.log('   4. 运行 test-voice-call-debug.js 进行完整测试\n');
    } else {
      console.log('🔧 修复建议:\n');

      if (!defaultVoiceId) {
        console.log('1. 为角色配置默认音色:');
        console.log('   方法1: 在管理后台编辑角色，选择默认音色');
        console.log('   方法2: 执行 SQL（插入到 app_voice 表）:');
        console.log(`   INSERT INTO app_voice (appId, voiceId, isDefault) VALUES (${appId}, '你的音色ID', 1);`);
        console.log(`   -- 如果已存在记录，使用 UPDATE:`);
        console.log(`   UPDATE app_voice SET voiceId = '你的音色ID', isDefault = 1 WHERE appId = ${appId};\n`);

        // 查询可用音色
        const [availableVoices] = await connection.execute(
          'SELECT voiceId, name, prefix FROM voice LIMIT 10'
        );
        if (availableVoices.length > 0) {
          console.log('   可用音色列表（前10个）:');
          availableVoices.forEach(v => {
            console.log(`   - ${v.voiceId} (${v.name || v.prefix || '未命名'})`);
          });
          console.log('');
        }
      }

      if (app.status !== 1) {
        console.log('2. 启用角色:');
        console.log(`   UPDATE app SET status = 1 WHERE id = ${appId};\n`);
      }
    }

  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    console.error('\n详细错误信息:');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 运行诊断
diagnoseVoiceConfig().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
