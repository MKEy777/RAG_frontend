<template>
  <div class="chat-input" :class="{ large }">
    <div class="chat-input-row">
      <t-textarea
        v-model="text"
        :autosize="{ minRows: large ? 2 : 1, maxRows: 6 }"
        :placeholder="placeholder"
        :disabled="disabled"
        class="chat-input-textarea"
        @keydown="handleKeydown"
      />
    </div>
    <div class="chat-input-actions">
      <div class="actions-left"><slot name="actions-left" /></div>
      <div class="actions-right">
        <slot name="actions-right" />
        <t-button
          v-if="streaming"
          shape="circle"
          theme="danger"
          variant="outline"
          size="small"
          class="chat-input-btn"
          @click="emit('stop')"
        >
          <t-icon name="stop" />
        </t-button>
        <t-button
          v-else
          shape="circle"
          theme="primary"
          size="small"
          :disabled="disabled || !text.trim()"
          class="chat-input-btn"
          @click="submit"
        >
          <t-icon name="send" />
        </t-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{ disabled?: boolean; streaming?: boolean; placeholder?: string; large?: boolean }>(),
  { disabled: false, streaming: false, large: false, placeholder: '输入问题，Enter 发送，Shift+Enter 换行' }
)

const emit = defineEmits<{ send: [text: string]; stop: [] }>()
const text = ref('')

const submit = () => {
  const value = text.value.trim()
  if (!value) return
  emit('send', value)
  text.value = ''
}

const handleKeydown = (_value: string, ctx: { e: KeyboardEvent }) => {
  const e = ctx.e
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    submit()
  }
}
</script>

<style scoped>
.chat-input {
  display: flex;
  flex-direction: column;
  background: var(--td-gray-color-1);
  border: none;
  border-radius: var(--kl-radius-xl);
  padding: var(--kl-space-3) var(--kl-space-3) var(--kl-space-2) var(--kl-space-4);
  transition: background var(--kl-duration-normal) var(--kl-ease-default);
}

.chat-input:focus-within {
  background: var(--td-bg-color-container);
  box-shadow: var(--kl-elevation-2);
}

.chat-input-row {
  display: flex;
}

.chat-input-textarea:deep(.t-textarea) {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}

.chat-input-textarea:deep(.t-textarea.t-is-focused) {
  border: none !important;
  box-shadow: none !important;
}

.chat-input-textarea :deep(.t-textarea__inner),
.chat-input-textarea :deep(.t-textarea__inner:focus) {
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  resize: none;
  padding: 0;
  font-size: 15px;
  line-height: var(--kl-space-6);
  background: transparent;
}

.chat-input.large {
  border-radius: var(--kl-radius-xl);
  padding: var(--kl-space-4) var(--kl-space-4) var(--kl-space-2) var(--kl-space-5);
}

.chat-input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--kl-space-2);
}

.actions-left,
.actions-right {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
}

.chat-input-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
}
</style>
