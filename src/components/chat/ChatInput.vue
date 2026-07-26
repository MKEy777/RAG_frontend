<template>
  <div class="chat-input" :class="{ large }">
    <div class="chat-input-row">
      <t-textarea
        v-model="text"
        :autosize="{ minRows: large ? 3 : 1, maxRows: 6 }"
        :placeholder="placeholder"
        :disabled="disabled"
        class="chat-input-textarea"
        @keydown="handleKeydown"
      />
      <t-button
        v-if="streaming"
        shape="circle"
        theme="danger"
        variant="outline"
        class="chat-input-btn"
        @click="emit('stop')"
      >
        <t-icon name="stop" />
      </t-button>
      <t-button
        v-else
        shape="circle"
        theme="primary"
        :disabled="disabled || !text.trim()"
        class="chat-input-btn"
        @click="submit"
      >
        <t-icon name="send" />
      </t-button>
    </div>
    <div v-if="$slots['actions-left'] || $slots['actions-right']" class="chat-input-actions">
      <div class="actions-left"><slot name="actions-left" /></div>
      <div class="actions-right"><slot name="actions-right" /></div>
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
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: 24px;
  padding: 10px 10px 8px 16px;
  box-shadow: var(--td-shadow-1);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.chat-input:focus-within {
  border-color: var(--td-gray-color-6);
  box-shadow: var(--td-shadow-2);
}

.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.chat-input-textarea :deep(.t-textarea__inner) {
  border: none;
  box-shadow: none !important;
  resize: none;
  padding: 0;
  font-size: 15px;
  line-height: 32px;
  background: transparent;
}

.chat-input.large {
  border-radius: 20px;
  padding: 14px 14px 10px 20px;
}

.chat-input-btn {
  flex-shrink: 0;
}

.chat-input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
}

.actions-left,
.actions-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
