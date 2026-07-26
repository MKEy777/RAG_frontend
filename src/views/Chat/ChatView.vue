<template>
  <div class="chat-page">
    <div class="chat-toolbar">
      <t-select
        v-model="selectedKbIds"
        :options="kbOptions"
        multiple
        clearable
        :min-collapsed-num="2"
        placeholder="选择知识库"
        class="kb-select"
        size="small"
      />
      <div class="boost-switch">
        <t-switch v-model="wikiBoost" size="small" />
        <span>Wiki 增强</span>
      </div>
    </div>

    <div v-if="!session || session.messages.length === 0" class="chat-hero">
      <h1 class="hero-title">有什么可以帮你？</h1>
      <p class="hero-hint">
        {{ selectedKbIds.length ? '基于所选知识库回答，答案附引用来源' : '请先在上方选择至少一个知识库' }}
      </p>
      <div class="hero-input">
        <ChatInput
          :disabled="!selectedKbIds.length"
          :streaming="isStreaming"
          @send="handleSend"
          @stop="stop"
        />
      </div>
    </div>

    <template v-else>
      <div ref="scrollRef" class="chat-messages">
        <div class="chat-messages-inner">
          <ChatMessage v-for="(msg, i) in session.messages" :key="`${session.id}-${i}`" :message="msg" />
        </div>
      </div>
      <div class="chat-footer">
        <ChatInput
          :disabled="!selectedKbIds.length"
          :streaming="isStreaming"
          @send="handleSend"
          @stop="stop"
        />
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
</script>

<style scoped>
.chat-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 52px;
  padding: 0 16px;
  flex-shrink: 0;
}

.kb-select {
  width: 300px;
}

.kb-select :deep(.t-input) {
  border-color: transparent;
  background: transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.kb-select :deep(.t-input:hover) {
  background: var(--td-gray-color-2);
}

.boost-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.chat-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 24px 15vh;
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

.hero-input {
  width: 100%;
  max-width: 760px;
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
}

.chat-footer :deep(.chat-input) {
  max-width: 760px;
  margin: 0 auto;
}

.chat-disclaimer {
  text-align: center;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin: 8px 0 0;
}
</style>
