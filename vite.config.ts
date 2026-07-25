import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { execSync } from 'child_process'

// 启动前强杀占用 3000 端口的进程
try {
  const out = execSync('netstat -ano', { encoding: 'utf-8' })
  for (const line of out.split('\n')) {
    if (line.includes(':3000') && line.includes('LISTENING')) {
      const pid = line.trim().split(/\s+/).pop()
      if (pid && pid !== '0') {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
        console.log(`  [✓] 已终止占用端口 3000 的进程 (PID: ${pid})`)
      }
      break
    }
  }
} catch { /* port not occupied */ }

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
})
