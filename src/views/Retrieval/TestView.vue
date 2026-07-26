<template>
  <div class="retrieval-test">
    <PageHeader title="检索测试" subtitle="调试混合检索与重排效果" />
    <t-row :gutter="16">
      <!-- 左侧：查询输入 -->
      <t-col :span="searching || hits.length > 0 || faqHits.length > 0 ? 4 : 12">
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
                  :autosize="{ minRows: 2, maxRows: 5 }"
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
      <t-col v-if="searching || hits.length > 0 || faqHits.length > 0" :span="8">
        <t-card title="检索结果" :bordered="false">
          <template #action>
            <t-tag v-if="hits.length > 0" theme="primary" variant="light">
              共 {{ hits.length }} 条结果
            </t-tag>
          </template>

          <t-loading :loading="searching">
            <div v-if="hits.length === 0 && faqHits.length === 0 && !searching" class="empty-state">
              <t-empty description="暂无检索结果，请输入查询并点击检索" />
            </div>

            <div v-else class="hits-list">
              <template v-if="faqHits.length > 0">
                <div class="faq-section-label">
                  <t-tag theme="warning" variant="light">FAQ 命中 {{ faqHits.length }} 条（独立路径，不参与融合）</t-tag>
                </div>
                <t-card
                  v-for="hit in faqHits"
                  :key="hit.chunk_id"
                  :bordered="true"
                  class="hit-card faq-hit-card"
                  hover-shadow
                >
                  <template #title>
                    <div class="hit-header">
                      <t-tag theme="warning" size="small">FAQ</t-tag>
                      <span class="hit-score">分数: {{ hit.score.toFixed(4) }}</span>
                    </div>
                  </template>
                  <pre class="hit-content">{{ hit.content }}</pre>
                </t-card>
              </template>

              <t-card
                v-for="(hit, index) in hits"
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

    <div class="adv-toggle" @click="showAdvParams = !showAdvParams">
      <t-icon :name="showAdvParams ? 'chevron-down' : 'chevron-right'" size="14px" />
      <span>高级参数（调试用）</span>
      <t-button v-if="showAdvParams" variant="text" size="small" theme="default" @click.stop="resetAdvParams">
        <template #icon><t-icon name="refresh" /></template>
        恢复默认
      </t-button>
    </div>
    <div v-show="showAdvParams" class="adv-card">
      <div class="formula-bar">
        <div class="formula-line">
          <span>score =</span>
          <t-input-number v-model="advParams.vector_weight" :min="0" :max="1" :step="0.05" :decimal-places="2" size="small" theme="column" class="f-input" />
          <span>× Embedding +</span>
          <t-input-number v-model="advParams.keyword_weight" :min="0" :max="1" :step="0.05" :decimal-places="2" size="small" theme="column" class="f-input" />
          <span>× BM25，RRF = 1/(</span>
          <t-input-number v-model="advParams.rrf_k" :min="1" :max="1000" size="small" theme="column" class="f-input" />
          <span>+ rank)</span>
        </div>
      </div>
      <div class="params-row">
        <t-form-item label="召回数" help="每通道检索量">
          <t-input-number v-model="advParams.recall_top_k" :min="10" :max="200" :step="10" size="small" theme="column" />
        </t-form-item>
        <t-form-item label="向量阈值" help="过滤低分向量">
          <t-input-number v-model="advParams.vector_threshold" :min="0" :max="1" :step="0.01" :decimal-places="2" size="small" theme="column" />
        </t-form-item>
        <t-form-item label="关键词阈值" help="过滤低分关键词">
          <t-input-number v-model="advParams.keyword_threshold" :min="0" :max="1" :step="0.01" :decimal-places="2" size="small" theme="column" />
        </t-form-item>
        <t-form-item label="Reranker 阈值" help="丢弃低分结果">
          <t-input-number v-model="advParams.rerank_threshold" :min="0" :max="1" :step="0.01" :decimal-places="2" size="small" theme="column" />
        </t-form-item>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listKnowledgeBases } from '@/api/knowledgeBase'
import { retrieve, type RetrievalHit } from '@/api/retrieval'
import PageHeader from '@/components/PageHeader.vue'

const kbLoading = ref(false)
const searching = ref(false)
const showAdvParams = ref(true)
const kbOptions = ref<{ label: string; value: string }[]>([])
const hits = ref<RetrievalHit[]>([])
const faqHits = ref<RetrievalHit[]>([])

const formData = reactive({
  kb_ids: [] as string[],
  query: '',
  top_k: 10,
  enable_graph: false,
  enable_wiki_boost: false,
  enable_rerank: true,
  expand_parent: true,
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

const resetAdvParams = () => {
  Object.assign(advParams, DEFAULT_ADV)
}

const canSearch = computed(() => {
  return formData.kb_ids.length > 0 && formData.query.trim().length > 0
})

watch(() => formData.enable_wiki_boost, (on) => {
  advParams.wiki_boost = on ? 1.3 : 1
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
  faqHits.value = []
  try {
    const res = await retrieve({
      kb_ids: formData.kb_ids,
      query: formData.query,
      top_k: formData.top_k,
      enable_graph: formData.enable_graph,
      enable_wiki_boost: formData.enable_wiki_boost,
      enable_rerank: formData.enable_rerank,
      expand_parent: formData.expand_parent,
      ...advParams,
    })
    hits.value = res.hits
    faqHits.value = res.faq_hits || []
    if (res.hits.length === 0 && faqHits.value.length === 0) {
      MessagePlugin.info('未找到相关结果')
    }
  } catch {
    MessagePlugin.error('检索失败')
  } finally {
    searching.value = false
  }
}

onMounted(fetchKbOptions)
</script>

<style scoped>
.retrieval-test {
  max-width: 1200px;
  margin: 0 auto;
}

.retrieval-test :deep(.page-header) {
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.retrieval-test :deep(.t-card__title) {
  font-size: 15px;
}

.retrieval-test :deep(.t-card__header) {
  padding: 10px 16px 0;
}

.retrieval-test :deep(.t-card__body) {
  padding: 8px 16px 12px;
}

.compact-form :deep(.t-form__item) {
  margin-bottom: 8px;
}

.query-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.query-row :deep(.t-textarea) {
  flex: 1;
}

.search-btn {
  flex-shrink: 0;
  align-self: flex-end;
  height: 32px;
}

.switch-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

.switch-grid :deep(.t-form__item) {
  margin-bottom: 4px;
}

.wiki-inline {
  display: flex;
  align-items: center;
  gap: 8px;
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
  gap: 6px;
  margin-top: 6px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  border-radius: var(--td-radius-medium);
  transition: background 0.15s;
}

.adv-toggle:hover {
  background: var(--td-gray-color-2);
}

.adv-card {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 20px;
  margin-top: 4px;
  padding: 10px 16px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-large);
}

.params-row {
  display: flex;
  gap: 16px;
  width: 100%;
}

.params-row :deep(.t-form__item) {
  flex: 1;
  margin-bottom: 0;
}

.formula-bar {
  width: 100%;
  padding-bottom: 10px;
  margin-bottom: 4px;
  border-bottom: 1px dashed var(--td-border-level-1-color);
}

.formula-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  overflow-x: auto;
}

.f-input {
  width: 72px;
}

.slider-value {
  margin-left: 12px;
  min-width: 30px;
  text-align: center;
  font-size: 12px;
}

.empty-state {
  padding: 60px 0;
}

.hits-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hit-card {
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-large);
}

.faq-hit-card {
  border-color: var(--td-warning-color-3);
}

.faq-section-label {
  margin-bottom: 4px;
}

.hit-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hit-score {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.hit-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin-bottom: 8px;
}

.hit-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  background: var(--td-bg-color-secondarycontainer);
  padding: 12px;
  border-radius: var(--td-radius-default);
  max-height: 300px;
  overflow: auto;
}
</style>
