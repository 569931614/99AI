<route lang="yaml">
meta:
  title: 表情包管理
</route>

<script lang="ts" setup>
  import ApiSticker, { type StickerPayload, type StickerRecord } from '@/api/modules/sticker';
  import uploadApi from '@/api/modules/upload';
  import { Plus } from '@element-plus/icons-vue';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import type { FormInstance, FormRules, UploadInstance, UploadRequestOptions } from 'element-plus';
  import { UploadAjaxError } from 'element-plus/es/components/upload/src/ajax';
  import dayjs from 'dayjs';
  import { computed, onMounted, reactive, ref } from 'vue';

  const loading = ref(false);
  const total = ref(0);
  const stickerList = ref<StickerRecord[]>([]);

  const filterForm = reactive({
    keyword: '',
    emotion: '',
    tags: [] as string[],
    page: 1,
    size: 12,
  });

  const emotionOptions = [
    { label: '开心/活力', value: 'happy' },
    { label: '鼓励/安慰', value: 'comfort' },
    { label: '惊讶/夸张', value: 'surprised' },
    { label: '吐槽/调侃', value: 'sarcasm' },
    { label: '委屈/难过', value: 'sad' },
    { label: '其他', value: 'other' },
  ];

  const dialogVisible = ref(false);
  const dialogTitle = computed(() => (isEdit.value ? '编辑表情包' : '新增表情包'));
  const isEdit = ref(false);
  const currentId = ref<number | null>(null);
  const saving = ref(false);
  const uploadLoading = ref(false);
  const formRef = ref<FormInstance>();
  const uploadRef = ref<UploadInstance>();

  const form = reactive<StickerPayload & { tags: string[] }>({
    name: '',
    imageUrl: '',
    tags: [],
    emotion: '',
    scenario: '',
  });

  const rules: FormRules = {
    name: [{ required: true, message: '请填写表情包名称！', trigger: 'blur' }],
    imageUrl: [{ required: true, message: '请先上传表情图片', trigger: 'change' }],
  };

  const emotionLabelMap = computed(() => {
    const map = new Map<string, string>();
    emotionOptions.forEach((item) => map.set(item.value, item.label));
    return map;
  });

  const tagOptions = computed(() => {
    const all = new Set<string>();
    stickerList.value.forEach((item) => item.tags?.forEach((tag) => all.add(tag)));
    form.tags.forEach((tag) => all.add(tag));
    filterForm.tags.forEach((tag) => all.add(tag));
    return Array.from(all);
  });

  const fetchStickers = async () => {
    loading.value = true;
    try {
      const payload = {
        keyword: filterForm.keyword || undefined,
        emotion: filterForm.emotion || undefined,
        page: filterForm.page,
        size: filterForm.size,
        tags: filterForm.tags.length ? filterForm.tags : undefined,
      };
      const res = await ApiSticker.list(payload);
      stickerList.value = res?.rows || [];
      total.value = res?.count || 0;
    } finally {
      loading.value = false;
    }
  };

  const handleSearch = () => {
    filterForm.page = 1;
    fetchStickers();
  };

  const handleReset = () => {
    filterForm.keyword = '';
    filterForm.emotion = '';
    filterForm.tags = [];
    filterForm.page = 1;
    fetchStickers();
  };

  const handlePageChange = (page: number) => {
    filterForm.page = page;
    fetchStickers();
  };

  const handleSizeChange = (size: number) => {
    filterForm.size = size;
    filterForm.page = 1;
    fetchStickers();
  };

  const openCreateDialog = () => {
    isEdit.value = false;
    currentId.value = null;
    resetForm();
    dialogVisible.value = true;
  };

  const openEditDialog = (item: StickerRecord) => {
    isEdit.value = true;
    currentId.value = item.id;
    resetForm();
    form.name = item.name;
    form.imageUrl = item.imageUrl;
    form.tags = item.tags ? [...item.tags] : [];
    form.emotion = item.emotion || '';
    form.scenario = item.scenario || '';
    dialogVisible.value = true;
  };

  const resetForm = () => {
    form.name = '';
    form.imageUrl = '';
    form.tags = [];
    form.emotion = '';
    form.scenario = '';
    formRef.value?.clearValidate();
    uploadRef.value?.clearFiles();
  };

  const handleDialogClose = () => {
    resetForm();
  };

  const submitForm = () => {
    formRef.value?.validate(async (valid) => {
      if (!valid) return;
      const payload: StickerPayload = {
        name: form.name.trim(),
        imageUrl: form.imageUrl.trim(),
        tags: form.tags,
        emotion: form.emotion || undefined,
        scenario: form.scenario?.trim() || undefined,
      };
      saving.value = true;
      try {
        if (isEdit.value && currentId.value) {
          await ApiSticker.update(currentId.value, payload);
          ElMessage.success('表情包更新成功！');
        } else {
          await ApiSticker.create(payload);
          ElMessage.success('新增表情包成功！');
        }
        dialogVisible.value = false;
        fetchStickers();
      } finally {
        saving.value = false;
      }
    });
  };

  const confirmDelete = async (item: StickerRecord) => {
    try {
      await ElMessageBox.confirm(`确认删除表情包【${item.name}】吗？删除后无法恢复！`, '删除确认', {
        type: 'warning',
      });
    } catch {
      return;
    }
    await ApiSticker.remove(item.id);
    ElMessage.success('删除成功');
    fetchStickers();
  };

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return dayjs(value).format('YYYY-MM-DD HH:mm');
  };

  const buildUploadError = (message: string, status = 400) =>
    new UploadAjaxError(message, status, 'POST', 'upload/file');

  const handleStickerUpload = async (options: UploadRequestOptions) => {
    const file = options.file as File;
    if (!file) return;
    const allowTypes = ['image/png', 'image/jpeg', 'image/gif'];
    if (!allowTypes.includes(file.type)) {
      const err = buildUploadError('只能上传 JPG/PNG/GIF 图片');
      ElMessage.error(err.message);
      options.onError?.(err);
      return;
    }
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      const err = buildUploadError('图片不能超过 2MB');
      ElMessage.error(err.message);
      options.onError?.(err);
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    uploadLoading.value = true;
    try {
      const res = await uploadApi.uploadFile(formData, 'stickers');
      const result: any = res;
      const url = result?.data?.data || result?.data || result?.url || result;
      if (!url || typeof url !== 'string') {
        throw new Error('未从服务器获取到图片链接！');
      }
      form.imageUrl = url;
      ElMessage.success('图片上传成功');
      options.onSuccess?.(res);
    } catch (error: any) {
      const message = error?.message || '图片上传失败';
      const status = Number(error?.response?.status) || 500;
      const ajaxError = buildUploadError(message, status);
      ElMessage.error(message);
      options.onError?.(ajaxError);
    } finally {
      uploadLoading.value = false;
    }
  };

  onMounted(fetchStickers);
</script>

<template>
  <div class="sticker-page">
    <PageHeader>
      <template #title>
        <div class="header-title">表情包管理</div>
      </template>
      <template #content> 管理对话中可使用的表情包，提升交互体验和情感表达 </template>
    </PageHeader>

    <page-main>
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="名称/描述">
          <el-input
            v-model="filterForm.keyword"
            placeholder="搜索名称或描述"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="情绪分类">
          <el-select v-model="filterForm.emotion" placeholder="全部" clearable>
            <el-option
              v-for="item in emotionOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签筛选">
          <el-select
            v-model="filterForm.tags"
            multiple
            allow-create
            filterable
            default-first-option
            placeholder="选择标签"
            style="width: 240px"
          >
            <el-option v-for="tag in tagOptions" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <div class="sticker-toolbar">
        <div></div>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增表情包</el-button>
      </div>

      <el-table :data="stickerList" border stripe v-loading="loading" empty-text="暂无数据">
        <el-table-column label="预览" width="140" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              :src="row.imageUrl"
              fit="cover"
              class="sticker-thumb"
              :preview-src-list="[row.imageUrl]"
            />
            <span v-else class="text-muted">暂无图片</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="表情包名称" width="180" show-overflow-tooltip />
        <el-table-column label="标签">
          <template #default="{ row }">
            <div v-if="row.tags?.length" class="tag-list">
              <el-tag v-for="tag in row.tags" :key="tag" size="small">{{ tag }}</el-tag>
            </div>
            <span v-else class="text-muted">未指定标签</span>
          </template>
        </el-table-column>
        <el-table-column prop="emotion" label="情绪" width="160">
          <template #default="{ row }">
            {{ emotionLabelMap.get(row.emotion || '') || '未定义' }}
          </template>
        </el-table-column>
        <el-table-column prop="scenario" label="使用场景" show-overflow-tooltip />
        <el-table-column label="上传时间" width="200">
          <template #default="{ row }">
            {{ formatDate(row.uploadDate || row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button text type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :current-page="filterForm.page"
          :page-size="filterForm.size"
          :page-sizes="[12, 24, 48, 96]"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </page-main>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="620px"
      @close="handleDialogClose"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="表情包名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="输入表情包名称"
            maxlength="40"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            multiple
            allow-create
            filterable
            placeholder="为表情包添加标签（可输入自定义标签）"
          >
            <el-option v-for="tag in tagOptions" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
        <el-form-item label="情绪">
          <el-select v-model="form.emotion" placeholder="请选择情绪分类" clearable>
            <el-option
              v-for="item in emotionOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="使用场景">
          <el-input
            v-model="form.scenario"
            type="textarea"
            :rows="3"
            placeholder="描述这个表情可以在哪些场景下使用"
          />
        </el-form-item>
        <el-form-item label="表情图片" prop="imageUrl">
          <div class="upload-block">
            <el-upload
              ref="uploadRef"
              class="sticker-upload"
              :show-file-list="false"
              :limit="1"
              accept="image/png,image/jpeg,image/gif"
              :disabled="uploadLoading"
              :http-request="handleStickerUpload"
            >
              <el-button :icon="Plus" :loading="uploadLoading">上传图片</el-button>
            </el-upload>
            <div class="upload-tip">支持 JPG/PNG/GIF，文件大小不超过 2MB</div>
            <el-image
              v-if="form.imageUrl"
              :src="form.imageUrl"
              fit="cover"
              class="preview-thumb"
              :preview-src-list="[form.imageUrl]"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
  .sticker-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header-title {
    font-size: 20px;
    font-weight: 600;
  }

  .filter-form {
    margin-bottom: 12px;
  }

  .sticker-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .sticker-thumb {
    width: 96px;
    height: 96px;
    border-radius: 8px;
    border: 1px solid var(--el-border-color-light);
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .text-muted {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .upload-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .upload-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .preview-thumb {
    width: 140px;
    height: 140px;
    border-radius: 8px;
    border: 1px solid var(--el-border-color);
    object-fit: cover;
  }
</style>
