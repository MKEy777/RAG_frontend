<template>
  <div class="graph-view">
    <t-card :bordered="false">
      <template #title>
        <div class="card-title">
          <t-button variant="text" shape="square" @click="router.back()">
            <t-icon name="chevron-left" />
          </t-button>
          <span>知识图谱</span>
          <t-select
            v-model="kbId"
            :options="kbOptions"
            placeholder="选择知识库"
            size="small"
            style="width: 220px"
            @change="fetchGraph"
          />
        </div>
      </template>
      <template #action>
        <div v-if="graphData" class="stats-bar">
          <t-tag variant="light" size="small">实体 {{ graphData.stats.returned_nodes }}/{{ graphData.stats.total_entities }}</t-tag>
          <t-tag variant="light" size="small">关系 {{ graphData.edges.length }}/{{ graphData.stats.total_relations }}</t-tag>
          <t-tag v-if="graphData.stats.truncated" theme="warning" variant="light" size="small">
            已按频次截取前 {{ graphData.stats.returned_nodes }} 节点
          </t-tag>
        </div>
      </template>

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
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { getGraph, type GraphData } from '@/api/graph'
import { listKnowledgeBases, type KnowledgeBase } from '@/api/knowledgeBase'

echarts.use([GraphChart, CanvasRenderer, TooltipComponent, LegendComponent])

const route = useRoute()
const router = useRouter()
const kbId = ref((route.params.id as string) || '')
const kbOptions = ref<{ label: string; value: string }[]>([])
const kbList = ref<KnowledgeBase[]>([])

const featureEnabled = computed(() => {
  const kb = kbList.value.find((k) => k.id === kbId.value)
  return kb ? kb.enable_graph : true
})

const loading = ref(false)
const graphData = ref<GraphData | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const typeColors: Record<string, string> = {
  Person: '#5470c6',
  Organization: '#91cc75',
  Location: '#fac858',
  Product: '#ee6666',
  Event: '#73c0de',
  Date: '#3ba272',
  Work: '#fc8452',
  Concept: '#9a60b4',
  Resource: '#ea7ccc',
  Category: '#a5a5a5',
  Operation: '#4e79a7',
}

const getCategoryColor = (type: string) => typeColors[type] || '#999'

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

const renderChart = () => {
  if (!chartContainer.value || !graphData.value) return

  if (chart) chart.dispose()

  const types = [...new Set(graphData.value.nodes.map((n) => n.type))]
  const categories = types.map((t) => ({ name: t, itemStyle: { color: getCategoryColor(t) } }))

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

  const handleResize = () => chart?.resize()
  window.addEventListener('resize', handleResize)

  const originalDispose = chart.dispose.bind(chart)
  chart.dispose = () => {
    window.removeEventListener('resize', handleResize)
    originalDispose()
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
  fetchGraph()
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped>
.graph-view {
  height: 100%;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-bar {
  display: flex;
  gap: 8px;
}

.chart-container {
  width: 100%;
  height: 600px;
}
</style>
