import api from '../index';

export interface AffectionRule {
  id?: number;
  appId?: number | null;
  stageName: string;
  minScore: number;
  maxScore?: number | null;
  behaviors: string;
}

export default {
  listRules: (params: { appId?: number } = {}) => api.get('affection/rules', { params }),
  upsertRule: (data: AffectionRule) => api.post('affection/rule', data),
  removeRule: (id: number) => api.delete(`affection/rule/${id}`),
  status: (params: { userId: number; appId: number }) => api.get('affection/status', { params }),
};
