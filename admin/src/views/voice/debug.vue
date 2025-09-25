<template>
  <div class="p-4">
    <el-page-header @back="router.back()" content="调试参数" class="mb-3" />

    <el-card shadow="never" class="mb-3">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <span>音色</span>
            <el-tag type="info" class="ml-2">{{ voiceId }}</el-tag>
          </div>
          <div>
            <el-tag type="success">模型：{{ model }}</el-tag>
          </div>
        </div>
      </template>

      <el-form :inline="true" label-width="120px">
        <el-form-item label="生成文本">
          <el-input v-model="form.text" placeholder="请输入要合成的文本" style="width: 520px" />
        </el-form-item>
        <el-form-item label="格式">
          <el-select v-model="form.format" style="width: 120px">
            <el-option label="mp3" value="mp3" />
            <el-option label="wav" value="wav" />
          </el-select>
        </el-form-item>
        <el-form-item label="采样率">
          <el-input-number v-model="form.sample_rate" :min="8000" :max="48000" :step="1000" />
        </el-form-item>
        <el-form-item label="音量">
          <el-input-number v-model="form.volume" :min="0" :max="100" :step="5" />
        </el-form-item>
      </el-form>

      <el-divider>参数范围</el-divider>

      <el-form :inline="true" label-width="100px">
        <el-form-item label="语速范围">
          <el-input-number v-model="form.rateMin" :min="0.5" :max="2" :step="0.1" />
          <span class="mx-2">~</span>
          <el-input-number v-model="form.rateMax" :min="0.5" :max="2" :step="0.1" />
          <span class="mx-2">步长</span>
          <el-input-number v-model="form.rateStep" :min="0.05" :max="1" :step="0.05" />
        </el-form-item>
        <el-form-item label="语调范围">
          <el-input-number v-model="form.pitchMin" :min="0.5" :max="2" :step="0.1" />
          <span class="mx-2">~</span>
          <el-input-number v-model="form.pitchMax" :min="0.5" :max="2" :step="0.1" />
          <span class="mx-2">步长</span>
          <el-input-number v-model="form.pitchStep" :min="0.05" :max="1" :step="0.05" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="generating" @click="onGenerate"
            >生成语音列表</el-button
          >
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>生成结果</span>
      </template>
      <el-table :data="results" size="small" v-loading="generating" style="width: 100%">
        <el-table-column prop="rate" label="语速" width="120" />
        <el-table-column prop="pitch" label="语调" width="120" />
        <el-table-column label="试听">
          <template #default="scope">
            <audio v-if="scope.row.url" :src="scope.row.url" controls preload="none" />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button size="small" @click="play(scope.row)" :disabled="!scope.row.url"
              >播放</el-button
            >
            <el-button
              size="small"
              type="success"
              @click="selectParams(scope.row)"
              :disabled="!scope.row.url"
              >选中</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import voiceApi from '@/api/modules/voice';
  import { ElMessage } from 'element-plus';
  import { onMounted, reactive, ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';

  const route = useRoute();
  const router = useRouter();
  const voiceId = String(route.params.voiceId || '');

  const model = ref('');
  function deriveModelFromVoiceId(id?: string) {
    const v = (id || '').toLowerCase();
    if (v.startsWith('cosyvoice-v3-plus-')) return 'cosyvoice-v3-plus';
    if (v.startsWith('cosyvoice-v3-')) return 'cosyvoice-v3';
    if (v.startsWith('cosyvoice-v2-')) return 'cosyvoice-v2';
    return 'cosyvoice-v2';
  }

  const form = reactive({
    text: '你好，这是参数调试生成的语音。',
    format: 'mp3' as 'mp3' | 'wav',
    sample_rate: 22050,
    volume: 50,
    rateMin: 0.9,
    rateMax: 1.2,
    rateStep: 0.1,
    pitchMin: 0.9,
    pitchMax: 1.2,
    pitchStep: 0.1,
  });

  const generating = ref(false);
  const results = ref<Array<{ rate: number; pitch: number; url?: string }>>([]);

  function range(start: number, end: number, step: number) {
    const arr: number[] = [];
    const eps = 1e-6;
    for (let v = start; v <= end + eps; v += step) {
      arr.push(Number(v.toFixed(3)));
    }
    return arr;
  }

  async function onGenerate() {
    if (!voiceId || !form.text) {
      ElMessage.warning('请完善参数');
      return;
    }
    const rates = range(form.rateMin, form.rateMax, form.rateStep);
    const pitchs = range(form.pitchMin, form.pitchMax, form.pitchStep);
    const combos: Array<{ rate: number; pitch: number }> = [];
    rates.forEach((r) => pitchs.forEach((p) => combos.push({ rate: r, pitch: p })));

    generating.value = true;
    results.value = combos.map((c) => ({ ...c, url: undefined }));

    // 顺序调用，避免外部限流
    for (let i = 0; i < results.value.length; i++) {
      const item = results.value[i];
      try {
        const res = await voiceApi.preview({
          voice_id: voiceId,
          text: form.text,
          model: model.value,
          format: form.format,
          sample_rate: form.sample_rate,
          volume: form.volume,
          rate: item.rate,
          pitch: item.pitch,
        });
        const url = (res as any)?.data?.data?.url || (res as any)?.data?.url;
        item.url = url;
      } catch (e: any) {
        // 忽略单个失败，继续
        item.url = '';
      }
    }

    generating.value = false;
    ElMessage.success('生成完成');
  }

  function play(row: any) {
    if (!row?.url) return;
    const a = new Audio(row.url);
    a.play();
  }

  async function selectParams(row: { rate: number; pitch: number; url?: string }) {
    try {
      const params = {
        format: form.format,
        sample_rate: form.sample_rate,
        volume: form.volume,
        rate: row.rate,
        pitch: row.pitch,
      };
      await voiceApi.setParams({ voice_id: voiceId, params });
      ElMessage.success('已设置为该音色的默认参数');
    } catch (e: any) {
      ElMessage.error(e?.message || '设置失败');
    }
  }

  onMounted(async () => {
    model.value = deriveModelFromVoiceId(voiceId);
    // 读取已保存的默认参数，用于预填
    try {
      const res = await voiceApi.getParams(voiceId);
      const data = (res as any)?.data;
      if (data && typeof data === 'object') {
        if (data.format) form.format = data.format;
        if (data.sample_rate) form.sample_rate = Number(data.sample_rate);
        if (data.volume) form.volume = Number(data.volume);
        if (data.rate) form.rateMin = form.rateMax = Number(data.rate);
        if (data.pitch) form.pitchMin = form.pitchMax = Number(data.pitch);
      }
    } catch {}
  });
</script>

<style scoped>
  .mx-2 {
    margin: 0 8px;
  }
</style>
