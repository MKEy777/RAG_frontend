<template>
  <div class="retrieval-test">
    <PageHeader title="检索测试" subtitle="调试混合检索与重排效果" />
    <t-row :gutter="16">
      <!-- 左侧：查询输入 -->
      <t-col :span="searching || hits.length > 0 ? 4 : 12">
        <t-card title="查询配置" :bordered="false" class="config-card">
          <t-form :data="formData" :label-width="72" class="compact-form">
            <t-form-item label="知识库">
              <t-select
                v-model="formData.kb_ids"
                :options="kbOptions"
                :loading="kbLoading"
                multiple
                placeholder="请选择知识库"
              />
            </t-form-item>
            <t-form-item label="查询文本">
              <div class="query-row">
                <t-textarea
                  v-model="formData.query"
                  placeholder="请输入查询内容"
                  :autosize="{ minRows: 1, maxRows: 5 }"
                  :maxlength="500"
                />
                <t-button
                  theme="primary"
                  shape="square"
                  :loading="searching"
                  :disabled="!canSearch"
                  class="search-btn"
                  @click="handleSearch"
                >
                  <template #icon><t-icon name="search" /></template>
                </t-button>
              </div>
            </t-form-item>
            <t-form-item label="Top K">
              <t-slider
                v-model="formData.top_k"
                :min="1"
                :max="50"
                :step="1"
              />
              <span class="slider-value">{{ formData.top_k }}</span>
            </t-form-item>
            <t-form-item label="检索模式">
              <t-radio-group v-model="formData.search_mode" variant="default-filled" size="small">
                <t-radio value="hybrid">混合</t-radio>
                <t-radio value="vector">向量</t-radio>
                <t-radio value="fulltext">全文</t-radio>
              </t-radio-group>
            </t-form-item>
            <div class="switch-grid">
              <t-form-item label="图谱增强">
                <t-switch v-model="formData.enable_graph" size="small" />
              </t-form-item>
              <t-form-item label="Wiki 加权">
                <div class="wiki-inline">
                  <t-switch v-model="formData.enable_wiki_boost" size="small" />
                  <t-input-number
                    v-model="advParams.wiki_boost"
                    :min="1" :max="3" :step="0.1" :decimal-places="1"
                    :disabled="!formData.enable_wiki_boost"
                    size="small" theme="column"
                    class="wiki-num"
                  />
                </div>
              </t-form-item>
              <t-form-item label="Reranker">
                <t-switch v-model="formData.enable_rerank" size="small" />
              </t-form-item>
              <t-form-item label="父块扩展">
                <t-switch v-model="formData.expand_parent" size="small" />
              </t-form-item>
            </div>
          </t-form>
        </t-card>
      </t-col>

      <!-- 右侧：检索结果 -->
      <t-col v-if="searching || hits.length > 0" :span="8">
        <t-card title="检索结果" :bordered="false">
          <template #action>
            <div class="result-actions">
              <t-checkbox v-model="hideGraph" size="small">隐藏图谱切片</t-checkbox>
              <t-tag v-if="displayHits.length > 0" theme="primary" variant="light">
                共 {{ displayHits.length }} 条结果
              </t-tag>
            </div>
          </template>

          <t-loading :loading="searching">
            <div v-if="hits.length === 0 && !searching" class="empty-state">
              <t-empty description="暂无检索结果，请输入查询并点击检索" />
            </div>

            <div v-else class="hits-list">
              <t-card
                v-for="(hit, index) in displayHits"
                :key="hit.chunk_id"
                :bordered="true"
                class="hit-card"
                hover-shadow
              >
                <template #title>
                  <div class="hit-header">
                    <t-tag theme="primary" variant="light">#{{ index + 1 }}</t-tag>
                    <span class="hit-score">分数: {{ hit.score.toFixed(4) }}</span>
                    <t-tag :theme="getChannelTheme(hit.channel)" size="small">
                      {{ hit.channel }}
                    </t-tag>
                    <t-tag theme="default" size="small">{{ hit.chunk_type }}</t-tag>
                  </div>
                </template>

                <div class="hit-meta">
                  <span>文档: {{ hit.document_id.slice(0, 8) }}...</span>
                  <span v-if="hit.title_path">路径: {{ hit.title_path }}</span>
                </div>

                <t-collapse>
                  <t-collapse-panel value="content" header="查看内容">
                    <pre class="hit-content">{{ hit.content }}</pre>
                  </t-collapse-panel>
                </t-collapse>
              </t-card>
            </div>
          </t-loading>
        </t-card>
      </t-col>
    </t-row>

    <!-- 测试历史 -->
    <div class="history-section">
      <div class="history-title">测试历史</div>
      <div class="history-list">
        <div
          v-for="h in serverHistory"
          :key="h.id"
          class="history-item"
          @click="formData.query = h.query"
        >
          <span class="history-query">{{ h.query }}</span>
          <div class="history-right">
            <span class="history-meta">{{ h.hit_count }} 条 · {{ h.duration_ms }}ms · {{ h.created_at }}</span>
            <t-icon name="delete" class="history-delete" @click.stop="handleDeleteHistory(h.id)" />
          </div>
        </div>
        <div v-if="!serverHistory.length && !historyLoading" class="history-empty">暂无测试历史</div>
      </div>
    </div>

    <div class="adv-toggle" @click="showSettingsDialog = true">
      <t-icon name="setting" size="14px" />
      <span>高级参数（调试用）</span>
    </div>

    <t-dialog
      v-model:visible="showSettingsDialog"
      header="检索参数配置"
      width="560px"
      :confirm-btn="{ content: '确定' }"
      @confirm="showSettingsDialog = false"
    >
      <SearchSettingsForm v-model="searchSettings" />
      <div class="adv-extra-params">
        <div class="formula-bar">
          <div class="formula-line">
            <span>RRF = 1/(</span>
            <t-input-number v-model="advParams.rrf_k" :min="1" :max="1000" size="small" theme="column" class="f-input" />
            <span>+ rank)</span>
            <span class="f-note">k 越大排名差异越小</span>
          </div>
        </div>
        <div class="params-row">
          <t-form-item label="召回数" help="每通道检索量">
            <t-input-number v-model="advParams.recall_top_k" :min="10" :max="200" :step="10" size="small" theme="column" />
          </t-form-item>
          <t-form-item label="Embedding 阈值" help="过滤低分向量">
            <t-input-number v-model="advParams.vector_threshold" :min="0" :max="1" :step="0.01" :decimal-places="2" size="small" theme="column" />
          </t-form-item>
          <t-form-item label="BM25 阈值" help="过滤低分关键词">
            <t-input-number v-model="advParams.keyword_threshold" :min="0" :max="1" :step="0.01" :decimal-places="2" size="small" theme="column" />
          </t-form-item>
          <t-form-item label="Reranker 阈值" help="丢弃低分结果">
            <t-input-number v-model="advParams.rerank_threshold" :min="0" :max="1" :step="0.01" :decimal-places="2" size="small" theme="column" />
          </t-form-item>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { listKnowledgeBases } from '@/api/knowledgeBase'
import { retrieve, listRetrievalHistory, deleteRetrievalHistory, type RetrievalHit, type RetrievalHistoryItem } from '@/api/retrieval'
import PageHeader from '@/components/PageHeader.vue'
import SearchSettingsForm from '@/components/SearchSettingsForm.vue'
import type { SearchSettings } from '@/components/SearchSettingsForm.vue'

const route = useRoute()

const kbLoading = ref(false)
const searching = ref(false)
const showSettingsDialog = ref(false)
const hideGraph = ref(false)
const kbOptions = ref<{ label: string; value: string }[]>([])
const hits = ref<RetrievalHit[]>([])
const serverHistory = ref<RetrievalHistoryItem[]>([])
const historyLoading = ref(false)

const searchSettings = ref<SearchSettings>({
  strategy: 'hybrid',
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  topK: 10,
  minScore: 0.5,
  minScoreEnabled: true,
})

const displayHits = computed(() => {
  if (!hideGraph.value) return hits.value
  return hits.value.filter((h) => h.channel !== 'graph')
})

const formData = reactive({
  kb_ids: [] as string[],
  query: '',
  top_k: 10,
  enable_graph: false,
  enable_wiki_boost: false,
  enable_rerank: true,
  expand_parent: true,
  search_mode: 'hybrid' as 'hybrid' | 'vector' | 'fulltext',
})

const advParams = reactive({
  recall_top_k: 50,
  vector_threshold: 0.15,
  keyword_threshold: 0.3,
  rrf_k: 60,
  vector_weight: 0.7,
  keyword_weight: 0.3,
  rerank_threshold: 0.2,
  wiki_boost: 1,
})

const DEFAULT_ADV = { ...advParams }

watch(() => searchSettings.value.vectorWeight, (v) => {
  advParams.vector_weight = v
  advParams.keyword_weight = Math.round((1 - v) * 100) / 100
})

watch(() => searchSettings.value.topK, (v) => {
  formData.top_k = v
})

const canSearch = computed(() => {
  return formData.kb_ids.length > 0 && formData.query.trim().length > 0
})

const fetchHistory = async () => {
  historyLoading.value = true
  try {
    const res = await listRetrievalHistory(formData.kb_ids[0], 1, 20)
    serverHistory.value = res.items
  } catch { /* ignore */ } finally {
    historyLoading.value = false
  }
}

const handleDeleteHistory = async (testId: string) => {
  try {
    await deleteRetrievalHistory(testId)
    fetchHistory()
  } catch { /* ignore */ }
}

let lastWikiBoost = 1.3

watch(() => formData.enable_wiki_boost, (on) => {
  if (on) {
    advParams.wiki_boost = lastWikiBoost
  } else {
    lastWikiBoost = advParams.wiki_boost
    advParams.wiki_boost = 1
  }
})

const getChannelTheme = (channel: string) => {
  switch (channel) {
    case 'vector':
      return 'primary'
    case 'keyword':
      return 'success'
    case 'graph':
      return 'warning'
    default:
      return 'default'
  }
}

const fetchKbOptions = async () => {
  kbLoading.value = true
  try {
    const res = await listKnowledgeBases(1, 100)
    kbOptions.value = res.items.map((kb) => ({
      label: kb.name,
      value: kb.id,
    }))
  } finally {
    kbLoading.value = false
  }
}

const handleSearch = async () => {
  if (!canSearch.value) {
    MessagePlugin.warning('请选择知识库并输入查询文本')
    return
  }

  searching.value = true
  hits.value = []
  try {
    const res = await retrieve({
      kb_ids: formData.kb_ids,
      query: formData.query,
      top_k: formData.top_k,
      enable_graph: formData.enable_graph,
      enable_wiki_boost: formData.enable_wiki_boost,
      enable_rerank: formData.enable_rerank,
      expand_parent: formData.expand_parent,
      search_mode: formData.search_mode,
      ...advParams,
    })
    hits.value = res.hits
    fetchHistory()
    if (res.hits.length === 0) {
      MessagePlugin.info('未找到相关结果')
    }
  } catch {
    MessagePlugin.error('检索失败')
  } finally {
    searching.value = false
  }
}

onMounted(async () => {
  await fetchKbOptions()
  const kbId = route.query.kb_id as string
  if (kbId && !formData.kb_ids.includes(kbId)) {
    formData.kb_ids.push(kbId)
  }
  fetchHistory()
})
</script>

<style scoped>
.retrieval-test {
  max-width: var(--kl-content-max-width);
  margin: 0 auto;
}

.retrieval-test :deep(.page-header) {
  padding-bottom: var(--kl-space-2);
  margin-bottom: var(--kl-space-3);
}

.retrieval-test :deep(.t-card__title) {
  font-size: 15px;
}

.retrieval-test :deep(.t-card__header) {
  padding: var(--kl-space-2) var(--kl-space-4) 0;
}

.retrieval-test :deep(.t-card__body) {
  padding: var(--kl-space-2) var(--kl-space-4) var(--kl-space-3);
}

.compact-form :deep(.t-form__item) {
  margin-bottom: var(--kl-space-2);
}

.query-row {
  display: flex;
  gap: var(--kl-space-2);
  width: 100%;
}

.query-row :deep(.t-textarea) {
  flex: 1;
}

.search-btn {
  flex-shrink: 0;
  align-self: stretch;
}

.switch-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 var(--kl-space-3);
}

.switch-grid :deep(.t-form__item) {
  margin-bottom: var(--kl-space-1);
}

.wiki-inline {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
}

.wiki-num {
  width: 72px;
}

.adv-collapse {
  margin-bottom: 12px;
}

.adv-collapse :deep(.t-collapse-panel__content) {
  padding: 8px 0 0;
}

.adv-toggle {
  display: flex;
  align-items: center;
  gap: var(--kl-space-1);
  margin-top: var(--kl-space-1);
  padding: var(--kl-space-1) var(--kl-space-3);
  font-size: var(--kl-text-sm);
  font-weight: var(--kl-weight-medium);
  color: var(--td-text-color-secondary);
  cursor: pointer;
  border-radius: var(--kl-radius-md);
  transition: background var(--kl-duration-fast) var(--kl-ease-default);
}

.adv-toggle:hover {
  background: var(--td-gray-color-2);
}

.adv-extra-params {
  margin-top: var(--kl-space-4);
  padding-top: var(--kl-space-4);
  border-top: var(--kl-border-width) solid var(--td-component-stroke);
}

.params-row {
  display: flex;
  gap: var(--kl-space-4);
  width: 100%;
}

.params-row :deep(.t-form__item) {
  flex: 1;
  margin-bottom: 0;
}

.formula-bar {
  width: 100%;
  padding-bottom: var(--kl-space-2);
  margin-bottom: var(--kl-space-1);
  border-bottom: 1px dashed var(--td-border-level-1-color);
}

.formula-line {
  display: flex;
  align-items: center;
  gap: var(--kl-space-1);
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-bold);
  color: var(--td-text-color-primary);
  white-space: nowrap;
  overflow-x: auto;
}

.f-input {
  width: 72px;
}

.f-note {
  font-size: var(--kl-text-xs);
  font-weight: var(--kl-weight-regular);
  color: var(--td-text-color-placeholder);
  margin-left: var(--kl-space-2);
}

.slider-value {
  margin-left: var(--kl-space-3);
  min-width: 30px;
  text-align: center;
  font-size: var(--kl-text-xs);
}

.empty-state {
  padding: 60px 0;
}

.hits-list {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-3);
}

.hit-card {
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--kl-radius-card);
}

.hit-header {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  flex-wrap: wrap;
}

.hit-score {
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
}

.hit-meta {
  display: flex;
  gap: var(--kl-space-4);
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  margin-bottom: var(--kl-space-2);
}

.hit-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: var(--kl-text-sm);
  line-height: 1.6;
  background: var(--td-bg-color-secondarycontainer);
  padding: var(--kl-space-3);
  border-radius: var(--kl-radius-md);
  max-height: 300px;
  overflow: auto;
}

.result-actions {
  display: flex;
  align-items: center;
  gap: var(--kl-space-3);
}

.history-section {
  margin-top: var(--kl-space-5);
}

.history-title {
  font-size: var(--kl-text-sm);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  margin-bottom: var(--kl-space-2);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-1);
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--kl-space-2) var(--kl-space-3);
  border-radius: var(--kl-radius-md);
  cursor: pointer;
  transition: background var(--kl-duration-fast) var(--kl-ease-default);
}

.history-item:hover {
  background: var(--td-gray-color-2);
}

.history-query {
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.history-meta {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
  margin-left: var(--kl-space-3);
}

.history-right { display: flex; align-items: center; gap: var(--kl-space-2); flex-shrink: 0; }
.history-delete { color: var(--td-text-color-placeholder); cursor: pointer; opacity: 0; transition: opacity 0.15s; }
.history-item:hover .history-delete { opacity: 1; }
.history-delete:hover { color: var(--td-error-color); }
.history-empty { padding: var(--kl-space-4); text-align: center; color: var(--td-text-color-placeholder); font-size: var(--kl-text-sm); }
</style>
