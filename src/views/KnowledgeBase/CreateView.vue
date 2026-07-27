<template>
  <div class="kb-create">
    <PageHeader title="新建知识库" back-to="/knowledge-bases" />

    <div class="create-body">
      <!-- 定义知识库 -->
      <section class="section-card">
        <h3 class="section-title">定义知识库</h3>
        <t-form :label-width="90">
          <t-form-item label="名称">
            <div class="input-with-count">
              <t-input v-model="form.name" placeholder="请输入知识库名称" :maxlength="50" />
              <span class="char-count">{{ form.name.length }} / 50</span>
            </div>
          </t-form-item>
          <t-form-item label="描述">
            <div class="input-with-count">
              <t-textarea
                v-model="form.description"
                placeholder="为快速了解核心内容，建议填写详细的知识库描述"
                :autosize="{ minRows: 3, maxRows: 6 }"
                :maxlength="400"
              />
              <span class="char-count">{{ form.description.length }} / 400</span>
            </div>
          </t-form-item>
          <t-form-item label="类型">
            <t-select v-model="form.type">
              <t-option value="document" label="文档知识库" />
              <t-option value="faq" label="FAQ 知识库" />
            </t-select>
          </t-form-item>
        </t-form>
      </section>

      <!-- 高级设置 -->
      <section class="section-card">
        <h3 class="section-title">高级设置</h3>
        <t-form :label-width="90">
          <t-form-item label="向量模型">
            <t-select v-model="form.embedding_model_id" placeholder="选择嵌入模型">
              <t-option v-for="m in embeddingModels" :key="m.id" :value="m.id" :label="`${m.model} (${m.dims}维)`" />
            </t-select>
          </t-form-item>
          <t-form-item label="启用 Wiki">
            <t-switch v-model="form.enable_wiki" />
          </t-form-item>
          <t-form-item label="知识图谱">
            <t-switch v-model="form.enable_graph" />
          </t-form-item>
        </t-form>
      </section>

      <!-- 检索设置 -->
      <section class="section-card">
        <h3 class="section-title">检索设置</h3>
        <SearchSettingsForm v-model="searchSettings" />
      </section>

      <div class="create-actions">
        <t-button variant="outline" @click="router.push('/knowledge-bases')">取消</t-button>
        <t-button theme="primary" :loading="creating" @click="handleCreate">确认创建</t-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import SearchSettingsForm from '@/components/SearchSettingsForm.vue'
import type { SearchSettings } from '@/components/SearchSettingsForm.vue'
import { createKnowledgeBase, listEmbeddingModels } from '@/api/knowledgeBase'

const router = useRouter()
const creating = ref(false)
const embeddingModels = ref<{ id: string; model: string; dims: number }[]>([])

const form = reactive({
  name: '',
  description: '',
  type: 'document',
  embedding_model_id: 'Qwen/Qwen3-Embedding-0.6B',
  enable_wiki: true,
  enable_graph: true,
})

const searchSettings = ref<SearchSettings>({
  strategy: 'hybrid',
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  topK: 10,
  minScore: 0.5,
  minScoreEnabled: true,
})

onMounted(async () => {
  try {
    const res = await listEmbeddingModels()
    embeddingModels.value = res.models
  } catch { /* fallback */ }
})

const handleCreate = async () => {
  if (!form.name.trim()) {
    MessagePlugin.warning('请输入知识库名称')
    return
  }
  creating.value = true
  try {
    const kb = await createKnowledgeBase({
      name: form.name,
      type: form.type,
      description: form.description || undefined,
      embedding_model_id: form.embedding_model_id,
      enable_wiki: form.enable_wiki,
      enable_graph: form.enable_graph,
    })
    MessagePlugin.success('创建成功')
    router.push(`/knowledge-bases/${kb.id}`)
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.kb-create {
  max-width: 720px;
  margin: 0 auto;
}

.create-body {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-5);
}

.section-card {
  background: var(--td-bg-color-container);
  border-radius: var(--kl-radius-card);
  padding: var(--kl-space-5) var(--kl-space-6);
  box-shadow: var(--kl-elevation-1);
}

.section-title {
  font-size: var(--kl-text-md);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  margin: 0 0 var(--kl-space-4);
}

.input-with-count {
  position: relative;
  width: 100%;
}

.char-count {
  position: absolute;
  right: var(--kl-space-2);
  bottom: var(--kl-space-2);
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
}

.create-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--kl-space-3);
  padding-top: var(--kl-space-2);
}
</style>
