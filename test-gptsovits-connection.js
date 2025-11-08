/**
 * GPT-SoVITS-v2 连接测试脚本
 * 测试是否能成功连接到本地的 GPT-SoVITS-v2 服务（端口 9874）
 */

const http = require('http');

const GPT_SOVITS_HOST = '127.0.0.1';
const GPT_SOVITS_PORT = 9874;

console.log('==========================================');
console.log('GPT-SoVITS-v2 连接测试');
console.log('==========================================\n');

/**
 * 发送 HTTP 请求的辅助函数
 */
function httpRequest(method, path, postData = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GPT_SOVITS_HOST,
      port: GPT_SOVITS_PORT,
      path: path,
      method: method,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }

    req.end();
  });
}

async function testConnection() {
  console.log(`正在测试连接: http://${GPT_SOVITS_HOST}:${GPT_SOVITS_PORT}\n`);

  // 测试 1: 基础连接测试（根路径）
  console.log('📝 测试 1: 基础连接测试（GET /）');
  try {
    const response = await httpRequest('GET', '/');
    console.log(`✅ 连接成功！`);
    console.log(`   状态码: ${response.status}`);
    console.log(`   响应头: ${JSON.stringify(response.headers, null, 2)}`);
    if (response.data) {
      const preview = response.data.substring(0, 200);
      console.log(`   响应数据: ${preview}${response.data.length > 200 ? '...' : ''}`);
    }
  } catch (error) {
    console.log(`❌ 连接失败！`);
    console.log(`   错误信息: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log(`   提示: 无法连接到服务器，请确认：`);
      console.log(`        1. GPT-SoVITS-v2 是否正在运行`);
      console.log(`        2. 端口是否为 9874`);
      console.log(`        3. 防火墙是否允许连接`);
    }
    return false;
  }

  console.log('\n');

  // 测试 2: 健康检查端点
  console.log('📝 测试 2: 健康检查端点');
  const healthEndpoints = ['/health', '/api/health', '/ping', '/status'];
  for (const endpoint of healthEndpoints) {
    try {
      const response = await httpRequest('GET', endpoint);
      if (response.status === 200) {
        console.log(`✅ ${endpoint} 响应成功`);
        console.log(`   响应数据: ${response.data}`);
        break;
      }
    } catch (error) {
      // 继续尝试下一个端点
    }
  }

  console.log('\n');

  // 测试 3: 模型设置端点（POST /set_model）
  console.log('📝 测试 3: 模型设置端点（POST /set_model）');
  try {
    const response = await httpRequest('POST', '/set_model', {});
    console.log(`✅ /set_model 端点存在`);
    console.log(`   状态码: ${response.status}`);
    const preview = response.data.substring(0, 200);
    console.log(`   响应: ${preview}${response.data.length > 200 ? '...' : ''}`);
  } catch (error) {
    console.log(`⚠️  /set_model 端点测试失败`);
    console.log(`   错误: ${error.message}`);
  }

  console.log('\n');

  // 测试 4: TTS 端点（POST /）
  console.log('📝 测试 4: TTS 合成端点（POST /）');
  try {
    const response = await httpRequest('POST', '/', {});
    console.log(`✅ TTS 合成端点存在`);
    console.log(`   状态码: ${response.status}`);
    const preview = response.data.substring(0, 200);
    console.log(`   响应: ${preview}${response.data.length > 200 ? '...' : ''}`);
  } catch (error) {
    console.log(`⚠️  TTS 合成端点测试失败`);
    console.log(`   错误: ${error.message}`);
  }

  console.log('\n');

  // 总结
  console.log('==========================================');
  console.log('✅ 连接测试完成！');
  console.log('==========================================');
  console.log('');
  console.log('📌 提示：');
  console.log('   如果所有测试都通过，说明 GPT-SoVITS-v2 服务运行正常。');
  console.log('   如果部分测试失败，可能需要：');
  console.log('   1. 检查 GPT-SoVITS-v2 的 API 文档确认正确的端点');
  console.log('   2. 查看 GPT-SoVITS-v2 的日志输出');
  console.log('   3. 确认服务是否完全启动');
  console.log('');

  return true;
}

// 执行测试
testConnection().catch(error => {
  console.error('\n测试脚本执行失败:', error);
  process.exit(1);
});
