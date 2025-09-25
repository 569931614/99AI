import { get } from '@/utils/request'

export interface AffectionStage {
  id: number
  name: string
  behaviors?: string
  min?: number
  max?: number | null
}

export interface AffectionStatus {
  score: number
  stage: AffectionStage | null
}

export function fetchAffectionStatus<T = AffectionStatus>(data: {
  userId: number | string
  appId: number
}) {
  return get<T>({
    url: '/affection/status',
    data,
  })
}
