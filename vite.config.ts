import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@components': path.resolve(__dirname, './src/components'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    watch: {
      // ignore temp files from agent infra to avoid EBUSY watcher crash
      ignored: ['**/*.agent_infra_tmp_*', '**/.git/**', '**/node_modules/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 8000,
        proxyTimeout: 8000,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
