<template>
  <div class="layout bg">
    <div class="navbar"></div>
    <div class="content column center">
      <img :src="logoImg" class="logo" alt="logo" />

      <template v-if="!isBind">
        <div class="no_bind_box column center">
          <div class="tips">绑定后，即可通过触碰手机召唤指定角色</div>
          <img :src="noBindImg" class="no_bind" alt="未绑定" />
          <div class="text">暂未绑定角色</div>
        </div>
        <button class="open_system" @click="closePopup">打开猫饼小程序，绑定猫饼手环</button>
      </template>

      <template v-else>
        <div class="role column center">
          <img :src="pageData.coverImg" class="role_avatar" alt="角色头像" />
          <div class="role_status flex aCenter">在线</div>
          <div class="role_name">{{ pageData.name || '' }}</div>
          <div class="role_recover">
            {{ pageData.desAiText || '思考中...' }}
          </div>
          <div class="role_audio flex aCenter jCenter">
            <div class="play-icon-box flex center" @click="playVoice">
              <div class="voice-wave" v-if="playing">
                <div class="wave-bar bar-1"></div>
                <div class="wave-bar bar-2"></div>
                <div class="wave-bar bar-3"></div>
              </div>
              <div v-else class="flex center play-icon">▶</div>
            </div>
          </div>
        </div>
        <button class="open_system" @click="closePopup">进入猫饼小程序，继续聊天</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchDeviceRolesHtml } from '@/api'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isBind = ref(false)
const pageData = ref<any>({})
const aiText = ref('')
const playing = ref(false)
const audioContext = ref<HTMLAudioElement | null>(null)
const audioUrl = ref('')

const braceletId = ref((route.query.id as string) || '8676')

const imgPath = 'https://maobingai.oss-cn-shanghai.aliyuncs.com/mini_program/'
const logoImg = imgPath + 'mb_xcx003@2x.png'
const noBindImg = imgPath + 'mb_xcx004@2x.png'

const closePopup = () => {
  if (pageData.value.wechat_config?.openlink) {
    window.location.href = pageData.value.wechat_config.openlink
  } else {
    alert('跳转地址无效')
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
  let markdownContent = ''
  if (
    pageData.value.calendar &&
    pageData.value.calendar[0] &&
    pageData.value.calendar[0].description
  ) {
    markdownContent = pageData.value.calendar[0].description
  }

  return fetch('https://admin.maobingai.com/api/open/chat/chat-process-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maobingBaseUrl: 'https://admin.maobingai.com',
      options: {
        skipSaveToDatabase: true,
      },
      prompt: `备忘录：${markdownContent}`,
      isCalendarMessage: true,
      userId: pageData.value.id,
    }),
  })
    .then(res => res.json())
    .then(res => {
      const text = res?.data?.data?.text || res?.data?.text
      if (text) {
        aiText.value = text
        pageData.value = { ...pageData.value, desAiText: '' }
        animationText(text)
        fetchChatTts().catch(err => {
          console.error('fetchChatTts catch', err)
        })
      } else {
        audioUrl.value = ''
      }
    })
    .catch(error => {
      console.error('fetchChatSuggestion error', error)
    })
}

const fetchChatTts = () => {
  return fetch('https://admin.maobingai.com/api/open/chat/tts-process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maobingBaseUrl: 'https://admin.maobingai.com',
      prompt: aiText.value,
      userId: pageData.value.id,
    }),
  })
    .then(res => res.json())
    .then(res => {
      const ttsUrl = res?.data?.ttsUrl || res?.ttsUrl
      if (ttsUrl) {
        audioUrl.value = ttsUrl
      } else {
        audioUrl.value = ''
      }
    })
    .catch(error => {
      console.error('fetchChatTts error', error)
    })
}

const initPage = () => {
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
})
</script>

<style lang="scss" scoped>
.layout {
  width: 100%;
  font-weight: bold;

  * {
    font-weight: bold;
  }

  @keyframes wave {
    0%,
    100% {
      transform: scaleY(0.5);
    }
    50% {
      transform: scaleY(1);
    }
  }

  .voice-wave {
    display: flex;
    align-items: center;
    gap: 2px;

    .wave-bar {
      width: 3px;
      background: #fff;
      border-radius: 1.5px;
      animation: wave 1s infinite;

      &.bar-1 {
        height: 10px;
        animation-delay: 0s;
      }
      &.bar-2 {
        height: 15px;
        animation-delay: 0.2s;
      }
      &.bar-3 {
        height: 10px;
        animation-delay: 0.4s;
      }
    }
  }

  .play-icon-box {
    width: 35px;
    height: 35px;
    border-radius: 50%;
    background: #d9a8a6;
    cursor: pointer;
  }

  .play-icon {
    font-size: 14px;
    color: #ffffff;
    padding-left: 2px;
  }

  &.bg {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    background: url('/page-bg.png') no-repeat center center;
    background-size: 100% 100%;
  }

  .navbar {
    height: 44px;
  }

  .content {
    width: 345px;
    margin: 12.5px auto 0;
  }

  .logo {
    width: 360px;
    height: 105px;
    object-fit: contain;
  }

  .column {
    display: flex;
    flex-direction: column;
  }

  .center {
    align-items: center;
  }

  .flex {
    display: flex;
  }

  .aCenter {
    align-items: center;
  }

  .jCenter {
    justify-content: center;
  }

  .no_bind_box {
    font-weight: bold;
    font-size: 14px;
    color: #666666;
    text-align: center;

    .tips {
      color: #333333;
      margin: 25px 0 85px;
      font-weight: bold;
    }

    img {
      width: 120px;
      height: 120px;
      margin-bottom: 15px;
    }

    .text {
      margin-top: 15px;
      font-weight: bold;
    }
  }

  .open_system {
    position: fixed;
    bottom: 37.5px;
    width: 325px;
    height: 50px;
    background: linear-gradient(180deg, #fbd5d3 0%, #d9a8a6 78%);
    border-radius: 18px;
    border: none;
    font-weight: bold;
    font-size: 16px;
    color: #ffffff;
    cursor: pointer;
  }

  .role {
    margin-top: 67.5px;
    position: relative;
    width: 100%;
    background: #ffffff;
    border-radius: 18px;
    padding: 0 20px 24px;

    &_avatar {
      position: absolute;
      top: -22px;
      width: 80px;
      height: 80px;
      border-radius: 31px;
      object-fit: cover;
    }

    &_status {
      position: absolute;
      top: 26px;
      right: 20px;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 12px;
      color: #148f04;
      background: rgba(20, 143, 4, 0.1);
      border-radius: 10px;

      &::before {
        content: '';
        display: inline-block;
        width: 6px;
        height: 6px;
        background: #148f04;
        border-radius: 50%;
        margin-right: 6px;
      }
    }

    &_name {
      margin-top: 77.5px;
      font-weight: bold;
      font-size: 16px;
      color: #333333;
    }

    &_recover {
      text-align: center;
      margin: 17.5px 0 67.5px;
      font-weight: bold;
      font-size: 14px;
      color: #774240;
      min-height: 20px;
    }

    &_audio {
      img {
        width: 35px;
        height: 35px;
      }

      &::before,
      &::after {
        content: '';
        width: 70px;
        height: 1px;
      }

      &::before {
        margin-right: 15px;
        background: linear-gradient(to right, transparent, #d9a5a5);
      }

      &::after {
        margin-left: 15px;
        background: linear-gradient(to left, transparent, #d9a5a5);
      }
    }
  }
}
</style>
