<template>
  <div class="chat-refs">
    <div class="chat-refs-toggle" @click="expanded = !expanded">
      <t-icon :name="expanded ? 'chevron-down' : 'chevron-right'" size="14px" />
      <span>参考来源 {{ references.length }} 条</span>
    </div>
    <transition name="refs-fade">
      <div v-if="expanded" class="chat-refs-list">
        <div
          v-for="ref in references"
          :key="ref.id"
          class="chat-refs-item"
          @click="openChunk(ref)"
        >
          <span class="chat-refs-badge">{{ ref.id.slice(1) }}</span>
          <span class="chat-refs-title">{{ ref.title_path || '未命名片段' }}</span>
          <t-tag size="small" variant="light" theme="primary">{{ ref.channel }}</t-tag>
          <span class="chat-refs-score">{{ ref.score.toFixed(3) }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref as vueRef } from 'vue'
import { useRouter } from 'vue-router'
import type { ChatReference } from '@/stores/chat'
import { getDocument } from '@/api/documents'

defineProps<{ references: ChatReference[] }>()

const expanded = vueRef(false)
const router = useRouter()

const openChunk = async (reference: ChatReference) => {
  try {
    const doc = await getDocument(reference.document_id)
    router.push(`/knowledge-bases/${doc.knowledge_base_id}/documents/${doc.id}/chunks`)
  } catch {
    // client 拦截器已弹错
  }
}
</script>

<style scoped>
.chat-refs {
  margin-top: 10px;
  border-top: 1px solid var(--td-component-stroke);
  padding-top: 8px;
}

.chat-refs-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  user-select: none;
}

.chat-refs-toggle:hover {
  color: var(--td-brand-color);
}

.chat-refs-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-refs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: background 0.15s ease;
}

.chat-refs-item:hover {
  background: var(--td-bg-color-secondarycontainer);
}

.chat-refs-badge {
  width: 18px;
  height: 18px;
  border-radius: var(--td-radius-circle);
  background: var(--td-brand-color-1);
  color: var(--td-brand-color-7);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-refs-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-refs-score {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
}

.refs-fade-enter-active,
.refs-fade-leave-active {
  transition: opacity 0.15s ease;
}

.refs-fade-enter-from,
.refs-fade-leave-to {
  opacity: 0;
}
</style>
