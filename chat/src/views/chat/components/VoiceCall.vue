<script setup lang="ts">
import { fetchQueryOneCatAPI } from '@/api/appStore'
import { useAuthStore, useChatStore } from '@/store'
import { message } from '@/utils/message'
import { onMounted, onUnmounted, reactive, ref } from 'vue'

// 简易"按住说话"语音通话组件（不改动原有语音上传按钮）
// - 连接后端 WS: /api/realtime/voice-call
// - start_call → 发送音频帧 → 服务端 ASR→LLM→TTS（带情绪识别），期间流式返回事件
// - 使用 MediaSource 实现边收边播的流式TTS播放

// 接收从父组件传来的角色配置
interface Props {
  appId?: number
  model?: string
  modelName?: string
  prompt?: string
  temperature?: number
  config?: any
}

const props = withDefaults(defineProps<Props>(), {
  appId: undefined,
  model: 'gpt-4o-mini',
  modelName: 'AI助手',
  prompt: '',
  temperature: 1,
  config: () => ({}),
})

const emit = defineEmits<{ (e: 'close'): void }>()
const ms = message()

const connected = ref(false)
const connecting = ref(false)
const wsRef = ref<WebSocket | null>(null)
const status = ref('未连接')
const logs = ref<string[]>([])
const currentEmotion = ref<string>('') // 当前检测到的情绪

// 语音参数
const voiceId = ref('') // 可手填，留空则只展示 ASR/LLM，不播报
const sampleRate = 8000
const format: 'pcm' = 'pcm'

// VAD (Voice Activity Detection) 参数
const vadConfig = {
  silenceThreshold: 100, // 静音阈值（RMS）
  silenceDuration: 1500, // 静音持续时长（ms）才认为说话结束
  voiceThreshold: 200, // 有声音阈值（RMS），用于检测打断
}
let silenceStartTime = 0 // 静音开始时间
const isSpeaking = ref(false) // 是否正在说话
let lastProcessTime = 0 // 上次处理时间，用于防抖

// 自动带入当前应用的默认音色（若后端配置了 app_voice）
const chatStore = useChatStore()
const authStore = useAuthStore()

// 当前实际使用的 appId（如果 props 没传，则从 chatStore 获取）
const effectiveAppId = ref<number | undefined>(props.appId)

// 确保 effectiveAppId 被正确赋值的辅助函数
function ensureEffectiveAppId() {
  if (effectiveAppId.value) return effectiveAppId.value

  const chatAppId = chatStore.getChatByGroupInfo()?.appId
  if (chatAppId) {
    effectiveAppId.value = chatAppId
    console.log(`[VoiceCall] 从 chatStore 获取到 appId: ${chatAppId}`)
  } else if (props.appId) {
    effectiveAppId.value = props.appId
    console.log(`[VoiceCall] 使用 props 传递的 appId: ${props.appId}`)
  } else {
    console.warn('[VoiceCall] 未找到 appId，将无法加载角色预设')
  }

  return effectiveAppId.value
}

onMounted(async () => {
  try {
    // 确保 appId 被赋值
    ensureEffectiveAppId()

    // 获取默认音色
    if (effectiveAppId.value) {
      const res: any = await fetchQueryOneCatAPI({ id: effectiveAppId.value })
      const vid = res?.data?.voiceId
      if (vid && !voiceId.value) voiceId.value = String(vid)
    }
  } catch (_) {}
})

// Mic 采集
const isRecording = ref(false)
const rec = reactive<{
  ctx: AudioContext | null
  stream: MediaStream | null
  source: MediaStreamAudioSourceNode | null
  processor: ScriptProcessorNode | null
  inputSampleRate: number
}>({ ctx: null, stream: null, source: null, processor: null, inputSampleRate: 48000 })

// TTS 播放（边到边）：使用 MediaSource + SourceBuffer 实时追加 audio/mpeg
const ttsChunks: ArrayBuffer[] = [] // 仅作为退路备用
let audioCtx: AudioContext | null = null
let sourceNode: AudioBufferSourceNode | null = null
let mediaSource: MediaSource | null = null
let sourceBuffer: SourceBuffer | null = null
let audioEl: HTMLAudioElement | null = null
let objectUrl: string | null = null
const pendingAppendQueue: ArrayBuffer[] = []
let ttsStreaming = false
let sentAudioChunkCount = 0

function log(line: string) {
  logs.value.push(line)
  if (logs.value.length > 200) logs.value.shift()
}

function isWSOpen() {
  const ws = wsRef.value
  return !!ws && ws.readyState === WebSocket.OPEN
}

function safeSendJSON(obj: any) {
  try {
    const ws = wsRef.value
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const msg = `WS未就绪，忽略消息: ${obj?.type || 'unknown'}`
      log(msg)
      console.warn(`[VoiceCall] ${msg}`)
      return
    }
    const jsonStr = JSON.stringify(obj)
    console.log(`[VoiceCall] 发送消息: type=${obj?.type}, data=${jsonStr.substring(0, 200)}`)
    ws.send(jsonStr)
  } catch (err) {
    console.error('[VoiceCall] safeSendJSON 错误:', err)
  }
}

function safeSendBinary(buf: ArrayBuffer) {
  try {
    const ws = wsRef.value
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[VoiceCall] WS未就绪，无法发送音频')
      return
    }
    console.log(`[VoiceCall] 发送音频: ${buf.byteLength} bytes`)
    ws.send(buf)
  } catch (err) {
    console.error('[VoiceCall] safeSendBinary 错误:', err)
  }
}

function ensureCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
}

function teardownMSE() {
  try {
    if (audioEl) {
      audioEl.pause()
    }
    if (sourceBuffer) {
      try {
        if ((sourceBuffer as any).updating) {
          /* noop */
        }
      } catch {}
      sourceBuffer = null
    }
    if (mediaSource) {
      try {
        mediaSource.endOfStream()
      } catch {}
      mediaSource = null
    }
    pendingAppendQueue.length = 0
    ttsStreaming = false
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
  } catch {}
}

function startMSEStreaming() {
  teardownMSE()
  mediaSource = new MediaSource()
  objectUrl = URL.createObjectURL(mediaSource)
  if (audioEl) {
    audioEl.src = objectUrl
    audioEl.autoplay = true
  }
  mediaSource.addEventListener('sourceopen', () => {
    try {
      if (!mediaSource || mediaSource.readyState !== 'open') return
      sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')
      sourceBuffer.mode = 'sequence'
      sourceBuffer.addEventListener('updateend', () => {
        if (!sourceBuffer) return
        if (pendingAppendQueue.length > 0 && !sourceBuffer.updating) {
          const next = pendingAppendQueue.shift()!
          try {
            sourceBuffer.appendBuffer(next)
          } catch {}
        }
      })
      ttsStreaming = true
      if (pendingAppendQueue.length > 0) {
        const first = pendingAppendQueue.shift()!
        try {
          sourceBuffer.appendBuffer(first)
        } catch {}
      }
    } catch (e) {
      // MSE 初始化失败时回退到合并播放
      ttsStreaming = false
    }
  })
}

function appendMSEChunk(chunk: ArrayBuffer) {
  if (!mediaSource || !sourceBuffer) {
    pendingAppendQueue.push(chunk)
    return
  }
  try {
    if (!sourceBuffer.updating) sourceBuffer.appendBuffer(chunk)
    else pendingAppendQueue.push(chunk)
  } catch {
    // 失败则丢弃该分片以保证不中断
  }
}

function downsampleBuffer(buffer: Float32Array, inSampleRate: number, outSampleRate: number) {
  if (outSampleRate === inSampleRate) return buffer
  const ratio = inSampleRate / outSampleRate
  const newLen = Math.floor(buffer.length / ratio)
  const result = new Float32Array(newLen)
  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < result.length) {
    result[offsetResult++] = buffer[Math.floor(offsetBuffer)]
    offsetBuffer += ratio
  }
  return result
}

function floatTo16BitPCM(float32Array: Float32Array) {
  const len = float32Array.length
  const result = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    result[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return result
}

function encodeWAV(samples: Int16Array, sr: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i))
  }
  let offset = 0
  writeString(offset, 'RIFF')
  offset += 4
  view.setUint32(offset, 36 + samples.length * 2, true)
  offset += 4
  writeString(offset, 'WAVE')
  offset += 4
  writeString(offset, 'fmt ')
  offset += 4
  view.setUint32(offset, 16, true)
  offset += 4
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint32(offset, sr, true)
  offset += 4
  view.setUint32(offset, sr * 2, true)
  offset += 4
  view.setUint16(offset, 2, true)
  offset += 2
  view.setUint16(offset, 16, true)
  offset += 2
  writeString(offset, 'data')
  offset += 4
  view.setUint32(offset, samples.length * 2, true)
  offset += 4
  for (let i = 0; i < samples.length; i++, offset += 2) view.setInt16(offset, samples[i], true)
  return new Blob([view], { type: 'audio/wav' })
}

async function connectWS() {
  if (wsRef.value || connecting.value) return
  connecting.value = true

  // 在连接前确保 effectiveAppId 已正确获取
  ensureEffectiveAppId()
  console.log(
    `[VoiceCall] connectWS: effectiveAppId=${effectiveAppId.value}, userId=${authStore.userInfo?.id}`
  )

  try {
    // 优化：智能构造 WebSocket 地址
    // 1. 优先使用当前页面的协议和主机
    // 2. 开发环境检测：如果是 localhost/127.0.0.1 且非 HTTPS，尝试连接本地开发服务器
    const isHttps = location.protocol === 'https:'
    const isLocalDev = ['localhost', '127.0.0.1'].includes(location.hostname) && !isHttps

    let url: string
    if (isLocalDev) {
      // 本地开发：尝试多个可能的端口
      url = `ws://${location.hostname}:9520/api/realtime/voice-call`
      log(`本地开发模式，连接到: ${url}`)
    } else if (isHttps) {
      // HTTPS 环境：使用 wss 同源连接
      url = `wss://${location.host}/api/realtime/voice-call`
      log(`HTTPS 环境，连接到: ${url}`)
    } else {
      // HTTP 环境：使用 ws 同源连接
      url = `ws://${location.host}/api/realtime/voice-call`
      log(`HTTP 环境，连接到: ${url}`)
    }

    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'

    // 添加连接超时检测
    const connectTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        log('连接超时，关闭 WebSocket')
        ws.close()
        connecting.value = false
        ms.error('连接超时，请检查网络或服务器状态')
      }
    }, 10000) // 10 秒超时

    const opened = new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        clearTimeout(connectTimeout)
        connected.value = true
        connecting.value = false
        status.value = '已连接'
        log('WS 已连接')
        // 发送开始通话消息，包含角色配置信息（用于情绪识别和星尘API）
        log(
          `准备发送start_call: userId=${authStore.userInfo?.id}, appId=${effectiveAppId.value}, prompt=${props.prompt?.substring(0, 30)}`
        )
        safeSendJSON({
          type: 'start_call',
          sampleRate,
          format,
          voice_id: voiceId.value || '',
          userId: authStore.userInfo?.id, // 添加用户ID用于星尘API
          appId: effectiveAppId.value, // 使用实际获取到的 appId
          model: props.model || 'gpt-4o-mini',
          modelName: props.modelName || 'AI助手',
          prompt: props.prompt || '',
          temperature: props.temperature || 1,
          config: props.config || {},
        })
        log(
          `start_call已发送: userId=${authStore.userInfo?.id}, appId=${effectiveAppId.value}, model=${props.model}`
        )
        resolve()
      }

      ws.onerror = e => {
        clearTimeout(connectTimeout)
        log('WS 连接错误')
        connecting.value = false
        reject(new Error('WebSocket 连接失败'))
      }
    })

    ws.onclose = () => {
      clearTimeout(connectTimeout)
      connected.value = false
      status.value = '未连接'
      wsRef.value = null
      log('WS 已关闭')
      connecting.value = false

      // 如果是非正常关闭，提示用户
      if (isRecording.value) {
        ms.warning('连接已断开，请重新连接')
        stopRec()
      }
    }

    ws.onmessage = async ev => {
      if (typeof ev.data !== 'string') {
        // 二进制 TTS 帧：边到边播放（MSE），失败则缓存
        const buf = ev.data as ArrayBuffer
        if (ttsStreaming) appendMSEChunk(buf)
        else ttsChunks.push(buf)
        return
      }
      try {
        const msg = JSON.parse(ev.data)
        // 打印后端事件便于诊断
        if (msg?.type && typeof msg.type === 'string') log(`[EV] ${msg.type}`)
        if (msg.type === 'asr.partial') log('[ASR] ' + msg.text)
        if (msg.type === 'asr.final') log('[ASR.final] ' + msg.text)
        if (msg.type === 'llm.partial') log('[LLM] ' + msg.text)
        if (msg.type === 'llm.final') log('[LLM.final] ' + msg.text)
        if (msg.type === 'emotion.detected') {
          currentEmotion.value = msg.emotion || ''
          log(`[情绪] 检测到: ${msg.emotion}`)
        }
        if (msg.type === 'tts.start') {
          ttsChunks.length = 0
          log('[TTS] start')
          // 启动 MSE 边播
          startMSEStreaming()
        }
        if (msg.type === 'tts.end') {
          log('[TTS] end')
          // 结束 MSE 流
          try {
            mediaSource && mediaSource.endOfStream()
          } catch {}
          ttsStreaming = false
          // 若 MSE 未启用，退回一次性播放缓存
          if (!audioEl || !audioEl.src) {
            try {
              ensureCtx()
              const blob = new Blob(ttsChunks, { type: 'audio/mpeg' })
              const arr = await blob.arrayBuffer()
              const buf = await audioCtx!.decodeAudioData(arr)
              sourceNode?.stop()
              sourceNode = audioCtx!.createBufferSource()
              sourceNode.buffer = buf
              sourceNode.connect(audioCtx!.destination)
              sourceNode.start()
            } catch (e) {
              console.error(e)
              ms.error('TTS 播放失败')
            }
          }
        }
        if (msg.type === 'probe.resp') {
          log(
            `[PROBE] bytes=${msg.recvBytesTotal} chunks=${msg.recvChunkCount} buffered=${msg.bufferedChunks} lastRms=${msg.lastRms}`
          )
        }
        if (msg.type === 'error') {
          ms.error(`错误: ${msg.stage || ''} ${msg.message || ''}`)
          log(`[ERROR] ${msg.stage || ''}: ${msg.message || ''}`)
        }
      } catch {}
    }
    wsRef.value = ws
    await opened
  } catch (e: any) {
    ms.error(`连接失败: ${e?.message || '未知错误'}`)
    log(`连接失败: ${e?.message || e}`)
    connecting.value = false
  }
}

async function startRec() {
  if (!connected.value) await connectWS()
  if (isRecording.value) return
  try {
    // 打断当前播放并通知后端取消本轮 TTS
    teardownMSE()
    safeSendJSON({ type: 'cancel' })

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    try {
      await ctx.resume()
    } catch {}
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(8192, 1, 1)
    rec.ctx = ctx
    rec.stream = stream
    rec.source = source
    rec.processor = processor
    rec.inputSampleRate = ctx.sampleRate
    sentAudioChunkCount = 0
    silenceStartTime = 0
    lastProcessTime = 0

    processor.onaudioprocess = e => {
      const input = e.inputBuffer.getChannelData(0)
      const ds = downsampleBuffer(input, rec.inputSampleRate, sampleRate)
      const pcm16 = floatTo16BitPCM(ds)

      // 计算音频能量（RMS）
      let sumSq = 0
      for (let i = 0; i < pcm16.length; i++) {
        const v = pcm16[i]
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / Math.max(1, pcm16.length))

      const now = Date.now()

      // VAD: 检测用户是否正在说话
      if (rms > vadConfig.voiceThreshold) {
        // 检测到有声音
        if (!isSpeaking.value) {
          log(`[VAD] 检测到说话开始 (RMS: ${Math.round(rms)})`)
          isSpeaking.value = true

          // 如果当前正在播放TTS，立即打断
          if (ttsStreaming || audioEl?.currentTime) {
            log('[VAD] 检测到打断，停止当前播放')
            teardownMSE()
            safeSendJSON({ type: 'cancel' })
          }
        }
        silenceStartTime = now // 重置静音计时
      } else if (rms < vadConfig.silenceThreshold) {
        // 检测到静音
        if (isSpeaking.value) {
          // 如果之前在说话，现在开始静音
          if (silenceStartTime === 0) {
            silenceStartTime = now
            log(`[VAD] 检测到静音开始 (RMS: ${Math.round(rms)})`)
          } else {
            // 检查静音持续时间
            const silenceDuration = now - silenceStartTime
            if (silenceDuration >= vadConfig.silenceDuration && now - lastProcessTime > 2000) {
              // 静音超过阈值时长，认为说话结束，自动触发处理
              log(`[VAD] 检测到说话结束（静音 ${silenceDuration}ms），自动发送`)
              isSpeaking.value = false
              silenceStartTime = 0
              lastProcessTime = now
              // 发送 stop 信号触发 ASR + LLM + TTS
              safeSendJSON({ type: 'stop' })
            }
          }
        }
      } else {
        // 中等能量，重置静音计时但不改变说话状态
        silenceStartTime = now
      }

      // 只要不是完全静音，就发送音频数据
      if (rms >= 3) {
        safeSendBinary(pcm16.buffer)
        sentAudioChunkCount++
      }
    }
    source.connect(processor)
    processor.connect(ctx.destination)
    isRecording.value = true
    log('开始连续录音（自动检测说话停顿）')
  } catch (e) {
    ms.error('无法访问麦克风')
  }
}

function stopRec() {
  if (!isRecording.value) return
  try {
    rec.processor && rec.processor.disconnect()
    rec.source && rec.source.disconnect()
    rec.ctx && rec.ctx.close()
    rec.stream?.getTracks().forEach(t => t.stop())
  } catch {}
  isRecording.value = false
  isSpeaking.value = false
  silenceStartTime = 0

  console.log(`[VoiceCall] stopRec: 共发送了 ${sentAudioChunkCount} 块音频`)
  log(`已停止录音 (共发送 ${sentAudioChunkCount} 块音频)`)
}

function closePanel() {
  if (isRecording.value) stopRec()
  teardownMSE()
  wsRef.value?.close()
  emit('close')
}

onUnmounted(() => {
  try {
    if (isRecording.value) stopRec()
    wsRef.value?.close()
  } catch {}
})
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
      <!-- 顶部标题栏 -->
      <div class="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
        <div class="flex items-center justify-between text-white">
          <div class="flex items-center space-x-3">
            <div
              class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl"
            >
              🎙️
            </div>
            <div>
              <h3 class="text-lg font-semibold">{{ props.modelName || '语音通话' }}</h3>
              <p class="text-xs opacity-90">{{ status }}</p>
            </div>
          </div>
          <button
            class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
            @click="closePanel"
          >
            ✖
          </button>
        </div>
      </div>

      <!-- 中间内容区 -->
      <div class="p-6 space-y-4">
        <!-- 当前情绪显示 -->
        <div
          v-if="currentEmotion"
          class="bg-primary-50 dark:bg-primary-900/20 rounded-2xl px-4 py-3 text-center"
        >
          <p class="text-sm text-gray-600 dark:text-gray-400">当前情绪</p>
          <p class="text-lg font-semibold text-primary-600 dark:text-primary-400">
            {{ currentEmotion }}
          </p>
        </div>

        <!-- 状态指示 -->
        <div class="flex justify-center items-center py-8">
          <div
            class="relative w-32 h-32 rounded-full flex items-center justify-center"
            :class="[
              isRecording ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700',
            ]"
          >
            <div
              v-if="isRecording"
              class="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
            ></div>
            <span class="text-5xl relative z-10">
              {{ isRecording ? '🎤' : '⏸️' }}
            </span>
          </div>
        </div>

        <!-- 主按钮 -->
        <div class="flex flex-col items-center space-y-3">
          <button
            class="w-full py-4 rounded-2xl font-semibold text-lg transition-all transform active:scale-95"
            :class="[
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50'
                : 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/50',
            ]"
            @click="isRecording ? stopRec() : startRec()"
          >
            {{ isRecording ? '停止录音' : '开始通话' }}
          </button>

          <!-- 说话状态指示 -->
          <div v-if="isRecording" class="text-sm text-gray-600 dark:text-gray-400 text-center">
            <span v-if="isSpeaking" class="text-green-600 dark:text-green-400">● 正在说话...</span>
            <span v-else class="text-gray-500">● 等待说话...</span>
          </div>

          <!-- 辅助按钮 -->
          <div class="flex items-center space-x-2 w-full">
            <button v-if="!connected" class="flex-1 btn-pill py-2" @click="connectWS">
              连接通话
            </button>
            <button
              v-else
              class="flex-1 btn-pill py-2"
              @click="wsRef?.send(JSON.stringify({ type: 'cancel' }))"
            >
              取消当前
            </button>
          </div>
        </div>

        <!-- 音频播放器（隐藏控件） -->
        <div class="hidden">
          <audio ref="(el)=>{audioEl=el as HTMLAudioElement}"></audio>
        </div>

        <!-- 调试日志（可折叠） -->
        <details class="mt-4">
          <summary
            class="text-sm text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
          >
            调试日志 ({{ logs.length }})
          </summary>
          <div
            class="mt-2 h-40 overflow-auto text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg font-mono"
          >
            <div v-for="(l, i) in logs" :key="i" class="py-0.5">{{ l }}</div>
          </div>
        </details>

        <!-- 高级设置（可折叠） -->
        <details>
          <summary
            class="text-sm text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
          >
            高级设置
          </summary>
          <div class="mt-2 space-y-2">
            <div class="flex items-center space-x-2">
              <label class="text-sm text-gray-600 dark:text-gray-400">音色 ID：</label>
              <input
                v-model="voiceId"
                placeholder="自动选择"
                class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
              />
            </div>
            <button
              class="btn-pill text-xs w-full"
              @click="wsRef?.send(JSON.stringify({ type: 'probe' }))"
            >
              发送诊断信息
            </button>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>
