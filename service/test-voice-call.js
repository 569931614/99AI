const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:9520',
  testAudioFile: path.join(__dirname, '../upload/祁煜test.wav'), // 使用现有的测试音频文件
  voiceId: 'cosyvoice-v3-zh-CN-XiaoxiaoNeural', // 测试音色ID
  config: {
    modelInfo: {
      model: 'gpt-4o-mini',
      modelName: 'AI助手'
    },
    prompt: '你是一个友好的AI助手，请用简洁的语言回答用户的问题。',
    temperature: 1
  }
};

async function testVoiceCall() {
  try {
    console.log('🎤 开始语音通话测试...');
    
    // 1. 检查测试音频文件是否存在
    if (!fs.existsSync(TEST_CONFIG.testAudioFile)) {
      console.log('❌ 测试音频文件不存在:', TEST_CONFIG.testAudioFile);
      console.log('请确保有音频文件用于测试');
      return;
    }
    
    // 2. 读取音频文件并转换为base64
    console.log('📁 读取音频文件...');
    const audioBuffer = fs.readFileSync(TEST_CONFIG.testAudioFile);
    const audioBase64 = `data:audio/wav;base64,${audioBuffer.toString('base64')}`;
    console.log(`✅ 音频文件读取成功，大小: ${audioBuffer.length} bytes`);
    
    // 3. 准备请求数据
    const requestData = {
      audioBase64,
      format: 'wav',
      sampleRate: 16000,
      voice_id: TEST_CONFIG.voiceId,
      appId: 1,
      config: TEST_CONFIG.config
    };
    
    console.log('🚀 发送语音测试请求...');
    console.log('请求配置:', {
      voice_id: TEST_CONFIG.voiceId,
      model: TEST_CONFIG.config.modelInfo.model,
      prompt: TEST_CONFIG.config.prompt.substring(0, 50) + '...'
    });
    
    // 4. 发送请求
    const response = await axios.post(
      `${TEST_CONFIG.baseUrl}/api/test/voice-call`,
      requestData,
      {
        timeout: 60000, // 60秒超时
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 5. 处理响应
    if (response.data.success) {
      console.log('✅ 语音测试成功！');
      console.log('📝 ASR识别结果:', response.data.asr);
      console.log('🤖 LLM响应:', response.data.llm);
      
      if (response.data.tts) {
        console.log('🔊 TTS合成信息:', {
          voice_id: response.data.tts.voice_id,
          audio_size: response.data.tts.audio_size + ' bytes'
        });
        
        // 保存TTS音频文件
        const ttsAudioBuffer = Buffer.from(response.data.tts.audio_base64.split(',')[1], 'base64');
        const outputFile = path.join(__dirname, 'test-tts-output.wav');
        fs.writeFileSync(outputFile, ttsAudioBuffer);
        console.log('💾 TTS音频已保存到:', outputFile);
      } else {
        console.log('⚠️  跳过TTS合成（无音色ID或无LLM响应）');
      }
    } else {
      console.log('❌ 语音测试失败:', response.data);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else if (error.request) {
      console.error('网络错误:', error.message);
      console.error('请确保服务端已启动在端口 9520');
    } else {
      console.error('其他错误:', error.message);
    }
  }
}

// 运行测试
if (require.main === module) {
  testVoiceCall();
}

module.exports = { testVoiceCall };









