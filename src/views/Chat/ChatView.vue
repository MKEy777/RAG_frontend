<template>
  <div class="chat-page" :class="{ 'sidebar-open': sidebarOpen }">
    <!-- 会话管理侧栏 -->
    <div class="chat-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">历史会话</span>
        <t-button size="small" variant="text" @click="handleNewChat">
          <template #icon><t-icon name="add" /></template>
        </t-button>
      </div>
      <div class="sidebar-list">
        <div
          v-for="s in serverSessions"
          :key="s.id"
          class="sidebar-item"
          :class="{ active: session?.serverSessionId === s.id }"
          @click="loadServerSession(s)"
        >
          <span class="sidebar-item-title">{{ s.title || '新对话' }}</span>
          <t-icon name="delete" class="sidebar-item-delete" @click.stop="handleDeleteSession(s.id)" />
        </div>
        <div v-if="!serverSessions.length" class="sidebar-empty">暂无历史会话</div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="chat-main">
    <div class="chat-topbar">
      <t-button variant="text" @click="sidebarOpen = !sidebarOpen">
        <template #icon><t-icon name="menu" /></template>
      </t-button>
    </div>
    <div v-if="!session || session.messages.length === 0" class="chat-hero">
      <h1 class="hero-title">有什么可以帮你？</h1>
      <p class="hero-hint">
        {{ selectedKbIds.length ? '基于所选知识库回答，答案附引用来源' : '点击 + 选择知识库开始对话' }}
      </p>
      <div class="hero-input-area">
        <div v-if="kbPopupOpen" class="kb-popup">
          <div
            v-for="kb in kbOptions"
            :key="kb.value"
            class="kb-popup-item"
            :class="{ selected: selectedKbIds.includes(kb.value) }"
            @click="toggleKb(kb.value)"
          >
            <t-icon :name="selectedKbIds.includes(kb.value) ? 'check' : 'server'" size="16px" />
            <span>{{ kb.label }}</span>
          </div>
          <div v-if="!kbOptions.length" class="kb-popup-empty">暂无知识库</div>
        </div>
        <ChatInput
          :disabled="!selectedKbIds.length"
          :streaming="isStreaming"
          large
          @send="handleSend"
          @stop="stop"
        >
          <template #actions-left>
            <button class="action-chip" :class="{ active: kbPopupOpen }" @click="kbPopupOpen = !kbPopupOpen">
              <t-icon name="add" size="16px" />
              <span>知识库</span>
              <t-tag v-if="selectedKbIds.length" variant="light" size="small">{{ selectedKbIds.length }}</t-tag>
            </button>
          </template>
          <template #actions-right>
            <button class="action-chip" :class="{ active: enableGraph }" @click="enableGraph = !enableGraph">
              <t-icon name="fork" size="16px" />
              <span>图谱增强</span>
            </button>
            <button class="action-chip" :class="{ active: wikiBoost }" @click="wikiBoost = !wikiBoost">
              <t-icon name="flashlight" size="16px" />
              <span>Wiki 增强</span>
            </button>
          </template>
        </ChatInput>
      </div>
    </div>

    <template v-else>
      <div ref="scrollRef" class="chat-messages">
        <div class="chat-messages-inner">
          <ChatMessage v-for="(msg, i) in session.messages" :key="`${session.id}-${i}`" :message="msg" @suggest="handleSend" />
        </div>
      </div>
      <div class="chat-footer">
        <div class="footer-input-area">
          <div v-if="kbPopupOpen" class="kb-popup">
            <div
              v-for="kb in kbOptions"
              :key="kb.value"
              class="kb-popup-item"
              :class="{ selected: selectedKbIds.includes(kb.value) }"
              @click="toggleKb(kb.value)"
            >
              <t-icon :name="selectedKbIds.includes(kb.value) ? 'check' : 'server'" size="16px" />
              <span>{{ kb.label }}</span>
            </div>
            <div v-if="!kbOptions.length" class="kb-popup-empty">暂无知识库</div>
          </div>
          <ChatInput
            :disabled="!selectedKbIds.length"
            :streaming="isStreaming"
            @send="handleSend"
            @stop="stop"
          >
            <template #actions-left>
              <button class="action-chip" :class="{ active: kbPopupOpen }" @click="kbPopupOpen = !kbPopupOpen">
                <t-icon name="add" size="16px" />
                <span>知识库</span>
                <t-tag v-if="selectedKbIds.length" variant="light" size="small">{{ selectedKbIds.length }}</t-tag>
              </button>
            </template>
            <template #actions-right>
              <button class="action-chip" :class="{ active: enableGraph }" @click="enableGraph = !enableGraph">
                <t-icon name="fork" size="16px" />
                <span>图谱增强</span>
              </button>
              <button class="action-chip" :class="{ active: wikiBoost }" @click="wikiBoost = !wikiBoost">
                <t-icon name="flashlight" size="16px" />
                <span>Wiki 增强</span>
              </button>
            </template>
          </ChatInput>
        </div>
        <p class="chat-disclaimer">内容由 AI 生成，请核对引用来源</p>
      </div>
    </template>
    </div><!-- .chat-main -->
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useChatStream } from '@/composables/useChatStream'
import { listKnowledgeBases } from '@/api/knowledgeBase'
import { listSessions, deleteSession, listMessages, updateSession, type SessionInfo } from '@/api/sessions'
import type { ChatReference } from '@/stores/chat'
import { MessagePlugin } from 'tdesign-vue-next'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'

const chatStore = useChatStore()
const { isStreaming, send, stop } = useChatStream()

const kbOptions = ref<{ label: string; value: string }[]>([])
const selectedKbIds = ref<string[]>([])
const wikiBoost = ref(false)
const enableGraph = ref(false)
const kbPopupOpen = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
const serverSessions = ref<SessionInfo[]>([])
const sidebarOpen = ref(true)
const renamingId = ref('')
const renameText = ref('')

const session = computed(() => chatStore.active)

const scrollToBottom = () => {
  nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(
  () => chatStore.activeId,
  () => {
    if (session.value) {
      selectedKbIds.value = [...session.value.kbIds]
      wikiBoost.value = session.value.enableWikiBoost
      enableGraph.value = session.value.enableGraph ?? false
    }
    scrollToBottom()
  },
  { immediate: true }
)

watch(
  () => {
    const msgs = session.value?.messages
    return msgs?.length ? msgs[msgs.length - 1].content.length : 0
  },
  () => {
    if (isStreaming.value) scrollToBottom()
  }
)

const handleSend = async (text: string) => {
  if (isStreaming.value || !selectedKbIds.value.length) return
  kbPopupOpen.value = false
  let target = session.value
  if (!target) {
    target = chatStore.createSession([...selectedKbIds.value], wikiBoost.value, enableGraph.value)
  } else {
    target.kbIds = [...selectedKbIds.value]
    target.enableWikiBoost = wikiBoost.value
    target.enableGraph = enableGraph.value
  }
  scrollToBottom()
  await send(target, text)
}

const fetchServerSessions = async () => {
  try {
    const res = await listSessions()
    serverSessions.value = res.sessions
  } catch { /* ignore */ }
}

const loadServerSession = async (s: SessionInfo) => {
  const local = chatStore.sessions.find((ls) => ls.serverSessionId === s.id)
  if (local) {
    chatStore.activeId = local.id
    return
  }
  try {
    const res = await listMessages(s.id)
    const sess = chatStore.createSession(s.kb_ids, false, false)
    sess.serverSessionId = s.id
    sess.title = s.title || '新对话'
    sess.messages = res.messages.map((m) => ({
      role: m.role,
      content: m.content,
      references: (m.references as ChatReference[]) || [],
      complete: true,
    }))
    chatStore.persist(true)
  } catch {
    MessagePlugin.error('加载会话失败')
  }
}

const handleNewChat = () => {
  chatStore.activeId = ''
  selectedKbIds.value = []
  wikiBoost.value = false
  enableGraph.value = false
}

const handleDeleteSession = async (sessionId: string) => {
  try {
    await deleteSession(sessionId)
    serverSessions.value = serverSessions.value.filter((s) => s.id !== sessionId)
    const local = chatStore.sessions.find((ls) => ls.serverSessionId === sessionId)
    if (local) chatStore.removeSession(local.id)
  } catch {
    MessagePlugin.error('删除失败')
  }
}

const startRename = (s: SessionInfo) => {
  renamingId.value = s.id
  renameText.value = s.title || ''
  nextTick(() => {
    const el = document.querySelector('.sidebar-item-rename') as HTMLInputElement | null
    el?.focus()
    el?.select()
  })
}

const confirmRename = async (sessionId: string) => {
  const title = renameText.value.trim()
  if (!title) {
    renamingId.value = ''
    return
  }
  try {
    await updateSession(sessionId, { title })
    const s = serverSessions.value.find((x) => x.id === sessionId)
    if (s) s.title = title
    const local = chatStore.sessions.find((ls) => ls.serverSessionId === sessionId)
    if (local) local.title = title
    chatStore.persist(true)
  } catch {
    MessagePlugin.error('重命名失败')
  }
  renamingId.value = ''
}

const handleRenameKeydown = (e: KeyboardEvent, sessionId: string) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    confirmRename(sessionId)
  } else if (e.key === 'Escape') {
    renamingId.value = ''
  }
}

onMounted(async () => {
  try {
    const res = await listKnowledgeBases(1, 100)
    kbOptions.value = res.items.map((kb) => ({ label: kb.name, value: kb.id }))
    if (!selectedKbIds.value.length && kbOptions.value.length === 1) {
      selectedKbIds.value = [kbOptions.value[0].value]
    }
  } catch {
    // client 拦截器已弹错
  }
  fetchServerSessions()
})

const toggleKb = (id: string) => {
  const idx = selectedKbIds.value.indexOf(id)
  if (idx >= 0) selectedKbIds.value.splice(idx, 1)
  else selectedKbIds.value.push(id)
}

const handleOutsideClick = (e: MouseEvent) => {
  const el = e.target as HTMLElement
  if (!el.closest('.kb-popup') && !el.closest('.action-chip')) {
    kbPopupOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))
</script>

<style scoped>
.chat-page {
  height: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

/* 侧栏 */
.chat-sidebar {
  width: 0;
  flex-shrink: 0;
  background: var(--td-bg-color-container);
  border-right: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width var(--kl-duration-normal) var(--kl-ease-default);
}

.chat-page.sidebar-open .chat-sidebar {
  width: 260px;
  border-right: 1px solid var(--td-component-stroke);
}

.chat-sidebar .sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--kl-space-3);
}

.sidebar-title {
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-semibold);
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--kl-space-2);
}

.sidebar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--kl-space-2);
  border-radius: var(--kl-radius-md);
  cursor: pointer;
  font-size: var(--kl-text-sm);
}

.sidebar-item:hover { background: var(--td-gray-color-2); }
.sidebar-item.active { background: var(--kl-accent-light); color: var(--kl-accent); }

.sidebar-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-item-delete {
  opacity: 0;
  color: var(--td-text-color-placeholder);
  transition: opacity 0.15s;
}

.sidebar-item:hover .sidebar-item-delete { opacity: 1; }
.sidebar-item-delete:hover { color: var(--td-error-color); }

.sidebar-empty {
  padding: var(--kl-space-4);
  text-align: center;
  color: var(--td-text-color-placeholder);
  font-size: var(--kl-text-sm);
}

/* 顶部栏 */
.chat-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: var(--kl-space-1) var(--kl-space-2);
}

/* 主内容区 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--kl-space-6) var(--kl-space-6) 8vh;
  gap: var(--kl-space-1);
}

.hero-title {
  font-size: 36px;
  font-weight: var(--kl-weight-regular);
  color: var(--td-text-color-primary);
  margin: 0;
  letter-spacing: var(--kl-tracking-tight);
}

.hero-hint {
  font-size: var(--kl-text-base);
  color: var(--td-text-color-secondary);
  margin: 0 0 var(--kl-space-5);
}

.hero-input-area,
.footer-input-area {
  width: 100%;
  max-width: 680px;
  position: relative;
}

.kb-popup {
  position: absolute;
  top: calc(100% + var(--kl-space-2));
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  padding: var(--kl-space-1);
  background: var(--td-bg-color-container);
  border: none;
  border-radius: var(--kl-radius-xl);
  box-shadow: var(--kl-elevation-flyout);
  z-index: var(--kl-z-flyout);
}

.kb-popup-item {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-2) var(--kl-space-3);
  border-radius: var(--kl-radius-md);
  font-size: var(--kl-text-base);
  color: var(--td-text-color-primary);
  cursor: pointer;
  transition: background var(--kl-duration-instant) var(--kl-ease-default);
}

.kb-popup-item:hover {
  background: var(--td-gray-color-2);
}

.kb-popup-item.selected {
  color: var(--kl-accent);
  font-weight: var(--kl-weight-semibold);
}

.kb-popup-empty {
  padding: var(--kl-space-4);
  text-align: center;
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-placeholder);
}

.action-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px var(--kl-space-1);
  border: none;
  border-radius: var(--kl-radius-full);
  background: transparent;
  font-size: var(--kl-text-base);
  color: var(--td-text-color-placeholder);
  cursor: pointer;
  transition: background var(--kl-duration-fast) var(--kl-ease-default),
    color var(--kl-duration-fast) var(--kl-ease-default);
}

.action-chip:hover {
  background: var(--td-gray-color-2);
  color: var(--td-text-color-secondary);
}

.action-chip.active {
  background: var(--kl-accent-light);
  color: var(--kl-accent);
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--kl-space-6);
}

.chat-messages-inner {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-6);
}

.chat-footer {
  flex-shrink: 0;
  padding: var(--kl-space-2) var(--kl-space-6) var(--kl-space-2);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chat-disclaimer {
  text-align: center;
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  margin: var(--kl-space-2) 0 0;
}
</style>
