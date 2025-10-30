<template>
  <div class="voice-test-container">
    <el-page-header @back="$router.push('/voice')" content="音色测试" class="mb-4" />

    <el-card shadow="never">
      <!-- 步骤指示器 -->
      <el-steps :active="currentStep" finish-status="success" align-center class="mb-6">
        <el-step title="上传音频" description="选择模型并上传声音文件" />
        <el-step title="训练声音" description="提交训练并等待完成" />
        <el-step title="参数调节" description="调节参数并试听效果" />
      </el-steps>

      <!-- 步骤1: 上传音频 -->
      <div v-show="currentStep === 0" class="step-content">
        <el-form :model="uploadForm" label-width="120px" style="max-width: 600px">
          <el-form-item label="音色名称" required>
            <el-input
              v-model="uploadForm.name"
              placeholder="给音色起个名字，便于识别"
              clearable
            />
            <div class="form-tip">例如：小明、客服小美、播音员张三等</div>
          </el-form-item>

          <el-form-item label="前缀标识" required>
            <el-input
              v-model="uploadForm.prefix"
              placeholder="仅限英文字母和数字"
              clearable
              @input="validatePrefix"
            />
            <div class="form-tip">
              ⚠️ 必须使用英文字母和数字，例如：xiaoming、kefu01、voice001
            </div>
          </el-form-item>

          <el-form-item label="选择模型" required>
            <el-select v-model="uploadForm.targetModel" style="width: 100%">
              <el-option
                label="CosyVoice v2 (基础版，速度快)"
                value="cosyvoice-v2"
              />
              <el-option
                label="CosyVoice v3 (标准版，效果好)"
                value="cosyvoice-v3"
              />
              <el-option
                label="CosyVoice v3 Plus (高级版，效果最佳)"
                value="cosyvoice-v3-plus"
              />
            </el-select>
            <div class="form-tip">模型越高级，合成效果越好，但训练时间也越长</div>
          </el-form-item>

          <el-form-item label="音频文件" required>
            <el-upload
              class="upload-demo"
              :show-file-list="true"
              :limit="1"
              :on-exceed="handleExceed"
              :http-request="customUpload"
              accept="audio/*,.wav,.mp3,.m4a"
            >
              <el-button type="primary" :icon="Upload">
                选择音频文件
              </el-button>
            </el-upload>
            <div class="form-tip mt-2">
              要求：
              <ul class="tip-list">
                <li>时长：10-20秒（推荐15秒左右）</li>
                <li>格式：WAV、MP3、M4A</li>
                <li>采样率：≥16kHz（推荐44.1kHz或48kHz）</li>
                <li>大小：≤10MB</li>
                <li>内容：清晰的人声，无背景音乐和噪音</li>
              </ul>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :disabled="!canSubmitUpload"
              :loading="uploading"
              @click="submitUpload"
            >
              下一步：开始训练
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 步骤2: 训练声音 -->
      <div v-show="currentStep === 1" class="step-content">
        <el-result
          v-if="trainingStatus === 'pending'"
          icon="info"
          title="训练中"
          sub-title="正在训练您的音色模型，请稍候..."
        >
          <template #extra>
            <el-progress :percentage="trainingProgress" :status="trainingProgressStatus" />
            <div class="mt-4">
              <el-button type="primary" :loading="true">
                训练中...（约需1-5分钟）
              </el-button>
              <el-button @click="checkTrainingStatus">
                手动刷新状态
              </el-button>
            </div>
          </template>
        </el-result>

        <el-result
          v-else-if="trainingStatus === 'success'"
          icon="success"
          title="训练成功"
          sub-title="音色模型已训练完成，可以开始调节参数了"
        >
          <template #extra>
            <el-button type="primary" size="large" @click="goToNextStep">
              下一步：调节参数
            </el-button>
          </template>
        </el-result>

        <el-result
          v-else-if="trainingStatus === 'failed'"
          icon="error"
          title="训练失败"
          sub-title="很抱歉，音色训练失败，请检查音频文件后重试"
        >
          <template #extra>
            <el-button type="primary" @click="backToUpload">
              返回重新上传
            </el-button>
          </template>
        </el-result>

        <div v-else class="text-center">
          <el-empty description="等待开始训练" />
        </div>
      </div>

      <!-- 步骤3: 参数调节 -->
      <div v-show="currentStep === 2" class="step-content">
        <el-row :gutter="20">
          <!-- 左侧：参数设置 -->
          <el-col :span="14">
            <el-card shadow="never" class="param-card">
              <template #header>
                <div class="card-header">
                  <span>语音参数</span>
                  <el-button type="text" @click="resetParams">重置默认</el-button>
                </div>
              </template>

              <el-form label-width="100px">
                <el-form-item label="测试文本">
                  <el-input
                    v-model="testParams.text"
                    type="textarea"
                    :rows="3"
                    placeholder="输入要合成的文本进行测试"
                  />
                </el-form-item>

                <el-divider content-position="left">基础参数</el-divider>

                <el-form-item label="语速">
                  <el-slider
                    v-model="testParams.rate"
                    :min="0.5"
                    :max="2"
                    :step="0.1"
                    :marks="{ 0.5: '0.5x', 1: '1x', 2: '2x' }"
                    show-input
                  />
                  <div class="param-tip">调节语速，1为正常速度</div>
                </el-form-item>

                <el-form-item label="音调">
                  <el-slider
                    v-model="testParams.pitch"
                    :min="0.5"
                    :max="2"
                    :step="0.1"
                    :marks="{ 0.5: '低', 1: '正常', 2: '高' }"
                    show-input
                  />
                  <div class="param-tip">调节音调高低，1为原始音调</div>
                </el-form-item>

                <el-form-item label="音量">
                  <el-slider
                    v-model="testParams.volume"
                    :min="0"
                    :max="100"
                    :step="5"
                    :marks="{ 0: '0', 50: '50', 100: '100' }"
                    show-input
                  />
                  <div class="param-tip">调节音量大小</div>
                </el-form-item>

                <el-divider content-position="left">高级参数</el-divider>

                <el-form-item label="输出格式">
                  <el-radio-group v-model="testParams.format">
                    <el-radio label="mp3">MP3（推荐）</el-radio>
                    <el-radio label="wav">WAV（无损）</el-radio>
                  </el-radio-group>
                </el-form-item>

                <el-form-item label="采样率">
                  <el-select v-model="testParams.sample_rate" style="width: 200px">
                    <el-option label="16000 Hz" :value="16000" />
                    <el-option label="22050 Hz (推荐)" :value="22050" />
                    <el-option label="24000 Hz" :value="24000" />
                    <el-option label="44100 Hz" :value="44100" />
                    <el-option label="48000 Hz" :value="48000" />
                  </el-select>
                  <div class="param-tip">采样率越高，音质越好，文件也越大</div>
                </el-form-item>

                <el-form-item label="情绪">
                  <el-select
                    v-model="testParams.instruction"
                    placeholder="选择情绪（可选）"
                    clearable
                    style="width: 280px"
                  >
                    <el-option label="无（默认）" value="" />
                    <el-option label="中性 (neutral)" value="你说话的情感是neutral。" />
                    <el-option label="恐惧 (fearful)" value="你说话的情感是fearful。" />
                    <el-option label="愤怒 (angry)" value="你说话的情感是angry。" />
                    <el-option label="悲伤 (sad)" value="你说话的情感是sad。" />
                    <el-option label="惊讶 (surprised)" value="你说话的情感是surprised。" />
                    <el-option label="开心 (happy)" value="你说话的情感是happy。" />
                    <el-option label="厌恶 (disgusted)" value="你说话的情感是disgusted。" />
                  </el-select>
                  <div class="param-tip">
                    ⚠️ 仅cosyvoice-v3默认音色支持，声音复刻暂不支持
                  </div>
                </el-form-item>

                <el-form-item>
                  <el-button
                    type="primary"
                    size="large"
                    :loading="generating"
                    @click="generatePreview"
                  >
                    生成试听
                  </el-button>
                  <el-button
                    type="success"
                    size="large"
                    :disabled="!previewUrl"
                    @click="saveParams"
                  >
                    保存为默认参数
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>

          <!-- 右侧：预览区域 -->
          <el-col :span="10">
            <el-card shadow="never" class="preview-card">
              <template #header>
                <span>音频预览</span>
              </template>

              <div v-if="previewUrl" class="preview-content">
                <div class="audio-info mb-3">
                  <el-tag type="success">生成成功</el-tag>
                  <el-tag type="info" class="ml-2" v-if="audioDuration">
                    时长: {{ formatDuration(audioDuration) }}
                  </el-tag>
                </div>

                <audio
                  ref="audioPlayer"
                  :src="previewUrl"
                  controls
                  class="audio-player"
                  @loadedmetadata="onAudioLoaded"
                />

                <div class="audio-actions mt-3">
                  <el-button type="primary" :icon="VideoPlay" @click="playAudio">
                    播放
                  </el-button>
                  <el-button :icon="VideoPause" @click="pauseAudio">
                    暂停
                  </el-button>
                  <el-button :icon="Download" @click="downloadAudio">
                    下载
                  </el-button>
                </div>

                <el-divider />

                <div class="param-summary">
                  <div class="summary-title">当前参数</div>
                  <div class="summary-item">
                    <span class="label">语速:</span>
                    <span class="value">{{ testParams.rate }}x</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">音调:</span>
                    <span class="value">{{ testParams.pitch }}x</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">音量:</span>
                    <span class="value">{{ testParams.volume }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">格式:</span>
                    <span class="value">{{ testParams.format.toUpperCase() }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">采样率:</span>
                    <span class="value">{{ testParams.sample_rate }} Hz</span>
                  </div>
                </div>
              </div>

              <el-empty
                v-else
                description="点击【生成试听】按钮生成音频"
                :image-size="120"
              />
            </el-card>
          </el-col>
        </el-row>

        <el-divider />

        <div class="step-actions text-center">
          <el-button @click="backToUpload">返回重新训练</el-button>
          <el-button type="success" @click="finishTest">
            完成测试
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload, VideoPlay, VideoPause, Download } from '@element-plus/icons-vue';
import { useRouter, useRoute } from 'vue-router';
import voiceApi from '@/api/modules/voice';
import uploadApi from '@/api/modules/upload';

const router = useRouter();
const route = useRoute();

// 当前步骤
const currentStep = ref(0);

// 步骤1: 上传表单
const uploadForm = reactive({
  name: '',
  prefix: '',
  targetModel: 'cosyvoice-v2',
  audioUrl: '',
});

const uploading = ref(false);
const canSubmitUpload = computed(() => {
  return (
    uploadForm.name.trim() &&
    uploadForm.prefix.trim() &&
    uploadForm.targetModel &&
    uploadForm.audioUrl
  );
});

// 文件上传
const handleExceed = () => {
  ElMessage.warning('只能上传一个音频文件');
};

const customUpload = async (options: any) => {
  const { file, onSuccess, onError } = options;

  // 验证文件大小
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过10MB');
    onError(new Error('文件过大'));
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await uploadApi.uploadFile(formData, 'voice');
    const url = res?.data?.data || res?.data;
    if (!url) throw new Error('上传失败，未获取到URL');

    uploadForm.audioUrl = url;
    ElMessage.success('音频上传成功');
    onSuccess(res);
  } catch (err: any) {
    ElMessage.error(err?.message || '音频上传失败');
    onError(err);
  }
};

// 验证前缀格式
const validatePrefix = () => {
  // 移除非字母数字字符
  uploadForm.prefix = uploadForm.prefix.replace(/[^a-zA-Z0-9]/g, '');
};

// 提交训练
const trainingVoiceId = ref('');
const trainingStatus = ref<'idle' | 'pending' | 'success' | 'failed'>('idle');
const trainingProgress = ref(0);
const trainingProgressStatus = computed(() => {
  if (trainingStatus.value === 'success') return 'success';
  if (trainingStatus.value === 'failed') return 'exception';
  return undefined;
});

let statusCheckTimer: number | null = null;

const submitUpload = async () => {
  // 验证前缀格式
  const prefixRegex = /^[a-zA-Z0-9]+$/;
  if (!prefixRegex.test(uploadForm.prefix)) {
    ElMessage.error('前缀只能包含英文字母和数字，不能包含中文、空格或特殊字符');
    return;
  }

  uploading.value = true;
  try {
    const res = await voiceApi.enroll({
      prefix: uploadForm.prefix,
      url: uploadForm.audioUrl,
      targetModel: uploadForm.targetModel,
      name: uploadForm.name,
    });

    const body: any = res || {};
    const voiceId =
      body?.data?.output?.voice_id ||
      body?.output?.voice_id ||
      body?.voice_id ||
      body?.data?.voice_id;

    if (!voiceId) {
      console.error('无法提取Voice ID，完整响应:', JSON.stringify(body, null, 2));
      throw new Error('训练提交成功，但未返回Voice ID');
    }

    trainingVoiceId.value = voiceId;
    trainingStatus.value = 'pending';
    trainingProgress.value = 10;
    currentStep.value = 1;

    ElMessage.success('训练任务已提交');

    // 开始轮询检查状态
    startStatusCheck();
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '训练提交失败';
    ElMessage.error(msg);
  } finally {
    uploading.value = false;
  }
};

const startStatusCheck = () => {
  if (statusCheckTimer) return;

  statusCheckTimer = setInterval(async () => {
    await checkTrainingStatus();
  }, 5000); // 每5秒检查一次
};

const stopStatusCheck = () => {
  if (statusCheckTimer) {
    clearInterval(statusCheckTimer);
    statusCheckTimer = null;
  }
};

const checkTrainingStatus = async () => {
  if (!trainingVoiceId.value) return;

  try {
    const res = await voiceApi.detail(trainingVoiceId.value);
    const body = res?.data || res || {};

    // 尝试多个可能的路径提取状态
    const status = String(
      body?.data?.output?.status ||
      body?.output?.status ||
      body?.data?.status ||
      body?.status ||
      body?.result?.status ||
      ''
    ).toUpperCase();

    console.log('训练状态检查:', status, '完整响应:', body);

    if (status === 'SUCCEEDED' || status === 'OK') {
      trainingStatus.value = 'success';
      trainingProgress.value = 100;
      stopStatusCheck();
      ElMessage.success('音色训练完成！');
    } else if (status === 'FAILED') {
      trainingStatus.value = 'failed';
      trainingProgress.value = 0;
      stopStatusCheck();
      ElMessage.error('音色训练失败');
    } else if (status === 'PENDING' || status === 'RUNNING') {
      // 继续等待，增加进度
      if (trainingProgress.value < 90) {
        trainingProgress.value += 10;
      }
    }
  } catch (e) {
    console.error('状态查询失败:', e);
  }
};

const goToNextStep = () => {
  currentStep.value = 2;
  // 初始化测试参数
  initTestParams();
};

const backToUpload = () => {
  currentStep.value = 0;
  trainingStatus.value = 'idle';
  trainingProgress.value = 0;
  trainingVoiceId.value = '';
  uploadForm.audioUrl = '';
  stopStatusCheck();
};

// 步骤3: 参数调节
const testParams = reactive({
  text: '你好，这是音色测试生成的语音。欢迎使用AI语音合成系统。',
  rate: 1.0,
  pitch: 1.0,
  volume: 50,
  format: 'mp3' as 'mp3' | 'wav',
  sample_rate: 22050,
  instruction: '', // 情绪指令，仅cosyvoice-v3默认音色支持
});

const previewUrl = ref('');
const audioDuration = ref(0);
const generating = ref(false);
const audioPlayer = ref<HTMLAudioElement>();

const initTestParams = async () => {
  // 尝试加载已保存的参数
  try {
    const res = await voiceApi.getParams(trainingVoiceId.value);
    const data = res?.data?.data || res?.data || {};
    if (data && typeof data === 'object') {
      if (typeof data.rate === 'number') testParams.rate = data.rate;
      if (typeof data.pitch === 'number') testParams.pitch = data.pitch;
      if (typeof data.volume === 'number') testParams.volume = data.volume;
      if (typeof data.format === 'string') testParams.format = data.format as any;
      if (typeof data.sample_rate === 'number') testParams.sample_rate = data.sample_rate;
      if (typeof data.instruction === 'string') testParams.instruction = data.instruction;
    }
  } catch (e) {
    // 忽略，使用默认参数
  }
};

const resetParams = () => {
  testParams.rate = 1.0;
  testParams.pitch = 1.0;
  testParams.volume = 50;
  testParams.format = 'mp3';
  testParams.sample_rate = 22050;
  testParams.instruction = '';
};

const generatePreview = async () => {
  if (!testParams.text.trim()) {
    ElMessage.warning('请输入测试文本');
    return;
  }

  generating.value = true;
  try {
    const previewParams: any = {
      voice_id: trainingVoiceId.value,
      text: testParams.text,
      model: uploadForm.targetModel,
      format: testParams.format,
      sample_rate: testParams.sample_rate,
      volume: testParams.volume,
      rate: testParams.rate,
      pitch: testParams.pitch,
    };

    // 只有当instruction不为空时才传递
    if (testParams.instruction) {
      previewParams.instruction = testParams.instruction;
    }

    const res = await voiceApi.preview(previewParams);

    const data = res?.data?.data || res?.data;
    const url = data?.url;
    const duration = data?.duration;

    if (!url) throw new Error('未返回音频URL');

    previewUrl.value = url;
    audioDuration.value = duration || 0;
    ElMessage.success('音频生成成功');
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败');
  } finally {
    generating.value = false;
  }
};

const saveParams = async () => {
  try {
    await voiceApi.setParams({
      voice_id: trainingVoiceId.value,
      params: {
        rate: testParams.rate,
        pitch: testParams.pitch,
        volume: testParams.volume,
        format: testParams.format,
        sample_rate: testParams.sample_rate,
        instruction: testParams.instruction,
      },
    });
    ElMessage.success('参数已保存为默认设置');
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败');
  }
};

const onAudioLoaded = () => {
  if (audioPlayer.value) {
    audioDuration.value = audioPlayer.value.duration;
  }
};

const playAudio = () => {
  audioPlayer.value?.play();
};

const pauseAudio = () => {
  audioPlayer.value?.pause();
};

const downloadAudio = () => {
  if (!previewUrl.value) return;
  const a = document.createElement('a');
  a.href = previewUrl.value;
  a.download = `voice_test_${Date.now()}.${testParams.format}`;
  a.click();
};

const formatDuration = (seconds: number) => {
  if (!seconds) return '--';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return min > 0 ? `${min}分${sec}秒` : `${sec}秒`;
};

const finishTest = async () => {
  const result = await ElMessageBox.confirm(
    '测试完成！您可以在音色列表中查看和使用此音色。是否返回音色列表？',
    '测试完成',
    {
      confirmButtonText: '返回列表',
      cancelButtonText: '继续测试',
      type: 'success',
    }
  ).catch(() => false);

  if (result) {
    router.push('/voice');
  }
};

// 初始化：检查URL参数，支持直接跳转到特定步骤
onMounted(() => {
  const voiceId = route.query.voiceId as string;
  const step = route.query.step as string;

  if (voiceId && step === '2') {
    // 直接进入参数调节步骤
    trainingVoiceId.value = voiceId;
    trainingStatus.value = 'success';
    currentStep.value = 2;

    // 推断模型
    const lowerId = voiceId.toLowerCase();
    if (lowerId.startsWith('cosyvoice-v3-plus-')) {
      uploadForm.targetModel = 'cosyvoice-v3-plus';
    } else if (lowerId.startsWith('cosyvoice-v3-')) {
      uploadForm.targetModel = 'cosyvoice-v3';
    } else if (lowerId.startsWith('cosyvoice-v2-')) {
      uploadForm.targetModel = 'cosyvoice-v2';
    }

    // 初始化测试参数
    initTestParams();
  }
});

// 组件卸载时清理定时器
onUnmounted(() => {
  stopStatusCheck();
});
</script>

<style scoped>
.voice-test-container {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.mb-4 {
  margin-bottom: 16px;
}

.mb-6 {
  margin-bottom: 24px;
}

.mb-3 {
  margin-bottom: 12px;
}

.mt-2 {
  margin-top: 8px;
}

.mt-3 {
  margin-top: 12px;
}

.mt-4 {
  margin-top: 16px;
}

.ml-2 {
  margin-left: 8px;
}

.step-content {
  padding: 30px 20px;
  min-height: 400px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.tip-list {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.tip-list li {
  line-height: 1.8;
}

.param-card,
.preview-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.param-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.preview-content {
  text-align: center;
}

.audio-info {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.audio-player {
  width: 100%;
  margin: 20px 0;
}

.audio-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.param-summary {
  text-align: left;
  background: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
}

.summary-title {
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #ebeef5;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item .label {
  color: #606266;
}

.summary-item .value {
  color: #303133;
  font-weight: 500;
}

.step-actions {
  padding: 20px 0;
}

.text-center {
  text-align: center;
}
</style>
