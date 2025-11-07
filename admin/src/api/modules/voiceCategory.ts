import api from '../index';

export default {
  // 创建分类
  create: (data: { name: string; description?: string; sort?: number; isEnabled?: boolean }) =>
    api.post('voice-category', data),
  // 获取分类列表
  list: () => api.get('voice-category'),
  // 获取分类详情
  detail: (id: number) => api.get(`voice-category/${id}`),
  // 更新分类
  update: (
    id: number,
    data: { name?: string; description?: string; sort?: number; isEnabled?: boolean },
  ) => api.put(`voice-category/${id}`, data),
  // 删除分类
  remove: (id: number) => api.delete(`voice-category/${id}`),
};
