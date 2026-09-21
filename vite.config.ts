import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 数组形式：精确路径（css 子路径）必须在通用前缀（tactile-weather）之前，否则前缀命中
    alias: [
      {
        find: 'tactile-weather/dist/tactile-weather.css',
        replacement: path.resolve(__dirname, './src/vendor/tactile-weather/tactile-weather.css'),
      },
      {
        // tactile-weather：官方 dist 内嵌 React 19.2 jsx-runtime，与项目 React 18 不兼容；
        // 已修补为 React 18 兼容版并 vendor 化（src/vendor/tactile-weather），
        // 归档见 D:\docker-ai\复用资源\组件\tactile-weather\（npm tarball 解包）
        find: 'tactile-weather',
        replacement: path.resolve(__dirname, './src/vendor/tactile-weather/index.js'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@modules', replacement: path.resolve(__dirname, './src/modules') },
      { find: '@components', replacement: path.resolve(__dirname, './src/components') },
      { find: '@stores', replacement: path.resolve(__dirname, './src/stores') },
      { find: '@services', replacement: path.resolve(__dirname, './src/services') },
    ],
  },
  server: {
    port: 5173,
    host: '::',
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
