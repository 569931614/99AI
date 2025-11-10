import api from '../index';

export interface StickerRecord {
  id: number;
  name: string;
  imageUrl: string;
  tags?: string[] | null;
  emotion?: string | null;
  scenario?: string | null;
  uploadDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StickerPayload {
  name: string;
  imageUrl: string;
  tags?: string[];
  emotion?: string;
  scenario?: string;
}

export interface StickerQuery {
  keyword?: string;
  emotion?: string;
  tags?: string[];
  page?: number;
  size?: number;
}

export interface StickerListResponse {
  rows: StickerRecord[];
  count: number;
  page: number;
  size: number;
}

type ApiResponse<T> = {
  success?: boolean;
  code?: number;
  message?: string;
  data: T;
};

const unwrap = async <T>(promise: Promise<any>): Promise<T> => {
  const res = await promise;
  if (res && typeof res === 'object' && 'data' in res) {
    const data = (res as Record<string, any>).data;
    if (data !== undefined) {
      if (data && typeof data === 'object' && 'data' in data) {
        return (data as Record<string, any>).data as T;
      }
      return data as T;
    }
  }
  return res as T;
};

export default {
  list: (params: StickerQuery) =>
    unwrap<StickerListResponse>(api.get<ApiResponse<StickerListResponse>>('stickers', { params })),
  detail: (id: number) =>
    unwrap<StickerRecord>(api.get<ApiResponse<StickerRecord>>(`stickers/${id}`)),
  create: (data: StickerPayload) =>
    unwrap<StickerRecord>(api.post<ApiResponse<StickerRecord>>('stickers', data)),
  update: (id: number, data: StickerPayload) =>
    unwrap<StickerRecord>(api.put<ApiResponse<StickerRecord>>(`stickers/${id}`, data)),
  remove: (id: number) =>
    unwrap<{ success: boolean }>(api.delete<ApiResponse<{ success: boolean }>>(`stickers/${id}`)),
};
