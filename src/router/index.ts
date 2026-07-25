import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/knowledge-bases',
    children: [
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
        name: 'DocumentList',
        component: () => import('@/views/Documents/ListView.vue'),
        meta: { title: '文档管理' },
      },
      {
        path: 'retrieval',
        name: 'RetrievalTest',
        component: () => import('@/views/Retrieval/TestView.vue'),
        meta: { title: '检索测试' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || 'PyRAG'} - PyRAG`
  next()
})

export default router
