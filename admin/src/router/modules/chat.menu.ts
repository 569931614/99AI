import type { RouteRecordRaw } from 'vue-router';

function Layout() {
  return import('@/layouts/index.vue');
}

const routes: RouteRecordRaw = {
  path: '/chat',
  component: Layout,
  redirect: '/chat/chat',
  name: 'chatMenu',
  meta: {
    title: '对话管理',
    icon: 'majesticons:data-line',
  },
  children: [
    {
      path: 'dashboard',
      name: 'dashboardMenu',
      component: () => import('@/views/users/index.vue'),
      meta: {
        title: '用户信息',
        icon: 'fa6-solid:list-ul',
      },
    },
    {
      path: 'list',
      name: 'chatMenuList',
      component: () => import('@/views/chat/chat.vue'),
      meta: {
        title: '对话记录',
        icon: 'material-symbols-light:chat-outline',
      },
    },
    {
      path: 'auto-reply',
      name: 'ReplyMenuList',
      component: () => import('@/views/sensitive/autpReply.vue'),
      meta: {
        title: 'Prompt 片段',
        icon: 'ic:outline-question-answer',
      },
    },
    {
      path: 'stickers',
      name: 'StickerManager',
      component: () => import('@/views/chat/stickers.vue'),
      meta: {
        title: '表情包管理',
        icon: 'mdi:sticker-emoji',
      },
    },
  ],
};

export default routes;
