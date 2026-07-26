<template>
  <div class="wiki-view">
    <PageHeader title="Wiki" subtitle="知识库自动生成的百科页面" back-to="">
      <template #actions>
        <t-select
          v-model="kbId"
          :options="kbOptions"
          placeholder="选择知识库"
          style="width: 240px"
          @change="handleKbChange"
        />
      </template>
    </PageHeader>
    <t-alert
      v-if="kbId && !featureEnabled"
      theme="warning"
      message="当前知识库未启用 Wiki 功能，请在创建时开启"
      style="margin-bottom: 16px"
    />
    <t-row :gutter="16">
      <t-col :span="4">
        <t-card title="Wiki 页面" :bordered="false" class="sidebar-card">
          <template #action>
            <t-button
              size="small"
              :loading="building"
              :disabled="building"
              @click="handleBuild"
            >
              生成 Wiki
            </t-button>
          </template>

          <t-empty v-if="pages.length === 0 && !loading" description="暂无 Wiki 页面" />

          <div v-else class="page-list">
            <div v-if="folderTree.length > 0" class="page-group">
              <div class="group-label">目录</div>
              <div
                class="page-item"
                :class="{ active: folderFilter === null }"
                @click="folderFilter = null"
              >
                全部页面
              </div>
              <div
                v-for="folder in folderTree"
                :key="folder.id"
                class="page-item folder-item"
                :class="{ active: folderFilter === folder.id }"
                :style="{ paddingLeft: `${8 + folder.depth * 14}px` }"
                @click="folderFilter = folderFilter === folder.id ? null : folder.id"
              >
                <t-icon name="folder" size="14px" />
                <span class="folder-name">{{ folder.name }}</span>
                <span class="folder-count">{{ folder.page_count }}</span>
              </div>
            </div>

            <div v-for="group in groupedPages" :key="group.kind" class="page-group">
              <div class="group-label">{{ kindLabels[group.kind] || group.kind }}</div>
              <div
                v-for="page in group.items"
                :key="page.page_id"
                class="page-item"
                :class="{ active: selected?.page_id === page.page_id }"
                @click="selectPage(page)"
              >
                {{ page.title }}
              </div>
            </div>
          </div>

          <div v-if="statusInfo" class="status-bar">
            <t-tag variant="light" size="small">共 {{ statusInfo.page_count }} 页</t-tag>
            <t-tag v-if="statusInfo.pending_count > 0" theme="warning" variant="light" size="small">
              处理中 {{ statusInfo.pending_count }}
            </t-tag>
          </div>
        </t-card>
      </t-col>

      <t-col :span="8">
        <t-card :bordered="false">
          <template #title>
            <div class="content-title">
              <span>{{ selected?.title || '选择页面查看详情' }}</span>
              <t-tag v-if="selected" size="small">{{ kindLabels[selected.kind] || selected.kind }}</t-tag>
            </div>
          </template>

          <t-loading :loading="contentLoading">
            <div v-if="!selected" class="empty-state">
              <t-empty description="请从左侧选择一个 Wiki 页面" />
            </div>

            <div v-else class="wiki-content" v-html="renderedContent" @click="handleContentClick" />
          </t-loading>
        </t-card>
      </t-col>
    </t-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { renderWikiMarkdown } from '@/utils/markdown'
import { listKnowledgeBases, type KnowledgeBase } from '@/api/knowledgeBase'
import PageHeader from '@/components/PageHeader.vue'
import {
  listWikiPages,
  getWikiPage,
  buildWiki,
  getWikiStatus,
  getWikiIndex,
  type WikiPageSummary,
  type WikiPageDetail,
  type WikiIndexFolder,
} from '@/api/wiki'

const route = useRoute()
const kbId = ref((route.params.id as string) || '')
const kbOptions = ref<{ label: string; value: string }[]>([])
const kbList = ref<KnowledgeBase[]>([])

const featureEnabled = computed(() => {
  const kb = kbList.value.find((k) => k.id === kbId.value)
  return kb ? kb.enable_wiki : true
})

const pages = ref<WikiPageSummary[]>([])
const folders = ref<WikiIndexFolder[]>([])
const folderFilter = ref<string | null>(null)
const selected = ref<WikiPageDetail | null>(null)
const loading = ref(false)
const contentLoading = ref(false)
const building = ref(false)
const statusInfo = ref<{ page_count: number; pending_count: number } | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const kindLabels: Record<string, string> = {
  index: '索引',
  overview: '概览',
  concept: '概念',
  entity: '实体',
  synthesis: '综合',
  comparison: '对比',
}

const groupedPages = computed(() => {
  const map = new Map<string, WikiPageSummary[]>()
  const order = ['index', 'overview', 'concept', 'entity', 'synthesis', 'comparison']
  for (const kind of order) map.set(kind, [])
  const visible = folderFilter.value
    ? pages.value.filter((p) => p.folder_id === folderFilter.value)
    : pages.value
  for (const p of visible) {
    const list = map.get(p.kind)
    if (list) list.push(p)
    else map.set(p.kind, [p])
  }
  return Array.from(map.entries())
    .filter(([, items]) => items.length > 0)
    .map(([kind, items]) => ({ kind, items }))
})

interface FolderNode extends WikiIndexFolder {
  depth: number
}

const folderTree = computed<FolderNode[]>(() => {
  const byParent = new Map<string | null, WikiIndexFolder[]>()
  for (const f of folders.value) {
    const list = byParent.get(f.parent_id) || []
    list.push(f)
    byParent.set(f.parent_id, list)
  }
  const out: FolderNode[] = []
  const walk = (pid: string | null, depth: number) => {
    for (const f of byParent.get(pid) || []) {
      out.push({ ...f, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

const renderedContent = computed(() => {
  if (!selected.value?.content) return ''
  return renderWikiMarkdown(selected.value.content)
})

const handleContentClick = (e: MouseEvent) => {
  const el = (e.target as HTMLElement).closest('[data-wiki-slug]')
  if (!el) return
  const slug = el.getAttribute('data-wiki-slug') || ''
  const page = pages.value.find((p) => p.slug === slug)
  if (page) selectPage(page)
  else MessagePlugin.warning(`页面不存在: ${slug}`)
}

const fetchPages = async () => {
  if (!kbId.value) return
  loading.value = true
  try {
    const [res, index] = await Promise.all([
      listWikiPages(kbId.value, 1, 200),
      getWikiIndex(kbId.value).catch(() => null),
    ])
    pages.value = res.items
    folders.value = index?.folders || []
  } finally {
    loading.value = false
  }
}

const handleKbChange = () => {
  selected.value = null
  statusInfo.value = null
  folderFilter.value = null
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  building.value = false
  fetchPages()
}

const selectPage = async (page: WikiPageSummary) => {
  contentLoading.value = true
  try {
    selected.value = await getWikiPage(kbId.value, page.page_id)
  } catch {
    MessagePlugin.error('获取页面详情失败')
  } finally {
    contentLoading.value = false
  }
}

const handleBuild = async () => {
  building.value = true
  try {
    await buildWiki(kbId.value)
    MessagePlugin.success('Wiki 构建已启动')
    startPolling()
  } catch {
    MessagePlugin.error('启动 Wiki 构建失败')
    building.value = false
  }
}

const fetchStatus = async () => {
  try {
    statusInfo.value = await getWikiStatus(kbId.value)
    if (statusInfo.value.pending_count === 0) {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      building.value = false
      fetchPages()
    }
  } catch {
    // ignore
  }
}

const startPolling = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(fetchStatus, 5000)
}

onMounted(async () => {
  try {
    const res = await listKnowledgeBases(1, 100)
    kbList.value = res.items
    kbOptions.value = res.items.map((kb) => ({ label: kb.name, value: kb.id }))
    if (!kbId.value && res.items.length > 0) kbId.value = res.items[0].id
  } catch {
    // ignore
  }
  fetchPages()
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})
</script>

<style scoped>
.wiki-view {
  max-width: 1200px;
  margin: 0 auto;
}

.sidebar-card {
  height: 100%;
}

.page-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-group {
  margin-bottom: 8px;
}

.group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--td-text-color-placeholder);
  padding: 4px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.page-item {
  padding: 6px 8px;
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--td-radius-default);
  transition: all 0.15s;
}

.page-item:hover {
  background: var(--td-bg-color-container-hover);
}

.page-item.active {
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font-weight: 500;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
}

.status-bar {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.content-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-state {
  padding: 60px 0;
}

.wiki-content {
  line-height: 1.8;
  font-size: 14px;
}

.wiki-content :deep(h1),
.wiki-content :deep(h2),
.wiki-content :deep(h3) {
  margin-top: 24px;
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.wiki-content :deep(p) {
  margin-bottom: 12px;
}

.wiki-content :deep(code) {
  background: var(--td-bg-color-secondarycontainer);
  padding: 2px 6px;
  border-radius: var(--td-radius-small);
  font-size: 13px;
}

.wiki-content :deep(pre) {
  background: var(--td-bg-color-secondarycontainer);
  padding: 16px;
  border-radius: var(--td-radius-medium);
  overflow-x: auto;
  margin-bottom: 16px;
}

.wiki-content :deep(pre code) {
  padding: 0;
  background: none;
}

.wiki-content :deep(ul),
.wiki-content :deep(ol) {
  padding-left: 24px;
  margin-bottom: 12px;
}

.wiki-content :deep(blockquote) {
  border-left: 3px solid var(--td-brand-color);
  padding-left: 12px;
  margin-left: 0;
  color: var(--td-text-color-secondary);
}

.wiki-content :deep(a.wiki-link) {
  color: var(--td-brand-color);
  cursor: pointer;
  text-decoration: none;
  border-bottom: 1px dashed var(--td-brand-color);
}

.wiki-content :deep(a.wiki-link:hover) {
  background: var(--td-brand-color-light);
}
</style>
