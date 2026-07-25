<template>
  <div class="retrieval-test">
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
            <div v-if="hits.length === 0 && !searching" class="empty-state">
              <t-empty description="暂无检索结果，请输入查询并点击检索" />
            </div>

            <div v-else class="hits-list">
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

const kbLoading = ref(false)
const searching = ref(false)
const kbOptions = ref<{ label: string; value: string }[]>([])
const hits = ref<RetrievalHit[]>([])

const formData = reactive({
  kb_ids: [] as string[],
  query: '',
  top_k: 10,
  enable_graph: false,
  enable_wiki_boost: false,
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
  try {
    const res = await retrieve({
      kb_ids: formData.kb_ids,
      query: formData.query,
      top_k: formData.top_k,
      enable_graph: formData.enable_graph,
      enable_wiki_boost: formData.enable_wiki_boost,
    })
    hits.value = res.hits
    if (res.hits.length === 0) {
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
  height: 100%;
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
  border: 1px solid var(--td-border-level-1-color);
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
  border-radius: 4px;
  max-height: 300px;
  overflow: auto;
}
</style>
