<template>
  <div class="chat-page">
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useChatStream } from '@/composables/useChatStream'
import { listKnowledgeBases } from '@/api/knowledgeBase'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'

const chatStore = useChatStore()
const { isStreaming, send, stop } = useChatStream()

const kbOptions = ref<{ label: string; value: string }[]>([])
const selectedKbIds = ref<string[]>([])
const wikiBoost = ref(false)
const kbPopupOpen = ref(false)
const scrollRef = ref<HTMLElement | null>(null)

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
    target = chatStore.createSession([...selectedKbIds.value], wikiBoost.value)
  } else {
    target.kbIds = [...selectedKbIds.value]
    target.enableWikiBoost = wikiBoost.value
  }
  scrollToBottom()
  await send(target, text)
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
  flex-direction: column;
  overflow: hidden;
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
