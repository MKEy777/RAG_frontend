<template>
  <div class="kb-list">
    <PageHeader :title="cfg.title" :subtitle="cfg.subtitle" />

    <div v-if="loading" class="kb-grid">
      <div v-for="i in 4" :key="i" class="kb-card skeleton-card">
        <t-skeleton :row-col="[{ width: '60%' }, { width: '100%' }, { width: '40%' }]" animation="gradient" />
      </div>
    </div>

    <div v-else-if="bases.length" class="kb-grid">
      <div
        v-for="kb in bases"
        :key="kb.id"
        class="kb-card"
        @click="router.push(`/knowledge-bases/${kb.id}/${mode}`)"
      >
        <div class="kb-card-head">
          <div class="kb-card-icon">
            <t-icon :name="cfg.icon" size="20px" />
          </div>
          <span class="kb-card-name">{{ kb.name }}</span>
        </div>
        <p class="kb-card-desc">{{ kb.description || '暂无描述' }}</p>
        <div class="kb-card-meta">
          <span>{{ kb.doc_count ?? '-' }} 个文档</span>
        </div>
      </div>
    </div>

    <t-empty v-else :description="cfg.empty" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { listKnowledgeBases, type KnowledgeBase } from '@/api/knowledgeBase'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const knowledgeBases = ref<KnowledgeBase[]>([])

const mode = computed(() => (route.meta.mode as string) || 'wiki')

const configs: Record<string, { title: string; subtitle: string; icon: string; empty: string }> = {
  wiki: { title: '知识 Wiki', subtitle: '选择一个知识库查看其 Wiki', icon: 'book', empty: '暂无启用 Wiki 的知识库' },
  graph: { title: '知识图谱', subtitle: '选择一个知识库查看其知识图谱', icon: 'relation', empty: '暂无启用图谱的知识库' },
}
const cfg = computed(() => configs[mode.value] ?? configs.wiki)

const bases = computed(() =>
  knowledgeBases.value.filter((kb) => (mode.value === 'graph' ? kb.enable_graph : kb.enable_wiki)),
)

onMounted(async () => {
  loading.value = true
  try {
    const res = await listKnowledgeBases(1, 100)
    knowledgeBases.value = res.items
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.kb-list {
  max-width: var(--kl-content-max-width);
  margin: 0 auto;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--kl-space-4);
  margin-top: var(--kl-space-5);
}

.kb-card {
  background: var(--td-gray-color-1);
  border-radius: var(--kl-radius-card);
  padding: var(--kl-card-padding);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-3);
  min-height: 120px;
  box-shadow: var(--kl-elevation-1);
  transition: box-shadow var(--kl-duration-fast) var(--kl-ease-default),
    background var(--kl-duration-fast) var(--kl-ease-default);
}

.kb-card:hover {
  box-shadow: var(--kl-elevation-2);
  background: var(--td-bg-color-container);
}

.skeleton-card {
  cursor: default;
}

.kb-card-head {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
}

.kb-card-icon {
  width: var(--kl-control-height-md);
  height: var(--kl-control-height-md);
  border-radius: var(--kl-radius-lg);
  background: var(--kl-accent-light);
  color: var(--kl-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kb-card-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kb-card-desc {
  flex: 1;
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
  line-height: var(--kl-leading-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.kb-card-meta {
  display: flex;
  gap: var(--kl-space-3);
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  padding-top: var(--kl-space-2);
  border-top: var(--kl-border-width) solid var(--td-component-stroke);
}
</style>