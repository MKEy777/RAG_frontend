<template>
  <div class="wiki-view">
    <PageHeader title="知识 Wiki" subtitle="知识库自动生成的百科页面" back-to="">
      <template #actions>
        <t-select
          v-if="!kbFixed"
          v-model="kbId"
          :options="kbOptions"
          placeholder="选择知识库"
          style="width: 240px"
          @change="handleKbChange"
        />
        <t-button variant="outline" :loading="building" :disabled="building || !kbId" @click="handleBuild">
          <template #icon><t-icon name="refresh" /></template>
          更新 Wiki
        </t-button>
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

    <!-- 有页面：左中右三栏 -->
    <div v-else class="wiki-layout">
      <!-- 左侧：按类型分组导航 -->
      <aside class="wiki-nav">
        <div class="nav-scroll">
          <div
            v-for="group in navGroups"
            :key="group.kind"
            class="nav-group"
          >
            <div
              class="nav-group-head"
              :class="{ single: !group.collapsible }"
              @click="group.collapsible && toggleGroup(group.kind)"
            >
              <span class="nav-group-title" :class="{ active: !group.collapsible && selected?.kind === group.kind }">
                {{ group.label }} <span class="nav-group-en">({{ group.en }})</span>
              </span>
              <t-icon
                v-if="group.collapsible"
                :name="collapsed[group.kind] ? 'chevron-right' : 'chevron-down'"
                size="14px"
              />
            </div>
            <div v-if="group.collapsible && !collapsed[group.kind]" class="nav-items">
              <div
                v-for="item in group.items"
                :key="item.slug"
                class="nav-item"
                :class="{ active: selected?.slug === item.slug }"
                @click="selectSlug(item.slug)"
              >
                {{ item.title }}
              </div>
              <p v-if="!group.items.length" class="nav-empty">暂无</p>
            </div>
          </div>
        </div>
        <div v-if="statusInfo" class="status-bar">
          <div class="status-tags">
            <t-tag variant="light" size="small">共 {{ statusInfo.page_count }} 页</t-tag>
            <t-tag v-if="statusInfo.building" theme="warning" variant="light" size="small">
              构建中 {{ statusInfo.completed_operations }}/{{ statusInfo.total_operations }}
            </t-tag>
          </div>
          <t-progress
            v-if="statusInfo.building && statusInfo.total_operations > 0"
            :percentage="Math.round((statusInfo.completed_operations / statusInfo.total_operations) * 100)"
            :label="true"
            size="small"
          />
          <p v-if="statusInfo.last_updated" class="status-updated">
            最近更新：{{ formatTime(statusInfo.last_updated) }}
          </p>
        </div>
      </aside>

      <!-- 中间：正文 -->
      <main class="wiki-main">
        <template v-if="selectedFaq">
          <div class="content-header">
            <h1 class="content-title">{{ selectedFaq.title }}</h1>
            <t-tag size="small" variant="light">FAQ · {{ selectedFaq.questions.length }} 条</t-tag>
          </div>
          <div class="faq-list">
            <div v-for="q in selectedFaq.questions" :key="q.id" class="faq-item">
              <t-icon name="help-circle" size="16px" class="faq-icon" />
              <span>{{ q.question }}</span>
            </div>
          </div>
        </template>
        <template v-else-if="!selected">
          <div class="empty-hint">
            <t-icon name="hint" size="20px" />
            <span>从左侧选择一个 Wiki 页面查看内容</span>
          </div>
        </template>
        <template v-else>
          <div class="content-header">
            <h1 class="content-title">{{ selected.title }}</h1>
            <t-tag size="small" variant="light">{{ kindLabels[selected.kind] || selected.kind }}</t-tag>
          </div>
          <t-loading :loading="contentLoading">
            <div v-if="selected.content" class="wiki-content" v-html="renderedContent" @click="handleContentClick" />
            <div v-else class="empty-hint">
              <t-icon name="hint" size="20px" />
              <span>该页面内容为空，可能生成时中断，点右上角「更新 Wiki」重新生成</span>
            </div>
          </t-loading>
        </template>
      </main>

      <!-- 右侧：关系图谱 + 反链 -->
      <aside class="wiki-aside">
        <div class="aside-card">
          <div class="aside-head">
            <span class="aside-title">关系图谱</span>
            <t-link theme="primary" size="small" hover="color" @click="showFullGraph = true">
              查看全量图谱
            </t-link>
          </div>
          <div ref="graphRef" class="graph-box" />
          <p v-if="!displayGraph.nodes.length" class="aside-empty">暂无图谱数据</p>
          <t-dialog
            v-model:visible="showFullGraph"
            class="full-graph-dialog"
            header="全量关系图谱"
            width="80%"
            top="5vh"
            :footer="false"
            @opened="onFullGraphOpened"
          >
            <div ref="fullGraphRef" class="full-graph-box" />
          </t-dialog>
        </div>
        <div class="aside-card">
          <div class="aside-head"><span class="aside-title">反链</span></div>
          <div v-if="selected && (selected.in_links || []).length" class="link-list">
            <div
              v-for="link in selected.in_links || []"
              :key="link"
              class="link-item"
              @click="navigateToSlug(link)"
            >{{ slugTitle(link) }}</div>
          </div>
          <p v-else class="aside-empty">暂无反链</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
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
  listWikiFaq,
  type WikiPageSummary,
  type WikiPageDetail,
  type WikiGraphNode,
  type WikiGraphEdge,
  type WikiStatus,
  type WikiFaqGroup,
} from '@/api/wiki'

const route = useRoute()
const kbId = ref((route.params.id as string) || '')
const kbFixed = computed(() => !!route.params.id)
const kbOptions = ref<{ label: string; value: string }[]>([])
const kbList = ref<KnowledgeBase[]>([])

const featureEnabled = computed(() => {
  const kb = kbList.value.find((k) => k.id === kbId.value)
  return kb ? kb.enable_wiki : true
})

const pages = ref<WikiPageSummary[]>([])
const selected = ref<WikiPageDetail | null>(null)
const loading = ref(false)
const contentLoading = ref(false)
const building = ref(false)
const statusInfo = ref<WikiStatus | null>(null)
const graphData = ref<{ nodes: WikiGraphNode[]; edges: WikiGraphEdge[] }>({ nodes: [], edges: [] })
const collapsed = ref<Record<string, boolean>>({})
const faqGroups = ref<WikiFaqGroup[]>([])
const selectedFaq = ref<WikiFaqGroup | null>(null)
const showFullGraph = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const graphRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
const fullGraphRef = ref<HTMLElement | null>(null)
let fullChart: echarts.ECharts | null = null

const kindLabels: Record<string, string> = {
  index: '目录',
  overview: '概览',
  concept: '概念',
  entity: '实体',
  synthesis: '领域综览',
  comparison: '对照',
  faq: 'FAQ',
}

// 左侧导航分组配置：概览/目录为单页，其余为可折叠分组
const navGroups = computed(() => {
  const byKind = new Map<string, WikiPageSummary[]>()
  for (const p of pages.value) {
    const list = byKind.get(p.kind) || []
    list.push(p)
    byKind.set(p.kind, list)
  }
  const groups: {
    kind: string
    label: string
    en: string
    collapsible: boolean
    items: WikiPageSummary[]
  }[] = []
  const overview = byKind.get('overview') || []
  if (overview.length) groups.push({ kind: 'overview', label: '概览', en: 'Overview', collapsible: false, items:overview })
  const index = byKind.get('index') || []
  if (index.length) groups.push({ kind: 'index', label: '目录', en: 'Index', collapsible: false, items: index })
  const rest: { kind: string; label: string; en: string }[] = [
    { kind: 'comparison', label: '对照库', en: 'Comparisons' },
    { kind: 'concept', label: '概念库', en: 'Concepts' },
    { kind: 'entity', label: '实体类型', en: 'Entities' },
    { kind: 'synthesis', label: '领域综览库', en: 'Synthesis' },
  ]
  for (const g of rest) {
    const items = byKind.get(g.kind) || []
    if (items.length) groups.push({ ...g, collapsible: true, items })
  }
  if (faqGroups.value.length) {
    groups.push({
      kind: 'faq',
      label: 'FAQ 问答',
      en: 'FAQ',
      collapsible: true,
      items: faqGroups.value.map((f) => ({
        page_id: f.knowledge_id,
        title: f.title,
        slug: `faq:${f.knowledge_id}`,
        kind: 'faq',
        summary: null,
        status: 'published',
        version: 1,
        folder_id: null,
        updated_at: null,
      })),
    })
  }
  return groups
})

const toggleGroup = (kind: string) => {
  collapsed.value[kind] = !collapsed.value[kind]
}

const renderedContent = computed(() => {
  if (!selected.value?.content) return ''
  return renderWikiMarkdown(selected.value.content)
})

const slugTitle = (slug: string) => pages.value.find((p) => p.slug === slug)?.title || slug

const handleContentClick = (e: MouseEvent) => {
  const el = (e.target as HTMLElement).closest('[data-wiki-slug]')
  if (!el) return
  navigateToSlug(el.getAttribute('data-wiki-slug') || '')
}

const navigateToSlug = (slug: string) => {
  const page = pages.value.find((p) => p.slug === slug)
  if (page) selectSlug(slug)
  else MessagePlugin.warning(`页面不存在: ${slug}`)
}

const selectSlug = async (slug: string) => {
  if (slug.startsWith('faq:')) {
    const kid = slug.slice(4)
    selected.value = null
    selectedFaq.value = faqGroups.value.find((f) => f.knowledge_id === kid) || null
    return
  }
  selectedFaq.value = null
  const page = pages.value.find((p) => p.slug === slug)
  if (!page) return
  contentLoading.value = true
  try {
    selected.value = await getWikiPage(kbId.value, page.page_id)
    highlightGraph(slug)
  } catch {
    MessagePlugin.error('获取页面详情失败')
  } finally {
    contentLoading.value = false
  }
}

const fetchPages = async () => {
  if (!kbId.value) return
  loading.value = true
  try {
    const [res, index, faq] = await Promise.all([
      listWikiPages(kbId.value, 1, 200),
      getWikiIndex(kbId.value).catch(() => null),
      listWikiFaq(kbId.value).catch(() => null),
    ])
    pages.value = res.items
    graphData.value = index?.graph || { nodes: [], edges: [] }
    faqGroups.value = faq?.groups || []
    // 默认选中概览
    if (!selected.value) {
      const ov = pages.value.find((p) => p.kind === 'overview') || pages.value[0]
      if (ov) await selectSlug(ov.slug)
    }
    await nextTick()
    renderGraph()
  } finally {
    loading.value = false
  }
}

const handleKbChange = () => {
  selected.value = null
  selectedFaq.value = null
  faqGroups.value = []
  statusInfo.value = null
  building.value = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  fetchPages()
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
    const prev = statusInfo.value?.building
    statusInfo.value = await getWikiStatus(kbId.value)
    if (!statusInfo.value.building) {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      if (prev || building.value) {
        MessagePlugin.success('Wiki 更新完成')
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

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const kindColor: Record<string, string> = {
  overview: '#0052d9',
  index: '#834ec2',
  concept: '#0594fa',
  entity: '#00a870',
  synthesis: '#ed7b2f',
  comparison: '#e34d59',
}

// 侧栏局部图谱：按当前选中页所属分类(kind)显示该分类下全部节点及其内部关系；未选中时返回完整图
const displayGraph = computed(() => {
  const all = graphData.value
  if (!selected.value) return all
  const kind = selected.value.kind
  const nodes = all.nodes.filter((n) => n.kind === kind)
  if (!nodes.length) return all
  const ids = new Set(nodes.map((n) => n.id))
  const edges = all.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
  return { nodes, edges }
})

const renderGraph = () => {
  if (!graphRef.value) return
  if (chart) chart.dispose()
  chart = echarts.init(graphRef.value)
  const curId = selected.value?.slug
  const edges = displayGraph.value.edges
  // 与当前节点直接相连的节点集合
  const adj = new Set<string>()
  if (curId) {
    adj.add(curId)
    edges.forEach((e) => {
      if (e.source === curId) adj.add(e.target)
      if (e.target === curId) adj.add(e.source)
    })
  }
  const nodes = displayGraph.value.nodes.map((n) => {
    const isCur = n.id === curId
    const dim = curId ? !adj.has(n.id) : false
    return {
      id: n.id,
      name: n.name,
      symbolSize: isCur ? 20 : 12,
      itemStyle: {
        color: kindColor[n.kind] || '#8592a3',
        opacity: dim ? 0.25 : 1,
        borderColor: isCur ? '#d54941' : 'transparent',
        borderWidth: isCur ? 3 : 0,
      },
      label: { fontWeight: isCur ? ('bold' as const) : ('normal' as const), opacity: dim ? 0.35 : 1 },
    }
  })
  const links = displayGraph.value.edges.map((e) => {
    const linked = !curId || e.source === curId || e.target === curId
    return {
      source: e.source,
      target: e.target,
      lineStyle: { opacity: linked ? 0.9 : 0.15, width: linked && curId ? 1.6 : 0.8 },
    }
  })
  chart.setOption({
    tooltip: {},
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        scaleLimit: { min: 0.4, max: 8 },
        label: { show: true, fontSize: 9, formatter: (p: any) => (p.name || '').slice(0, 8) },
        force: { repulsion: 80, edgeLength: 60 },
        lineStyle: { color: '#c8cdd4', width: 0.8, curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 2 } },
        data: nodes,
        links,
      },
    ],
  })
  chart.on('click', (p: any) => {
    if (p.dataType === 'node') selectSlug(p.data.id)
  })
  nextTick(() => chart?.resize())
}

// 全量图谱弹窗渲染：节点更大、显示完整名称
const renderFullGraph = () => {
  if (!fullGraphRef.value) return
  if (fullChart) fullChart.dispose()
  fullChart = echarts.init(fullGraphRef.value)
  const nodes = graphData.value.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    symbolSize: 18,
    itemStyle: { color: kindColor[n.kind] || '#8592a3' },
  }))
  const links = graphData.value.edges.map((e) => ({ source: e.source, target: e.target }))
  fullChart.setOption({
    tooltip: {},
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        scaleLimit: { min: 0.3, max: 10 },
        label: { show: true, fontSize: 11, formatter: (p: any) => (p.name || '').slice(0, 14) },
        force: { repulsion: 160, edgeLength: 100 },
        lineStyle: { color: '#c8cdd4', width: 1, curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 2.5 } },
        data: nodes,
        links,
      },
    ],
  })
  fullChart.on('click', (p: any) => {
    if (p.dataType === 'node') {
      selectSlug(p.data.id)
      showFullGraph.value = false
    }
  })
  nextTick(() => fullChart?.resize())
}

const onFullGraphOpened = () => nextTick(renderFullGraph)

watch(showFullGraph, (v) => {
  if (!v && fullChart) {
    fullChart.dispose()
    fullChart = null
  }
})

const highlightGraph = (slug: string) => {
  void slug
  nextTick(renderGraph)
}

const handleResize = () => chart?.resize()

watch(displayGraph, () => nextTick(renderGraph))

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
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  fullChart?.dispose()
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

.wiki-layout {
  display: grid;
  grid-template-columns: 220px 1fr 320px;
  gap: var(--kl-space-5);
  align-items: start;
}

/* 左侧导航 */
.wiki-nav {
  position: sticky;
  top: var(--kl-space-4);
}

.nav-scroll {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  padding-right: var(--kl-space-1);
}

.nav-group {
  margin-bottom: var(--kl-space-1);
}

.nav-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--kl-space-2) var(--kl-space-3);
  cursor: pointer;
  border-radius: var(--kl-radius-lg);
  font-size: var(--kl-text-base);
  color: var(--td-text-color-primary);
  transition: background var(--kl-duration-fast) var(--kl-ease-default);
}

.nav-group-head:hover {
  background: var(--td-bg-color-container-hover);
}

.nav-group-title {
  font-weight: var(--kl-weight-medium);
}

.nav-group-title.active {
  color: var(--td-brand-color);
}

.nav-group-head.single .nav-group-title:hover {
  color: var(--td-brand-color);
}

.nav-group-en {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  font-weight: var(--kl-weight-regular);
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: var(--kl-space-2);
}

.nav-item {
  padding: var(--kl-space-1) var(--kl-space-3);
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
  cursor: pointer;
  border-radius: var(--kl-radius-md);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all var(--kl-duration-fast) var(--kl-ease-default);
}

.nav-item:hover {
  background: var(--td-bg-color-container-hover);
}

.nav-item.active {
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font-weight: var(--kl-weight-medium);
}

.nav-empty {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  padding: var(--kl-space-1) var(--kl-space-3);
  margin: 0;
}

.status-bar {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-2);
  margin-top: var(--kl-space-3);
  padding-top: var(--kl-space-3);
  border-top: var(--kl-border-width) solid var(--td-border-level-1-color);
}

.status-tags {
  display: flex;
  gap: var(--kl-space-2);
}

.status-updated {
  margin: 0;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

/* 中间正文 */
.wiki-main {
  min-width: 0;
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
  font-size: var(--kl-text-xl);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  margin: 0;
}

.wiki-content {
  line-height: 1.8;
  font-size: var(--kl-text-base);
  max-width: 760px;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-2);
  max-width: 760px;
}

.faq-item {
  display: flex;
  align-items: flex-start;
  gap: var(--kl-space-2);
  padding: var(--kl-space-3);
  border: var(--kl-border-width) solid var(--td-border-level-1-color);
  border-radius: var(--kl-radius-md);
  font-size: var(--kl-text-base);
  line-height: 1.6;
}

.faq-icon {
  color: var(--td-brand-color);
  flex-shrink: 0;
  margin-top: 2px;
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

/* 右侧 */
.wiki-aside {
  position: sticky;
  top: var(--kl-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-4);
}

.aside-card {
  border: var(--kl-border-width) solid var(--td-border-level-1-color);
  border-radius: var(--kl-radius-lg);
  padding: var(--kl-space-3);
}

.aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--kl-space-2);
}

.aside-title {
  font-size: var(--kl-text-sm);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
}

.aside-sub {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
}

.graph-box {
  width: 100%;
  height: 280px;
}

.full-graph-box {
  width: 100%;
  height: 70vh;
}

.full-graph-dialog :deep(.t-dialog) {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.full-graph-dialog :deep(.t-dialog__body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-1);
}

.link-item {
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

.link-item:hover {
  background: var(--kl-accent-light);
}

.aside-empty {
  font-size: var(--kl-text-xs);
  color: var(--td-text-color-placeholder);
  margin: 0;
}
</style>