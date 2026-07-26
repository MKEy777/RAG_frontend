<template>
  <t-layout class="layout">
    <t-aside class="layout-aside">
      <div class="logo">
        <span class="logo-text">PyRAG</span>
      </div>
      <t-menu
        :value="activeMenu"
        :collapsed="collapsed"
        @change="handleMenuChange"
      >
        <t-menu-item value="/knowledge-bases">
          <template #icon>
            <t-icon name="server" />
          </template>
          知识库管理
        </t-menu-item>
        <t-menu-item value="/wiki">
          <template #icon>
            <t-icon name="book" />
          </template>
          Wiki
        </t-menu-item>
        <t-menu-item value="/graph">
          <template #icon>
            <t-icon name="fork" />
          </template>
          知识图谱
        </t-menu-item>
        <t-menu-item value="/retrieval">
          <template #icon>
            <t-icon name="search" />
          </template>
          检索测试
        </t-menu-item>
      </t-menu>
    </t-aside>
    <t-layout>
      <t-header class="layout-header">
        <t-button variant="text" shape="square" @click="collapsed = !collapsed">
          <t-icon :name="collapsed ? 'menu-unfold' : 'menu-fold'" />
        </t-button>
        <span class="header-title">{{ currentTitle }}</span>
      </t-header>
      <t-content class="layout-content">
        <router-view />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)

const activeMenu = computed(() => {
  const path = route.path
  if (path.includes('/wiki')) return '/wiki'
  if (path.includes('/graph')) return '/graph'
  if (path.startsWith('/knowledge-bases')) return '/knowledge-bases'
  if (path.startsWith('/retrieval')) return '/retrieval'
  return path
})

const currentTitle = computed(() => {
  return (route.meta.title as string) || 'PyRAG'
})

const handleMenuChange = (value: string) => {
  router.push(value)
}
</script>

<style scoped>
.layout {
  height: 100vh;
}

.layout-aside {
  background: #fff;
  border-right: 1px solid var(--td-border-level-1-color);
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.logo-text {
  font-size: 20px;
  font-weight: 600;
  color: var(--td-brand-color);
}

.layout-header {
  height: 64px;
  background: #fff;
  border-bottom: 1px solid var(--td-border-level-1-color);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
}

.header-title {
  font-size: 16px;
  font-weight: 500;
}

.layout-content {
  padding: 24px;
  background: var(--td-bg-color-page);
  overflow: auto;
}
</style>
