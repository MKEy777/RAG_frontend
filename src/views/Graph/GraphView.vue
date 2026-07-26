<template>
  <div class="graph-view">
    <PageHeader title="知识图谱" back-to="">
      <template #actions>
        <template v-if="graphData">
          <t-tag variant="light" size="small">实体 {{ graphData.stats.returned_nodes }}/{{ graphData.stats.total_entities }}</t-tag>
          <t-tag variant="light" size="small">关系 {{ graphData.edges.length }}/{{ graphData.stats.total_relations }}</t-tag>
          <t-tag v-if="graphData.stats.truncated" theme="warning" variant="light" size="small">
            已按频次截取前 {{ graphData.stats.returned_nodes }} 节点
          </t-tag>
        </template>
        <t-select
          v-model="kbId"
          :options="kbOptions"
          placeholder="选择知识库"
          size="small"
          style="width: 220px"
          @change="fetchGraph"
        />
        <t-button size="small" variant="outline" :disabled="!kbId || rebuilding" @click="handleRebuild">
          {{ rebuilding ? '重建中…' : '重建图谱' }}
        </t-button>
        <t-button size="small" variant="outline" :disabled="!kbId" @click="fetchGraph">刷新</t-button>
        <t-popconfirm content="确定删除该知识库的图谱数据？" theme="danger" @confirm="handleDelete">
          <t-button size="small" variant="outline" theme="danger" :disabled="!kbId || rebuilding">删除</t-button>
        </t-popconfirm>
      </template>
    </PageHeader>

    <t-alert
      v-if="kbId && !featureEnabled"
      theme="warning"
      message="当前知识库未启用知识图谱功能，请在创建时开启"
      style="margin-bottom: 16px"
    />

    <t-empty
      v-if="!loading && (!graphData || graphData.nodes.length === 0)"
      description="暂无图谱数据，请先上传并解析文档"
    />

    <div
      v-show="graphData && graphData.nodes.length > 0"
      v-loading="loading"
      ref="chartContainer"
      class="chart-container"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { getGraph, rebuildGraph, deleteGraph, type GraphData } from '@/api/graph'
import { listKnowledgeBases, type KnowledgeBase } from '@/api/knowledgeBase'
import PageHeader from '@/components/PageHeader.vue'

echarts.use([GraphChart, CanvasRenderer, TooltipComponent, LegendComponent])

const route = useRoute()
const kbId = ref((route.params.id as string) || '')
const kbOptions = ref<{ label: string; value: string }[]>([])
const kbList = ref<KnowledgeBase[]>([])

const featureEnabled = computed(() => {
  const kb = kbList.value.find((k) => k.id === kbId.value)
  return kb ? kb.enable_graph : true
})

const loading = ref(false)
const rebuilding = ref(false)
const graphData = ref<GraphData | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const palette = [
  '#4285F4',
  '#9B72F5',
  '#8250df',
  '#1a7f37',
  '#9a6700',
  '#cf222e',
  '#0969da',
  '#bf3989',
  '#afb8c1',
  '#57606a',
]

const fetchGraph = async () => {
  if (!kbId.value) return
  loading.value = true
  try {
    graphData.value = await getGraph(kbId.value, 300)
    if (graphData.value.nodes.length > 0) {
      await nextTick()
      renderChart()
    }
  } catch {
    MessagePlugin.error('获取图谱数据失败')
  } finally {
    loading.value = false
  }
}

const handleRebuild = async () => {
  if (!kbId.value || rebuilding.value) return
  rebuilding.value = true
  try {
    const res = await rebuildGraph(kbId.value)
    MessagePlugin.success(`已开始重建（${res.documents} 个文档），完成后自动刷新`)
    // 重建是后台任务：轮询图谱直到实体数稳定两次不变或超时
    let last = -1
    let stable = 0
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const data = await getGraph(kbId.value, 300)
      if (data.stats.total_entities === last && last > 0) {
        stable++
        if (stable >= 2) break
      } else {
        stable = 0
      }
      last = data.stats.total_entities
    }
    await fetchGraph()
    MessagePlugin.success('图谱重建完成')
  } catch {
    MessagePlugin.error('重建请求失败')
  } finally {
    rebuilding.value = false
  }
}

const handleDelete = async () => {
  if (!kbId.value) return
  try {
    await deleteGraph(kbId.value)
    MessagePlugin.success('图谱已删除')
    await fetchGraph()
  } catch {
    MessagePlugin.error('删除失败')
  }
}

const renderChart = () => {
  if (!chartContainer.value || !graphData.value) return

  if (chart) chart.dispose()

  const types = [...new Set(graphData.value.nodes.map((n) => n.type))]
  const categories = types.map((t, i) => ({
    name: t,
    itemStyle: { color: palette[i % palette.length] },
  }))

  const freqValues = graphData.value.nodes.map((n) => n.frequency)
  const maxFreq = Math.max(...freqValues, 1)

  const option = {
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { dataType: string; data: { name: string; description: string; type: string; frequency: number; degree: number } }
        if (p.dataType === 'node') {
          return `<b>${p.data.name}</b><br/>类型: ${p.data.type}<br/>描述: ${p.data.description}<br/>频次: ${p.data.frequency}<br/>度: ${p.data.degree}`
        }
        return ''
      },
    },
    legend: {
      data: categories.map((c) => c.name),
      type: 'scroll',
      bottom: 0,
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        force: {
          repulsion: 300,
          edgeLength: [80, 200],
          gravity: 0.1,
        },
        roam: true,
        draggable: true,
        data: graphData.value.nodes.map((n) => ({
          name: n.name,
          value: n.frequency,
          // maxFreq 为 1 时 log(1)/log(1) = NaN，退化为固定尺寸
          symbolSize:
            maxFreq > 1
              ? Math.max(10, Math.min(50, 10 + (40 * Math.log(n.frequency)) / Math.log(maxFreq)))
              : 20,
          category: types.indexOf(n.type),
          type: n.type,
          description: n.description,
          frequency: n.frequency,
          degree: n.degree,
        })),
        links: graphData.value.edges.map((e) => ({
          source: e.source,
          target: e.target,
          value: e.weight,
          lineStyle: {
            width: Math.max(1, Math.min(4, e.weight)),
          },
        })),
        categories,
        edgeSymbol: ['none', 'arrow'],
        edgeLabel: {
          show: false,
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 10,
        },
        lineStyle: {
          curveness: 0.3,
          opacity: 0.6,
        },
      },
    ],
  }

  chart = echarts.init(chartContainer.value)
  chart.setOption(option)
}

const handleResize = () => chart?.resize()

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  try {
    const res = await listKnowledgeBases(1, 100)
    kbList.value = res.items
    kbOptions.value = res.items.map((kb) => ({ label: kb.name, value: kb.id }))
    if (!kbId.value && res.items.length > 0) kbId.value = res.items[0].id
  } catch {
    // ignore
  }
  fetchGraph()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped>
.graph-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--kl-page-padding-y) var(--kl-page-padding-x) var(--kl-space-4);
}

.chart-container {
  flex: 1;
  min-height: 0;
  width: 100%;
}
</style>
