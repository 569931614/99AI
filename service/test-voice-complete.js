const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 测试完整的语音通话流程
async function testVoiceCall() {
  console.log('🎤 开始完整语音通话测试...');

  // 1. 检查音频文件
  const uploadAudioPath = path.join(__dirname, '..', 'upload', '祁煜test.wav');
  const testAudioPath = path.join(__dirname, 'test.wav');
  
  let audioFilePath = testAudioPath;
  
  if (fs.existsSync(uploadAudioPath)) {
    console.log('✅ 找到真实音频文件，使用真实音频进行测试');
    audioFilePath = uploadAudioPath;
  } else if (!fs.existsSync(testAudioPath)) {
    console.log('❌ 测试音频文件不存在，创建一个简单的测试音频...');
    // 创建一个简单的WAV文件头
    const sampleRate = 16000;
    const duration = 2; // 2秒
    const numSamples = sampleRate * duration;
    const buffer = Buffer.alloc(44 + numSamples * 2); // WAV header + 16-bit samples
    
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
    
    // 填充静音数据
    for (let i = 0; i < numSamples; i++) {
      buffer.writeInt16LE(0, 44 + i * 2);
    }
    
    fs.writeFileSync(testAudioPath, buffer);
    console.log(`✅ 创建测试音频文件: ${testAudioPath}`);
  }

  // 2. 读取音频文件
  console.log('📁 读取音频文件...');
  const audioBuffer = fs.readFileSync(audioFilePath);
  const audioBase64 = audioBuffer.toString('base64');
  console.log(`✅ 音频文件读取成功，大小: ${audioBuffer.length} bytes`);

  // 3. 测试语音识别接口
  console.log('🔍 测试语音识别接口...');
  try {
    const asrResponse = await axios.post('http://localhost:9520/api/open/voice/asr', {
      audioBase64: `data:audio/wav;base64,${audioBase64}`,
      format: 'wav',
      sample_rate: 16000
    });
    console.log('✅ ASR接口调用成功');
    console.log('ASR结果:', asrResponse.data);
  } catch (error) {
    console.log('❌ ASR接口调用失败:', error.response?.data || error.message);
  }

  // 4. 测试语音对话接口
  console.log('💬 测试语音对话接口...');
  try {
    const chatResponse = await axios.post('http://localhost:9520/api/open/chat/chat-process-voice', {
      userId: 1,
      audioBase64: `data:audio/wav;base64,${audioBase64}`,
      model: 'gpt-4o-mini',
      modelName: 'AI助手',
      prompt: '你是一个友好的AI助手，请简洁地回答用户的问题。'
    });
    console.log('✅ 语音对话接口调用成功');
    console.log('对话结果:', chatResponse.data);
  } catch (error) {
    console.log('❌ 语音对话接口调用失败:', error.response?.data || error.message);
  }

  // 5. 测试TTS接口
  console.log('🔊 测试语音合成接口...');
  try {
    const ttsResponse = await axios.post('http://localhost:9520/api/open/chat/tts-process', {
      userId: 1,
      prompt: '你好，这是一个语音合成测试。',
      chatId: null
    });
    console.log('✅ TTS接口调用成功');
    console.log('TTS结果:', ttsResponse.data);
  } catch (error) {
    console.log('❌ TTS接口调用失败:', error.response?.data || error.message);
  }

  console.log('🎉 语音通话功能测试完成！');
}

// 运行测试
testVoiceCall().catch(console.error);
