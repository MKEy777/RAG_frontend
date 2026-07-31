<template>
  <div class="kb-settings">
    <PageHeader title="设置知识库" :back-to="`/knowledge-bases/${kbId}`" />

    <div class="settings-body">
      <section class="section-card">
        <h3 class="section-title">基本信息</h3>
        <t-form :label-width="90">
          <t-form-item label="名称">
            <t-input v-model="settingsForm.name" placeholder="输入知识库名称" />
          </t-form-item>
          <t-form-item label="描述">
            <t-textarea
              v-model="settingsForm.description"
              placeholder="简单描述该知识库的用途"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </t-form-item>
          <t-form-item label="Wiki" help="文档解析后自动生成百科页面，并为切片生成 FAQ 问句提升召回">
            <t-switch v-model="settingsForm.enable_wiki" />
          </t-form-item>
          <t-form-item label="知识图谱" help="抽取实体关系构建图谱，检索可图谱增强">
            <t-switch v-model="settingsForm.enable_graph" />
          </t-form-item>
        </t-form>
      </section>

      <section class="section-card">
        <h3 class="section-title">检索设置</h3>
        <SearchSettingsForm v-model="searchSettings" />
      </section>

      <div class="settings-actions">
        <t-button variant="outline" @click="handleCancel">取消</t-button>
        <t-button :loading="savingSettings" @click="saveSettings">确认</t-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import SearchSettingsForm from '@/components/SearchSettingsForm.vue'
import type { SearchSettings } from '@/components/SearchSettingsForm.vue'
import { getKnowledgeBase, updateKnowledgeBase } from '@/api/knowledgeBase'

const route = useRoute()
const router = useRouter()
const kbId = route.params.id as string

const savingSettings = ref(false)
const settingsForm = reactive({
  name: '',
  description: '',
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
    const kb = await getKnowledgeBase(kbId)
    settingsForm.name = kb.name
    settingsForm.description = kb.description || ''
    settingsForm.enable_wiki = kb.enable_wiki
    settingsForm.enable_graph = kb.enable_graph
    const rc = kb.retrieval_config || {}
    searchSettings.value = {
      strategy: (rc.search_mode as SearchSettings['strategy']) ?? 'hybrid',
      vectorWeight: (rc.vector_weight as number) ?? 0.7,
      keywordWeight: (rc.keyword_weight as number) ?? 0.3,
      topK: (rc.top_k as number) ?? 10,
      minScore: (rc.vector_threshold as number) ?? 0.5,
      minScoreEnabled: rc.vector_threshold != null,
    }
  } catch {
    // client 拦截器已弹错
  }
})

const handleCancel = () => {
  router.push(`/knowledge-bases/${kbId}`)
}

const saveSettings = async () => {
  if (savingSettings.value) return
  savingSettings.value = true
  try {
    const s = searchSettings.value
    const threshold = s.minScoreEnabled ? s.minScore : null
    const retrieval_config = {
      search_mode: s.strategy,
      top_k: s.topK,
      vector_weight: s.vectorWeight,
      keyword_weight: s.keywordWeight,
      vector_threshold: threshold,
      keyword_threshold: threshold,
    }
    await updateKnowledgeBase(kbId, { ...settingsForm, retrieval_config })
    MessagePlugin.success('配置已保存')
    router.push(`/knowledge-bases/${kbId}`)
  } catch {
    // client 拦截器已弹错
  } finally {
    savingSettings.value = false
  }
}
</script>

<style scoped>
.kb-settings {
  max-width: 720px;
  margin: 0 auto;
}

.settings-body {
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

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--kl-space-3);
}
</style>