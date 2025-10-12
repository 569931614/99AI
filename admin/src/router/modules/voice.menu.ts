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
  ],
};

export default routes;
