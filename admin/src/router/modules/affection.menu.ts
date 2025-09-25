import type { RouteRecordRaw } from 'vue-router';

function Layout() {
  return import('@/layouts/index.vue');
}

const routes: RouteRecordRaw = {
  path: '/affection',
  component: Layout,
  redirect: '/affection/index',
  name: 'AffectionMenu',
  meta: {
    title: '好感度管理',
    icon: 'mdi:heart',
  },
  children: [
    {
      path: 'index',
      name: 'AffectionIndex',
      component: () => import('@/views/affection/index.vue'),
      meta: {
        title: '阶段规则',
        icon: 'mdi:format-list-bulleted',
      },
    },
  ],
};

export default routes;
