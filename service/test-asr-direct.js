const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 直接测试ASR服务
async function testASRDirect() {
  console.log('🔍 直接测试ASR服务...');

  // 1. 创建测试音频文件
  console.log('🎵 创建测试音频文件...');
  const audioFilePath = path.join(__dirname, 'test-asr.wav');
  
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
    let sample = 0;
    
    // 模拟"你好"的语音特征
    if (t < 1.0) {
      // "你" - 基频 200Hz
      sample += Math.sin(2 * Math.PI * 200 * t) * 0.4;
      sample += Math.sin(2 * Math.PI * 400 * t) * 0.3;
      sample += Math.sin(2 * Math.PI * 600 * t) * 0.2;
    } else if (t < 2.0) {
      // "好" - 基频 300Hz
      sample += Math.sin(2 * Math.PI * 300 * t) * 0.5;
      sample += Math.sin(2 * Math.PI * 600 * t) * 0.4;
      sample += Math.sin(2 * Math.PI * 900 * t) * 0.3;
    } else if (t < 3.0) {
      // 静音
      sample = 0;
    }
    
    // 添加随机噪声
    sample += (Math.random() - 0.5) * 0.1;
    
    // 限制振幅
    sample = Math.max(-1, Math.min(1, sample));
    
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  
  fs.writeFileSync(audioFilePath, buffer);
  console.log(`✅ 创建测试音频文件: ${audioFilePath}`);

  // 2. 分析音频质量
  console.log('📊 分析音频文件质量...');
  const audioData = new Int16Array(buffer.slice(44));
  const maxAmplitude = Math.max(...Array.from(audioData).map(Math.abs));
  const avgAmplitude = audioData.reduce((sum, val) => sum + Math.abs(val), 0) / audioData.length;
  
  console.log(`音频质量: 最大振幅=${maxAmplitude}, 平均振幅=${avgAmplitude.toFixed(2)}`);
  console.log(`音频时长: ${(audioData.length / sampleRate).toFixed(2)}秒`);

  // 3. 测试ASR服务
  console.log('🔍 测试ASR服务...');
  try {
    const audioBase64 = buffer.toString('base64');
    
    // 测试不同的ASR参数
    const testCases = [
      {
        name: '基础参数',
        params: {
          audioBase64: `data:audio/wav;base64,${audioBase64}`,
          format: 'wav',
          sample_rate: 16000
        }
      },
      {
        name: '带模型参数',
        params: {
          audioBase64: `data:audio/wav;base64,${audioBase64}`,
          format: 'wav',
          sample_rate: 16000,
          model: 'paraformer-realtime-v2'
        }
      },
      {
        name: '带语言提示',
        params: {
          audioBase64: `data:audio/wav;base64,${audioBase64}`,
          format: 'wav',
          sample_rate: 16000,
          model: 'paraformer-realtime-v2',
          language_hints: ['zh-CN']
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🧪 测试: ${testCase.name}`);
      try {
        const response = await axios.post('http://localhost:9520/api/open/voice/asr', testCase.params, {
          timeout: 30000
        });
        
        console.log('✅ ASR调用成功');
        console.log('响应:', JSON.stringify(response.data, null, 2));
        
        if (response.data.data && response.data.data.text) {
          console.log('🎯 识别到文本:', response.data.data.text);
        } else {
          console.log('⚠️ 未识别到文本');
        }
      } catch (error) {
        console.log('❌ ASR调用失败:', error.response?.data || error.message);
      }
    }

  } catch (error) {
    console.log('❌ 测试失败:', error.message);
  }

  console.log('\n🎉 ASR直接测试完成！');
}

// 运行测试
testASRDirect().catch(console.error);









