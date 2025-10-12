<script setup lang="ts">
import { fetchQueryOneCatAPI } from '@/api/appStore'
import { useChatStore } from '@/store'
import { message } from '@/utils/message'
import { onMounted, onUnmounted, reactive, ref } from 'vue'

// 简易“按住说话”语音通话组件（不改动原有语音上传按钮）
// - 连接后端 WS: /api/realtime/voice-call
// - start → 发送音频帧 → stop → 服务端 ASR→LLM→TTS，期间流式返回事件
// - 先将 TTS 二进制帧缓存，结束后一次性播放（后续可升级为真正流式播放）

const emit = defineEmits<{ (e: 'close'): void }>()
const ms = message()

const connected = ref(false)
const connecting = ref(false)
const wsRef = ref<WebSocket | null>(null)
const status = ref('未连接')
const logs = ref<string[]>([])

// 语音参数
const voiceId = ref('') // 可手填，留空则只展示 ASR/LLM，不播报
const sampleRate = 8000
const format: 'pcm' = 'pcm'

// 自动带入当前应用的默认音色（若后端配置了 app_voice）
const chatStore = useChatStore()
onMounted(async () => {
  try {
    const appId = chatStore.getChatByGroupInfo()?.appId
    if (appId) {
      const res: any = await fetchQueryOneCatAPI({ id: appId })
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
      log(`WS未就绪，忽略消息: ${obj?.type || 'unknown'}`)
      return
    }
    ws.send(JSON.stringify(obj))
  } catch {}
}

function safeSendBinary(buf: ArrayBuffer) {
  try {
    const ws = wsRef.value
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(buf)
  } catch {}
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
        safeSendJSON({ type: 'start', sampleRate, format, voice_id: voiceId.value || '' })
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
    processor.onaudioprocess = e => {
      const input = e.inputBuffer.getChannelData(0)
      const ds = downsampleBuffer(input, rec.inputSampleRate, sampleRate)
      const pcm16 = floatTo16BitPCM(ds)

      // 优化：简化VAD逻辑，只过滤完全静音的音频
      let sumSq = 0
      for (let i = 0; i < pcm16.length; i++) {
        const v = pcm16[i]
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / Math.max(1, pcm16.length))

      // 只过滤完全静音（rms < 3），其他全部发送
      if (rms < 3) {
        // 仍发送一些静音帧以保持连接活跃
        // 可选：每10帧发送一次静音帧
        // 这里简化处理：直接跳过
        return
      }

      safeSendBinary(pcm16.buffer)
      sentAudioChunkCount++
    }
    source.connect(processor)
    processor.connect(ctx.destination)
    isRecording.value = true
    log('开始录音')
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

  // 优化：总是发送 stop 信号，移除补帧逻辑
  // 后端会处理空音频的情况
  safeSendJSON({ type: 'stop' })
  log(`已停止并提交本轮音频 (发送了 ${sentAudioChunkCount} 块音频)`)
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
  <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-4 shadow-xl">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-lg font-semibold">语音通话（按住说话）</h3>
        <button class="btn-pill" @click="closePanel">✖</button>
      </div>

      <div class="space-y-3">
        <div class="flex items-center space-x-2">
          <label class="text-sm text-gray-500">音色 voice_id：</label>
          <input
            v-model="voiceId"
            placeholder="留空仅文字，不播报"
            class="flex-1 px-2 py-1 rounded border border-gray-300 dark:bg-gray-700"
          />
        </div>

        <div class="text-xs text-gray-500">状态：{{ status }}</div>

        <div class="flex items-center space-x-2">
          <button
            class="btn-pill"
            :class="[isRecording ? 'btn-pill-active' : '']"
            @mousedown.prevent="startRec"
            @mouseup.prevent="stopRec"
            @mouseleave.prevent="stopRec"
            @touchstart.prevent="startRec"
            @touchend.prevent="stopRec"
          >
            按住说话
          </button>
          <button
            class="btn-pill"
            @click="connected ? wsRef?.send(JSON.stringify({ type: 'cancel' })) : connectWS()"
          >
            {{ connected ? '取消当前轮次' : '连接通话' }}
          </button>
          <button
            class="btn-pill"
            @click="
              () => {
                if (!connected) return
                isRecording ? stopRec() : startRec()
              }
            "
          >
            连续通话
          </button>
          <button class="btn-pill" @click="wsRef?.send(JSON.stringify({ type: 'probe' }))">
            诊断
          </button>
        </div>

        <div class="h-40 overflow-auto text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
          <div v-for="(l, i) in logs" :key="i">{{ l }}</div>
        </div>

        <div class="mt-2">
          <audio ref="(el)=>{audioEl=el as HTMLAudioElement}" controls class="w-full"></audio>
        </div>
      </div>
    </div>
  </div>
</template>
