<template>
  <div class="retrieval-test">
    <PageHeader title="检索测试" subtitle="调试混合检索与重排效果" />
    <t-row :gutter="16">
      <!-- 左侧：查询输入 -->
      <t-col :span="4">
        <t-card title="查询配置" :bordered="false">
          <t-form :data="formData" :label-width="80">
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
              <t-textarea
                v-model="formData.query"
                placeholder="请输入查询内容"
                :autosize="{ minRows: 3, maxRows: 6 }"
              />
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
            <t-form-item label="图谱增强">
              <t-switch v-model="formData.enable_graph" />
            </t-form-item>
            <t-form-item label="Wiki 加权">
              <t-switch v-model="formData.enable_wiki_boost" />
            </t-form-item>
            <t-form-item label="精排">
              <t-switch v-model="formData.enable_rerank" />
            </t-form-item>
            <t-form-item label="父块扩展">
              <t-switch v-model="formData.expand_parent" />
            </t-form-item>

            <t-collapse :borderless="true" style="margin-bottom: 16px">
              <t-collapse-panel value="adv" header="高级参数">
                <t-form-item label="自定义参数" help="关闭时使用后端默认值">
                  <t-switch v-model="useCustomParams" />
                </t-form-item>
                <template v-if="useCustomParams">
                  <t-form-item label="召回数/通道">
                    <t-slider v-model="advParams.recall_top_k" :min="10" :max="200" :step="10" />
                    <span class="slider-value">{{ advParams.recall_top_k }}</span>
                  </t-form-item>
                  <t-form-item label="向量阈值">
                    <t-slider v-model="advParams.vector_threshold" :min="0" :max="1" :step="0.01" />
                    <span class="slider-value">{{ advParams.vector_threshold.toFixed(2) }}</span>
                  </t-form-item>
                  <t-form-item label="关键词阈值">
                    <t-slider v-model="advParams.keyword_threshold" :min="0" :max="1" :step="0.01" />
                    <span class="slider-value">{{ advParams.keyword_threshold.toFixed(2) }}</span>
                  </t-form-item>
                  <t-form-item label="RRF k">
                    <t-input-number v-model="advParams.rrf_k" :min="1" :max="1000" theme="column" />
                  </t-form-item>
                  <t-form-item label="向量权重">
                    <t-slider v-model="advParams.vector_weight" :min="0" :max="1" :step="0.05" />
                    <span class="slider-value">{{ advParams.vector_weight.toFixed(2) }}</span>
                  </t-form-item>
                  <t-form-item label="关键词权重">
                    <t-slider v-model="advParams.keyword_weight" :min="0" :max="1" :step="0.05" />
                    <span class="slider-value">{{ advParams.keyword_weight.toFixed(2) }}</span>
                  </t-form-item>
                  <t-form-item label="精排阈值">
                    <t-slider v-model="advParams.rerank_threshold" :min="0" :max="1" :step="0.01" />
                    <span class="slider-value">{{ advParams.rerank_threshold.toFixed(2) }}</span>
                  </t-form-item>
                  <t-form-item label="Wiki 加权系数">
                    <t-slider v-model="advParams.wiki_boost" :min="1" :max="3" :step="0.1" />
                    <span class="slider-value">{{ advParams.wiki_boost.toFixed(1) }}</span>
                  </t-form-item>
                </template>
              </t-collapse-panel>
            </t-collapse>
            <t-form-item>
              <t-button
                theme="primary"
                block
                :loading="searching"
                :disabled="!canSearch"
                @click="handleSearch"
              >
                <template #icon><t-icon name="search" /></template>
                开始检索
              </t-button>
            </t-form-item>
          </t-form>
        </t-card>
      </t-col>

      <!-- 右侧：检索结果 -->
      <t-col :span="8">
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listKnowledgeBases } from '@/api/knowledgeBase'
import { retrieve, type RetrievalHit } from '@/api/retrieval'
import PageHeader from '@/components/PageHeader.vue'

const kbLoading = ref(false)
const searching = ref(false)
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

const useCustomParams = ref(false)

const advParams = reactive({
  recall_top_k: 50,
  vector_threshold: 0.15,
  keyword_threshold: 0.3,
  rrf_k: 60,
  vector_weight: 0.7,
  keyword_weight: 0.3,
  rerank_threshold: 0.2,
  wiki_boost: 1.3,
})

const canSearch = computed(() => {
  return formData.kb_ids.length > 0 && formData.query.trim().length > 0
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
      ...(useCustomParams.value ? { ...advParams } : {}),
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

.slider-value {
  margin-left: 12px;
  min-width: 30px;
  text-align: center;
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
