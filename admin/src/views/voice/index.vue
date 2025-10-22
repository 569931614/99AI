<template>
  <div class="p-4">
    <el-card class="mb-4" shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>声音复刻（创建音色）</span>
          <div class="flex gap-2">
            <el-button type="success" @click="syncPendingStatus" :loading="syncing" size="small">
              同步PENDING状态
            </el-button>
            <el-button type="primary" @click="onRefresh" :loading="loading || syncing"
              >刷新列表</el-button
            >
          </div>
        </div>
      </template>
      <el-form :inline="true" :model="enrollForm" class="mb-2">
        <el-form-item label="名称">
          <el-input
            v-model="enrollForm.name"
            placeholder="给该音色起个名字（便于识别）"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item label="前缀">
          <el-input
            v-model="enrollForm.prefix"
            placeholder="用于区分的前缀，如 myvoice"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item label="样本音频">
          <el-upload :show-file-list="false" :http-request="customUpload">
            <el-button>上传音频文件</el-button>
          </el-upload>
          <span v-if="enrollForm.url" class="ml-2 text-gray-500">已上传</span>
        </el-form-item>
        <el-form-item>
          <el-button
            type="success"
            :disabled="!enrollForm.prefix || !enrollForm.url"
            @click="onEnroll"
            :loading="enrolling"
            >提交复刻</el-button
          >
        </el-form-item>
      </el-form>
      <div class="text-xs text-gray-500 leading-6">
        要求：10-20秒、≥16kHz、WAV/MP3/M4A，≤10MB；默认使用 cosyvoice-v2。
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>声音列表</span>
      </template>
      <el-table :data="voices" v-loading="loading" size="small" style="width: 100%">
        <el-table-column label="名称" width="160">
          <template #default="scope">
            <span>{{ scope.row.name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="voice_id" label="Voice ID" min-width="260" />

        <el-table-column prop="status" label="状态" width="120">
          <template #default="scope">
            <el-tag
              :type="
                scope.row.status === 'SUCCEEDED'
                  ? 'success'
                  : scope.row.status === 'FAILED'
                    ? 'danger'
                    : 'warning'
              "
            >
              {{ scope.row.status || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="520">
          <template #default="scope">
            <el-button size="small" @click="onQuery(scope.row)">查询训练状态</el-button>
            <el-button
              size="small"
              type="primary"
              @click="openPreview(scope.row)"
              :disabled="scope.row.status !== 'SUCCEEDED'"
              >试听</el-button
            >
            <el-button size="small" type="warning" class="ml-2" @click="openDebug(scope.row)"
              >调试参数</el-button
            >
            >
            <el-button size="small" type="success" class="ml-2" @click="openSetParams(scope.row)"
              >设置参数</el-button
            >
            >
            <el-button size="small" class="ml-2" @click="openSetName(scope.row)"
              >设置名称</el-button
            >
            >
            <el-popconfirm title="确认删除该音色？" @confirm="onRemove(scope.row)">
              <template #reference>
                <el-button size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="mt-3 flex items-center gap-2">
        <el-input v-model="listQuery.prefix" placeholder="按前缀过滤" style="width: 200px" />
        <el-button @click="onSearch">查询</el-button>
        <div class="flex-1" />
        <el-pagination
          :current-page="uiPage"
          :page-size="listQuery.page_size"
          :page-sizes="[10, 20, 50, 100]"
          :total="computedTotal"
          layout="prev, pager, next, sizes"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="previewDialog.visible" title="试听合成" width="560px">
      <el-form label-width="80px">
        <el-form-item label="文本">
          <el-input
            v-model="previewDialog.text"
            type="textarea"
            :rows="3"
            placeholder="输入要合成的文本"
          />
        </el-form-item>
        <el-form-item label="模型">
          <el-select v-model="previewDialog.model" style="width: 220px">
            <el-option label="cosyvoice-v2" value="cosyvoice-v2" />
            <el-option label="cosyvoice-v3" value="cosyvoice-v3" />
            <el-option label="cosyvoice-v3-plus" value="cosyvoice-v3-plus" />
          </el-select>
        </el-form-item>
        <el-form-item label="格式">
          <el-select v-model="previewDialog.format" style="width: 220px">
            <el-option label="mp3" value="mp3" />
            <el-option label="wav" value="wav" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="flex items-center justify-between w-full">
          <audio v-if="previewDialog.url" :src="previewDialog.url" controls style="height: 36px" />
          <div class="flex-1"></div>
          <el-button @click="previewDialog.visible = false">取消</el-button>
          <el-button type="primary" :loading="previewDialog.loading" @click="onPreview"
            >生成试听</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="debugDialog.visible" title="调试参数" width="780px">
      <el-form label-width="100px">
        <el-form-item label="文本">
          <el-input
            v-model="debugDialog.text"
            type="textarea"
            :rows="3"
            placeholder="输入批量测试文本"
          />
        </el-form-item>
        <div class="flex gap-2">
          <el-form-item label="语速范围">
            <div class="flex items-center gap-2">
              <el-input-number
                v-model="debugDialog.rateMin"
                :min="-100"
                :max="100"
                :step="0.1"
                :precision="1"
              />
              <span>至</span>
              <el-input-number
                v-model="debugDialog.rateMax"
                :min="-100"
                :max="100"
                :step="0.1"
                :precision="1"
              />
              <span>步长</span>
              <el-input-number
                v-model="debugDialog.rateStep"
                :min="0.1"
                :max="50"
                :step="0.1"
                :precision="1"
              />
            </div>
          </el-form-item>
          <el-form-item label="语调范围">
            <div class="flex items-center gap-2">
              <el-input-number
                v-model="debugDialog.pitchMin"
                :min="-12"
                :max="12"
                :step="0.1"
                :precision="1"
              />
              <span>至</span>
              <el-input-number
                v-model="debugDialog.pitchMax"
                :min="-12"
                :max="12"
                :step="0.1"
                :precision="1"
              />
              <span>步长</span>
              <el-input-number
                v-model="debugDialog.pitchStep"
                :min="0.1"
                :max="6"
                :step="0.1"
                :precision="1"
              />
            </div>
          </el-form-item>
        </div>
        <div class="flex gap-2">
          <el-form-item label="音量">
            <el-input-number v-model="debugDialog.volume" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="格式">
            <el-select v-model="debugDialog.format" style="width: 160px">
              <el-option label="mp3" value="mp3" />
              <el-option label="wav" value="wav" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>

      <div class="mb-3">
        <el-button @click="debugDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="debugDialog.generating" @click="onGenerateDebug"
          >生成语音列表</el-button
        >
      </div>

      <el-table v-if="debugDialog.items.length" :data="debugDialog.items" size="small">
        <el-table-column label="语速" prop="rate" width="100" />
        <el-table-column label="语调" prop="pitch" width="100" />
        <el-table-column label="试听" min-width="360">
          <template #default="scope">
            <audio v-if="scope.row.url" :src="scope.row.url" controls style="height: 36px" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button size="small" type="success" @click="chooseDebug(scope.row)">选中</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 设置名称（项目内弹窗） -->
    <el-dialog v-model="setNameDialog.visible" title="设置名称" width="420px">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="setNameDialog.name" placeholder="输入音色名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="setNameDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="setNameDialog.saving" @click="onConfirmSetName"
          >保存</el-button
        >
      </template>
    </el-dialog>

    <!-- 单独设置默认参数（不走批量调试） -->
    <el-dialog v-model="paramDialog.visible" title="设置默认参数" width="560px">
      <el-form label-width="100px">
        <el-form-item label="文本">
          <el-input
            v-model="paramDialog.text"
            type="textarea"
            :rows="2"
            placeholder="可选：保存一个常用的合成默认文本"
          />
        </el-form-item>
        <div class="flex gap-2">
          <el-form-item label="语速">
            <el-input-number
              v-model="paramDialog.rate"
              :min="-100"
              :max="100"
              :step="0.1"
              :precision="1"
            />
          </el-form-item>
          <el-form-item label="语调">
            <el-input-number
              v-model="paramDialog.pitch"
              :min="-12"
              :max="12"
              :step="0.1"
              :precision="1"
            />
          </el-form-item>
        </div>
        <div class="flex gap-2">
          <el-form-item label="音量">
            <el-input-number v-model="paramDialog.volume" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="格式">
            <el-select v-model="paramDialog.format" style="width: 160px">
              <el-option label="mp3" value="mp3" />
              <el-option label="wav" value="wav" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="flex items-center justify-between w-full">
          <div>
            <audio v-if="paramDialog.url" :src="paramDialog.url" controls style="height: 36px" />
          </div>
          <div>
            <el-button @click="paramDialog.visible = false">取消</el-button>
            <el-button :loading="paramDialog.previewing" @click="onParamPreview">试听</el-button>
            <el-button type="primary" :loading="paramDialog.saving" @click="onConfirmSetParams"
              >保存</el-button
            >
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import uploadApi from '@/api/modules/upload';
  import voiceApi from '@/api/modules/voice';
  import { ElMessage } from 'element-plus';
  import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

  const loading = ref(false);
  const enrolling = ref(false);
  const syncing = ref(false);

  const voices = ref<any[]>([]);
  const listQuery = reactive<{ prefix?: string; page_index?: number; page_size?: number }>({
    page_index: 0,
    page_size: 10,
  });

  const uiPage = ref(1);
  const total = ref(0);
  const computedTotal = computed(() => Number(total.value) || 0);

  function onSearch() {
    listQuery.page_index = 0;
    uiPage.value = 1;
    fetchList();
  }

  function onPageChange(p: number) {
    uiPage.value = Number(p) || 1;
    listQuery.page_index = Math.max(0, uiPage.value - 1);
    fetchList();
  }

  function onPageSizeChange(size: number) {
    listQuery.page_size = Number(size) || 10;
    listQuery.page_index = 0;
    uiPage.value = 1;
    fetchList();
  }

  const enrollForm = reactive<{ prefix: string; url: string; name?: string }>({
    prefix: '',
    url: '',
    name: '',
  });

  async function fetchList() {
    loading.value = true;
    try {
      const res = await voiceApi.list({
        prefix: listQuery.prefix,
        page_index: listQuery.page_index,
        page_size: listQuery.page_size,
      });
      // 统一兼容返回结构（兼容 data.output.voice_list / voices），并做字段映射
      const body: any = res || {};
      const rawList =
        body?.rows ??
        body?.data?.rows ??
        body?.data?.voices ??
        body?.voices ??
        body?.data?.output?.voices ??
        body?.output?.voices ??
        body?.data?.output?.voice_list ??
        body?.output?.voice_list ??
        (Array.isArray(body) ? body : []);
      const arr = Array.isArray(rawList) ? rawList : [];
      voices.value = arr.map((item: any) => {
        const id = item?.voice_id || item?.id || '';
        const parts = (id || '').split('-');
        const prefix = parts.length >= 3 ? parts[2] : '';
        let status = String(item?.status || '').toUpperCase();
        if (status === 'OK') status = 'SUCCEEDED';
        const rawName = item?.name ?? item?.data?.name ?? item?.meta?.name ?? '';
        const name = String(rawName || '').trim();
        return { ...item, prefix, status, name };
      });

      // 更新分页信息（尽量兼容不同返回结构）
      const totalCandidate = Number(
        body?.count ??
          body?.data?.count ??
          body?.data?.total ??
          body?.total ??
          body?.data?.output?.total ??
          body?.output?.total ??
          body?.data?.total_count ??
          body?.total_count ??
          body?.data?.output?.total_count ??
          body?.output?.total_count ??
          body?.data?.totalSize ??
          body?.totalSize ??
          body?.data?.totalElements ??
          body?.totalElements ??
          0,
      );
      const pageIndexNum = Number(listQuery.page_index) || 0;
      const pageSizeNum = Number(listQuery.page_size) || 10;
      const est = pageIndexNum * pageSizeNum + arr.length;
      if (Number.isFinite(totalCandidate) && totalCandidate > 0) {
        // 如果后端给出的 count 和当前页已知最小总数一致，且当前页满额，
        // 允许再多出一页，便于用户点到下一页探测是否还有数据（上游有时不给总数或给的是当前页计数）
        if (totalCandidate <= est && arr.length === pageSizeNum) {
          total.value = est + 1;
        } else {
          total.value = Math.max(totalCandidate, est);
        }
      } else {
        // 无总数字段时，回退为“已知最小总数”估算，保证分页可用
        total.value = est;
      }
      uiPage.value = pageIndexNum + 1;

      // 拉取每个音色的元信息（如名称）
      try {
        await Promise.all(
          voices.value.map(async (v: any) => {
            try {
              const r = await voiceApi.getMeta(v.voice_id || v.id);
              const meta = (r && (r.data || r)) || ({} as any);
              const metaName = meta?.name || meta?.data?.name || meta?.data?.data?.name || '';
              const fallback = deriveNameFromVoiceId(v.voice_id || v.id);
              v.name = metaName || v.name || fallback;
            } catch (_) {
              v.name = v.name || deriveNameFromVoiceId(v.voice_id || v.id);
            }
          }),
        );
      } catch (_) {}
    } catch (e: any) {
      ElMessage.error(e?.message || '获取列表失败');
    } finally {
      loading.value = false;
    }
  }

  const customUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await uploadApi.uploadFile(form, 'voice');
      const url = res?.data?.data || res?.data; // 兼容两种返回
      if (!url) throw new Error('未获取到URL');
      enrollForm.url = url;
      onSuccess && onSuccess(res);
      ElMessage.success('音频上传成功');
    } catch (err: any) {
      onError && onError(err);
      ElMessage.error(err?.message || '音频上传失败');
    }
  };

  async function onEnroll() {
    enrolling.value = true;
    try {
      const res = await voiceApi.enroll({
        prefix: enrollForm.prefix,
        url: enrollForm.url,
        name: enrollForm.name,
      });
      const body: any = res || {};
      const ok = !!(body?.output || body?.data || body?.request_id || body?.id);
      const vid = body?.output?.voice_id || body?.voice_id || body?.data?.voice_id;
      if (ok) {
        ElMessage.success(`已提交复刻/训练${vid ? '（Voice ID: ' + vid + '）' : ''}`);
        enrollForm.prefix = '';
        enrollForm.url = '';
        fetchList();
      } else {
        console.warn('Enroll response unexpected shape:', body);
        ElMessage.warning('请求成功但未返回预期数据');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '提交失败';
      ElMessage.error(msg);
    } finally {
      enrolling.value = false;
    }
  }

  async function onQuery(row: any) {
    try {
      const res = await voiceApi.detail(row.voice_id || row.id || row.voiceId);
      const data = res?.data?.data || res?.data || {};
      ElMessage.success(`状态：${data?.status || data?.result?.status || '未知'}`);

      fetchList();
    } catch (e: any) {
      ElMessage.error(e?.message || '查询失败');
    }
  }

  async function onRemove(row: any) {
    try {
      await voiceApi.remove({ voice_id: row.voice_id });
      ElMessage.success('已删除');
      fetchList();
    } catch (e: any) {
      ElMessage.error(e?.message || '删除失败');
    }
  }

  const previewDialog = reactive<{
    visible: boolean;

    text: string;
    model: string;
    format: 'mp3' | 'wav';
    voice_id?: string;
    url?: string;
    loading: boolean;
  }>({
    visible: false,
    text: '你好，这是AI语音合成试听。',
    model: 'cosyvoice-v2',
    format: 'mp3',
    voice_id: undefined,
    url: undefined,
    loading: false,
  });

  function deriveModelFromVoiceId(id?: string) {
    const v = (id || '').toLowerCase();
    if (v.startsWith('cosyvoice-v3-plus-')) return 'cosyvoice-v3-plus';
    if (v.startsWith('cosyvoice-v3-')) return 'cosyvoice-v3';
    if (v.startsWith('cosyvoice-v2-')) return 'cosyvoice-v2';
    return previewDialog.model;
  }

  function deriveNameFromVoiceId(id?: string) {
    const parts = (id || '').split('-');
    if (parts.length >= 3) return parts.slice(0, 3).join('-');
    return id || '';
  }

  function openPreview(row: any) {
    previewDialog.visible = true;
    previewDialog.voice_id = row.voice_id;
    previewDialog.model = deriveModelFromVoiceId(row.voice_id);

    previewDialog.url = undefined;
  }

  const debugDialog = reactive<{
    visible: boolean;
    voice_id?: string;
    model: string;
    text: string;
    format: 'mp3' | 'wav';
    volume: number;
    rateMin: number;
    rateMax: number;
    rateStep: number;
    pitchMin: number;
    pitchMax: number;
    pitchStep: number;

    generating: boolean;
    items: Array<{ rate: number; pitch: number; url?: string }>;
  }>({
    visible: false,
    voice_id: undefined,
    model: 'cosyvoice-v2',
    text: '你好，这是参数调试批量测试文本。',
    format: 'mp3',
    volume: 100,
    rateMin: -20,
    rateMax: 20,
    rateStep: 10,
    pitchMin: -2,
    pitchMax: 2,
    pitchStep: 2,
    generating: false,
    items: [],
  });

  async function openDebug(row: any) {
    debugDialog.visible = true;
    debugDialog.voice_id = row.voice_id;
    debugDialog.model = deriveModelFromVoiceId(row.voice_id);
    debugDialog.items = [];
    try {
      const res = await voiceApi.getParams(row.voice_id);
      const data = res?.data?.data || res?.data || {};
      if (data && typeof data === 'object') {
        if (typeof data.rate === 'number') {
          debugDialog.rateMin = data.rate;
          debugDialog.rateMax = data.rate;
        }
        if (typeof data.pitch === 'number') {
          debugDialog.pitchMin = data.pitch;
          debugDialog.pitchMax = data.pitch;
        }
        if (typeof data.volume === 'number') debugDialog.volume = data.volume;
        if (typeof data.text === 'string') debugDialog.text = data.text;
        if (typeof data.format === 'string') debugDialog.format = data.format;
      }
    } catch (e) {
      // 忽略未设置参数的情况
    }
  }

  function makeRange(min: number, max: number, step: number) {
    const arr: number[] = [];
    if (step <= 0) step = 1;
    if (min > max) [min, max] = [max, min];
    for (let v = min; v <= max; v += step) arr.push(Number(v.toFixed(6)));
    if (arr.length === 0) arr.push(min);
    return arr;
  }

  async function onGenerateDebug() {
    if (!debugDialog.voice_id || !debugDialog.text) {
      ElMessage.warning('请完善文本');
      return;
    }
    const rates = makeRange(debugDialog.rateMin, debugDialog.rateMax, debugDialog.rateStep);
    const pitchs = makeRange(debugDialog.pitchMin, debugDialog.pitchMax, debugDialog.pitchStep);
    const combos: Array<{ rate: number; pitch: number }> = [];
    for (const r of rates) for (const p of pitchs) combos.push({ rate: r, pitch: p });
    if (!combos.length) {
      ElMessage.warning('没有可生成的组合');
      return;
    }

    debugDialog.generating = true;
    debugDialog.items = [];
    try {
      for (const c of combos) {
        try {
          const res = await voiceApi.preview({
            voice_id: debugDialog.voice_id,
            text: debugDialog.text,
            model: debugDialog.model,
            format: debugDialog.format,
            rate: c.rate,
            pitch: c.pitch,
            volume: debugDialog.volume,
          });
          const url = res?.data?.data?.url || res?.data?.url;
          debugDialog.items.push({ rate: c.rate, pitch: c.pitch, url });
        } catch (e) {
          debugDialog.items.push({ rate: c.rate, pitch: c.pitch });
        }
      }
      ElMessage.success('批量生成完成');
    } finally {
      debugDialog.generating = false;
    }
  }

  async function chooseDebug(item: { rate: number; pitch: number }) {
    if (!debugDialog.voice_id) return;
    try {
      await voiceApi.setParams({
        voice_id: debugDialog.voice_id,
        params: {
          rate: item.rate,
          pitch: item.pitch,
          volume: debugDialog.volume,
          format: debugDialog.format,
          text: debugDialog.text,
        },
      });
      ElMessage.success('已保存为该音色的默认参数');
      debugDialog.visible = false;
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败');
    }
  }

  async function onPreview() {
    if (!previewDialog.voice_id || !previewDialog.text) {
      ElMessage.warning('请完善参数');
      return;
    }
    previewDialog.loading = true;
    try {
      const res = await voiceApi.preview({
        voice_id: previewDialog.voice_id,
        text: previewDialog.text,
        model: previewDialog.model,
        format: previewDialog.format,
      });
      const url = res?.data?.data?.url || res?.data?.url;
      if (!url) throw new Error('未返回音频URL');
      previewDialog.url = url;
      ElMessage.success('试听生成成功');
    } catch (e: any) {
      ElMessage.error(e?.message || '试听失败');
    } finally {
      previewDialog.loading = false;
    }
  }

  // 设置名称对话框 state 与提交
  const setNameDialog = reactive<{
    visible: boolean;
    voice_id: string;
    name: string;
    saving: boolean;
  }>({
    visible: false,
    voice_id: '',
    name: '',
    saving: false,
  });
  async function onConfirmSetName() {
    const name = String(setNameDialog.name || '').trim();
    if (!name) {
      ElMessage.warning('请输入名称');
      return;
    }
    setNameDialog.saving = true;
    try {
      await voiceApi.setMeta({ voice_id: setNameDialog.voice_id, meta: { name } });
      const it = voices.value.find((v: any) => (v.voice_id || v.id) === setNameDialog.voice_id);
      if (it) it.name = name;
      ElMessage.success('已更新名称');
      setNameDialog.visible = false;
    } catch (e: any) {
      ElMessage.error(e?.message || '更新失败');
    } finally {
      setNameDialog.saving = false;
    }
  }

  // 单独设置参数对话框 state 与提交
  const paramDialog = reactive<{
    visible: boolean;
    voice_id: string;
    text: string;
    format: 'mp3' | 'wav';
    volume: number;
    rate: number;
    pitch: number;
    url?: string;
    previewing: boolean;
    saving: boolean;
  }>({
    visible: false,
    voice_id: '',
    text: '',
    format: 'mp3',
    volume: 100,
    rate: 1,
    pitch: 1,
    url: undefined,
    previewing: false,
    saving: false,
  });

  async function openSetParams(row: any) {
    paramDialog.visible = true;
    paramDialog.voice_id = row.voice_id || row.id;
    // 读取已保存的参数用于回显
    try {
      const res = await voiceApi.getParams(paramDialog.voice_id);
      const data = (res?.data?.data || res?.data || {}) as any;
      if (data && typeof data === 'object') {
        if (typeof data.text === 'string') paramDialog.text = data.text;
        if (typeof data.format === 'string') paramDialog.format = data.format;
        if (typeof data.volume === 'number') paramDialog.volume = data.volume;
        if (typeof data.rate === 'number') paramDialog.rate = data.rate;
        if (typeof data.pitch === 'number') paramDialog.pitch = data.pitch;
      }
    } catch {}
  }

  async function onConfirmSetParams() {
    if (!paramDialog.voice_id) return;
    paramDialog.saving = true;
    try {
      await voiceApi.setParams({
        voice_id: paramDialog.voice_id,
        params: {
          text: paramDialog.text,
          format: paramDialog.format,
          volume: paramDialog.volume,
          rate: paramDialog.rate,
          pitch: paramDialog.pitch,
        },
      });
      ElMessage.success('已保存默认参数');
      paramDialog.visible = false;
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败');
    } finally {
      paramDialog.saving = false;
    }
  }

  async function onParamPreview() {
    if (!paramDialog.voice_id || !paramDialog.text) {
      ElMessage.warning('请完善参数');
      return;
    }
    paramDialog.previewing = true;
    try {
      const res = await voiceApi.preview({
        voice_id: paramDialog.voice_id,
        text: paramDialog.text,
        model: deriveModelFromVoiceId(paramDialog.voice_id),
        format: paramDialog.format,
        volume: paramDialog.volume,
        rate: paramDialog.rate,
        pitch: paramDialog.pitch,
      });
      const url = res?.data?.data?.url || res?.data?.url;
      if (!url) throw new Error('未返回音频URL');
      paramDialog.url = url;
      ElMessage.success('试听生成成功');
    } catch (e: any) {
      ElMessage.error(e?.message || '试听失败');
    } finally {
      paramDialog.previewing = false;
    }
  }

  function openSetName(row: any) {
    setNameDialog.visible = true;
    setNameDialog.voice_id = row.voice_id || row.id;
    setNameDialog.name = row?.name || '';
  }

  // 自动刷新定时器
  let refreshTimer: number | null = null;

  // 检查是否有PENDING状态的音色
  function hasPendingVoices() {
    return voices.value.some((voice) => voice.status === 'PENDING');
  }

  // 启动自动刷新
  function startAutoRefresh() {
    if (refreshTimer) return;

    refreshTimer = setInterval(() => {
      if (hasPendingVoices()) {
        console.log('检测到PENDING状态音色，自动刷新列表...');
        fetchList();
      }
    }, 10000); // 每10秒检查一次
  }

  // 停止自动刷新
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  onMounted(() => {
    fetchList();
    startAutoRefresh();
  });

  // 手动同步PENDING状态
  async function syncPendingStatus() {
    try {
      syncing.value = true;
      await voiceApi.syncPendingStatus();
      ElMessage.success('PENDING状态同步完成');
      // 同步后刷新列表
      await fetchList();
    } catch (error) {
      console.error('同步PENDING状态失败:', error);
      ElMessage.error('同步失败，请稍后重试');
    } finally {
      syncing.value = false;
    }
  }

  // 刷新：先同步状态，再刷新列表
  async function onRefresh() {
    try {
      syncing.value = true;
      await voiceApi.syncPendingStatus();
    } catch (_) {
      // ignore errors
    } finally {
      syncing.value = false;
    }
    await fetchList();
  }

  onUnmounted(() => {
    stopAutoRefresh();
  });
</script>

<style scoped>
  .mb-2 {
    margin-bottom: 8px;
  }
  .mb-3 {
    margin-bottom: 12px;
  }
  .mb-4 {
    margin-bottom: 16px;
  }

  .ml-2 {
    margin-left: 8px;
  }
  .inline-block {
    display: inline-block;
  }
  .p-4 {
    padding: 16px;
  }
  .text-gray-500 {
    color: #6b7280;
  }
  .text-xs {
    font-size: 12px;
  }
  .flex {
    display: flex;
  }
  .items-center {
    align-items: center;
  }
  .justify-between {
    justify-content: space-between;
  }
  .gap-2 {
    gap: 8px;
  }
  .w-full {
    width: 100%;
  }
</style>
