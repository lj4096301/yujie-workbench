import React, { useEffect } from 'react'

import { useLayoutStore, HOME_ID } from '@/stores/layoutStore'
import Panel from '@/components/Panel'
import HomeWorkbench from '@/components/home'
import { getMainAreaBounds } from '@/utils/layoutBounds'
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
import SpreadsheetModule from '@/modules/spreadsheet'
import FlowchartModule from '@/modules/flowchart'
import MindmapModule from '@/modules/mindmap'

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
  spreadsheet: SpreadsheetModule,
  flowchart: FlowchartModule,
  mindmap: MindmapModule,
}

/** 完整模块映射 = registry 元数据 + 组件 */
const MODULE_MAP: Record<string, { component: React.FC<{ panelId?: string }>; title: string; icon: string }> =
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
  const setActiveModule = useLayoutStore((s) => s.setActiveModule)

  const isHome = activeModule === HOME_ID

  // 恢复本地布局；首次打开（无缓存）时按当前视图铺排
  useEffect(() => {
    const restored = loadLayout()
    const state = useLayoutStore.getState()
    const visibleCount = state.panels.filter((p) => p.isVisible && !p.isFloating).length

    if (!restored || visibleCount === 0) {
      if (state.activeModule === HOME_ID) activateHome()
      else activateModule(state.activeModule, getMainAreaBounds())
    }
    saveLayout()
  }, [loadLayout, activateModule, activateHome, saveLayout])

  const handleClose = (id: string) => {
    updatePanel(id, { isVisible: false })
    const remain = useLayoutStore.getState().panels.filter((p) => p.isVisible && !p.isFloating).length
    // 关掉最后一个窗口时回到首页空状态，避免白屏
    if (remain === 0) setActiveModule(HOME_ID)
    saveLayout()
  }

  const visiblePanels = panels.filter((p) => p.isVisible && !p.isFloating)

  const renderPanelContent = (panelId: string) => {
    const panel = panels.find((p) => p.id === panelId)
    const mod = panel ? MODULE_MAP[panel.moduleId] : undefined
    if (!panel || !mod) return null
    const Component = mod.component
    return (
      <Panel id={panel.id} title={panel.title} icon={mod.icon} onClose={() => handleClose(panel.id)}>
        <Component key={panel.id} panelId={panel.id} />
      </Panel>
    )
  }

  return (
    <div className={'main-area' + (isHome ? ' main-area-home' : '')}>
      {/* 首页工作台：欢迎横幅 + KPI + 主工作区 + 工具 + 更多模块 */}
      {isHome && (
        <HomeWorkbench
          onOpen={(mid) => activateModule(mid, getMainAreaBounds())}
          onClose={handleClose}
        />
      )}

      {isHome ? null : (
        /* 独占模式：单个模块铺满主内容区 */
        <div className="main-container">
          <div className="panels-canvas" style={{ height: '100%' }}>
            {visiblePanels.map((panel) => (
              <div key={panel.id} className="window" style={{ position: 'absolute', inset: 0 }}>
                {renderPanelContent(panel.id)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MainLayout
