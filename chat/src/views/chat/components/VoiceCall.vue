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
const sampleRate = 16000
const format: 'wav' = 'wav'

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

// TTS 播放缓存
const ttsChunks: ArrayBuffer[] = []
let audioCtx: AudioContext | null = null
let sourceNode: AudioBufferSourceNode | null = null

function log(line: string) {
  logs.value.push(line)
  if (logs.value.length > 200) logs.value.shift()
}

function ensureCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
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
    const url =
      (location.protocol === 'https:' ? 'wss://' : 'ws://') +
      location.host +
      '/api/realtime/voice-call'
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      connected.value = true
      connecting.value = false
      status.value = '已连接'
      log('WS 已连接')
      ws.send(JSON.stringify({ type: 'start', sampleRate, format, voice_id: voiceId.value || '' }))
    }
    ws.onclose = () => {
      connected.value = false
      status.value = '未连接'
      wsRef.value = null
      log('WS 已关闭')
    }
    ws.onerror = e => {
      log('WS 错误')
    }
    ws.onmessage = async ev => {
      if (typeof ev.data !== 'string') {
        // 二进制 TTS 帧：缓存，待结束后统一播放
        ttsChunks.push(ev.data as ArrayBuffer)
        return
      }
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'asr.partial') log('[ASR] ' + msg.text)
        if (msg.type === 'asr.final') log('[ASR.final] ' + msg.text)
        if (msg.type === 'llm.partial') log('[LLM] ' + msg.text)
        if (msg.type === 'llm.final') log('[LLM.final] ' + msg.text)
        if (msg.type === 'tts.start') {
          ttsChunks.length = 0
          log('[TTS] start')
        }
        if (msg.type === 'tts.end') {
          log('[TTS] end, 准备播放')
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
        if (msg.type === 'error') {
          ms.error(`错误: ${msg.stage || ''} ${msg.message || ''}`)
        }
      } catch {}
    }
    wsRef.value = ws
  } catch (e) {
    ms.error('连接失败')
    connecting.value = false
  }
}

async function startRec() {
  if (!connected.value) await connectWS()
  if (isRecording.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    rec.ctx = ctx
    rec.stream = stream
    rec.source = source
    rec.processor = processor
    rec.inputSampleRate = ctx.sampleRate
    processor.onaudioprocess = e => {
      const input = e.inputBuffer.getChannelData(0)
      const ds = downsampleBuffer(input, rec.inputSampleRate, sampleRate)
      const pcm16 = floatTo16BitPCM(ds)
      const wavBlob = encodeWAV(pcm16, sampleRate)
      wavBlob
        .arrayBuffer()
        .then(buf => wsRef.value?.send(buf))
        .catch(() => {})
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
  wsRef.value?.send(JSON.stringify({ type: 'stop' }))
  log('已停止并提交本轮音频')
}

function closePanel() {
  if (isRecording.value) stopRec()
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
        </div>

        <div class="h-40 overflow-auto text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
          <div v-for="(l, i) in logs" :key="i">{{ l }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
