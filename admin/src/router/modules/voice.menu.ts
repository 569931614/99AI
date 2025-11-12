import type { RouteRecordRaw } from 'vue-router';

function Layout() {
  return import('@/layouts/index.vue');
}

const routes: RouteRecordRaw = {
  path: '/voice',
  component: Layout,
  redirect: '/voice/index',
  name: 'VoiceMenu',
  meta: {
    title: '语音管理',
    icon: 'mdi:waveform',
  },
  children: [
    {
      path: 'index',
      name: 'VoiceList',
      component: () => import('@/views/voice/index.vue'),
      meta: {
        title: '声音列表',
        icon: 'mdi:playlist-music',
      },
    },
    {
      path: 'test',
      name: 'VoiceTest',
      component: () => import('@/views/voice/test.vue'),
      meta: {
        title: '音色测试',
        icon: 'mdi:test-tube',
      },
    },
    {
      path: 'gpt-library',
      name: 'VoiceGptModels',
      component: () => import('@/views/voice/gpt-library.vue'),
      meta: {
        title: 'GPT-SoVITS 模型管理',
        icon: 'mdi:folder-star',
      },
    },
  ],
};

export default routes;
