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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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
  padding: 24px 24px 12vh;
  gap: 10px;
}

.hero-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin: 0;
}

.hero-hint {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin: 0 0 16px;
}

.hero-input-area,
.footer-input-area {
  width: 100%;
  max-width: 760px;
  position: relative;
}

.kb-popup {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-large);
  box-shadow: var(--td-shadow-2);
  z-index: 50;
}

.kb-popup-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--td-radius-medium);
  font-size: 14px;
  color: var(--td-text-color-primary);
  cursor: pointer;
  transition: background 0.12s;
}

.kb-popup-item:hover {
  background: var(--td-gray-color-2);
}

.kb-popup-item.selected {
  color: var(--td-brand-color);
  font-weight: 600;
}

.kb-popup-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--td-text-color-placeholder);
}

.action-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  border: none;
  border-radius: 14px;
  background: transparent;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.action-chip:hover {
  background: var(--td-gray-color-2);
  color: var(--td-text-color-secondary);
}

.action-chip.active {
  background: var(--td-brand-color);
  color: #fff;
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
}

.chat-messages-inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chat-footer {
  flex-shrink: 0;
  padding: 8px 24px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chat-disclaimer {
  text-align: center;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin: 8px 0 0;
}
</style>
