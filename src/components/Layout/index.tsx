import React, { useEffect, useMemo, useRef, useState } from 'react'
import { message } from 'antd'
import ReactGridLayout, { WidthProvider, Layout } from 'react-grid-layout'
import { useLayoutStore, HOME_ID, MODULE_ORDER } from '@/stores/layoutStore'
import { useUIStore } from '@/stores/uiStore'
import Panel from '@/components/Panel'
import { getMainAreaBounds } from '@/utils/layoutBounds'
import { GRID_COLS, GRID_ROW_H } from '@/stores/layoutStore'
import { MODULE_META } from '@/modules/registry'
import KnowledgeModule from '@/modules/knowledge'
import NovelModule from '@/modules/novel'
import CalendarModule from '@/modules/calendar'
import WeatherModule from '@/modules/weather'
import EpicModule from '@/modules/epic-games'
import NewsModule from '@/modules/news'
import TVModule from '@/modules/tv-tracker'
import APIMonitorModule from '@/modules/api-monitor'
import BookmarksModule from '@/modules/bookmarks'
import TasksModule from '@/modules/tasks'
import ClipboardModule from '@/modules/clipboard'
import KanbanModule from '@/modules/kanban'
import 'react-grid-layout/css/styles.css'

/** RGL 需要感知容器宽度才能按 cols 换算像素，WidthProvider 自动跟随 */
const Grid = WidthProvider(ReactGridLayout)

/** 模块组件映射：title/icon 由 registry 统一供给，这里只负责 component */
const MODULE_COMPONENTS: Record<string, React.FC> = {
  knowledge: KnowledgeModule,
  novel: NovelModule,
  calendar: CalendarModule,
  weather: WeatherModule,
  epic: EpicModule,
  news: NewsModule,
  tv: TVModule,
  'api-monitor': APIMonitorModule,
  bookmarks: BookmarksModule,
  tasks: TasksModule,
  clipboard: ClipboardModule,
  kanban: KanbanModule,
}

/** 完整模块映射 = registry 元数据 + 组件（新增模块时改 registry + MODULE_COMPONENTS 两处即可） */
const MODULE_MAP: Record<string, { component: React.FC; title: string; icon: string }> =
  Object.fromEntries(
    MODULE_META.map((m) => [m.id, { component: MODULE_COMPONENTS[m.id], title: m.title, icon: m.icon }])
  )

const MainLayout: React.FC = () => {
  const panels = useLayoutStore((s) => s.panels)
  const activeModule = useLayoutStore((s) => s.activeModule)
  const updatePanel = useLayoutStore((s) => s.updatePanel)
  const saveLayout = useLayoutStore((s) => s.saveLayout)
  const loadLayout = useLayoutStore((s) => s.loadLayout)
  const activateModule = useLayoutStore((s) => s.activateModule)
  const activateHome = useLayoutStore((s) => s.activateHome)
  const togglePanelAt = useLayoutStore((s) => s.togglePanelAt)
  const setActiveModule = useLayoutStore((s) => s.setActiveModule)
  const bringToFront = useLayoutStore((s) => s.bringToFront)
  const zoom = useUIStore((s) => s.zoom)

  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  const isHome = activeModule === HOME_ID

  // 恢复本地布局；首次打开（无缓存）时按当前视图铺排
  useEffect(() => {
    const restored = loadLayout()
    const state = useLayoutStore.getState()
    const visibleCount = state.panels.filter((p) => p.isVisible && !p.isFloating).length

    if (!restored || visibleCount === 0) {
      if (state.activeModule === HOME_ID) activateHome(getMainAreaBounds())
      else activateModule(state.activeModule, getMainAreaBounds())
    }
    saveLayout()
  }, [loadLayout, activateModule, activateHome, saveLayout])

  // 跟踪主内容区尺寸（WidthProvider 响应；这里只为判断空态渲染等）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleClose = (id: string) => {
    updatePanel(id, { isVisible: false })
    const remain = useLayoutStore.getState().panels.filter((p) => p.isVisible && !p.isFloating).length
    // 关掉最后一个窗口时回到首页空状态，避免白屏
    if (remain === 0) setActiveModule(HOME_ID)
    saveLayout()
  }

  const handleChipClick = (id: string) => {
    togglePanelAt(id, getMainAreaBounds())
  }

  const visiblePanels = panels.filter((p) => p.isVisible && !p.isFloating)
  const maximizedPanel = visiblePanels.find((p) => p.isMaximized)
  const gridPanels = visiblePanels.filter((p) => !p.isMaximized)

  /** RGL layout：从面板网格状态生成（缺 grid 的给默认位，避免崩溃） */
  const gridLayout: Layout[] = useMemo(
    () =>
      gridPanels.map((p, i) => ({
        i: p.id,
        x: p.grid?.x ?? (i % 2) * 6,
        y: p.grid?.y ?? Math.floor(i / 2) * 18,
        w: p.grid?.w ?? 6,
        h: p.grid?.h ?? 18,
        minW: 3,
        minH: 12,
      })),
    [gridPanels]
  )

  /** RGL 拖拽/缩放后同步回 store；防抖落盘（拖动中高频触发，只在停顿后写 localStorage） */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleLayoutChange = (layout: Layout[]) => {
    for (const li of layout) {
      const p = gridPanels.find((gp) => gp.id === li.i)
      const g = p?.grid
      if (!g || g.x !== li.x || g.y !== li.y || g.w !== li.w || g.h !== li.h) {
        updatePanel(li.i, { grid: { x: li.x, y: li.y, w: li.w, h: li.h } })
      }
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(saveLayout, 300)
  }

  /**
   * 缩放防重叠：RGL 的 preventCollision 只作用于拖动，缩放可以越过邻居，
   * 这里在松手时检查 —— 与其他窗口重叠就整块回滚到缩放前的位置尺寸。
   */
  const handleResizeStop = (layout: Layout[], oldItem: Layout, newItem: Layout) => {
    const overlap = (a: Layout, b: Layout) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    const clash = gridLayout.some((g) => g.i !== newItem.i && overlap(newItem, g))
    if (clash) {
      updatePanel(oldItem.i, {
        grid: { x: oldItem.x, y: oldItem.y, w: oldItem.w, h: oldItem.h },
      })
      message.warning('与其他模块重叠，已还原')
    }
  }

  const renderPanelContent = (panelId: string) => {
    const panel = panels.find((p) => p.id === panelId)
    const mod = panel ? MODULE_MAP[panel.moduleId] : undefined
    if (!panel || !mod) return null
    const Component = mod.component
    return (
      <Panel id={panel.id} title={panel.title} icon={mod.icon} onClose={() => handleClose(panel.id)}>
        <Component key={`${panel.id}-${panel.refreshKey || 0}`} />
      </Panel>
    )
  }

  return (
    <div className="main-area">
      {/* 首页工具条：模块启动器 */}
      {isHome && (
        <div className="home-toolbar">
          <span className="home-toolbar-title">🏠 首页 · 全部模块</span>
          <div className="home-chips">
            {MODULE_ORDER.map((id) => {
              const mod = MODULE_MAP[id]
              const panel = panels.find((p) => p.id === id)
              const on = !!panel?.isVisible
              return (
                <button
                  key={id}
                  type="button"
                  className={`home-chip${on ? ' home-chip-on' : ''}`}
                  onClick={() => handleChipClick(id)}
                  title={on ? '关闭该模块' : '打开该模块'}
                >
                  <span>{mod?.icon}</span>
                  <span>{mod?.title}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="home-chip home-chip-action"
            onClick={() => {
              activateHome(getMainAreaBounds())
              saveLayout()
            }}
            title="把所有模块排回网格"
          >
            重排
          </button>
        </div>
      )}

      <div ref={containerRef} className={`main-container${isHome ? ' main-container-home' : ''}`}>
        {isHome ? (
          /* 首页：react-grid-layout 接管拖拽 / 吸附 / 防重叠。
             app-root 的 CSS zoom 会缩放视口坐标，RGL 的拖拽/缩放 delta
             需要除以该倍数才能换回画布布局像素 —— 官方 transformScale 就是干这个的。 */
          <div
            className="panels-canvas"
            style={{ height: 'auto', minHeight: '100%' }}
          >
            <Grid
              layout={gridLayout}
              cols={GRID_COLS}
              rowHeight={GRID_ROW_H}
              margin={[12, 12]}
              containerPadding={[12, 12]}
              preventCollision
              allowOverlap={false}
              compactType={null}
              draggableHandle=".panel-header"
              resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
              transformScale={zoom}
              onLayoutChange={handleLayoutChange}
              onDragStart={(_l, _o, newItem) => bringToFront(newItem.i)}
              onResizeStop={handleResizeStop}
            >
              {gridPanels.map((panel) => (
                <div key={panel.id} className="window window-in-grid">
                  {renderPanelContent(panel.id)}
                </div>
              ))}
            </Grid>

            {/* 最大化面板：脱离网格，铺满画布 */}
            {maximizedPanel && (
              <div
                className="window window-maximized"
                style={{ position: 'absolute', inset: 0, zIndex: 9999 }}
              >
                {renderPanelContent(maximizedPanel.id)}
              </div>
            )}

            {visiblePanels.length === 0 && (
              <div className="home-empty">
                <div className="home-empty-icon">🗂️</div>
                <div className="home-empty-title">所有模块都已关闭</div>
                <div className="home-empty-desc">用上方模块条打开，或一键恢复全部模块</div>
                <button
                  type="button"
                  className="home-empty-btn"
                  onClick={() => {
                    activateHome(getMainAreaBounds())
                    saveLayout()
                  }}
                >
                  恢复全部模块
                </button>
              </div>
            )}
          </div>
        ) : (
          /* 独占模式：单个模块铺满主内容区（无拖拽，视口即画布） */
          <div className="panels-canvas" style={{ height: '100%' }}>
            {visiblePanels.map((panel) => (
              <div
                key={panel.id}
                className="window"
                style={{ position: 'absolute', inset: 0 }}
              >
                {renderPanelContent(panel.id)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MainLayout
