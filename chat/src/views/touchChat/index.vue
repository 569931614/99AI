<template>
  <div class="touch-layout">
    <!-- 上传中提示遮罩 -->
    <div class="upload-overlay" v-if="isSavingBg">
      <div class="upload-loading-box">
        <div class="upload-spinner"></div>
        <p>上传中...</p>
      </div>
    </div>

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
      <img v-else :src="backgroundUrl || defaultBgUrl" class="bg-media" alt="背景" />
    </div>

    <!-- 顶部导航栏 - 仅已绑定状态显示 -->
    <div class="navbar" v-if="isBind">
      <div class="nav-left">
        <img
          src="https://maobingai.oss-cn-shanghai.aliyuncs.com/mini_program/H5logo.png"
          class="nav-logo"
          alt="猫饼AI"
        />
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
            <button
              class="confirm-link-btn"
              @click="handleLinkSubmit"
              :disabled="!bgLinkInput.trim() || isSavingBg"
            >
              {{ isSavingBg ? '保存中...' : '确认' }}
            </button>
          </div>
          <div class="divider-line">
            <span>或</span>
          </div>
          <!-- 上传文件 -->
          <div class="upload-section">
            <button class="upload-btn" @click="triggerFileUpload" :disabled="isSavingBg">
              <svg
                v-if="!isSavingBg"
                viewBox="0 0 24 24"
                fill="currentColor"
                width="20"
                height="20"
              >
                <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
              </svg>
              <div v-else class="upload-loading"></div>
              <span>{{ isSavingBg ? '上传中...' : '上传本地文件' }}</span>
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
      <button class="bind-btn" @click="goToBind">打开猫饼小程序，绑定猫饼手环</button>
    </template>

    <!-- 已绑定状态 -->
    <template v-else>
      <!-- 加载提示 -->
      <div class="chat-bubble loading-bubble" v-if="isLoading">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p class="loading-text">{{ loadingText }}</p>
        </div>
      </div>

      <!-- 对话气泡 -->
      <div class="chat-bubble" v-else-if="pageData.desAiText">
        <p class="bubble-text">{{ pageData.desAiText }}</p>
      </div>

      <!-- 角色信息区域 -->
      <div class="role-info">
        <div class="role-name">{{ pageData.name || '' }}</div>
      </div>

      <!-- 底部语音组件 - 靠左 -->
      <div class="audio-player-mini" v-if="audioUrl" @click="playVoice">
        <div class="play-btn-mini">
          <div class="play-icon" v-if="!playing">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div class="wave-animation-mini" v-else>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
          </div>
        </div>
        <!-- 波浪纹 -->
        <div class="waveform-mini">
          <span
            v-for="i in 18"
            :key="i"
            class="bar"
            :style="{ height: getWaveHeight(i) + 'px' }"
          ></span>
        </div>
        <div class="duration-mini">{{ voiceDuration }}″</div>
      </div>

      <!-- 继续聊天按钮 - 靠右 -->
      <button class="enter-btn-inline" @click="closePopup">
        <span>继续聊天</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  fetchDeviceRolesHtml,
  fetchTouchChatProcess,
  saveDeviceBackground,
  getDeviceBackground,
  uploadFileOpen,
} from '@/api'
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

// 加载状态
const isLoading = ref(false)
const loadingText = ref('正在输入中...')

const braceletId = ref((route.query.id as string) || '8676')

// 背景相关
const fileInputRef = ref<HTMLInputElement | null>(null)
const backgroundUrl = ref('')
const backgroundType = ref<'image' | 'gif' | 'video'>('image')
const defaultBgUrl = '/page-bg.png'
const showBgModal = ref(false)
const bgLinkInput = ref('')
const isSavingBg = ref(false) // 背景保存中状态

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

  // 防止重复点击
  if (isSavingBg.value) return

  // 简单验证URL格式
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    alert('请输入有效的链接地址（以 http:// 或 https:// 开头）')
    return
  }

  const bgType = getBackgroundTypeFromUrl(url)

  isSavingBg.value = true

  // 先验证链接是否可访问
  try {
    if (bgType === 'video') {
      // 视频链接验证
      const video = document.createElement('video')
      video.preload = 'metadata'
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve
        video.onerror = () => reject(new Error('视频链接无效'))
        video.src = url
        setTimeout(() => reject(new Error('视频加载超时')), 10000)
      })
    } else {
      // 图片链接验证
      await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = () => reject(new Error('图片链接无效'))
        img.src = url
        setTimeout(() => reject(new Error('图片加载超时')), 10000)
      })
    }
  } catch (error: any) {
    isSavingBg.value = false
    alert(error.message || '链接无法访问，请检查后重试')
    return
  }

  // 先显示预览
  backgroundUrl.value = url
  backgroundType.value = bgType

  // 保存到数据库（带重试）
  let retryCount = 0
  const maxRetries = 3

  while (retryCount < maxRetries) {
    try {
      await saveDeviceBackground({
        braceletId: braceletId.value,
        backgroundUrl: url,
        backgroundType: bgType,
      })
      console.log('背景链接已保存到数据库:', url, '类型:', bgType)

      // 成功后关闭弹窗并清空输入
      showBgModal.value = false
      bgLinkInput.value = ''
      isSavingBg.value = false
      return
    } catch (error) {
      retryCount++
      console.error(`保存背景链接失败(第${retryCount}次):`, error)
      if (retryCount < maxRetries) {
        await new Promise(r => setTimeout(r, 1000)) // 等待1秒后重试
      }
    }
  }

  isSavingBg.value = false
  alert('保存失败，请稍后重试')
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

  // 防止重复上传
  if (isSavingBg.value) {
    target.value = ''
    return
  }

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    alert('请上传图片或MP4视频文件')
    target.value = ''
    return
  }

  // 文件大小限制（统一20MB）
  const maxSize = 20 * 1024 * 1024
  if (file.size > maxSize) {
    alert('文件不能超过20MB')
    target.value = ''
    return
  }

  const bgType = getBackgroundType(file)
  isSavingBg.value = true

  // 先显示本地预览
  const localUrl = URL.createObjectURL(file)
  backgroundUrl.value = localUrl
  backgroundType.value = bgType

  // 上传到 OSS（带重试）
  let ossUrl = ''
  let uploadRetry = 0
  const maxUploadRetries = 3

  while (uploadRetry < maxUploadRetries) {
    try {
      const uploadResult: any = await uploadFileOpen(file, '0', 'chat/background')
      if (uploadResult.success && uploadResult.data) {
        ossUrl = uploadResult.data
        break
      } else {
        throw new Error(uploadResult.message || '上传失败')
      }
    } catch (error: any) {
      uploadRetry++
      console.error(`上传失败(第${uploadRetry}次):`, error)
      if (uploadRetry < maxUploadRetries) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }

  if (!ossUrl) {
    isSavingBg.value = false
    URL.revokeObjectURL(localUrl)
    alert('文件上传失败，请重试')
    target.value = ''
    return
  }

  // 更新为 OSS URL
  backgroundUrl.value = ossUrl
  URL.revokeObjectURL(localUrl)

  // 保存到数据库（带重试）
  let saveRetry = 0
  const maxSaveRetries = 3

  while (saveRetry < maxSaveRetries) {
    try {
      await saveDeviceBackground({
        braceletId: braceletId.value,
        backgroundUrl: ossUrl,
        backgroundType: bgType,
        originalName: file.name,
      })
      console.log('背景已保存到数据库:', ossUrl, '类型:', bgType)
      isSavingBg.value = false
      target.value = ''
      return
    } catch (error) {
      saveRetry++
      console.error(`保存数据库失败(第${saveRetry}次):`, error)
      if (saveRetry < maxSaveRetries) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }

  isSavingBg.value = false
  target.value = ''
  alert('保存失败，请重试')
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
      url: `/pages/bind/index?bracelet_id=${braceletId.value}`,
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
    audioContext.value = null
  }

  if (!audioUrl.value) {
    console.warn('audioUrl 为空，无法播放')
    return
  }

  console.log('创建音频对象:', audioUrl.value)
  const audio = new Audio()
  audioContext.value = audio

  // 设置音频属性
  audio.preload = 'auto'
  // audio.crossOrigin = 'anonymous' // 移除避免CORS问题

  audio.onloadedmetadata = () => {
    console.log('音频元数据加载完成, 时长:', audio.duration)
  }

  audio.oncanplay = () => {
    console.log('音频可以播放了')
    // 尝试播放
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('音频播放启动成功')
          playing.value = true
        })
        .catch(err => {
          console.error('音频播放失败:', err.name, err.message)
          playing.value = false
        })
    }
  }

  audio.onplay = () => {
    console.log('音频开始播放')
    playing.value = true
  }

  audio.onended = () => {
    console.log('音频播放结束')
    playing.value = false
    audioContext.value = null
  }

  audio.onerror = e => {
    console.error('音频加载错误:', e)
    playing.value = false
    audioContext.value = null
  }

  // 设置 src 触发加载
  audio.src = audioUrl.value
  audio.load()
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
  // 显示加载状态
  isLoading.value = true
  loadingText.value = '正在输入中...'

  // 格式化备忘录列表（只保留今天和明天的）
  let calendarList = ''
  if (pageData.value.calendar && pageData.value.calendar.length > 0) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)

    const filteredItems = pageData.value.calendar.filter((item: any) => {
      // 构建备忘录时间
      const year = item.schedule_year || now.getFullYear()
      const month = (item.schedule_month || 1) - 1 // 月份从0开始
      const day = item.schedule_day || 1
      const hour = item.schedule_hour ?? 0
      const minute = item.schedule_minute ?? 0
      const itemDate = new Date(year, month, day, hour, minute)
      // 只保留今天和明天的备忘录（且时间未过期）
      const itemDay = new Date(year, month, day)
      return itemDate >= now && itemDay < dayAfterTomorrow
    })

    if (filteredItems.length > 0) {
      const items = filteredItems
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
      // 隐藏加载状态
      isLoading.value = false

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
      isLoading.value = false
      loadingText.value = ''
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

// 上传中提示遮罩
.upload-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;

  .upload-loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 48px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);

    .upload-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #eee;
      border-top-color: #d9a8a6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    p {
      margin: 0;
      font-size: 16px;
      color: #333;
      font-weight: 500;
    }
  }
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

    .nav-logo {
      height: 40px;
      width: auto;
      object-fit: contain;
    }
  }

  .nav-right {
    .change-bg-btn {
      padding: 6px 12px;
      background: linear-gradient(180deg, #f0c4c4 0%, #e8b4b4 50%, #daa8a8 100%);
      border: none;
      border-radius: 16px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow:
        0 4px 8px rgba(200, 150, 150, 0.3),
        0 2px 4px rgba(200, 150, 150, 0.2),
        inset 0 1px 1px rgba(255, 255, 255, 0.3),
        inset 0 -1px 1px rgba(0, 0, 0, 0.05);

      &:hover {
        transform: scale(1.02);
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

// 底部绑定按钮（未绑定状态使用）
.bind-btn {
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

// 对话气泡 - 固定底部距离，内容增加向上扩展
.chat-bubble {
  position: absolute;
  left: 20px;
  bottom: 220px;
  z-index: 10;
  max-width: 75%;
  padding: 20px 24px;
  background: rgba(180, 130, 130, 0.5);
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

  // 加载状态样式
  &.loading-bubble {
    .loading-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loading-text {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
  }
}

// 加载动画
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 角色信息区域 - 固定底部距离
.role-info {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 120px;
  z-index: 10;

  .role-name {
    font-size: 32px;
    font-weight: bold;
    color: #fff;
    margin-bottom: 16px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
}

// 底部语音播放器 - 靠左
.audio-player-mini {
  position: fixed;
  bottom: 38px;
  left: 20px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  min-width: 250px;
  background: rgba(180, 130, 130, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(180, 130, 130, 0.85);
  }

  &:active {
    transform: scale(0.95);
  }

  .play-btn-mini {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(217, 168, 166, 0.9);
    border-radius: 50%;
    flex-shrink: 0;

    .play-icon {
      color: #fff;
      padding-left: 2px;
    }

    .wave-animation-mini {
      display: flex;
      align-items: center;
      gap: 2px;

      .wave-bar {
        width: 2px;
        height: 10px;
        background: #fff;
        border-radius: 2px;
        animation: wave-anim 0.8s ease-in-out infinite;

        &:nth-child(1) {
          animation-delay: 0s;
        }
        &:nth-child(2) {
          animation-delay: 0.15s;
        }
        &:nth-child(3) {
          animation-delay: 0.3s;
        }
      }
    }
  }

  // 波浪纹
  .waveform-mini {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 24px;
    flex: 1;

    .bar {
      width: 2px;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 2px;
      transition: height 0.2s ease;
    }
  }

  .duration-mini {
    font-size: 16px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    min-width: 28px;
    text-align: center;
    flex-shrink: 0;
  }
}

// 继续聊天按钮 - 靠右
.enter-btn-inline {
  position: fixed;
  bottom: 38px;
  right: 20px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  white-space: nowrap;
  background: linear-gradient(180deg, #f0c4c4 0%, #e8b4b4 50%, #daa8a8 100%);
  border: none;
  border-radius: 20px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow:
    0 4px 8px rgba(200, 150, 150, 0.3),
    0 2px 4px rgba(200, 150, 150, 0.2),
    inset 0 1px 1px rgba(255, 255, 255, 0.3),
    inset 0 -1px 1px rgba(0, 0, 0, 0.05);

  &:hover {
    transform: scale(1.02);
  }

  &:active {
    transform: scale(0.98);
    box-shadow:
      0 2px 4px rgba(200, 150, 150, 0.3),
      inset 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  svg {
    flex-shrink: 0;
  }
}

// 波浪动画
@keyframes wave-anim {
  0%,
  100% {
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

    .upload-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .upload-loading {
      width: 20px;
      height: 20px;
      border: 2px solid #ddd;
      border-top-color: #d9a8a6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  }
}

// 安全区域适配
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .audio-player-mini,
  .enter-btn-inline,
  .bind-btn {
    bottom: calc(50px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
