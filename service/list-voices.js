/**
 * 快速获取可用音色列表
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function listVoices() {
  console.log('======================================');
  console.log('获取可用音色列表');
  console.log('======================================\n');

  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_DATABASE || 'chatgpt',
  };

  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    const [voices] = await connection.execute(
      'SELECT voiceId, name, prefix, model FROM voice ORDER BY id DESC LIMIT 20'
    );

    if (voices.length === 0) {
      console.log('❌ 未找到任何音色');
      console.log('💡 请先同步音色数据：访问 http://localhost:9520/api/voice/sync');
      return;
    }

    console.log(`找到 ${voices.length} 个音色（最近20个）:\n`);
    console.log('序号  音色ID                           名称/前缀');
    console.log('================================================================');

    voices.forEach((v, i) => {
      const displayName = v.name || v.prefix || v.model || '(未命名)';
      console.log(`${String(i + 1).padStart(2)}    ${v.voiceId.padEnd(35)} ${displayName}`);
    });

    console.log('\n推荐音色（中文）:');
    console.log('  - cosyvoice-v2-longxiaochun  (龙小春)');
    console.log('  - cosyvoice-v2-longjingwei   (龙精卫)');
    console.log('  - cosyvoice-v2-longyueyue    (龙悦悦)');
    console.log('  - cosyvoice-v2-longwan       (龙婉)');

    console.log('\n使用方法:');
    console.log('  1. 为角色配置默认音色:');
    console.log('     UPDATE app SET voiceId = \'音色ID\' WHERE id = 10023;');
    console.log('\n  2. 或在测试页面的"音色ID"输入框填入音色ID');

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

listVoices();
