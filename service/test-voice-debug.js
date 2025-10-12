const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 测试语音识别调试
async function testVoiceDebug() {
  console.log('🔍 语音识别调试测试...');

  // 等待服务启动
  console.log('⏳ 等待服务启动...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 1. 检查服务状态
  console.log('🔍 检查服务状态...');
  try {
    const response = await axios.get('http://localhost:9520/api/open/voice/list');
    console.log('✅ 服务正常，可用音色数量:', response.data.data.count);
  } catch (error) {
    console.log('❌ 服务异常:', error.message);
    return;
  }

  // 2. 创建测试音频文件 - 包含真实语音内容
  console.log('🎵 创建测试音频文件...');
  const audioFilePath = path.join(__dirname, 'test-debug.wav');
  
  // 创建一个包含语音特征的音频文件
  const sampleRate = 16000;
  const duration = 3; // 3秒
  const numSamples = sampleRate * duration;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  
  // 创建模拟"你好"的音频数据
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // 模拟"你好"的语音特征 - 包含多个频率成分
    let sample = 0;
    
    // 基频 200Hz (模拟"你")
    if (t < 1.0) {
      sample += Math.sin(2 * Math.PI * 200 * t) * 0.3;
      sample += Math.sin(2 * Math.PI * 400 * t) * 0.2;
      sample += Math.sin(2 * Math.PI * 600 * t) * 0.1;
    }
    // 基频 300Hz (模拟"好")
    else if (t < 2.0) {
      sample += Math.sin(2 * Math.PI * 300 * t) * 0.4;
      sample += Math.sin(2 * Math.PI * 600 * t) * 0.3;
      sample += Math.sin(2 * Math.PI * 900 * t) * 0.2;
    }
    // 静音
    else {
      sample = 0;
    }
    
    // 添加一些随机噪声模拟真实语音
    sample += (Math.random() - 0.5) * 0.05;
    
    // 限制振幅
    sample = Math.max(-1, Math.min(1, sample));
    
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  
  fs.writeFileSync(audioFilePath, buffer);
  console.log(`✅ 创建测试音频文件: ${audioFilePath}`);

  // 3. 分析音频文件质量
  console.log('📊 分析音频文件质量...');
  const audioData = new Int16Array(buffer.slice(44));
  const maxAmplitude = Math.max(...Array.from(audioData).map(Math.abs));
  const avgAmplitude = audioData.reduce((sum, val) => sum + Math.abs(val), 0) / audioData.length;
  
  console.log(`音频质量: 最大振幅=${maxAmplitude}, 平均振幅=${avgAmplitude.toFixed(2)}`);
  
  if (maxAmplitude < 100) {
    console.log('⚠️ 音频信号太弱');
  } else {
    console.log('✅ 音频信号强度正常');
  }

  // 4. 测试语音识别
  console.log('🔍 测试语音识别...');
  try {
    const audioBase64 = buffer.toString('base64');
    const asrResponse = await axios.post('http://localhost:9520/api/open/voice/asr', {
      audioBase64: `data:audio/wav;base64,${audioBase64}`,
      format: 'wav',
      sample_rate: 16000,
      model: 'paraformer-realtime-v2'
    }, {
      timeout: 30000
    });
    
    console.log('✅ ASR识别成功');
    console.log('ASR结果:', asrResponse.data);
    
    if (asrResponse.data.data.text) {
      console.log('🎯 识别到文本:', asrResponse.data.data.text);
    } else {
      console.log('⚠️ 未识别到文本');
      console.log('可能的原因:');
      console.log('1. API Key配置问题');
      console.log('2. 音频格式不兼容');
      console.log('3. 音频内容不够清晰');
    }
  } catch (error) {
    console.log('❌ ASR识别失败:', error.response?.data || error.message);
  }

  // 5. 测试语音对话
  console.log('💬 测试语音对话...');
  try {
    const audioBase64 = buffer.toString('base64');
    const chatResponse = await axios.post('http://localhost:9520/api/open/chat/chat-process-voice', {
      userId: 1,
      audioBase64: `data:audio/wav;base64,${audioBase64}`,
      model: 'gpt-4o-mini',
      modelName: 'AI助手'
    }, {
      timeout: 60000
    });
    
    console.log('✅ 语音对话成功');
    console.log('响应长度:', chatResponse.data?.length || '未知');
    
    if (typeof chatResponse.data === 'string' && chatResponse.data.length > 0) {
      console.log('📝 对话响应:', chatResponse.data.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ 语音对话失败:', error.response?.data || error.message);
  }

  console.log('🎉 语音识别调试测试完成！');
  console.log('');
  console.log('💡 如果仍然无法识别，请检查:');
  console.log('1. 项目配置中的 dashscopeApiKey 是否正确');
  console.log('2. 网络连接是否正常');
  console.log('3. 音频设备是否正常工作');
  console.log('4. 说话声音是否足够清晰');
}

// 运行测试
testVoiceDebug().catch(console.error);









