<template>
  <div class="layout">
    <aside
      class="sidebar"
      :class="{ collapsed: sidebarCollapsed }"
      @mouseenter="sidebarCollapsed && (navFlyout = true)"
      @mouseleave="sidebarCollapsed && (navFlyout = false)"
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

      <div class="nav-wrapper">
        <nav class="sidebar-nav">
          <div
            class="nav-item"
            :class="{ active: route.path === '/chat' && !chatStore.activeId }"
            @click="handleNewChat"
            @mouseenter="hoveredNav = '__new'"
          >
            <t-icon name="edit-1" size="18px" />
            <span v-show="!sidebarCollapsed">新对话</span>
          </div>
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            @mouseenter="hoveredNav = item.path"
          >
            <t-icon :name="item.icon" size="18px" />
            <span v-show="!sidebarCollapsed">{{ item.label }}</span>
          </router-link>
        </nav>

        <div v-if="sidebarCollapsed && navFlyout" class="nav-flyout">
          <div
            class="flyout-item"
            :class="{ highlighted: hoveredNav === '__new' }"
            @mouseenter="hoveredNav = '__new'"
            @click="handleNewChat"
          >新对话</div>
          <div
            v-for="item in navItems"
            :key="item.path"
            class="flyout-item"
            :class="{ highlighted: hoveredNav === item.path, active: isActive(item.path) }"
            @mouseenter="hoveredNav = item.path"
            @click="router.push(item.path)"
          >{{ item.label }}</div>
        </div>
      </div>

      <div v-if="!sidebarCollapsed && chatStore.sorted.length" class="session-section">
        <div class="session-label">最近对话</div>
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
const navFlyout = ref(false)
const hoveredNav = ref('')

const navItems = [
  { path: '/chat', icon: 'chat', label: '聊天问答' },
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
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-sidebar);
  padding: 14px 10px;
  gap: 14px;
  transition: width 0.2s ease;
  position: relative;
}

.sidebar.collapsed {
  width: 56px;
  padding: 14px 8px;
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

.nav-wrapper {
  position: relative;
}

.nav-flyout {
  position: absolute;
  top: 0;
  left: 100%;
  min-width: 130px;
  padding: 4px 4px 4px 10px;
  border-radius: var(--td-radius-large);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  box-shadow: var(--td-shadow-2);
  z-index: 100;
}

.nav-flyout .flyout-item {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  font-size: 14px;
  border-radius: var(--td-radius-medium);
  white-space: nowrap;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.nav-flyout .flyout-item.highlighted {
  background: var(--td-gray-color-3);
  color: var(--td-text-color-primary);
  font-weight: 600;
}

.nav-flyout .flyout-item.active {
  color: var(--td-brand-color);
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--td-radius-small);
  cursor: pointer;
  color: var(--td-text-color-placeholder);
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--td-gray-color-3);
  color: var(--td-text-color-primary);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  cursor: pointer;
}

.logo-mark {
  width: 28px;
  height: 28px;
  border-radius: var(--td-radius-medium);
  background: var(--td-brand-color);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
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
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--td-radius-medium);
  font-size: 14px;
  color: var(--td-text-color-primary);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.nav-item:hover {
  background: var(--td-gray-color-3);
}

.nav-item.active {
  background: var(--td-gray-color-3);
  font-weight: 600;
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
  font-size: 12px;
  font-weight: 500;
  color: var(--td-text-color-placeholder);
  padding: 0 10px 4px;
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
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: background 0.15s ease;
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
  font-size: 13px;
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
  transition: opacity 0.15s ease;
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
  padding: 24px 32px;
}

.layout-content.no-pad {
  padding: 0;
  overflow-y: hidden;
}
</style>
