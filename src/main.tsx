import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

/**
 * 白屏兜底：模块加载或渲染抛错时把错误显示在页面上，
 * 避免「页面全白、只能开 DevTools」的排查困境。
 */
function showFatalError(title: string, detail: string) {
  if (document.getElementById('mimo-fatal-error')) return
  const box = document.createElement('div')
  box.id = 'mimo-fatal-error'
  box.style.cssText =
    'position:fixed;inset:auto 16px 16px 16px;z-index:999999;background:#fff2f0;border:1px solid #ffccc7;' +
    'border-radius:8px;padding:12px 16px;color:#a8071a;font-size:12px;white-space:pre-wrap;' +
    'max-height:40vh;overflow:auto;box-shadow:0 6px 16px rgba(0,0,0,0.12);font-family:monospace'
  box.textContent = `${title}\n\n${detail}`
  document.body.appendChild(box)
}

window.addEventListener('error', (e) => {
  showFatalError('页面脚本运行出错', e.error?.stack || e.message || String(e))
})
window.addEventListener('unhandledrejection', (e) => {
  showFatalError('异步任务出错', String((e.reason as Error)?.stack || e.reason))
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
