<template>
  <div class="citation-card">
    <div class="citation-card-title">{{ reference.title_path || '未命名片段' }}</div>
    <div class="citation-card-meta">
      <t-tag size="small" variant="light" theme="primary">{{ reference.channel }}</t-tag>
      <t-tag size="small" variant="outline">{{ reference.chunk_type }}</t-tag>
      <span class="citation-card-score">相关度 {{ reference.score.toFixed(3) }}</span>
    </div>
    <div class="citation-card-link" @click="openChunk">查看切片 →</div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ChatReference } from '@/stores/chat'
import { getDocument } from '@/api/documents'

const props = defineProps<{ reference: ChatReference }>()
const router = useRouter()

const openChunk = async () => {
  try {
    const doc = await getDocument(props.reference.document_id)
    router.push({
      path: `/knowledge-bases/${doc.knowledge_base_id}/documents/${doc.id}/chunks`,
      query: { from: 'chat', chunk_id: props.reference.chunk_id },
    })
  } catch {
    // client 拦截器已弹错
  }
}
</script>

<style scoped>
.citation-card {
  width: 280px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-large);
  box-shadow: var(--td-shadow-2);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.citation-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  line-height: 1.4;
  word-break: break-all;
}

.citation-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.citation-card-score {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.citation-card-link {
  font-size: 12px;
  color: var(--td-brand-color);
  cursor: pointer;
}

.citation-card-link:hover {
  color: var(--td-brand-color-active);
}
</style>
