<template>
  <div class="touch-layout">
    <!-- 背景层 - 支持图片/GIF/MP4 -->
    <div class="background-layer">
      <video
        v-if="isVideoBackground"
        :src="backgroundUrl"
        class="bg-media"
        autoplay
        loop
        muted
        playsinline
      />
      <img
        v-else
        :src="backgroundUrl || defaultBgUrl"
        class="bg-media"
        alt="背景"
      />
    </div>

    <!-- 顶部导航栏 - 仅已绑定状态显示 -->
    <div class="navbar" v-if="isBind">
      <div class="nav-left">
        <span class="brand">猫饼AI</span>
        <span class="divider">|</span>
        <span class="sub-brand">虚拟互动</span>
      </div>
      <div class="nav-right">
        <button class="change-bg-btn" @click="showBgModal = true">更换背景</button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*,video/mp4"
          class="hidden-input"
          @change="handleFileChange"
        />
      </div>
    </div>

    <!-- 隐藏的文件上传input（用于未绑定状态的弹窗） -->
    <input
      v-if="!isBind"
      ref="fileInputRef"
      type="file"
      accept="image/*,video/mp4"
      class="hidden-input"
      @change="handleFileChange"
    />

    <!-- 更换背景弹窗 -->
    <div class="bg-modal-overlay" v-if="showBgModal" @click.self="showBgModal = false">
      <div class="bg-modal">
        <div class="bg-modal-header">
          <span>更换背景</span>
          <button class="close-btn" @click="showBgModal = false">×</button>
        </div>
        <div class="bg-modal-body">
          <!-- 输入链接 -->
          <div class="input-section">
            <label>输入链接</label>
            <input
              v-model="bgLinkInput"
              type="text"
              placeholder="输入图片/GIF/视频链接"
              class="link-input"
            />
            <button class="confirm-link-btn" @click="handleLinkSubmit" :disabled="!bgLinkInput.trim()">
              确认
            </button>
          </div>
          <div class="divider-line">
            <span>或</span>
          </div>
          <!-- 上传文件 -->
          <div class="upload-section">
            <button class="upload-btn" @click="triggerFileUpload">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
              </svg>
              <span>上传本地文件</span>
            </button>
            <p class="upload-tip">支持 JPG、PNG、GIF、MP4 格式</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 未绑定状态 -->
    <template v-if="!isBind">
      <div class="content-wrapper">
        <!-- Logo图片 -->
        <img :src="logoFullImg" class="logo-full" alt="猫饼AI" />

        <!-- 未绑定内容 -->
        <div class="unbind-content">
          <div class="unbind-tips">绑定后，即可通过触碰手机召唤指定角色</div>
          <img :src="noBindImg" class="no-bind-img" alt="未绑定" />
          <div class="unbind-text">暂未绑定角色</div>
        </div>
      </div>

      <!-- 底部绑定按钮 -->
      <button class="bind-btn" @click="goToBind">
        打开猫饼小程序，绑定猫饼手环
      </button>
    </template>

    <!-- 已绑定状态 -->
    <template v-else>
      <!-- 对话气泡 -->
      <div class="chat-bubble" v-if="pageData.desAiText">
        <p class="bubble-text">{{ pageData.desAiText }}</p>
      </div>

      <!-- 角色信息区域 -->
      <div class="role-info">
        <div class="role-name">{{ pageData.name || '' }}</div>
        <!-- 音频播放器 -->
        <div class="audio-player" v-if="audioUrl">
          <div class="play-btn" @click="playVoice">
            <div class="play-icon" v-if="!playing">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <div class="wave-animation" v-else>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
            </div>
          </div>
          <div class="waveform">
            <div class="waveform-bars">
              <span v-for="i in 20" :key="i" class="bar" :style="{ height: getWaveHeight(i) + 'px' }"></span>
            </div>
          </div>
          <div class="duration">{{ voiceDuration }}″</div>
        </div>
      </div>

      <!-- 底部按钮 - 仅已绑定状态显示 -->
      <button class="enter-btn" @click="closePopup">
        <span>点击进入猫饼 继续聊天</span>
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { fetchDeviceRolesHtml, fetchTouchChatProcess, saveDeviceBackground, getDeviceBackground, uploadFileOpen } from '@/api'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isBind = ref(false)
const pageData = ref<any>({})
const aiText = ref('')
const playing = ref(false)
const audioContext = ref<HTMLAudioElement | null>(null)
const audioUrl = ref('')
const voiceDuration = ref(15)

const braceletId = ref((route.query.id as string) || '8676')

// 背景相关
const fileInputRef = ref<HTMLInputElement | null>(null)
const backgroundUrl = ref('')
const backgroundType = ref<'image' | 'gif' | 'video'>('image')
const defaultBgUrl = '/page-bg.png'
const showBgModal = ref(false)
const bgLinkInput = ref('')

const imgPath = 'https://maobingai.oss-cn-shanghai.aliyuncs.com/mini_program/'
const noBindImg = imgPath + 'mb_xcx004@2x.png'
const logoFullImg = imgPath + 'mb_xcx003@2x.png'

// 计算是否是视频背景
const isVideoBackground = computed(() => {
  return backgroundType.value === 'video'
})

// 生成波形高度
const getWaveHeight = (index: number) => {
  const heights = [8, 16, 24, 12, 20, 28, 14, 22, 10, 18, 26, 16, 24, 12, 20, 28, 14, 22, 10, 18]
  return heights[(index - 1) % heights.length]
}

// 触发文件上传
const triggerFileUpload = () => {
  fileInputRef.value?.click()
  showBgModal.value = false
}

// 根据URL判断背景类型
const getBackgroundTypeFromUrl = (url: string): 'image' | 'gif' | 'video' => {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.mov')) {
    return 'video'
  }
  if (lowerUrl.endsWith('.gif')) {
    return 'gif'
  }
  return 'image'
}

// 处理链接输入提交
const handleLinkSubmit = async () => {
  const url = bgLinkInput.value.trim()
  if (!url) return

  // 简单验证URL格式
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    alert('请输入有效的链接地址（以 http:// 或 https:// 开头）')
    return
  }

  const bgType = getBackgroundTypeFromUrl(url)

  // 先显示预览
  backgroundUrl.value = url
  backgroundType.value = bgType

  try {
    // 保存到数据库
    await saveDeviceBackground({
      braceletId: braceletId.value,
      backgroundUrl: url,
      backgroundType: bgType,
    })
    console.log('背景链接已保存到数据库:', url, '类型:', bgType)

    // 关闭弹窗并清空输入
    showBgModal.value = false
    bgLinkInput.value = ''
  } catch (error) {
    console.error('保存背景链接失败:', error)
    alert('保存失败，请重试')
  }
}

// 获取文件的背景类型
const getBackgroundType = (file: File): 'image' | 'gif' | 'video' => {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'image/gif') return 'gif'
  return 'image'
}

// 处理文件上传
const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    alert('请上传图片或MP4视频文件')
    return
  }

  const bgType = getBackgroundType(file)

  // 先显示本地预览
  const localUrl = URL.createObjectURL(file)
  backgroundUrl.value = localUrl
  backgroundType.value = bgType

  try {
    // 上传到 OSS
    const uploadResult: any = await uploadFileOpen(file, '0', 'chat/background')
    if (uploadResult.success && uploadResult.data) {
      const ossUrl = uploadResult.data
      backgroundUrl.value = ossUrl

      // 保存到数据库
      await saveDeviceBackground({
        braceletId: braceletId.value,
        backgroundUrl: ossUrl,
        backgroundType: bgType,
        originalName: file.name,
      })
      console.log('背景已保存到数据库:', ossUrl, '类型:', bgType)
    } else {
      console.error('上传失败:', uploadResult.message)
      alert('背景上传失败，请重试')
    }
  } catch (error) {
    console.error('上传或保存失败:', error)
    alert('背景保存失败，请重试')
  }

  // 清除 input 以支持重复选择同一文件
  target.value = ''
}

// 从数据库加载背景
const loadBackgroundFromDatabase = async () => {
  if (!braceletId.value) return

  try {
    const result: any = await getDeviceBackground(braceletId.value)
    if (result.success && result.data) {
      backgroundUrl.value = result.data.backgroundUrl
      backgroundType.value = result.data.backgroundType || 'image'
      console.log('已从数据库加载背景:', result.data.backgroundUrl)
    }
  } catch (error) {
    console.error('加载背景失败:', error)
  }
}

const closePopup = () => {
  if (pageData.value.wechat_config?.openlink) {
    window.location.href = pageData.value.wechat_config.openlink
  } else {
    alert('跳转地址无效')
  }
}

// 跳转到绑定角色页面（打开猫饼小程序）
const goToBind = () => {
  // 如果有返回的跳转链接（wechat openlink），优先使用
  if (pageData.value.wechat_config?.openlink) {
    window.location.href = pageData.value.wechat_config.openlink
    return
  }

  // 默认跳转到猫饼小程序绑定页面
  // 微信环境下使用 URL Scheme 打开小程序
  const isWechat = /MicroMessenger/i.test(navigator.userAgent)
  if (isWechat) {
    // 微信内直接跳转小程序（需要配置正确的路径）
    wx?.miniProgram?.navigateTo?.({
      url: `/pages/bind/index?bracelet_id=${braceletId.value}`
    })
  } else {
    // 非微信环境，使用 URL Scheme
    window.location.href = `weixin://dl/business/?appid=wxe4f5f5f5f5f5f5f5&path=pages/bind/index&query=bracelet_id=${braceletId.value}`
  }
}

const playVoice = () => {
  if (!audioUrl.value) {
    alert('语音正在生成，请稍后重试')
    return
  }

  if (playing.value) {
    stopAudio()
  } else {
    startAudio()
  }
}

const startAudio = () => {
  if (audioContext.value) {
    audioContext.value.pause()
  }

  audioContext.value = new Audio(audioUrl.value)
  playing.value = true

  audioContext.value.onplay = () => {
    console.log('音频开始播放')
  }

  audioContext.value.onended = () => {
    console.log('音频播放结束')
    playing.value = false
    audioContext.value = null
  }

  audioContext.value.onerror = error => {
    console.error('音频播放错误', error)
    playing.value = false
    alert('播放失败')
    if (audioContext.value) {
      audioContext.value = null
    }
  }

  audioContext.value.play()
}

const stopAudio = () => {
  if (audioContext.value) {
    audioContext.value.pause()
    audioContext.value = null
  }
  playing.value = false
}

const animationText = (text: string) => {
  const totalAnswerStr = text
  let currentAnswerStr = ''
  streamTextAsync(totalAnswerStr, (char: string) => {
    currentAnswerStr += char
    pageData.value.desAiText = currentAnswerStr
  })
}

const streamTextAsync = async (text: string, callback: Function, interval: number = 150) => {
  for (const char of text) {
    callback(char)
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}

const fetchChatSuggestion = () => {
  // 格式化备忘录列表（只保留未过期的）
  let calendarList = ''
  if (pageData.value.calendar && pageData.value.calendar.length > 0) {
    const now = new Date()
    const futureItems = pageData.value.calendar.filter((item: any) => {
      // 构建备忘录时间
      const year = item.schedule_year || now.getFullYear()
      const month = (item.schedule_month || 1) - 1 // 月份从0开始
      const day = item.schedule_day || 1
      const hour = item.schedule_hour ?? 0
      const minute = item.schedule_minute ?? 0
      const itemDate = new Date(year, month, day, hour, minute)
      // 只保留未来的备忘录
      return itemDate >= now
    })

    if (futureItems.length > 0) {
      const items = futureItems
        .map((item: any, index: number) => {
          // 格式化时间：年月日 时:分
          const year = item.schedule_year || ''
          const month = item.schedule_month || ''
          const day = item.schedule_day || ''
          const hour = String(item.schedule_hour ?? '').padStart(2, '0')
          const minute = String(item.schedule_minute ?? '').padStart(2, '0')
          const time = year ? `${year}年${month}月${day}日 ${hour}:${minute}` : ''
          const event = item.description || ''
          return `${index + 1}.时间：${time}，事件：${event}`
        })
        .join('\n')
      calendarList = items
    }
  }

  return fetchTouchChatProcess({
    prompt: `备忘录列表：\n${calendarList}`,
    appId: Number(pageData.value.id),
    userId: Number(pageData.value.userId),
    options: {
      skipSaveToDatabase: true,
    },
    isCalendarMessage: true,
  })
    .then((res: any) => {
      // 返回格式: { success, data: [{ text, audioUrl, voiceDuration, emotion, chatId }], meta }
      const dataArray = res?.data?.data || res?.data || []
      const firstItem = Array.isArray(dataArray) ? dataArray[0] : dataArray

      const text = firstItem?.text
      if (text) {
        aiText.value = text
        pageData.value = { ...pageData.value, desAiText: '' }
        animationText(text)

        // 直接从返回数据获取语音URL
        const ttsUrl = firstItem?.audioUrl
        if (ttsUrl) {
          audioUrl.value = ttsUrl
          voiceDuration.value = firstItem?.voiceDuration || 15
          console.log('备忘录消息语音URL:', ttsUrl)
        } else {
          audioUrl.value = ''
          console.log('返回数据无语音URL')
        }
      } else {
        audioUrl.value = ''
      }
    })
    .catch(error => {
      console.error('fetchChatSuggestion error', error)
    })
}

const initPage = async () => {
  // 从数据库加载保存的背景
  await loadBackgroundFromDatabase()

  if (!braceletId.value) {
    pageData.value = {}
    isBind.value = false
    return
  }

  fetchDeviceRolesHtml({
    bracelet_id: braceletId.value,
  })
    .then((res: any) => {
      if (res.data && res.data.id) {
        pageData.value = {
          ...res.data,
          desAiText: '',
        }
        isBind.value = true
        fetchChatSuggestion().catch(err => {
          console.error('fetchChatSuggestion catch', err)
        })
      } else {
        pageData.value = res.data || {}
        isBind.value = false
      }
    })
    .catch(err => {
      pageData.value = {}
      isBind.value = false
    })
}

onMounted(() => {
  initPage()
})

onUnmounted(() => {
  stopAudio()
  // 清理 blob URL
  if (backgroundUrl.value && backgroundUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(backgroundUrl.value)
  }
})
</script>

<style lang="scss" scoped>
.touch-layout {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

// 背景层
.background-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;

  .bg-media {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

// 顶部导航
.navbar {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  padding-top: calc(16px + env(safe-area-inset-top, 0px));

  .nav-left {
    display: flex;
    align-items: center;

    .brand {
      font-size: 18px;
      font-weight: bold;
      color: #e8a5a5;
    }

    .divider {
      margin: 0 8px;
      color: #e8a5a5;
      opacity: 0.8;
    }

    .sub-brand {
      font-size: 16px;
      color: #e88b8b;
      font-weight: 500;
    }
  }

  .nav-right {
    .change-bg-btn {
      padding: 8px 16px;
      background: rgba(232, 165, 165, 0.1);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid #e8a5a5;
      border-radius: 20px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(232, 165, 165, 0.2);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .hidden-input {
      display: none;
    }
  }
}

// 未绑定状态 - 内容包装器
.content-wrapper {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 345px;
  margin: 0 auto;
  padding-top: 60px;
}

// Logo完整图片
.logo-full {
  width: 100%;
  max-width: 360px;
  height: auto;
  object-fit: contain;
}

// 未绑定内容
.unbind-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #333;
  text-align: center;
  margin-top: 20px;

  .unbind-tips {
    font-size: 14px;
    font-weight: 500;
    color: #666;
    margin-bottom: 80px;
  }

  .no-bind-img {
    width: 120px;
    height: 120px;
    margin-bottom: 20px;
  }

  .unbind-text {
    font-size: 14px;
    font-weight: 500;
    color: #666;
  }
}

// 底部绑定按钮
.bind-btn,
.enter-btn {
  position: fixed;
  bottom: 38px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 50px);
  max-width: 345px;
  padding: 18px 24px;
  background: linear-gradient(180deg, #f0c4c4 0%, #e8b4b4 50%, #daa8a8 100%);
  border: none;
  border-radius: 50px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow:
    0 4px 8px rgba(200, 150, 150, 0.3),
    0 2px 4px rgba(200, 150, 150, 0.2),
    inset 0 1px 1px rgba(255, 255, 255, 0.3),
    inset 0 -1px 1px rgba(0, 0, 0, 0.05);

  &:hover {
    transform: translateX(-50%) scale(1.02);
  }

  &:active {
    transform: translateX(-50%) scale(0.98);
    box-shadow:
      0 2px 4px rgba(200, 150, 150, 0.3),
      inset 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  svg {
    flex-shrink: 0;
  }
}

// 对话气泡
.chat-bubble {
  position: absolute;
  left: 20px;
  top: 38%;
  z-index: 10;
  max-width: 75%;
  padding: 20px 24px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(232, 165, 165, 0.5);

  // 气泡三角形
  &::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 24px;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid rgba(232, 165, 165, 0.5);
  }

  .bubble-text {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.8;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
}

// 角色信息区域
.role-info {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 58%;
  z-index: 10;

  .role-name {
    font-size: 32px;
    font-weight: bold;
    color: #fff;
    margin-bottom: 16px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .audio-player {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 30px;
    border: 1px solid rgba(255, 255, 255, 0.2);

    .play-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(217, 168, 166, 0.9);
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
      }

      .play-icon {
        color: #fff;
        padding-left: 3px;
      }

      .wave-animation {
        display: flex;
        align-items: center;
        gap: 2px;

        .wave-bar {
          width: 3px;
          height: 12px;
          background: #fff;
          border-radius: 2px;
          animation: wave-anim 0.8s ease-in-out infinite;

          &:nth-child(1) { animation-delay: 0s; }
          &:nth-child(2) { animation-delay: 0.1s; }
          &:nth-child(3) { animation-delay: 0.2s; }
          &:nth-child(4) { animation-delay: 0.3s; }
          &:nth-child(5) { animation-delay: 0.4s; }
        }
      }
    }

    .waveform {
      flex: 1;
      min-width: 180px;

      .waveform-bars {
        display: flex;
        align-items: center;
        gap: 4px;
        height: 30px;

        .bar {
          width: 3px;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 2px;
          transition: height 0.2s ease;
        }
      }
    }

    .duration {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      min-width: 35px;
      text-align: right;
    }
  }
}

// 波浪动画
@keyframes wave-anim {
  0%, 100% {
    height: 4px;
  }
  50% {
    height: 14px;
  }
}

// 更换背景弹窗
.bg-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.bg-modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 360px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);

  .bg-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;

    span {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .close-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: #f5f5f5;
      border-radius: 50%;
      font-size: 20px;
      color: #666;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;

      &:hover {
        background: #eee;
        color: #333;
      }
    }
  }

  .bg-modal-body {
    padding: 20px;
  }

  .input-section {
    label {
      display: block;
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }

    .link-input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;

      &:focus {
        border-color: #d9a8a6;
      }

      &::placeholder {
        color: #bbb;
      }
    }

    .confirm-link-btn {
      width: 100%;
      margin-top: 12px;
      padding: 12px;
      background: linear-gradient(135deg, #fbd5d3 0%, #d9a8a6 100%);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(217, 168, 166, 0.4);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }

  .divider-line {
    display: flex;
    align-items: center;
    margin: 20px 0;

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #eee;
    }

    span {
      padding: 0 12px;
      color: #999;
      font-size: 13px;
    }
  }

  .upload-section {
    text-align: center;

    .upload-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 28px;
      background: #f8f8f8;
      border: 2px dashed #ddd;
      border-radius: 12px;
      color: #666;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.3s ease;
      width: 100%;

      &:hover {
        border-color: #d9a8a6;
        background: #fef7f7;
        color: #d9a8a6;
      }

      svg {
        flex-shrink: 0;
      }
    }

    .upload-tip {
      margin-top: 10px;
      font-size: 12px;
      color: #999;
    }
  }
}

// 安全区域适配
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .enter-btn,
  .bind-btn {
    bottom: calc(50px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
