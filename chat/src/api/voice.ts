import { post } from '@/utils/request'

export function fetchASR<T = any>(data: {
  audioBase64: string
  format?: 'wav' | 'pcm' | 'mp3' | 'opus' | 'speex' | 'aac' | 'amr'
  sample_rate?: number
  model?: string
  language_hints?: string[]
  disfluency_removal_enabled?: boolean
}) {
  return post<T>({ url: '/voice/asr', data })
}
