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

    <!-- 无页面：全宽引导 -->
    <div v-if="pages.length === 0 && !loading" class="wiki-guide">
      <t-icon name="book" size="48px" class="guide-icon" />
      <h2 class="guide-title">暂无 Wiki 页面</h2>
      <p class="guide-desc">Wiki 基于知识库文档自动生成百科式摘要，帮助快速理解知识库核心内容</p>
      <t-button theme="primary" size="large" :loading="building" :disabled="building || !kbId" @click="handleBuild">
        <template #icon><t-icon name="play-circle" /></template>
        生成 Wiki
      </t-button>
    </div>

    <!-- 有页面：左右分栏 -->
    <t-row v-else :gutter="16">
      <t-col :span="3">
        <div class="wiki-sidebar">
          <div class="sidebar-head">
            <span class="sidebar-title">页面列表</span>
            <t-space size="4px">
              <t-button size="small" variant="outline" @click="fetchPages">
                刷新
              </t-button>
              <t-popconfirm content="重建将清除现有页面并重新生成，确定？" @confirm="handleRebuild">
                <t-button size="small" variant="outline" theme="danger" :loading="building" :disabled="building">
                  重建
                </t-button>
              </t-popconfirm>
            </t-space>
          </div>

          <div class="folder-actions">
            <t-button size="small" variant="outline" @click="showNewFolder = !showNewFolder">
              <template #icon><t-icon name="folder-add" /></template>
              新建文件夹
            </t-button>
            <div v-if="showNewFolder" class="new-folder-row">
              <t-input v-model="newFolderName" placeholder="文件夹名称" size="small" @enter="handleCreateFolder" />
              <t-button size="small" :loading="createFolderLoading" @click="handleCreateFolder">创建</t-button>
            </div>
          </div>

          <div class="page-list">
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
                <t-popconfirm content="删除文件夹？其中的页面不会被删除" @confirm="handleDeleteFolder(folder.id)">
                  <t-icon name="close" size="12px" class="folder-delete" @click.stop />
                </t-popconfirm>
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
        </div>
      </t-col>

      <t-col :span="7">
        <div class="wiki-content-panel">
          <template v-if="!selected">
            <div class="empty-hint">
              <t-icon name="hint" size="20px" />
              <span>从左侧选择一个 Wiki 页面查看内容</span>
            </div>
          </template>
          <template v-else>
            <div class="content-header">
              <h2 class="content-title">{{ selected.title }}</h2>
              <t-tag size="small" variant="light">{{ kindLabels[selected.kind] || selected.kind }}</t-tag>
            </div>
            <t-loading :loading="contentLoading">
              <div class="wiki-content" v-html="renderedContent" @click="handleContentClick" />
            </t-loading>
          </template>
        </div>
      </t-col>

      <t-col :span="2">
        <div class="wiki-right-panel">
          <div class="right-section">
            <div class="right-title">关系图谱</div>
            <div v-if="selected" class="right-links">
              <div
                v-for="link in (selected.out_links || []).slice(0, 10)"
                :key="link"
                class="right-link-item"
                @click="navigateToSlug(link)"
              >{{ link }}</div>
              <p v-if="!(selected.out_links || []).length" class="right-empty">暂无关联</p>
            </div>
            <p v-else class="right-empty">选择页面查看关联</p>
          </div>
          <div class="right-section">
            <div class="right-title">反馈</div>
            <div class="feedback-actions">
              <t-button size="small" variant="outline" shape="square">
                <t-icon name="thumb-up" />
              </t-button>
              <t-button size="small" variant="outline" shape="square">
                <t-icon name="thumb-down" />
              </t-button>
            </div>
          </div>
        </div>
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
  clearWikiPages,
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

const newFolderName = ref('')
const showNewFolder = ref(false)
const createFolderLoading = ref(false)

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
  navigateToSlug(slug)
}

const navigateToSlug = (slug: string) => {
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

const handleRebuild = async () => {
  building.value = true
  try {
    await clearWikiPages(kbId.value)
    pages.value = []
    selected.value = null
    await buildWiki(kbId.value)
    MessagePlugin.success('Wiki 重建已启动')
    startPolling()
  } catch {
    MessagePlugin.error('重建失败')
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

const handleCreateFolder = async () => {
  if (!newFolderName.value.trim() || !kbId.value) return
  createFolderLoading.value = true
  try {
    await createWikiFolder(kbId.value, {
      name: newFolderName.value.trim(),
      parent_id: folderFilter.value || undefined,
    })
    newFolderName.value = ''
    showNewFolder.value = false
    fetchPages()
  } catch {
    MessagePlugin.error('创建文件夹失败')
  } finally {
    createFolderLoading.value = false
  }
}

const handleDeleteFolder = async (folderId: string) => {
  try {
    await deleteWikiFolder(kbId.value, folderId)
    if (folderFilter.value === folderId) folderFilter.value = null
    fetchPages()
  } catch {
    MessagePlugin.error('删除文件夹失败')
  }
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
  max-width: var(--kl-content-max-width);
  margin: 0 auto;
}

.wiki-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--kl-space-16) var(--kl-space-6);
  text-align: center;
}

.guide-icon {
  color: var(--td-text-color-placeholder);
  margin-bottom: var(--kl-space-4);
}

.guide-title {
  font-size: var(--kl-text-lg);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  margin: 0 0 var(--kl-space-2);
}

.guide-desc {
  font-size: var(--kl-text-base);
  color: var(--td-text-color-secondary);
  margin: 0 0 var(--kl-space-6);
  max-width: 400px;
}

.wiki-sidebar {
  border-right: none;
  padding-right: var(--kl-space-3);
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--kl-space-3);
}

.sidebar-title {
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
}

.page-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
}

.page-group {
  margin-bottom: var(--kl-space-2);
}

.group-label {
  font-size: var(--kl-text-xs);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-placeholder);
  padding: var(--kl-space-1) var(--kl-space-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.page-item {
  padding: var(--kl-space-1) var(--kl-space-2);
  font-size: var(--kl-text-sm);
  cursor: pointer;
  border-radius: var(--kl-radius-lg);
  transition: all var(--kl-duration-fast) var(--kl-ease-default);
}

.page-item:hover {
  background: var(--td-bg-color-container-hover);
}

.page-item.active {
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font-weight: var(--kl-weight-medium);
}

.folder-item {
  display: flex;
  align-items: center;
  gap: var(--kl-space-1);
}

.folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
}

.folder-actions {
  padding: 0 var(--kl-space-2) var(--kl-space-2);
}

.new-folder-row {
  display: flex;
  gap: var(--kl-space-1);
  margin-top: var(--kl-space-1);
}

.folder-delete {
  opacity: 0;
  color: var(--td-text-color-placeholder);
  cursor: pointer;
  transition: opacity 0.15s;
  margin-left: var(--kl-space-1);
}

.folder-item:hover .folder-delete {
  opacity: 1;
}

.folder-delete:hover {
  color: var(--td-error-color);
}

.status-bar {
  display: flex;
  gap: var(--kl-space-2);
  margin-top: var(--kl-space-3);
  padding-top: var(--kl-space-3);
  border-top: var(--kl-border-width) solid var(--td-border-level-1-color);
}

.wiki-content-panel {
  padding-left: var(--kl-space-2);
}

.empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-10) 0;
  font-size: var(--kl-text-base);
  color: var(--td-text-color-placeholder);
}

.content-header {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  margin-bottom: var(--kl-space-5);
  padding-bottom: var(--kl-space-3);
  border-bottom: var(--kl-border-width) solid var(--td-border-level-1-color);
}

.content-title {
  font-size: var(--kl-text-lg);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  margin: 0;
}

.wiki-content {
  line-height: 1.8;
  font-size: var(--kl-text-base);
  max-width: 720px;
}

.wiki-content :deep(h1),
.wiki-content :deep(h2),
.wiki-content :deep(h3) {
  margin-top: var(--kl-space-6);
  margin-bottom: var(--kl-space-3);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
}

.wiki-content :deep(p) {
  margin-bottom: var(--kl-space-3);
}

.wiki-content :deep(code) {
  background: var(--td-bg-color-secondarycontainer);
  padding: 2px 6px;
  border-radius: var(--kl-radius-sm);
  font-size: var(--kl-text-sm);
}

.wiki-content :deep(pre) {
  background: var(--td-bg-color-secondarycontainer);
  padding: var(--kl-space-4);
  border-radius: var(--kl-radius-md);
  overflow-x: auto;
  margin-bottom: var(--kl-space-4);
}

.wiki-content :deep(pre code) {
  padding: 0;
  background: none;
}

.wiki-content :deep(ul),
.wiki-content :deep(ol) {
  padding-left: var(--kl-space-6);
  margin-bottom: var(--kl-space-3);
}

.wiki-content :deep(blockquote) {
  border-left: 3px solid var(--kl-accent);
  padding-left: var(--kl-space-3);
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

.wiki-right-panel {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-4);
  padding-left: var(--kl-space-3);
  border-left: var(--kl-border-width) solid var(--td-component-stroke);
}

.right-section {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-2);
}

.right-title {
  font-size: var(--kl-text-sm);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
}

.right-links {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-1);
}

.right-link-item {
  font-size: var(--kl-text-xs);
  color: var(--kl-accent);
  cursor: pointer;
  padding: var(--kl-space-1) var(--kl-space-2);
  border-radius: var(--kl-radius-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background var(--kl-duration-fast) var(--kl-ease-default);
}

.right-link-item:hover {
  background: var(--kl-accent-light);
}

.right-empty {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  margin: 0;
}

.feedback-actions {
  display: flex;
  gap: var(--kl-space-2);
}
</style>
