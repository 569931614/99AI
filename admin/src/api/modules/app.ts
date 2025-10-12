import api from '../index';

export default {
  queryCats: (params: any) => api.get('app/queryAppCats', { params }),
  deleteCats: (data: { id: number }) => api.post('app/delAppCats', data),
  createCats: (data: any) => api.post('app/createAppCats', data),
  updateCats: (data: any) => api.post('app/updateAppCats', data),
  queryApp: (params: any) => api.get('app/queryApp', { params }),
  deleteApp: (data: { id: number }) => api.post('app/delApp', data),
  createApp: (data: any) => api.post('app/createApp', data),
  updateApp: (data: any) => api.post('app/updateApp', data),

  // 统一角色情绪配置
  getGlobalEmotions: () => api.get('app/emotions'),
  setGlobalEmotions: (data: { emotions: Array<{ emotion: string; voiceId?: string }> }) =>
    api.post('app/emotions', data),

  // 每个角色的情绪-音色映射
  getAppEmotionVoices: (appId: number) => api.get('app/emotionVoices', { params: { appId } }),
  setAppEmotionVoices: (data: {
    appId: number;
    items: Array<{ emotion: string; voiceId: string }>;
  }) => api.post('app/emotionVoices', data),
};
