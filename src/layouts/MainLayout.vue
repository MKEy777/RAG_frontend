<template>
  <div class="layout">
    <aside
      class="sidebar"
      :class="{ collapsed: sidebarCollapsed }"
    >
      <div class="sidebar-top">
        <div class="sidebar-logo" @click="sidebarCollapsed ? (sidebarCollapsed = false) : router.push('/chat')">
          <div class="logo-mark">KL</div>
          <span v-show="!sidebarCollapsed" class="logo-text">KnowLink</span>
        </div>
        <div v-show="!sidebarCollapsed" class="sidebar-toggle" @click="sidebarCollapsed = true">
          <t-icon name="chevron-left" size="16px" />
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :data-label="item.label"
          @click="item.path === '/chat' && (chatStore.activeId = '')"
        >
          <t-icon :name="item.icon" size="18px" />
          <span v-show="!sidebarCollapsed">{{ item.label }}</span>
        </router-link>
      </nav>

      <div v-if="!sidebarCollapsed" class="session-section">
        <div class="session-label">最近</div>
        <div class="session-list">
          <div
            v-for="session in chatStore.sorted"
            :key="session.id"
            class="session-item"
            :class="{ active: session.id === chatStore.activeId && route.path === '/chat' }"
            @click="handleOpenSession(session.id)"
          >
            <span class="session-title">{{ session.title }}</span>
            <span class="session-delete" @click.stop="handleDeleteSession(session.id)">
              <t-icon name="delete" size="14px" />
            </span>
          </div>
        </div>
      </div>
    </aside>

    <main class="layout-content" :class="{ 'no-pad': route.meta.fullHeight }">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()
const sidebarCollapsed = ref(false)

const navItems = [
  { path: '/chat', icon: 'edit-1', label: '新聊天' },
  { path: '/knowledge-bases', icon: 'server', label: '知识库' },
  { path: '/retrieval', icon: 'search', label: '检索测试' },
  { path: '/faq', icon: 'help-circle', label: 'FAQ 管理' },
]

const isActive = (path: string) =>
  path === '/chat' ? route.path === '/chat' : route.path.startsWith(path)

const handleNewChat = () => {
  chatStore.activeId = ''
  router.push('/chat')
}

const handleOpenSession = (id: string) => {
  chatStore.activeId = id
  router.push('/chat')
}

const handleDeleteSession = (id: string) => {
  chatStore.removeSession(id)
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: var(--kl-sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-sidebar);
  padding: var(--kl-space-3) var(--kl-space-2);
  gap: var(--kl-space-3);
  transition: width var(--kl-duration-normal) var(--kl-ease-default);
  position: relative;
}

.sidebar.collapsed {
  width: var(--kl-sidebar-collapsed);
  padding: var(--kl-space-3) var(--kl-space-2);
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 0;
}

.sidebar.collapsed .sidebar-logo {
  justify-content: center;
  padding: 4px 0;
}

.sidebar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar.collapsed .sidebar-top {
  flex-direction: column;
  gap: 8px;
}

/* 收起态图标 tooltip */
.sidebar.collapsed .nav-item {
  position: relative;
}

.sidebar.collapsed .nav-item::after {
  content: attr(data-label);
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) scale(0.92);
  padding: var(--kl-space-1) var(--kl-space-2);
  background: var(--td-gray-color-13);
  color: #fff;
  font-size: var(--kl-text-xs);
  font-weight: var(--kl-weight-medium);
  border-radius: var(--kl-radius-sm);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--kl-duration-fast) var(--kl-ease-default),
    transform var(--kl-duration-fast) var(--kl-ease-default);
  z-index: var(--kl-z-flyout);
}

.sidebar.collapsed .nav-item:hover::after {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--kl-icon-lg);
  height: var(--kl-icon-lg);
  border-radius: var(--kl-radius-sm);
  cursor: pointer;
  color: var(--td-text-color-placeholder);
  transition: background var(--kl-duration-fast) var(--kl-ease-default),
    color var(--kl-duration-fast) var(--kl-ease-default);
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--td-gray-color-3);
  color: var(--td-text-color-primary);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-1) var(--kl-space-2);
  cursor: pointer;
}

.logo-mark {
  width: 28px;
  height: 28px;
  border-radius: var(--kl-radius-md);
  background: var(--kl-gradient);
  color: #fff;
  font-size: var(--kl-text-sm);
  font-weight: var(--kl-weight-bold);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: var(--kl-text-md);
  font-weight: var(--kl-weight-bold);
  color: var(--td-text-color-primary);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  height: var(--kl-control-height-md);
  padding: 0 var(--kl-space-3);
  border-radius: var(--kl-radius-pill);
  font-size: var(--kl-text-base);
  color: var(--td-text-color-primary);
  text-decoration: none;
  cursor: pointer;
  transition: background var(--kl-duration-fast) var(--kl-ease-default);
}

.nav-item:hover {
  background: var(--td-gray-color-2);
}

.nav-item.active {
  background: var(--td-gray-color-3);
  font-weight: var(--kl-weight-semibold);
}

.session-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
}

.session-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--kl-text-xs);
  font-weight: var(--kl-weight-medium);
  color: var(--td-text-color-placeholder);
  padding: 0 var(--kl-space-2) var(--kl-space-1);
}

.session-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--kl-radius-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.session-add:hover {
  background: var(--td-gray-color-3);
  color: var(--td-text-color-primary);
}

.session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  height: 34px;
  padding: 0 var(--kl-space-2);
  border-radius: var(--kl-radius-lg);
  cursor: pointer;
  transition: background var(--kl-duration-fast) var(--kl-ease-default);
}

.session-item:hover {
  background: var(--td-gray-color-3);
}

.session-item.active {
  background: var(--td-gray-color-3);
}

.session-title {
  flex: 1;
  min-width: 0;
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-delete {
  display: inline-flex;
  align-items: center;
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--kl-duration-fast) var(--kl-ease-default);
}

.session-item:hover .session-delete {
  opacity: 1;
}

.session-delete:hover {
  color: var(--td-error-color);
}

.layout-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  background: var(--td-bg-color-page);
  padding: var(--kl-space-8) var(--kl-space-10);
}

.layout-content.no-pad {
  padding: 0;
  overflow-y: hidden;
}
</style>
