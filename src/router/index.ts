import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/chat',
    children: [
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/Chat/ChatView.vue'),
        meta: { title: '聊天问答', fullHeight: true },
      },
      {
        path: 'knowledge-bases',
        name: 'KnowledgeBaseList',
        component: () => import('@/views/KnowledgeBase/ListView.vue'),
        meta: { title: '知识库管理' },
      },
      {
        path: 'knowledge-bases/:id',
        name: 'KnowledgeBaseDetail',
        component: () => import('@/views/KnowledgeBase/DetailView.vue'),
        meta: { title: '知识库详情' },
      },
      {
        path: 'knowledge-bases/:id/documents',
        redirect: (to) => `/knowledge-bases/${to.params.id}`,
      },
      {
        path: 'knowledge-bases/:id/chunks',
        name: 'KbChunks',
        component: () => import('@/views/Documents/ChunksView.vue'),
        meta: { title: '切片检查', fullHeight: true },
      },
      {
        path: 'knowledge-bases/:id/documents/:docId/chunks',
        name: 'ChunksView',
        component: () => import('@/views/Documents/ChunksView.vue'),
        meta: { title: '切片详情', fullHeight: true },
      },
      {
        path: 'knowledge-bases/:id/wiki',
        name: 'WikiView',
        component: () => import('@/views/Wiki/WikiView.vue'),
        meta: { title: 'Wiki' },
      },
      {
        path: 'knowledge-bases/:id/graph',
        name: 'GraphView',
        component: () => import('@/views/Graph/GraphView.vue'),
        meta: { title: '知识图谱', fullHeight: true },
      },
      {
        path: 'retrieval',
        name: 'RetrievalTest',
        component: () => import('@/views/Retrieval/TestView.vue'),
        meta: { title: '检索测试' },
      },
      {
        path: 'faq',
        name: 'FaqManage',
        component: () => import('@/views/Faq/FaqView.vue'),
        meta: { title: 'FAQ 管理' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || 'KnowLink'} - KnowLink`
  next()
})

export default router
