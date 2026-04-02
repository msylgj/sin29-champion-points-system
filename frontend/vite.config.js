import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const envRoot = fileURLToPath(new URL('../', import.meta.url))
  const env = loadEnv(mode, envRoot, '')
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || process.env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  return {
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true
      }
    },
    allowedHosts
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/xlsx/')) return 'vendor-xlsx'
          if (id.includes('/vue/') || id.includes('/vue-router/')) return 'vendor-vue'
          return 'vendor'
        }
      }
    }
  }
}
})
