<template>
  <div class="chat-msg" :class="message.role">
    <div v-if="message.role === 'user'" class="user-bubble">{{ message.content }}</div>

    <div v-else class="assistant-card" @mouseleave="hoverRef = null">
      <div v-if="!displayed && !message.complete" class="thinking">
        <t-loading size="small" />
        <span>正在思考...</span>
      </div>

      <div
        v-else
        class="md-body"
        v-html="html"
        @mouseover="handleOver"
        @click="handleClick"
      ></div>

      <div v-if="message.complete && message.via" class="fastpath-badge">
        <t-icon :name="message.via === 'fastpath' ? 'lightning-circle' : 'refresh'" size="14px" />
        <span>{{ message.via === 'fastpath' ? '快路径命中' : '语义缓存命中' }}</span>
      </div>

      <div v-if="message.error" class="msg-error">
        <t-icon name="error-circle" size="14px" />
        <span>{{ message.error }}</span>
      </div>

      <ChatReferences
        v-if="message.complete && message.references?.length"
        :references="message.references"
      />

      <div v-if="message.suggestions?.length && message.complete" class="suggestions">
        <t-tag
          v-for="s in message.suggestions"
          :key="s"
          variant="outline"
          style="cursor: pointer; margin-right: 8px; margin-top: 8px"
          @click="emit('suggest', s)"
        >
          {{ s }}
        </t-tag>
      </div>

      <div v-if="hoverRef" class="popover-wrap" :style="popoverStyle">
        <CitationPopover :reference="hoverRef" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatMessage, ChatReference } from '@/stores/chat'
import { useTypewriter } from '@/composables/useTypewriter'
import { renderChatMarkdown } from '@/utils/markdown'
import ChatReferences from './ChatReferences.vue'
import CitationPopover from './CitationPopover.vue'

const props = defineProps<{ message: ChatMessage }>()
const emit = defineEmits<{ suggest: [text: string] }>()

const { displayed } = useTypewriter(
  () => props.message.content,
  () => props.message.complete
)

const html = computed(() =>
  props.message.role === 'assistant' ? renderChatMarkdown(displayed.value) : ''
)

const hoverRef = ref<ChatReference | null>(null)
const popoverStyle = ref<Record<string, string>>({})

const findRef = (target: EventTarget | null): ChatReference | null => {
  const el = (target as HTMLElement | null)?.closest?.('.citation') as HTMLElement | null
  if (!el) return null
  const id = el.dataset.refId
  return props.message.references?.find((r) => r.id === id) ?? null
}

const handleOver = (e: MouseEvent) => {
  const reference = findRef(e.target)
  if (!reference) return
  const el = (e.target as HTMLElement).closest('.citation') as HTMLElement
  const card = el.closest('.assistant-card') as HTMLElement
  const elRect = el.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  popoverStyle.value = {
    left: `${Math.min(elRect.left - cardRect.left, cardRect.width - 290)}px`,
    top: `${elRect.bottom - cardRect.top + 6}px`,
  }
  hoverRef.value = reference
}

const handleClick = (e: MouseEvent) => {
  const reference = findRef(e.target)
  if (reference) hoverRef.value = reference
}
</script>

<style scoped>
.chat-msg {
  display: flex;
}

.chat-msg.user {
  justify-content: flex-end;
}

.user-bubble {
  max-width: 70%;
  background: var(--td-gray-color-3);
  color: var(--td-text-color-primary);
  padding: var(--kl-space-2) var(--kl-space-4);
  border-radius: var(--kl-radius-pill);
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.assistant-card {
  position: relative;
  max-width: 100%;
  min-width: 0;
  flex: 1;
}

.thinking {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
}

.msg-error {
  display: flex;
  align-items: center;
  gap: var(--kl-space-1);
  margin-top: var(--kl-space-2);
  font-size: var(--kl-text-sm);
  color: var(--td-error-color);
}

.fastpath-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: var(--kl-radius-pill);
  font-size: var(--kl-text-xs);
  color: var(--td-brand-color);
  background: color-mix(in srgb, var(--td-brand-color) 10%, transparent);
}

.popover-wrap {
  position: absolute;
  z-index: var(--kl-z-sticky);
}

.md-body {
  font-size: var(--kl-text-md);
  line-height: 1.75;
  color: var(--td-text-color-primary);
  word-break: break-word;
}

.md-body :deep(p) {
  margin: 0 0 var(--kl-space-3);
}

.md-body :deep(p:last-child) {
  margin-bottom: 0;
}

.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4) {
  margin: var(--kl-space-3) 0 var(--kl-space-2);
  font-weight: var(--kl-weight-semibold);
  line-height: 1.4;
}

.md-body :deep(h1) {
  font-size: var(--kl-text-lg);
}

.md-body :deep(h2) {
  font-size: var(--kl-text-md);
}

.md-body :deep(h3),
.md-body :deep(h4) {
  font-size: 15px;
}

.md-body :deep(ul),
.md-body :deep(ol) {
  padding-left: var(--kl-space-5);
  margin: var(--kl-space-1) 0;
}

.md-body :deep(li) {
  margin: 3px 0;
}

.md-body :deep(code) {
  font-family: var(--app-font-family-mono);
  font-size: var(--kl-text-sm);
  background: var(--td-bg-color-secondarycontainer);
  border-radius: var(--kl-radius-md);
  padding: 1px 5px;
}

.md-body :deep(pre) {
  background: var(--td-gray-color-1);
  border: var(--kl-border-width) solid var(--kl-border-color);
  border-radius: var(--kl-radius-md);
  padding: var(--kl-space-3) var(--kl-space-3);
  overflow-x: auto;
  margin: var(--kl-space-2) 0;
}

.md-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
}

.md-body :deep(blockquote) {
  border-left: 3px solid var(--td-gray-color-4);
  margin: var(--kl-space-2) 0;
  padding: var(--kl-space-1) var(--kl-space-3);
  color: var(--td-text-color-secondary);
}

.md-body :deep(table) {
  border-collapse: collapse;
  margin: var(--kl-space-2) 0;
  font-size: var(--kl-text-sm);
}

.md-body :deep(th),
.md-body :deep(td) {
  border: var(--kl-border-width) solid var(--kl-border-color-strong);
  padding: var(--kl-space-1) var(--kl-space-2);
}

.md-body :deep(th) {
  background: var(--td-bg-color-secondarycontainer);
}

.md-body :deep(a) {
  color: var(--td-brand-color);
}

.md-body :deep(sup.citation) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 var(--kl-space-1);
  margin: 0 2px;
  border-radius: var(--kl-radius-full);
  background: var(--td-gray-color-3);
  color: var(--td-text-color-primary);
  font-size: var(--kl-text-xs);
  font-weight: var(--kl-weight-semibold);
  cursor: pointer;
  vertical-align: super;
  transition: background var(--kl-duration-fast) var(--kl-ease-default),
    color var(--kl-duration-fast) var(--kl-ease-default);
}

.md-body :deep(sup.citation:hover) {
  background: var(--kl-accent);
  color: #fff;
}
</style>
