import api from '../index';

export default {
  // 声音复刻：创建音色
  enroll: (data: { prefix: string; url: string; targetModel?: string; name?: string }) =>
    api.post('voice/enroll', data),
  // 列出服务器上的 GPT-SoVITS 模型文件
  listGptSovitsFiles: () => api.get('voice/gpt-sovits/files'),
  // 导入 GPT-SoVITS 模型（支持上传文件或选择服务器文件）
  importGptSovits: (data: FormData) => api.post('voice/gpt-sovits/import', data),

  // MiniMax 语音克隆：上传音频文件
  importMinimax: (data: FormData) =>
    api.post('voice/minimax/clone', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2分钟超时
    }),
  // MiniMax 关联已有音色ID
  linkMinimax: (data: {
    voiceId?: string;
    name?: string;
    minimaxVoiceId: string;
    model?: string;
    speed?: number;
    vol?: number;
    pitch?: number;
    languageBoost?: string;
  }) => api.post('voice/minimax/link', data),
  // MiniMax 音色设计：通过文字描述生成AI音色
  designMinimax: (data: {
    voiceId?: string;
    name?: string;
    prompt: string;       // 音色风格描述
  }) =>
    api.post('voice/minimax/design', data, {
      timeout: 120000, // 2分钟超时
    }),
  // 上传单个 GPT-SoVITS 模型文件
  uploadGptSovitsModel: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('voice/gpt-sovits/models/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000, // 10分钟超时（模型文件可能很大）
    });
  },
  // 获取 GPT-SoVITS 模型库（包含文件元信息）
  listGptSovitsLibrary: () => api.get('voice/gpt-sovits/files'),
  // 列出音色
  list: (
    params: {
      name?: string;
      prefix?: string;
      page_index?: number;
      page_size?: number;
      categoryId?: number;
    } = {},
  ) => api.get('voice/list', { params }),
  // 获取 GPT-SoVITS 角色列表
  listGptSovitsCharacters: () => api.get('voice/gpt-sovits/characters'),
  // 获取指定角色信息
  getGptSovitsCharacterInfo: (characterName: string) =>
    api.get(`voice/gpt-sovits/character/${encodeURIComponent(characterName)}`),
  // 查询指定音色详情
  detail: (voiceId: string) => api.get(`voice/detail/${encodeURIComponent(voiceId)}`),
  // 更新（训练）音色
  update: (data: { voice_id: string; url: string }) => api.post('voice/update', data),
  // 删除音色
  remove: (data: { voice_id: string }) => api.post('voice/delete', data),
  // 试听：生成试听音频并返回URL
  preview: (data: {
    voice_id: string;
    text: string;
    model?: string;
    format?: 'mp3' | 'wav' | 'pcm';
    sample_rate?: number;
    volume?: number;
    rate?: number;
    pitch?: number;
    text_language?: string;
    cut_punc?: string;
  }) => api.post('open/voice/preview', data),

  // 获取/设置 音色默认参数
  getParams: (voiceId: string) => api.get(`voice/params/${encodeURIComponent(voiceId)}`),
  setParams: (data: { voice_id: string; params: any }) => api.post('voice/params', data),

  // 获取/设置 音色元信息（如名称）
  getMeta: (voiceId: string) => api.get(`voice/meta/${encodeURIComponent(voiceId)}`),
  setMeta: (data: { voice_id: string; meta: any }) => api.post('voice/meta', data),

  // 设置音色分类
  setCategory: (data: { voice_id: string; categoryId: number | null }) =>
    api.post('voice/category', data),

  // 同步PENDING状态的音色
  syncPendingStatus: () => api.post('voice/sync-pending-status'),
};
