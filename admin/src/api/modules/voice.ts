import api from '../index';

export default {
  // 声音复刻：创建音色
  enroll: (data: { prefix: string; url: string; targetModel?: string; name?: string }) =>
    api.post('voice/enroll', data),
  // 列出服务器上的 GPT-SoVITS 模型文件
  listGptSovitsFiles: () => api.get('voice/gpt-sovits/files'),
  // 导入 GPT-SoVITS 模型（支持上传文件或选择服务器文件）
  importGptSovits: (data: FormData) => api.post('voice/gpt-sovits/import', data),
  // 列出音色
  list: (
    params: {
      prefix?: string;
      page_index?: number;
      page_size?: number;
      categoryId?: number;
    } = {},
  ) => api.get('voice/list', { params }),
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
  }) => api.post('voice/preview', data),

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
