import React, { useCallback, useEffect, useState } from 'react'
import { ConfigProvider } from 'antd'
import { Modal } from '@arco-design/web-react'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import MainLayout from '@/components/Layout'
import GlobalSearch from '@/components/GlobalSearch'
import { useLayoutStore, MODULE_ORDER } from '@/stores/layoutStore'
import { useUIStore } from '@/stores/uiStore'
import { getTheme } from '@/themes'
import { useClipboardStore } from '@/stores/clipboardStore'
import { getMainAreaBounds } from '@/utils/layoutBounds'

dayjs.extend(isoWeek)
dayjs.extend(weekOfYear)

const App: React.FC = () => {
  const isLoggedIn = useLayoutStore((s) => s.isLoggedIn)
  const searchVisible = useLayoutStore((s) => s.searchVisible)
  const setSearchVisible = useLayoutStore((s) => s.setSearchVisible)
  const zoom = useUIStore((s) => s.zoom)
  const theme = useUIStore((s) => s.themeId)
  const zoomIn = useUIStore((s) => s.zoomIn)
  const zoomOut = useUIStore((s) => s.zoomOut)
  const resetZoom = useUIStore((s) => s.resetZoom)
  const [aboutVisible, setAboutVisible] = useState(false)

  /**
   * 下面这些动作同时被两处调用：
   *   1. 渲染进程的键盘快捷键（浏览器模式 dev:web 下同样可用）
   *   2. Electron 主进程菜单（preload 注入的 onMenuCommand）
   * 抽成独立函数，避免两套实现漂移。
   */
  const goHome = useCallback(() => {
    const store = useLayoutStore.getState()
    store.activateHome(getMainAreaBounds())
    store.saveLayout()
  }, [])

  const openModule = useCallback((index: number) => {
    if (index < 0 || index >= MODULE_ORDER.length) return
    const store = useLayoutStore.getState()
    store.activateModule(MODULE_ORDER[index], getMainAreaBounds())
    store.saveLayout()
  }, [])

  const resetLayout = useCallback(() => {
    localStorage.removeItem('mimo-panels')
    localStorage.removeItem('mimo-layouts')
    localStorage.removeItem('mimo-active-module')
    localStorage.removeItem('mimo-panels-version')
    window.location.reload()
  }, [])

  const newNote = useCallback(() => {
    window.dispatchEvent(new CustomEvent('mimo:new-note'))
  }, [])

  const toggleSearch = useCallback(() => {
    setSearchVisible(!useLayoutStore.getState().searchVisible)
  }, [setSearchVisible])

  /** 刷新当前可见模块（独占视图下就是当前那一个） */
  const refreshVisible = useCallback(() => {
    const store = useLayoutStore.getState()
    const visible = store.panels.filter((p) => p.isVisible && !p.isFloating)
    if (visible.length === 0) return
    visible.forEach((p) => store.refreshPanel(p.id))
    store.saveLayout()
  }, [])

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const accel = e.ctrlKey || e.metaKey

      // Ctrl+= / Ctrl++ 放大界面（字体等比放大）
      if (accel && (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault()
        zoomIn()
        return
      }
      // Ctrl+- 缩小界面
      if (accel && (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault()
        zoomOut()
        return
      }
      // Ctrl+Shift+0 还原 100%（Ctrl+0 留给「回到首页」）
      if (accel && e.shiftKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault()
        resetZoom()
        return
      }

      if (!accel) {
        if (e.key === 'Escape') setSearchVisible(false)
        return
      }

      // Ctrl+K 全局搜索
      if (e.key === 'k' || e.code === 'KeyK') {
        e.preventDefault()
        toggleSearch()
        return
      }
      // Ctrl+0 回到首页（全部模块平铺）
      if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault()
        goHome()
        return
      }
      // Ctrl+1~9 切换模块（与侧栏点击一致：独占显示并铺满）
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        openModule(parseInt(e.key, 10) - 1)
        return
      }
      // Ctrl+N 新建灵感速记
      if (e.key === 'n' || e.code === 'KeyN') {
        e.preventDefault()
        newNote()
        return
      }
      // Ctrl+L 重置布局
      if (e.key === 'l' || e.code === 'KeyL') {
        e.preventDefault()
        resetLayout()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    setSearchVisible,
    zoomIn,
    zoomOut,
    resetZoom,
    goHome,
    openModule,
    resetLayout,
    newNote,
    toggleSearch,
  ])

  // Electron 原生菜单命令 → 与快捷键走同一套动作
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onMenuCommand) return

    return api.onMenuCommand((command) => {
      switch (command) {
        case 'home':
          goHome()
          break
        case 'zoom-in':
          zoomIn()
          break
        case 'zoom-out':
          zoomOut()
          break
        case 'zoom-reset':
          resetZoom()
          break
        case 'new-note':
          newNote()
          break
        case 'reset-layout':
          resetLayout()
          break
        case 'refresh':
          refreshVisible()
          break
        case 'about':
          setAboutVisible(true)
          break
        default:
          break
      }
    })
  }, [goHome, zoomIn, zoomOut, resetZoom, newNote, resetLayout, refreshVisible])

  // 全局剪贴板监听：应用内 copy/cut + Electron 主进程推送的系统剪贴板变化，
  // 统一写入 clipboardStore，保证面板隐藏时也能记录历史（剪切板模块只负责渲染）。
  useEffect(() => {
    const onCopy = () => {
      const sel = window.getSelection()?.toString()
      if (sel && sel.trim()) useClipboardStore.getState().add(sel, 'copy')
    }
    document.addEventListener('copy', onCopy)

    const api = window.electronAPI
    let unsub: (() => void) | undefined
    if (api?.onClipboardChange) {
      unsub = api.onClipboardChange((text: string) => {
        if (text && text.trim()) useClipboardStore.getState().add(text, 'global')
      })
    }
    return () => {
      document.removeEventListener('copy', onCopy)
      unsub?.()
    }
  }, [])

  // 顶部栏「关于」→ 打开关于弹窗
  useEffect(() => {
    const open = () => setAboutVisible(true)
    window.addEventListener('mimo:show-about', open)
    return () => window.removeEventListener('mimo:show-about', open)
  }, [])

  return (
    <ConfigProvider locale={zhCN} theme={{ token: getTheme(theme).antToken }}>
      {/*
        界面缩放的落点：zoom 是布局级缩放（元素重新排版 + 文字重新光栅化），
        比 transform: scale 清晰，且 antd 组件、自定义 px 字号会一起放大。
        高度用 100vh / zoom 抵消放大带来的溢出，保证铺满窗口不出现滚动条。
      */}
      <div
        className="app-root"
        style={{ '--mimo-zoom': String(zoom) } as React.CSSProperties}
      >
        <Sidebar />
        <div className="app-main">
          <TopBar />
          <MainLayout />
        </div>
        {searchVisible && <GlobalSearch />}

        <Modal
          title="关于 宇界工作台"
          visible={aboutVisible}
          onCancel={() => setAboutVisible(false)}
          footer={null}
          style={{ width: 420 }}
        >
          <div style={{ fontSize: 13, lineHeight: 2, color: '#555' }}>
            <div>宇界工作台 · 个人工作台</div>
            <div>模块：{MODULE_ORDER.length} 个（知识库 / 小说 / 日程 / 天气 / 免费游戏 / 新闻 / 追剧 / API 价格 / 书签 / 待办 / 剪贴板）</div>
            <div>当前界面缩放：{Math.round(zoom * 100)}%</div>
            <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
              快捷键：Ctrl+K 搜索 · Ctrl+0 首页 · Ctrl+1~9 切模块 · Ctrl+=/- 缩放
            </div>
          </div>
        </Modal>
      </div>
    </ConfigProvider>
    ) : (
      <LoginModule />
    )
  )
}

export default App
