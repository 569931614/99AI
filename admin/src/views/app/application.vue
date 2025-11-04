<route lang="yaml">
meta:
  title: 角色管理
</route>

<script lang="ts" setup>
  import ApiApp from '@/api/modules/app';
  import ApiModels from '@/api/modules/models';
  import uploadApi from '@/api/modules/upload';
  import ApiVoice from '@/api/modules/voice';
  import { utcToShanghaiTime } from '@/utils/utcFormatTime';
  import {
    Plus,
    Refresh,
    Avatar,
    Edit,
    User,
    Picture,
    Upload,
    InfoFilled,
    Warning,
    Headset,
    Microphone,
    Operation,
    Setting,
    ChatDotRound,
    Clock,
    Memo,
    Search,
    FolderOpened,
    ChatLineRound,
    Delete,
    Tools,
    Document,
    Close,
    Check,
  } from '@element-plus/icons-vue';
  import type {
    FormInstance,
    FormRules,
    UploadProps,
    UploadRequestHandler,
    UploadRequestOptions,
  } from 'element-plus';
  import { ElMessage } from 'element-plus';
  import { v4 as uuidv4 } from 'uuid';
  import { computed, onMounted, reactive, ref, watch } from 'vue';

  import PromptTemplateEditor from '@/components/PromptTemplateEditor/index.vue';
  import { QUESTION_STATUS_MAP } from '@/constants/index';
  import axios from 'axios';

  const formRef = ref<FormInstance>();
  const total = ref(0);
  const visible = ref(false);
  const loading = ref(false);

  const formInline = reactive({
    name: '',
    catId: '',
    page: 1,
    size: 10,
  });

  const formPackageRef = ref<FormInstance>();
  const activeAppCatId = ref(0);
  const isUserApp = ref(false);
  const userAppStatus = ref(0);
  const formPackage = reactive({
    id: '',
    name: '',
    catId: [] as string[],
    des: '',
    preset: '',
    coverImg: '',
    demoData: '',
    order: 100,
    status: 1,
    isGPTs: 0,
    gizmoID: '',
    isFixedModel: 0,
    appModel: '',
    isFlowith: 0,
    flowithId: '',
    flowithName: '',
    flowithKey: '',
    backgroundImg: '',
    prompt: '',
    voiceId: '',
    // 星尘API扩展字段
    enableRealTime: false,
    enableLongTermMemory: false,
    enableKnowledgeBase: false,
    knowledgeBaseIds: '',
    dialogueExamples: '',
    openingRemark: '',
  });

  // 添加特殊模型类型
  const specialModelType = ref('none'); // none, gpts, flowith

  // 监听特殊模型类型变化
  watch(specialModelType, (newValue) => {
    if (newValue === 'none') {
      formPackage.isGPTs = 0;
      formPackage.isFlowith = 0;
    } else if (newValue === 'gpts') {
      formPackage.isGPTs = 1;
      formPackage.isFlowith = 0;
    } else if (newValue === 'flowith') {
      formPackage.isGPTs = 0;
      formPackage.isFlowith = 1;
    }
  });

  const rules = reactive<FormRules>({
    name: [{ required: true, message: '请填写角色名称', trigger: 'blur' }],
    preset: [{ required: false, message: '请填写角色设定', trigger: 'blur' }],
  });

  const tableData = ref([]);

  interface CatItem {
    id: number;
    name: string;
  }
  const catList: Ref<CatItem[]> = ref([]);

  const dialogTitle = computed(() => {
    return activeAppCatId.value ? '更新应用' : '新增应用';
  });

  const dialogButton = computed(() => {
    return activeAppCatId.value ? '确认更新' : '确认新增';
  });

  const modelOptions = ref<string[]>([]);
  const voiceOptions = ref<Array<{ label: string; value: string }>>([]);
  const voiceLoading = ref(false);

  async function queryVoiceList() {
    try {
      voiceLoading.value = true;
      const res: any = await ApiVoice.list({ page_index: 0, page_size: 200 });
      const body: any = res || {};
      // 兼容多种返回结构：优先使用 rows（数据库分页结构）
      const rawList =
        body?.data?.rows ??
        body?.rows ??
        body?.data?.voices ??
        body?.voices ??
        body?.data?.output?.voices ??
        body?.output?.voices ??
        body?.data?.output?.voice_list ??
        body?.data?.voice_list ??
        body?.output?.voice_list ??
        body?.voice_list ??
        body?.list ??
        (Array.isArray(body) ? body : []);

      const arr = Array.isArray(rawList) ? rawList : [];
      voiceOptions.value = arr.map((v: any) => {
        const id = v?.voice_id || v?.id || '';
        const name = v?.name || '';
        return { value: id, label: name ? `${name} (${id})` : id };
      });

      console.log('音色列表加载完成:', voiceOptions.value.length, '条记录');
    } catch (e) {
      console.error('音色列表加载失败:', e);
    } finally {
      voiceLoading.value = false;
    }
  }

  // 统一角色情绪配置（应用到所有角色）
  const emotionDialog = reactive({
    visible: false,
    saving: false,
    list: [] as Array<{ emotion: string; voiceId?: string }>,
  });

  function openEmotionDialog() {
    emotionDialog.visible = true;
    loadGlobalEmotions();
  }

  async function loadGlobalEmotions() {
    try {
      const res: any = await ApiApp.getGlobalEmotions();
      const list = res?.data?.emotions || [];
      emotionDialog.list = Array.isArray(list)
        ? list.map((i: any) => ({
            emotion: String(i?.emotion || ''),
            voiceId: i?.voiceId ? String(i.voiceId) : '',
          }))
        : [];
    } catch (_) {
      emotionDialog.list = [];
    }
  }

  function addEmotionRow() {
    emotionDialog.list.push({ emotion: '', voiceId: '' });
  }

  function removeEmotionRow(index: number) {
    emotionDialog.list.splice(index, 1);
  }

  async function saveGlobalEmotions() {
    try {
      emotionDialog.saving = true;
      const cleaned = emotionDialog.list
        .map((i) => ({
          emotion: String(i.emotion || '').trim(),
          voiceId: i.voiceId ? String(i.voiceId) : '',
        }))
        .filter((i) => i.emotion);
      await ApiApp.setGlobalEmotions({ emotions: cleaned });
      ElMessage.success('已保存统一情绪配置');
      emotionDialog.visible = false;
    } catch (e) {
      ElMessage.error('保存失败');
    } finally {
      emotionDialog.saving = false;
    }
  }

  onMounted(() => {
    queryVoiceList();
  });

  // 打开编辑弹窗时若未加载过音色，再次尝试加载，保证下拉有值
  watch(visible, (val) => {
    if (val && voiceOptions.value.length === 0 && !voiceLoading.value) {
      queryVoiceList();
    }

    // 打开时初始化该角色的情绪-音色映射（若为新建，则仅加载全局情绪空映射）
    if (val) {
      // @ts-ignore
      initRoleEmotionForApp((activeAppCatId as any)?.value || undefined);
    }

    // 选项加载完成后，强制触发一次回显刷新
    watch(voiceOptions, () => {
      if (visible.value && formPackage.voiceId) {
        formPackage.voiceId = String(formPackage.voiceId);
      }
    });
  });

  // 角色情绪-音色映射（按角色）
  const roleEmotion = reactive<{
    list: Array<{ emotion: string; voiceId: string }>;
    loading: boolean;
  }>({
    list: [],
    loading: false,
  });

  // 对话示例列表（可视化编辑）
  const dialogueExamplesList = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // 添加对话示例行
  function addDialogueExample() {
    dialogueExamplesList.value.push({ role: 'user', content: '' });
  }

  // 删除对话示例行
  function removeDialogueExample(index: number) {
    dialogueExamplesList.value.splice(index, 1);
  }

  // 全局：情绪名称→ID 的映射，用于提交 emotionId
  const emotionNameToId = ref(new Map<string, number>());

  async function loadGlobalEmotionListOnly(): Promise<string[]> {
    try {
      const res: any = await ApiApp.getGlobalEmotions();
      const list = res?.data?.emotions || [];
      // 记录情绪名称到ID的映射，便于提交 emotionId
      try {
        const map = new Map<string, number>();
        (Array.isArray(list) ? list : []).forEach((i: any) => {
          const name = String(i?.emotion || '').trim();
          const id = Number(i?.id || 0);
          if (name && id) map.set(name, id);
        });
        emotionNameToId.value = map;
      } catch (_) {}
      return Array.isArray(list)
        ? list.map((i: any) => String(i?.emotion || '').trim()).filter((s: string) => !!s)
        : [];
    } catch (_) {
      return [];
    }
  }

  async function initRoleEmotionForApp(appId?: number) {
    roleEmotion.loading = true;
    try {
      const emotions = await loadGlobalEmotionListOnly();
      let mapping: any[] = [];
      if (appId) {
        try {
          const r: any = await ApiApp.getAppEmotionVoices(appId);
          mapping = r?.data?.items || r?.items || [];
        } catch (_) {}
      }
      const mapByEmotion = new Map<string, string>();
      (Array.isArray(mapping) ? mapping : []).forEach((m: any) => {
        const e = String(m?.emotion || '').trim();
        const v = String(m?.voiceId || '');
        if (e) mapByEmotion.set(e, v);
      });
      roleEmotion.list = emotions.map((e) => ({ emotion: e, voiceId: mapByEmotion.get(e) || '' }));
    } finally {
      roleEmotion.loading = false;
    }
  }

  async function queryAppList() {
    try {
      loading.value = true;
      // 处理catId，不再需要将数组转换为逗号分隔的字符串
      const params = { ...formInline };
      const res = await ApiApp.queryApp(params);
      const { rows, count } = res.data;
      loading.value = false;
      total.value = count;
      tableData.value = rows.sort(
        (a: { order: number }, b: { order: number }) => b.order - a.order,
      );
    } catch (error) {
      loading.value = false;
    }
  }

  async function queryCatList() {
    const res = await ApiApp.queryCats({ size: 100 });
    const { rows } = res.data;
    catList.value = rows;
  }

  // Helper function to check if a string is valid JSON template
  function isValidJsonTemplate(str: string): boolean {
    if (!str || !str.startsWith('[')) {
      return false;
    }
    try {
      const parsed = JSON.parse(str);
      // Basic check: is it an array? Does the first item look like our structure?
      return (
        Array.isArray(parsed) &&
        (!parsed.length ||
          (parsed[0] &&
            typeof parsed[0].type === 'string' &&
            typeof parsed[0].placeholder === 'string'))
      );
    } catch (e) {
      return false;
    }
  }

  function handleUpdatePackage(row: any) {
    // 确保弹窗打开前已有音色选项（否则回显看不到标签）
    if (voiceOptions.value.length === 0 && !voiceLoading.value) {
      queryVoiceList();
    }
    activeAppCatId.value = row.id;
    isUserApp.value = row.role === 'user';
    userAppStatus.value = row.status;
    const {
      name,
      status,
      des,
      order,
      coverImg,
      catId,
      preset,
      demoData,
      isGPTs,
      gizmoID,
      isFixedModel,
      appModel,
      isFlowith,
      flowithId,
      flowithName,
      flowithKey,
      backgroundImg,
      prompt,
      voiceId,
      enableRealTime,
      enableLongTermMemory,
      enableKnowledgeBase,
      knowledgeBaseIds,
      dialogueExamples,
      openingRemark,
    } = row;

    // 设置特殊模型类型
    if (isGPTs === 1) {
      specialModelType.value = 'gpts';
    } else if (isFlowith === 1) {
      specialModelType.value = 'flowith';
    } else {
      specialModelType.value = 'none';
    }

    // 处理catId，确保它是字符串数组
    let processedCatId: string[] = [];
    if (typeof catId === 'string') {
      // 如果是逗号分隔的字符串，则拆分为数组
      processedCatId = catId.split(',').filter((id) => id.trim() !== '');
    } else if (Array.isArray(catId)) {
      // 如果已经是数组，则确保所有元素都是字符串
      processedCatId = catId.map((id) => id.toString());
    } else if (catId) {
      // 如果是单个值，则转换为包含一个元素的数组
      processedCatId = [catId.toString()];
    }

    nextTick(() => {
      Object.assign(formPackage, {
        name,
        status,
        des,
        order,
        coverImg,
        catId: processedCatId,
        preset,
        demoData,
        isGPTs,
        gizmoID,
        isFixedModel,
        appModel,
        isFlowith,
        flowithId,
        flowithName,
        flowithKey,
        backgroundImg,
        prompt,
        voiceId,
        enableRealTime: enableRealTime ?? false,
        enableLongTermMemory: enableLongTermMemory ?? false,
        enableKnowledgeBase: enableKnowledgeBase ?? false,
        knowledgeBaseIds: knowledgeBaseIds ?? '',
        dialogueExamples: dialogueExamples ?? '',
        openingRemark: openingRemark ?? '',
      });

      // --- 新增：处理 prompt 模板 ---
      if (isValidJsonTemplate(formPackage.prompt)) {
        try {
          templateFields.value = JSON.parse(formPackage.prompt);
          templateFields.value.forEach((field) => {
            if (!field.id) field.id = uuidv4();
            if (field.title === undefined) field.title = '';
            if (field.type === 'select' && !field.options) field.options = [];
          });
          usePromptTemplate.value = 'template';
        } catch (e) {
          console.error('Failed to parse prompt template:', e);
          // 解析失败，回退到普通模式
          templateFields.value = [];
          usePromptTemplate.value = 'plain';
          // formPackage.prompt 保持原样，让用户看到原始文本
        }
      } else {
        templateFields.value = [];
        usePromptTemplate.value = 'plain';
      }
      // --- 结束：处理 prompt 模板 ---

      // --- 新增：处理对话示例 ---
      if (formPackage.dialogueExamples) {
        try {
          const parsed = JSON.parse(formPackage.dialogueExamples);
          if (Array.isArray(parsed)) {
            dialogueExamplesList.value = parsed.map((item: any) => ({
              role: item.role === 'assistant' ? 'assistant' : 'user',
              content: String(item.content || ''),
            }));
          } else {
            dialogueExamplesList.value = [];
          }
        } catch (e) {
          console.error('Failed to parse dialogue examples:', e);
          dialogueExamplesList.value = [];
        }
      } else {
        dialogueExamplesList.value = [];
      }
      // --- 结束：处理对话示例 ---

      // --- 新增：处理知识库ID列表 ---
      if (formPackage.knowledgeBaseIds) {
        try {
          const parsed = JSON.parse(formPackage.knowledgeBaseIds);
          if (Array.isArray(parsed)) {
            // 将JSON数组转换为换行分隔的字符串
            formPackage.knowledgeBaseIds = parsed.filter((id) => id).join('\n');
          }
        } catch (e) {
          // 如果解析失败，说明可能已经是换行分隔的格式，保持不变
        }
      }
      // --- 结束：处理知识库ID列表 ---
    });
    visible.value = true;
  }

  function handlerCloseDialog(formEl: FormInstance | undefined) {
    activeAppCatId.value = 0;
    formEl?.resetFields();
    // --- 新增：重置模板状态 ---
    usePromptTemplate.value = 'plain';
    templateFields.value = [];
    // --- 结束：重置模板状态 ---
    // --- 新增：重置对话示例列表 ---
    dialogueExamplesList.value = [];
    // --- 结束：重置对话示例列表 ---
  }

  async function handleDeletePackage(row: any) {
    await ApiApp.deleteApp({ id: row.id });
    ElMessage.success('删除分类成功');
    queryAppList();
  }

  function handlerReset(formEl: FormInstance | undefined) {
    formEl?.resetFields();
    formInline.catId = '';
    queryAppList();
  }

  const handleAvatarSuccess: UploadProps['onSuccess'] = (response, uploadFile) => {
    console.log('response: ', response);
    if (response && response.data) {
      formPackage.coverImg = response.data;
    } else {
      ElMessage.error('上传成功但未获取到URL');
    }
  };

  const handleBackgroundSuccess: UploadProps['onSuccess'] = (response, uploadFile) => {
    console.log('response: ', response);
    if (response && response.data) {
      formPackage.backgroundImg = response.data;
    } else {
      ElMessage.error('上传成功但未获取到URL');
    }
  };

  const beforeAvatarUpload: UploadProps['beforeUpload'] = (rawFile) => {
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ];
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'];

    // 获取文件扩展名
    const fileName = rawFile.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    if (!allowedTypes.includes(rawFile.type) && !allowedExtensions.includes(fileExtension)) {
      ElMessage.error('当前系统仅支持 PNG、JPEG、GIF、WebP 和 ICO 格式的图片!');
      return false;
    } else if (rawFile.size / 1024 > 3000) {
      ElMessage.error('当前限制文件最大不超过 3000KB!');
      return false;
    }
    return true;
  };

  async function reuploadAppAvatar() {
    if (formPackage.coverImg) {
      try {
        ElMessage.info('正在重新上传应用图标...');
        const originalValue = formPackage.coverImg; // 保存原始值
        const file = await downloadFile(formPackage.coverImg);
        uploadFile(file, handleAvatarSuccess, originalValue);
      } catch (error) {
        console.error('下载应用图标文件失败', error);
        ElMessage.error('重新上传应用图标失败，请检查链接是否有效');
      }
    }
  }

  async function reuploadBackgroundImg() {
    if (formPackage.backgroundImg) {
      try {
        ElMessage.info('正在重新上传背景图片...');
        const originalValue = formPackage.backgroundImg; // 保存原始值
        const file = await downloadFile(formPackage.backgroundImg);
        uploadFile(file, handleBackgroundSuccess, originalValue);
      } catch (error) {
        console.error('下载背景图片文件失败', error);
        ElMessage.error('重新上传背景图片失败，请检查链接是否有效');
      }
    }
  }

  function uploadFile(file: any, successHandler: any, originalValue?: string) {
    const form = new FormData();
    form.append('file', file);

    uploadApi
      .uploadFile(form, 'system/app')
      .then((response) => {
        // 创建模拟的响应对象，与el-upload期望的结构一致
        successHandler({
          data: response.data,
        });

        // 如果是重新上传场景（有原始值），显示成功消息
        if (originalValue) {
          if (successHandler === handleAvatarSuccess) {
            ElMessage.success('重新上传应用图标成功');
          } else if (successHandler === handleBackgroundSuccess) {
            ElMessage.success('重新上传背景图片成功');
          }
        }
      })
      .catch((error) => {
        console.error('上传失败', error);
        ElMessage.error('文件上传失败');
        // 如果上传失败且有原始值，恢复原始值
        if (originalValue) {
          if (successHandler === handleAvatarSuccess) {
            formPackage.coverImg = originalValue;
          } else if (successHandler === handleBackgroundSuccess) {
            formPackage.backgroundImg = originalValue;
          }
        }
      });
  }

  // 自定义上传方法
  const customUpload: UploadRequestHandler = (options: UploadRequestOptions) => {
    const { file, onSuccess, onError } = options;
    const form = new FormData();
    form.append('file', file);

    return uploadApi
      .uploadFile(form, 'system/app')
      .then((response) => {
        if (onSuccess) {
          // 对于普通上传（而非重新上传）显示上传成功的消息
          ElMessage.success('上传成功');
          onSuccess(response);
        }
        return response;
      })
      .catch((error) => {
        if (onError) {
          onError(error);
        }
        console.error('上传失败', error);
        ElMessage.error('文件上传失败');
        return Promise.reject(error);
      });
  };

  async function downloadFile(url: string) {
    const response = await axios.get(url, { responseType: 'blob' });
    let fileName = 'downloaded_file';

    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const matches = /filename="([^"]+)"/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        fileName = matches[1];
      }
    } else {
      fileName = getFileNameFromUrl(url);
    }

    return new File([response.data], fileName, { type: response.data.type });
  }

  function getFileNameFromUrl(url: string | URL) {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    return pathname.substring(pathname.lastIndexOf('/') + 1);
  }

  function handlerSubmit(formEl: FormInstance | undefined) {
    formEl?.validate(async (valid) => {
      if (valid) {
        // --- 新增：处理 prompt 模板提交 ---
        let finalPrompt = formPackage.prompt; // 默认使用文本框内容
        if (usePromptTemplate.value === 'template') {
          // 过滤掉选项为空的下拉框 和 占位符为空的字段（可选）
          const cleanedFields = templateFields.value
            .map((field) => ({
              ...field,
              options:
                field.type === 'select'
                  ? (field.options || []).filter((opt) => opt && opt.trim() !== '')
                  : undefined,
            }))
            .filter(
              (field) =>
                field.title &&
                field.title.trim() !== '' &&
                field.placeholder &&
                field.placeholder.trim() !== '',
            );

          if (cleanedFields.length > 0) {
            finalPrompt = JSON.stringify(cleanedFields);
          } else {
            finalPrompt = ''; // 如果模板为空，则提交空字符串
          }
        }
        // --- 结束：处理 prompt 模板提交 ---

        // --- 新增：处理对话示例提交 ---
        let finalDialogueExamples = '';
        const cleanedExamples = dialogueExamplesList.value
          .filter((item) => item.content && item.content.trim() !== '')
          .map((item) => ({
            role: item.role,
            content: item.content.trim(),
          }));
        if (cleanedExamples.length > 0) {
          finalDialogueExamples = JSON.stringify(cleanedExamples);
        }
        // --- 结束：处理对话示例提交 ---

        // --- 新增：处理知识库ID列表提交 ---
        let finalKnowledgeBaseIds = '';
        if (formPackage.knowledgeBaseIds && formPackage.knowledgeBaseIds.trim()) {
          // 将换行分隔的字符串转换为JSON数组
          const ids = formPackage.knowledgeBaseIds
            .split('\n')
            .map((id) => id.trim())
            .filter((id) => id !== '');
          if (ids.length > 0) {
            finalKnowledgeBaseIds = JSON.stringify(ids);
          }
        }
        // --- 结束：处理知识库ID列表提交 ---

        // 注入后端必需的默认字段以简化表单
        const ensureDefaults = (obj: any) => {
          const firstCat = catList.value?.[0]?.id?.toString();
          if (!obj.des) obj.des = obj.name || '';
          if (obj.status === undefined || obj.status === null) obj.status = 1;
          if (!obj.catId || (Array.isArray(obj.catId) && obj.catId.length === 0)) {
            obj.catId = firstCat ? [firstCat] : ['1'];
          }
        };

        if (activeAppCatId.value) {
          const params: any = {
            ...formPackage,
            prompt: finalPrompt,
            dialogueExamples: finalDialogueExamples,
            knowledgeBaseIds: finalKnowledgeBaseIds,
            id: activeAppCatId.value,
          };
          ensureDefaults(params);
          params.catId = (Array.isArray(params.catId) ? params.catId : [params.catId]).join(
            ',',
          ) as any;
          if (isUserApp.value) Object.assign(params, { status: userAppStatus.value });
          // 直接在 updateApp 中提交情绪-音色映射（仅 emotionId 与非空 voiceId）
          params.emotionVoices = roleEmotion.list
            .map((i) => ({
              emotionId: emotionNameToId.value.get(String(i.emotion || '').trim()) || 0,
              voiceId: i.voiceId ? String(i.voiceId) : '',
            }))
            .filter((i) => i.emotionId && i.voiceId);
          await ApiApp.updateApp(params);
          ElMessage({ type: 'success', message: '更新应用成功！' });
        } else {
          const newApp: any = {
            ...formPackage,
            prompt: finalPrompt,
            dialogueExamples: finalDialogueExamples,
            knowledgeBaseIds: finalKnowledgeBaseIds,
          };
          ensureDefaults(newApp);
          newApp.catId = (Array.isArray(newApp.catId) ? newApp.catId : [newApp.catId]).join(
            ',',
          ) as any;
          // 直接在 createApp 中提交情绪-音色映射（仅 emotionId 与非空 voiceId）
          newApp.emotionVoices = roleEmotion.list
            .map((i) => ({
              emotionId: emotionNameToId.value.get(String(i.emotion || '').trim()) || 0,
              voiceId: i.voiceId ? String(i.voiceId) : '',
            }))
            .filter((i) => i.emotionId && i.voiceId);
          await ApiApp.createApp(newApp);
          ElMessage({ type: 'success', message: '创建新的应用成功！' });
        }
        visible.value = false;
        queryAppList();
      }
    });
  }

  // 获取分类名称
  function getCategoryName(catId: string): string {
    const category = catList.value.find((item) => item.id.toString() === catId);
    return category ? category.name : '';
  }

  // 检查分类是否已被选择
  function isCategorySelected(catId: string): boolean {
    return formPackage.catId.includes(catId);
  }

  // 选择分类
  function selectCategory(catId: string): void {
    if (!isCategorySelected(catId)) {
      formPackage.catId.push(catId);
    }
  }

  // 移除特定分类
  function removeCategory(catId: string): void {
    const index = formPackage.catId.indexOf(catId);
    if (index !== -1) {
      formPackage.catId.splice(index, 1);
    }
  }

  // 清除所有分类选择
  function clearCategory(): void {
    formPackage.catId = [];
  }

  // 检查搜索分类是否已被选择
  function isSearchCategorySelected(catId: string): boolean {
    return formInline.catId === catId;
  }

  function showDevOnlyMessage() {
    ElMessage({ type: 'warning', message: '此功能仅开发版支持！' });
  }

  // 选择搜索分类
  function selectSearchCategory(catId: string): void {
    formInline.catId = catId;
  }

  // 移除特定搜索分类
  function removeSearchCategory(catId: string): void {
    if (formInline.catId === catId) {
      formInline.catId = '';
    }
  }

  // 清除所有搜索分类
  function clearSearchCategory(): void {
    formInline.catId = '';
  }

  // 获取模型列表
  async function fetchModelList() {
    try {
      const res = await ApiModels.queryModels({
        page: 1,
        size: 1000, // 获取较大的数量以确保获取所有模型
      });
      const { rows } = res.data;
      const uniqueModels = new Set<string>();
      rows.forEach((row: any) => {
        if (row.model) {
          uniqueModels.add(row.model);
        }
      });
      modelOptions.value = Array.from(uniqueModels);
    } catch (error) {
      console.error('获取模型列表失败:', error);
    }
  }

  // --- 新增状态 ---
  const usePromptTemplate = ref<'plain' | 'template'>('plain');
  const templateFields = ref<
    Array<{
      id: string;
      title: string;
      type: 'input' | 'select';
      placeholder: string;
      options?: string[];
    }>
  >([]);
  // --- 结束：新增状态 ---

  // --- Synchronization Watchers ---
  let isUpdatingInternally = false; // Flag to prevent recursive updates

  // Watch for changes in the template editor data
  watch(
    templateFields,
    (newFields) => {
      if (isUpdatingInternally) return;
      if (usePromptTemplate.value === 'template') {
        isUpdatingInternally = true;
        try {
          const cleanedFields = newFields
            .map(({ id, ...rest }) => ({
              // <-- Destructure to exclude id
              ...rest,
              options:
                rest.type === 'select'
                  ? (rest.options || []).filter((opt) => opt != null && opt.trim() !== '')
                  : undefined,
              title: rest.title || '',
              placeholder: rest.placeholder || '',
            }))
            .filter(
              (field) => field.type && field.title.trim() !== '' && field.placeholder.trim() !== '',
            ); // ID is no longer needed here

          if (cleanedFields.length > 0) {
            formPackage.prompt = JSON.stringify(cleanedFields, null, 2); // <-- Use pretty print with 2 spaces
          } else {
            formPackage.prompt = '';
          }
        } catch (e) {
          console.error('Error stringifying template fields:', e);
          formPackage.prompt = '';
        } finally {
          nextTick(() => {
            isUpdatingInternally = false;
          });
        }
      }
    },
    { deep: true },
  );

  // Watch for changes in the plain text prompt
  watch(
    () => formPackage.prompt,
    (newPrompt) => {
      if (isUpdatingInternally) return;
      if (usePromptTemplate.value === 'plain') {
        if (isValidJsonTemplate(newPrompt)) {
          isUpdatingInternally = true;
          try {
            const parsedFields = JSON.parse(newPrompt);
            if (Array.isArray(parsedFields)) {
              parsedFields.forEach((field) => {
                if (!field.id) field.id = uuidv4();
                if (field.title === undefined) field.title = '';
                if (field.placeholder === undefined) field.placeholder = '';
                if (field.type === 'select' && !Array.isArray(field.options)) field.options = [];
              });
              templateFields.value = parsedFields;
            } // else: Parsed but not array, do nothing to templateFields
          } catch (e) {
            console.error('Error parsing prompt JSON for template fields:', e);
            // templateFields.value = []; // Optionally clear on error
          } finally {
            nextTick(() => {
              isUpdatingInternally = false;
            });
          }
        }
        // else { // Optionally clear templateFields if plain text is not valid JSON
        //     templateFields.value = [];
        // }
      }
    },
  );

  // Refine the mode switch watcher for initial sync on switch
  watch(usePromptTemplate, (newValue, oldValue) => {
    isUpdatingInternally = true;
    if (newValue === 'template') {
      // Switching to template mode: Try to parse plain text content
      if (isValidJsonTemplate(formPackage.prompt)) {
        try {
          const parsedFields = JSON.parse(formPackage.prompt);
          if (Array.isArray(parsedFields)) {
            parsedFields.forEach((field) => {
              if (!field.id) field.id = uuidv4();
              if (field.title === undefined) field.title = '';
              if (field.placeholder === undefined) field.placeholder = '';
              if (field.type === 'select' && !Array.isArray(field.options)) field.options = [];
            });
            templateFields.value = parsedFields;
          } else {
            templateFields.value = [];
          }
        } catch (e) {
          templateFields.value = [];
        }
      } // else: Keep existing templateFields if plain text is invalid/empty
    } else {
      // newValue === 'plain'
      // Switching to plain mode: Stringify template editor content
      const cleanedFields = templateFields.value
        .map(({ id, ...rest }) => ({
          // <-- Destructure to exclude id
          ...rest,
          options:
            rest.type === 'select'
              ? (rest.options || []).filter((opt) => opt != null && opt.trim() !== '')
              : undefined,
          title: rest.title || '',
          placeholder: rest.placeholder || '',
        }))
        .filter(
          (field) => field.type && field.title.trim() !== '' && field.placeholder.trim() !== '',
        ); // ID is no longer needed here

      if (cleanedFields.length > 0) {
        formPackage.prompt = JSON.stringify(cleanedFields, null, 2); // <-- Use pretty print with 2 spaces
      } else {
        formPackage.prompt = '';
      }
    }
    nextTick(() => {
      isUpdatingInternally = false;
    });
  });
  // --- 结束：监听模板模式切换 ---

  // --- Computed property for placeholder ---
  const plainModePlaceholder = computed(() => {
    return `请按以下JSON格式输入模板，或切换到"模板模式"进行可视化编辑：
[
  {
    "type": "input",
    "title": "字段名称",
    "placeholder": "输入提示文字"
  },
  {
    "type": "select",
    "title": "下拉框名称",
    "placeholder": "下拉提示",
    "options": ["选项1", "选项2"]
  }
]`;
  });
  // --- End computed property ---

  onMounted(() => {
    queryAppList();
    queryCatList();
    fetchModelList();
  });
</script>

<template>
  <div>
    <PageHeader>
      <template #title>
        <div class="flex items-center gap-4">角色管理</div>
      </template>
      <template #content>
        <div class="text-sm/6">
          <div>请按星尘API规范维护角色信息（名称、设定、可选特质Traits），建议规范命名与分类。</div>
          <div>模型可固定或不固定；如无特殊需要，保持默认即可。</div>
        </div>
      </template>
      <HButton outline @click="visible = true">
        <SvgIcon name="ic:baseline-plus" />
        新增应用
      </HButton>
      <HButton outline class="ml-2" @click="openEmotionDialog">
        <SvgIcon name="mdi:emoticon-outline" />
        统一情绪设置
      </HButton>
    </PageHeader>

    <page-main>
      <el-form ref="formRef" :inline="true" :model="formInline">
        <el-form-item label="App分类" prop="catId">
          <el-select
            v-model="formInline.catId"
            placeholder="请选择App分类"
            clearable
            style="width: 240px"
          >
            <el-option
              v-for="item in catList"
              :key="item.id"
              :label="item.name"
              :value="item.id.toString()"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="App名称" prop="name">
          <el-input
            v-model="formInline.name"
            placeholder="App名称[模糊搜索]"
            clearable
            @keydown.enter.prevent="queryAppList"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="queryAppList"> 查询 </el-button>
          <el-button @click="handlerReset(formRef)"> 重置 </el-button>
        </el-form-item>
      </el-form>
    </page-main>

    <page-main style="width: 100%">
      <el-table v-loading="loading" border :data="tableData" style="width: 100%" size="large">
        <el-table-column prop="coverImg" label="角色封面" width="100">
          <template #default="scope">
            <el-image style="height: 50px" :src="scope.row.coverImg" fit="fill" />
          </template>
        </el-table-column>
        <el-table-column prop="catName" label="分类" width="120">
          <template #default="scope">
            <el-tooltip
              v-if="scope.row.catName && scope.row.catName.includes(',')"
              class="box-item"
              effect="dark"
              placement="top-start"
            >
              <template #content>
                <div :style="{ maxWidth: '250px' }">
                  {{ scope.row.catName }}
                </div>
              </template>
              <div :style="{ maxHeight: '50px', cursor: 'pointer' }">
                {{ scope.row.catName }}
              </div>
            </el-tooltip>
            <span v-else>{{ scope.row.catName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="角色名称" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
              {{ QUESTION_STATUS_MAP[scope.row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <!-- <el-table-column prop="public" label="是否共享" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.public ? 'success' : 'info'">
              {{ scope.row.public ? '共享' : '私有' }}
            </el-tag>
          </template>
        </el-table-column> -->
        <!-- <el-table-column prop="public" label="应用创建角色" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.role === 'system' ? 'success' : 'info'">
              {{ scope.row.role === 'system' ? '系统' : '用户' }}
            </el-tag>
          </template>
        </el-table-column> -->
        <el-table-column prop="order" label="排序ID" /> />
        <el-table-column prop="preset" label="角色设定" width="400">
          <template #default="scope">
            <el-tooltip class="box-item" effect="dark" placement="top-start">
              <template #content>
                <div :style="{ maxWidth: '350px' }">
                  {{ scope.row.preset }}
                </div>
              </template>
              <div :style="{ maxHeight: '50px', cursor: 'pointer' }">
                {{ scope.row.preset }}
              </div>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column prop="des" label="角色描述" width="300">
          <template #default="scope">
            <el-tooltip class="box-item" effect="dark" placement="top-start">
              <template #content>
                <div :style="{ maxWidth: '350px' }">
                  {{ scope.row.des }}
                </div>
              </template>
              <div :style="{ maxHeight: '50px', cursor: 'pointer' }">
                {{ scope.row.des }}
              </div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="120">
          <template #default="scope">
            {{ utcToShanghaiTime(scope.row.createdAt, 'YYYY-MM-DD') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button
              v-if="scope.row.role === 'system' || scope.row.public"
              link
              type="primary"
              size="small"
              @click="handleUpdatePackage(scope.row)"
            >
              编辑
            </el-button>
            <el-popconfirm
              v-if="scope.row.role === 'system'"
              title="确认删除此应用么?"
              width="200"
              icon-color="red"
              @confirm="handleDeletePackage(scope.row)"
            >
              <template #reference>
                <el-button link type="danger" size="small"> 删除应用 </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <el-row class="mt-5 flex justify-end">
        <el-pagination
          v-model:current-page="formInline.page"
          v-model:page-size="formInline.size"
          class="mr-5"
          :page-sizes="[10, 20, 30, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="queryAppList"
          @current-change="queryAppList"
        />
      </el-row>
    </page-main>
    <el-dialog
      v-model="visible"
      :close-on-click-modal="false"
      :title="dialogTitle"
      width="90%"
      top="3vh"
      @close="handlerCloseDialog(formPackageRef)"
      class="app-dialog"
    >
      <el-form
        ref="formPackageRef"
        label-position="right"
        label-width="110px"
        :model="formPackage"
        :rules="rules"
      >
        <el-tabs type="border-card" class="form-tabs">
          <!-- 基础信息标签页 -->
          <el-tab-pane>
            <template #label>
              <span class="tab-label">
                <el-icon><Avatar /></el-icon>
                基础信息
              </span>
            </template>
            <el-row :gutter="20" class="form-section">
              <el-col :span="10">
                <el-form-item label="角色名称" prop="name">
                  <el-input v-model="formPackage.name" placeholder="请填写App名称" />
                </el-form-item>
                <el-form-item v-if="false" label="App状态" prop="status">
                  <el-switch v-model="formPackage.status" :active-value="1" :inactive-value="0" />
                </el-form-item>
                <el-form-item v-if="false" label="排序ID" prop="order">
                  <el-input v-model.number="formPackage.order" placeholder="排序ID" />
                </el-form-item>
              </el-col>
              <el-col :span="14">
                <el-form-item v-if="false" label="App分类" prop="catId">
                  <div class="category-selector" style="height: 100%">
                    <div class="selected-categories mb-2">
                      <el-tag
                        v-for="catId in formPackage.catId"
                        :key="catId"
                        closable
                        class="mr-1 mb-1"
                        @close="removeCategory(catId)"
                      >
                        {{ getCategoryName(catId) }}
                      </el-tag>
                      <div v-if="formPackage.catId.length === 0" class="text-gray-400 text-sm">
                        请选择分类
                      </div>
                    </div>
                    <div class="category-options p-2 border rounded-md max-h-48 overflow-y-auto">
                      <div class="text-sm text-gray-500 mb-2">可选分类：</div>
                      <el-tag
                        v-for="item in catList"
                        :key="item.id"
                        :class="[
                          'mr-1 mb-1 cursor-pointer',
                          isCategorySelected(item.id.toString()) ? 'is-disabled' : '',
                        ]"
                        :effect="isCategorySelected(item.id.toString()) ? 'plain' : 'dark'"
                        @click="selectCategory(item.id.toString())"
                      >
                        {{ item.name }}
                      </el-tag>
                    </div>
                  </div>
                </el-form-item>
                <!-- 角色头像放到第一行 -->
                <el-form-item label="角色头像" prop="coverImg">
                  <div class="avatar-upload-box">
                    <el-input
                      v-model="formPackage.coverImg"
                      placeholder="填写图片URL或点击上传"
                      clearable
                    >
                      <template #prefix>
                        <el-icon><Picture /></el-icon>
                      </template>
                    </el-input>
                    <el-upload
                      class="avatar-uploader"
                      :http-request="customUpload"
                      :show-file-list="false"
                      :on-success="handleAvatarSuccess"
                      :before-upload="beforeAvatarUpload"
                    >
                      <el-button type="primary">
                        <el-icon><Upload /></el-icon>
                        上传
                      </el-button>
                    </el-upload>
                    <el-avatar v-if="formPackage.coverImg" :src="formPackage.coverImg" :size="40" />
                  </div>
                  <div class="form-item-tip">
                    <el-icon><InfoFilled /></el-icon>
                    支持PNG、JPEG、GIF、WebP格式，大小不超过3MB
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="角色描述" prop="des">
                  <el-input
                    v-model="formPackage.des"
                    type="textarea"
                    placeholder="请填写App介绍信息..."
                    :rows="3"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item v-if="false" label="示例内容" prop="demoData">
                  <el-input
                    v-model="formPackage.demoData"
                    type="textarea"
                    placeholder="请填写App的demo示例数据..."
                    :rows="3"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item v-if="specialModelType !== 'gpts'" label="角色设定" prop="preset">
                  <el-input
                    v-model="formPackage.preset"
                    type="textarea"
                    placeholder="请详细描述角色的性格、背景、说话风格、特点等..."
                    :rows="6"
                    maxlength="2000"
                    show-word-limit
                  />
                  <div class="form-item-tip">
                    <el-icon><InfoFilled /></el-icon>
                    角色设定会直接影响AI的回答风格和语气，建议详细描述角色特征
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item v-if="false" label="特殊模型" prop="specialModel">
                  <el-radio-group v-model="specialModelType">
                    <el-radio label="none">不使用</el-radio>
                    <el-radio label="gpts">GPTs</el-radio>
                    <el-radio label="flowith" :disabled="true" @click="showDevOnlyMessage"
                      >Flowith</el-radio
                    >
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-row :gutter="10">
                  <el-col :span="12">
                    <el-form-item
                      label="固定模型"
                      prop="isFixedModel"
                      v-if="specialModelType === 'none'"
                    >
                      <el-switch
                        v-model="formPackage.isFixedModel"
                        :active-value="1"
                        :inactive-value="0"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item
                      label="使用模型"
                      prop="appModel"
                      v-if="specialModelType === 'none' && Number(formPackage.isFixedModel) === 1"
                    >
                      <el-select
                        v-model="formPackage.appModel"
                        filterable
                        allow-create
                        placeholder="选择模型"
                        clearable
                      >
                        <el-option
                          v-for="item in modelOptions"
                          :key="item"
                          :label="item"
                          :value="item"
                        />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>
              </el-col>
              <el-col :span="12">
                <el-form-item label="角色音色" prop="voiceId">
                  <el-select
                    v-model="formPackage.voiceId"
                    filterable
                    clearable
                    :loading="voiceLoading"
                    placeholder="选择音色"
                  >
                    <el-option
                      v-for="opt in voiceOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>

              <!-- 角色情绪-音色映射（按角色） -->
              <el-col :span="24">
                <el-form-item label="角色情绪音色">
                  <el-table :data="roleEmotion.list" border size="small" style="width: 100%">
                    <el-table-column label="情绪" prop="emotion" width="200" />
                    <el-table-column label="音色">
                      <template #default="scope">
                        <el-select
                          v-model="scope.row.voiceId"
                          filterable
                          clearable
                          :loading="voiceLoading"
                          placeholder="选择音色"
                          style="width: 100%"
                        >
                          <el-option
                            v-for="opt in voiceOptions"
                            :key="opt.value"
                            :label="opt.label"
                            :value="opt.value"
                          />
                        </el-select>
                      </template>
                    </el-table-column>
                  </el-table>
                </el-form-item>
              </el-col>

              <!-- 星尘API扩展配置 -->
              <el-col :span="24" style="margin-top: 24px">
                <el-alert
                  type="info"
                  :closable="false"
                  show-icon
                  title="星尘API扩展配置"
                  description="以下配置基于阿里云星尘大模型API，可提升角色的智能化和个性化程度"
                />
              </el-col>

              <el-col :span="24">
                <el-form-item label="开场白" prop="openingRemark">
                  <el-input
                    v-model="formPackage.openingRemark"
                    type="textarea"
                    placeholder="例如：你好！我是你的AI助手，有什么可以帮助你的吗？"
                    :rows="2"
                    maxlength="500"
                    show-word-limit
                  />
                  <div class="form-item-tip">
                    <el-icon><InfoFilled /></el-icon>
                    角色在新对话开始时的问候语，会在首次交互时展示给用户
                  </div>
                </el-form-item>
              </el-col>

              <el-col :span="24">
                <el-divider content-position="left">
                  <el-icon><Setting /></el-icon>
                  智能增强功能
                </el-divider>
              </el-col>

              <el-col :span="24">
                <div class="enhance-features-container">
                  <div class="feature-card">
                    <div class="feature-icon">
                      <el-icon :size="24" color="#3b82f6"><Clock /></el-icon>
                    </div>
                    <div class="feature-content">
                      <div class="feature-title">真实时间</div>
                      <div class="feature-desc">AI可以感知当前时间和日期</div>
                    </div>
                    <div class="feature-switch">
                      <el-switch
                        v-model="formPackage.enableRealTime"
                        size="large"
                        active-text="开启"
                        inactive-text="关闭"
                      />
                    </div>
                  </div>

                  <div class="feature-card">
                    <div class="feature-icon">
                      <el-icon :size="24" color="#8b5cf6"><Memo /></el-icon>
                    </div>
                    <div class="feature-content">
                      <div class="feature-title">长期记忆</div>
                      <div class="feature-desc">记住用户的偏好和历史对话内容</div>
                    </div>
                    <div class="feature-switch">
                      <el-switch
                        v-model="formPackage.enableLongTermMemory"
                        size="large"
                        active-text="开启"
                        inactive-text="关闭"
                      />
                    </div>
                  </div>

                  <div class="feature-card">
                    <div class="feature-icon">
                      <el-icon :size="24" color="#10b981"><Search /></el-icon>
                    </div>
                    <div class="feature-content">
                      <div class="feature-title">知识库搜索</div>
                      <div class="feature-desc">从指定知识库中检索相关信息</div>
                    </div>
                    <div class="feature-switch">
                      <el-switch
                        v-model="formPackage.enableKnowledgeBase"
                        size="large"
                        active-text="开启"
                        inactive-text="关闭"
                      />
                    </div>
                  </div>
                </div>
              </el-col>

              <el-col :span="24" v-if="formPackage.enableKnowledgeBase">
                <el-form-item label="知识库ID列表" prop="knowledgeBaseIds">
                  <el-input
                    v-model="formPackage.knowledgeBaseIds"
                    type="textarea"
                    placeholder="每行输入一个知识库ID，例如：&#10;kb_id_1&#10;kb_id_2&#10;kb_id_3"
                    :rows="4"
                  />
                  <div class="form-item-tip">
                    <el-icon><FolderOpened /></el-icon>
                    每行一个知识库ID，AI会从这些知识库中检索相关信息来辅助回答
                  </div>
                </el-form-item>
              </el-col>

              <el-col :span="24">
                <el-divider content-position="left">
                  <el-icon><ChatLineRound /></el-icon>
                  对话示例配置
                </el-divider>
              </el-col>

              <el-col :span="24">
                <el-form-item label="对话示例" prop="dialogueExamples">
                  <div style="width: 100%; margin-bottom: 12px">
                    <el-button type="primary" plain size="default" @click="addDialogueExample">
                      <el-icon><Plus /></el-icon>
                      新增对话示例
                    </el-button>
                    <span
                      class="form-item-tip"
                      style="display: inline-flex; margin-left: 12px; padding: 6px 10px"
                    >
                      <el-icon><InfoFilled /></el-icon>
                      提供2-4组对话示例，帮助AI理解你期望的回答风格和语气
                    </span>
                  </div>
                  <div style="width: 100%">
                    <el-table
                      :data="dialogueExamplesList"
                      border
                      size="default"
                      style="width: 100%"
                      :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
                      v-if="dialogueExamplesList.length > 0"
                    >
                      <el-table-column label="角色" width="150" align="center">
                        <template #default="scope">
                          <el-select
                            v-model="scope.row.role"
                            placeholder="选择角色"
                            style="width: 100%"
                          >
                            <el-option label="👤 用户" value="user" />
                            <el-option label="🤖 AI助手" value="assistant" />
                          </el-select>
                        </template>
                      </el-table-column>
                      <el-table-column label="对话内容">
                        <template #default="scope">
                          <el-input
                            v-model="scope.row.content"
                            type="textarea"
                            :rows="2"
                            placeholder="请输入对话内容..."
                          />
                        </template>
                      </el-table-column>
                      <el-table-column label="操作" width="100" align="center">
                        <template #default="scope">
                          <el-button
                            link
                            type="danger"
                            @click="removeDialogueExample(scope.$index)"
                          >
                            <el-icon><Delete /></el-icon>
                            删除
                          </el-button>
                        </template>
                      </el-table-column>
                    </el-table>
                    <el-empty
                      v-else
                      description="暂无对话示例，点击上方按钮添加"
                      :image-size="100"
                    />
                  </div>
                </el-form-item>
              </el-col>

              <el-col :span="12" v-if="specialModelType === 'gpts'">
                <el-form-item v-if="false" label="gizmoID" prop="gizmoID">
                  <el-input
                    v-model="formPackage.gizmoID"
                    placeholder="请填写 GPTs 使用的 gizmoID"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12" v-if="specialModelType === 'gpts'">
                <!-- Placeholder Column -->
              </el-col>

              <el-col :span="12">
                <el-form-item v-if="false" label="App背景图" prop="backgroundImg">
                  <el-input
                    v-model="formPackage.backgroundImg"
                    placeholder="填写或上传背景图"
                    clearable
                  >
                    <template #append>
                      <!-- Upload Component -->
                      <el-upload
                        class="avatar-uploader"
                        :http-request="customUpload"
                        :show-file-list="false"
                        :on-success="handleBackgroundSuccess"
                        :before-upload="beforeAvatarUpload"
                        style="
                          display: inline-flex;
                          align-items: center;
                          justify-content: center;
                          vertical-align: middle;
                        "
                      >
                        <img
                          v-if="formPackage.backgroundImg"
                          :src="formPackage.backgroundImg"
                          style="
                            max-width: 1.5rem;
                            max-height: 1.5rem;
                            margin: 5px 0;
                            object-fit: contain;
                          "
                        />
                        <el-icon v-else style="width: 1rem">
                          <Plus />
                        </el-icon>
                      </el-upload>
                      <!-- Re-upload Icon (Separate) -->
                      <el-icon
                        v-if="formPackage.backgroundImg"
                        @click="reuploadBackgroundImg"
                        style="
                          margin-left: 10px;
                          width: 1rem;
                          cursor: pointer;
                          vertical-align: middle;
                        "
                        class="hover:text-primary"
                      >
                        <Refresh />
                      </el-icon>
                    </template>
                  </el-input>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item v-if="false" label="提问模版" prop="prompt">
                  <el-radio-group v-model="usePromptTemplate" size="small" class="mb-2">
                    <el-radio-button label="plain">普通模式</el-radio-button>
                    <el-radio-button label="template">模板模式</el-radio-button>
                  </el-radio-group>

                  <!-- Container for both modes, use v-show -->
                  <div class="w-full mt-2">
                    <!-- Plain Mode Textarea -->
                    <el-input
                      v-show="usePromptTemplate === 'plain'"
                      v-model="formPackage.prompt"
                      type="textarea"
                      :placeholder="plainModePlaceholder"
                      :rows="8"
                    />
                    <!-- Template Mode Editor -->
                    <div
                      v-show="usePromptTemplate === 'template'"
                      class="border rounded p-3 bg-gray-50"
                      style="min-height: 150px"
                    >
                      <PromptTemplateEditor v-model="templateFields" />
                    </div>
                  </div>
                </el-form-item>
              </el-col>
            </el-row>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <span class="mr-5 flex justify-end">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" @click="handlerSubmit(formPackageRef)">
            {{ dialogButton }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 统一情绪设置弹窗 -->
    <el-dialog v-model="emotionDialog.visible" title="统一情绪设置" width="720px">
      <div>
        <el-table :data="emotionDialog.list" border size="small" style="width: 100%">
          <el-table-column label="情绪名称" min-width="200">
            <template #default="scope">
              <el-input v-model="scope.row.emotion" placeholder="例如：开心、伤心、严肃..." />
            </template>
          </el-table-column>
          <!-- 统一设置处不再选择音色，仅维护情绪列表 -->
          <el-table-column label="操作" width="120">
            <template #default="scope">
              <el-button link type="danger" @click="removeEmotionRow(scope.$index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="mt-3">
          <el-button type="primary" plain @click="addEmotionRow">新增情绪</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="emotionDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="emotionDialog.saving" @click="saveGlobalEmotions"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
  .category-selector {
    width: 100%;
  }

  .selected-categories {
    min-height: 32px;
    padding: 4px 0;
  }

  .category-options .el-tag {
    transition: all 0.3s;
  }

  .category-options .el-tag:not(.is-disabled):hover {
    transform: scale(1.05);
  }

  .category-options .el-tag.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* 优化后的弹窗样式 */
  .app-dialog :deep(.el-dialog__body) {
    padding: 0;
    max-height: 75vh;
  }

  .form-tabs :deep(.el-tabs__header) {
    margin: 0;
    background: #f5f7fa;
  }

  .form-tabs :deep(.el-tabs__content) {
    padding: 24px;
    max-height: 65vh;
    overflow-y: auto;
  }

  .form-tabs :deep(.el-tabs__item) {
    font-size: 14px;
    padding: 0 24px;
  }

  .tab-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .form-section {
    margin-bottom: 16px;
  }

  .form-item-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 8px 12px;
    background: #f0f9ff;
    border-left: 3px solid #3b82f6;
    border-radius: 4px;
    font-size: 13px;
    color: #64748b;
  }

  .avatar-upload-box {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 10px;
  }

  .avatar-upload-box .el-input {
    flex: 1;
  }

  /* 自定义滚动条 */
  .form-tabs :deep(.el-tabs__content)::-webkit-scrollbar {
    width: 8px;
  }

  .form-tabs :deep(.el-tabs__content)::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .form-tabs :deep(.el-tabs__content)::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }

  .form-tabs :deep(.el-tabs__content)::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* 智能增强功能卡片样式 */
  .enhance-features-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }

  @media (max-width: 1400px) {
    .enhance-features-container {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .enhance-features-container {
      grid-template-columns: 1fr;
    }
  }

  .feature-card {
    display: flex;
    align-items: center;
    padding: 20px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    transition: all 0.3s ease;
    gap: 16px;
  }

  .feature-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    transform: translateY(-2px);
  }

  .feature-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    border-radius: 12px;
  }

  .feature-content {
    flex: 1;
    min-width: 0;
  }

  .feature-title {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 4px;
  }

  .feature-desc {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.4;
  }

  .feature-switch {
    flex-shrink: 0;
  }

  /* 分隔线图标优化 */
  .el-divider__text {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
