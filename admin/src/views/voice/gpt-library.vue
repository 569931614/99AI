<template>
  <div class="p-4 space-y-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>GPT-SoVITS 模型管理</span>
          <div class="flex gap-2">
            <el-button type="primary" size="small" @click="triggerUpload" :loading="uploading">
              上传模型
            </el-button>
            <el-button size="small" @click="fetchLibrary" :loading="loading">刷新</el-button>
          </div>
        </div>
      </template>
      <div class="text-xs text-gray-500 leading-6">
        管理上传到受控目录的 GPT (.ckpt/.bin) 和 SoVITS (.pth/.pt)
        模型文件，声音复刻会直接使用此列表。
      </div>
      <div v-if="storageRoot" class="text-xs text-gray-400 mt-2">
        当前存储目录：<span class="font-mono">{{ storageRoot }}</span>
      </div>
    </el-card>

    <el-card shadow="never">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-3">
        <el-radio-group v-model="filterType" size="small">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="gpt">GPT 模型</el-radio-button>
          <el-radio-button label="sovits">SoVITS 模型</el-radio-button>
        </el-radio-group>
        <span class="text-xs text-gray-500">共 {{ filteredLibrary.length }} 个文件</span>
      </div>
      <el-table :data="filteredLibrary" size="small" v-loading="loading" style="width: 100%">
        <el-table-column prop="filename" label="文件" min-width="280">
          <template #default="{ row }">
            <div class="flex flex-col">
              <span class="font-medium">{{ row.filename }}</span>
              <span class="text-xs text-gray-500">{{ row.relativePath || row.path }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 'gpt' ? 'success' : 'warning'">
              {{ row.type === 'gpt' ? 'GPT' : 'SoVITS' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatUpdatedAt(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="copyPath(row.path, '绝对路径')">
              复制绝对路径
            </el-button>
            <el-button
              text
              type="primary"
              size="small"
              @click="copyPath(row.relativePath || row.path, '相对路径')"
            >
              复制相对路径
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      accept=".ckpt,.bin,.pth,.pt"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { ElMessage } from 'element-plus';
  import voiceApi from '@/api/modules/voice';

  type LibraryEntry = {
    type: 'gpt' | 'sovits';
    filename: string;
    path: string;
    relativePath?: string;
    size?: number;
    updatedAt?: number;
  };

  const library = ref<LibraryEntry[]>([]);
  const storageRoot = ref('');
  const loading = ref(false);
  const uploading = ref(false);
  const filterType = ref<'all' | 'gpt' | 'sovits'>('all');
  const fileInputRef = ref<HTMLInputElement>();

  const filteredLibrary = computed(() => {
    const sorted = [...library.value].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (filterType.value === 'all') return sorted;
    return sorted.filter((item) => item.type === filterType.value);
  });

  onMounted(() => {
    fetchLibrary();
  });

  function getFileName(filePath: string): string {
    if (!filePath) return '';
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || filePath;
  }

  function deriveRelativePath(pathStr: string): string {
    if (!pathStr) return '';
    const normalizedRoot = storageRoot.value.replace(/\\/g, '/');
    const normalizedPath = pathStr.replace(/\\/g, '/');
    if (normalizedRoot && normalizedPath.startsWith(normalizedRoot)) {
      return (
        normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, '') || getFileName(pathStr)
      );
    }
    return getFileName(pathStr);
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function formatUpdatedAt(ts?: number): string {
    if (!ts) return '-';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
      2,
      '0',
    )}`;
  }

  async function fetchLibrary() {
    loading.value = true;
    try {
      const fetcher = voiceApi.listGptSovitsLibrary || voiceApi.listGptSovitsFiles;
      const res = await fetcher();
      const data = res?.data || res || {};
      storageRoot.value = data.storageRoot || '';
      if (Array.isArray(data.library) && data.library.length) {
        library.value = data.library;
      } else {
        library.value = buildFallbackLibrary(data);
      }
      if (!library.value.length) {
        ElMessage.info('暂无模型文件，请先上传');
      } else {
        ElMessage.success('模型库已刷新');
      }
    } catch (error: any) {
      ElMessage.error(error?.message || '获取模型库失败');
    } finally {
      loading.value = false;
    }
  }

  function buildFallbackLibrary(data: any): LibraryEntry[] {
    const result: LibraryEntry[] = [];
    const pushEntry = (pathStr: string, type: LibraryEntry['type']) => {
      if (!pathStr) return;
      result.push({
        type,
        path: pathStr,
        filename: getFileName(pathStr),
        relativePath: deriveRelativePath(pathStr),
      });
    };
    (data.gptModels || []).forEach((pathStr: string) => pushEntry(pathStr, 'gpt'));
    (data.sovitsModels || []).forEach((pathStr: string) => pushEntry(pathStr, 'sovits'));
    return result;
  }

  function triggerUpload() {
    fileInputRef.value?.click();
  }

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    uploading.value = true;
    try {
      await voiceApi.uploadGptSovitsModel(file);
      ElMessage.success('上传成功');
      await fetchLibrary();
    } catch (error: any) {
      ElMessage.error(error?.message || '上传失败，请重试');
    } finally {
      uploading.value = false;
    }
  }

  async function copyPath(text: string, label: string) {
    if (!text) {
      ElMessage.warning(`暂无可复制的${label}`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      ElMessage.success(`${label}已复制`);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      ElMessage.success(`${label}已复制`);
    }
  }
</script>

<style scoped>
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
  .gap-3 {
    gap: 12px;
  }
  .flex-wrap {
    flex-wrap: wrap;
  }
  .space-y-4 > :not([hidden]) ~ :not([hidden]) {
    margin-top: 16px;
  }
  .text-gray-400 {
    color: #9ca3af;
  }
  .text-gray-500 {
    color: #6b7280;
  }
  .font-mono {
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
      monospace;
  }
  .text-xs {
    font-size: 12px;
  }
  .font-medium {
    font-weight: 500;
  }
  .mb-3 {
    margin-bottom: 12px;
  }
  .hidden {
    display: none;
  }
</style>
