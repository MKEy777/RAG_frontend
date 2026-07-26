import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['tdesign-vue-next', 'tdesign-icons-vue-next', 'vue', 'vue-router', 'pinia'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          tdesign: ['tdesign-vue-next', 'tdesign-icons-vue-next'],
          echarts: ['echarts/core', 'echarts/charts', 'echarts/renderers', 'echarts/components'],
        },
      },
    },
  },
})
