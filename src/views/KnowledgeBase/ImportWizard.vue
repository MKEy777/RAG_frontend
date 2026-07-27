<template>
  <div class="import-wizard">
    <PageHeader title="文件配置" :back-to="`/knowledge-bases/${kbId}`" />

    <t-steps :current="currentStep" class="wizard-steps">
      <t-step-item title="解析规则" />
      <t-step-item title="版面识别" />
      <t-step-item title="分段设置" />
    </t-steps>

    <div class="wizard-body">
      <!-- Step 1: 解析规则 -->
      <div v-show="currentStep === 0" class="step-content">
        <section class="rule-section">
          <h4 class="rule-title">基础解析</h4>
          <div class="rule-grid">
            <label v-for="item in basicRules" :key="item.key" class="rule-item">
              <t-checkbox v-model="parseConfig[item.key]" />
              <div class="rule-text">
                <span class="rule-name">{{ item.name }}</span>
                <span class="rule-desc">{{ item.desc }}</span>
              </div>
            </label>
          </div>
        </section>

        <section class="rule-section">
          <h4 class="rule-title">深度解析</h4>
          <div class="rule-grid">
            <label v-for="item in deepRules" :key="item.key" class="rule-item">
              <t-checkbox v-model="parseConfig[item.key]" />
              <div class="rule-text">
                <span class="rule-name">{{ item.name }}</span>
                <span class="rule-desc">{{ item.desc }}</span>
              </div>
            </label>
          </div>
        </section>

        <section class="rule-section">
          <h4 class="rule-title">解析策略</h4>
          <div class="rule-grid">
            <label v-for="item in strategyRules" :key="item.key" class="rule-item">
              <t-checkbox v-model="parseConfig[item.key]" />
              <div class="rule-text">
                <span class="rule-name">{{ item.name }}</span>
                <span class="rule-desc">{{ item.desc }}</span>
              </div>
            </label>
          </div>
        </section>
      </div>

      <!-- Step 2: 版面识别 -->
      <div v-show="currentStep === 1" class="step-content step-layout">
        <div class="layout-files">
          <div class="layout-panel-title">文件列表</div>
          <div class="layout-file-item active">
            <t-icon name="file" size="14px" />
            <span>当前文档</span>
          </div>
        </div>
        <div class="layout-preview">
          <div class="layout-panel-title">原文件预览</div>
          <div class="layout-placeholder">
            <t-icon name="file-paste" size="48px" />
            <p>文档预览区域</p>
          </div>
        </div>
        <div class="layout-progress">
          <div class="layout-panel-title">识别结构预览</div>
          <div class="layout-placeholder">
            <t-icon name="scan" size="48px" />
            <p>版面识别中...</p>
          </div>
        </div>
      </div>

      <!-- Step 3: 分段设置 -->
      <div v-show="currentStep === 2" class="step-content step-layout">
        <div class="layout-files">
          <div class="layout-panel-title">分段规则</div>
          <div
            v-for="opt in segmentOptions"
            :key="opt.value"
            class="segment-option"
            :class="{ active: segmentStrategy === opt.value }"
            @click="segmentStrategy = opt.value"
          >
            <span class="segment-radio" :class="{ checked: segmentStrategy === opt.value }" />
            <div class="rule-text">
              <span class="rule-name">{{ opt.label }}</span>
              <span class="rule-desc">{{ opt.desc }}</span>
            </div>
          </div>
        </div>
        <div class="layout-preview">
          <div class="layout-panel-title">文档内容</div>
          <div class="layout-placeholder">
            <t-icon name="file-paste" size="48px" />
            <p>文档内容预览</p>
          </div>
        </div>
        <div class="layout-progress">
          <div class="layout-panel-title">分段结构预览</div>
          <div class="layout-placeholder">
            <t-icon name="view-list" size="48px" />
            <p>分段结构预览</p>
          </div>
        </div>
      </div>
    </div>

    <div class="wizard-footer">
      <t-button v-if="currentStep > 0" variant="outline" @click="currentStep--">上一步</t-button>
      <t-button v-if="currentStep < 2" theme="primary" @click="currentStep++">下一步</t-button>
      <t-button v-else theme="primary" @click="handleSubmit">提交</t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()
const router = useRouter()
const kbId = route.params.id as string

const currentStep = ref(0)
const segmentStrategy = ref('auto')

const parseConfig = reactive<Record<string, boolean>>({
  textExtract: true,
  multimodal: true,
  docImage: true,
  docChart: true,
  tableDeep: false,
  formula: false,
  ocr: false,
  vlm: false,
})

const basicRules = [
  { key: 'textExtract', name: '文字提取', desc: '基于规则的文档文字提取' },
  { key: 'multimodal', name: '多模态解析', desc: '识别文档文本排版，标题位置信息' },
]

const deepRules = [
  { key: 'docImage', name: '文档图片解析', desc: '将图片作为知识库参考信息的一部分' },
  { key: 'docChart', name: '文档图表解析', desc: '识别文档中包含的图表信息' },
  { key: 'tableDeep', name: '表格深度解析', desc: '深度识别文档中包含的表格信息' },
  { key: 'formula', name: '文档公式解析', desc: '深度识别文档中包含的公式信息' },
]

const strategyRules = [
  { key: 'ocr', name: '图片文字识别（OCR）', desc: '识别图片中的文字，适用于文档扫描件' },
  { key: 'vlm', name: '图片理解（VLM）', desc: '调用多模态大模型理解图片，适用于画面描述、图表研读等场景' },
]

const segmentOptions = [
  { value: 'auto', label: '自动分段与清洗', desc: '快速分段，最大长度 1024，重叠长度 100' },
  { value: 'symbol', label: '自定义 — 按标识符号切分', desc: '使用符号切分和预处理规则' },
  { value: 'length', label: '按长度切分', desc: '按长度规则切分' },
  { value: 'toc', label: '按文档目录结构切分', desc: '生成树状目录及对应分段' },
]

const handleSubmit = () => {
  // TODO: API — 提交解析配置到后端
  MessagePlugin.success('配置已提交')
  router.push(`/knowledge-bases/${kbId}`)
}
</script>

<style scoped>
.import-wizard {
  max-width: var(--kl-content-max-width);
  margin: 0 auto;
}

.wizard-steps {
  margin-bottom: var(--kl-space-6);
}

.wizard-body {
  min-height: 400px;
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: var(--kl-space-5);
}

.rule-section {
  background: var(--td-bg-color-container);
  border-radius: var(--kl-radius-card);
  padding: var(--kl-space-5);
  box-shadow: var(--kl-elevation-1);
}

.rule-title {
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  margin: 0 0 var(--kl-space-3);
}

.rule-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--kl-space-3);
}

.rule-item {
  display: flex;
  align-items: flex-start;
  gap: var(--kl-space-2);
  padding: var(--kl-space-3);
  border-radius: var(--kl-radius-md);
  background: var(--td-gray-color-1);
  cursor: pointer;
}

.rule-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rule-name {
  font-size: var(--kl-text-base);
  font-weight: var(--kl-weight-medium);
  color: var(--td-text-color-primary);
}

.rule-desc {
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
}

.step-layout {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  gap: var(--kl-space-4);
  min-height: 400px;
}

.layout-files,
.layout-preview,
.layout-progress {
  background: var(--td-bg-color-container);
  border-radius: var(--kl-radius-card);
  padding: var(--kl-space-4);
  box-shadow: var(--kl-elevation-1);
}

.layout-panel-title {
  font-size: var(--kl-text-sm);
  font-weight: var(--kl-weight-semibold);
  color: var(--td-text-color-primary);
  margin-bottom: var(--kl-space-3);
  padding-bottom: var(--kl-space-2);
  border-bottom: var(--kl-border-width) solid var(--td-component-stroke);
}

.layout-file-item {
  display: flex;
  align-items: center;
  gap: var(--kl-space-2);
  padding: var(--kl-space-2);
  border-radius: var(--kl-radius-md);
  font-size: var(--kl-text-sm);
  color: var(--td-text-color-secondary);
}

.layout-file-item.active {
  background: var(--kl-accent-light);
  color: var(--kl-accent);
}

.layout-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--kl-space-2);
  min-height: 200px;
  color: var(--td-text-color-placeholder);
  font-size: var(--kl-text-sm);
}

.segment-option {
  display: flex;
  align-items: flex-start;
  gap: var(--kl-space-2);
  padding: var(--kl-space-3);
  border-radius: var(--kl-radius-md);
  cursor: pointer;
  margin-bottom: var(--kl-space-2);
  transition: background var(--kl-duration-fast) var(--kl-ease-default);
}

.segment-option:hover {
  background: var(--td-gray-color-2);
}

.segment-option.active {
  background: var(--kl-accent-light);
}

.segment-radio {
  width: 16px;
  height: 16px;
  border-radius: var(--kl-radius-full);
  border: 2px solid var(--td-gray-color-5);
  flex-shrink: 0;
  margin-top: 2px;
}

.segment-radio.checked {
  border-color: var(--kl-accent);
  background: var(--kl-accent);
  box-shadow: inset 0 0 0 3px #fff;
}

.wizard-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--kl-space-3);
  margin-top: var(--kl-space-6);
  padding-top: var(--kl-space-4);
  border-top: var(--kl-border-width) solid var(--td-component-stroke);
}
</style>
