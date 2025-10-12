const axios = require('axios');

// 测试API Key配置
async function testApiKey() {
  console.log('🔍 测试API Key配置...');

  try {
    // 1. 测试获取配置
    console.log('📋 测试获取项目配置...');
    const configResponse = await axios.post('http://localhost:9520/api/globalConfig/query', {
      keys: ['dashscopeApiKey', 'openaiBaseKey', 'openaiBaseUrl']
    });
    
    console.log('✅ 配置获取成功');
    console.log('配置内容:', JSON.stringify(configResponse.data, null, 2));
    
    const configs = configResponse.data.data || {};
    const dashscopeApiKey = configs.dashscopeApiKey;
    const openaiBaseKey = configs.openaiBaseKey;
    const openaiBaseUrl = configs.openaiBaseUrl;
    
    console.log('\n🔑 API Key状态:');
    console.log(`dashscopeApiKey: ${dashscopeApiKey ? '已配置' : '未配置'}`);
    console.log(`openaiBaseKey: ${openaiBaseKey ? '已配置' : '未配置'}`);
    console.log(`openaiBaseUrl: ${openaiBaseUrl || '未配置'}`);
    
    if (!dashscopeApiKey) {
      console.log('\n❌ 问题诊断:');
      console.log('dashscopeApiKey 未配置，这是ASR识别失败的根本原因！');
      console.log('\n🔧 解决方案:');
      console.log('1. 在项目配置中设置 dashscopeApiKey');
      console.log('2. 或者在环境变量中设置 DASHSCOPE_API_KEY');
      console.log('3. 确保API Key有效且有足够的调用额度');
    } else {
      console.log('\n✅ dashscopeApiKey 已配置，ASR应该可以正常工作');
    }
    
  } catch (error) {
    console.log('❌ 配置获取失败:', error.response?.data || error.message);
  }

  console.log('\n🎉 API Key测试完成！');
}

// 运行测试
testApiKey().catch(console.error);









