import React from 'react'
import { useLayoutStore, HOME_ID } from '@/stores/layoutStore'
import { useUIStore, ZOOM_MAX, ZOOM_MIN } from '@/stores/uiStore'
import { getMainAreaBounds } from '@/utils/layoutBounds'
import { MODULE_META } from '@/modules/registry'

/** 导航清单来自模块注册表（title 复用为 label，改名只改 registry） */
const MENU_ITEMS = MODULE_META.map((m) => ({ id: m.id, icon: m.icon, label: m.title }))

const Sidebar: React.FC = () => {
  const activeModule = useLayoutStore((s) => s.activeModule)
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar)
  const setSearchVisible = useLayoutStore((s) => s.setSearchVisible)
  const activateModule = useLayoutStore((s) => s.activateModule)
  const activateHome = useLayoutStore((s) => s.activateHome)
  const saveLayout = useLayoutStore((s) => s.saveLayout)

  const zoom = useUIStore((s) => s.zoom)
  const zoomIn = useUIStore((s) => s.zoomIn)
  const zoomOut = useUIStore((s) => s.zoomOut)
  const resetZoom = useUIStore((s) => s.resetZoom)

  const handleModuleClick = (id: string) => {
    // 独占显示：隐藏其他面板，目标面板铺满主内容区
    activateModule(id, getMainAreaBounds())
    saveLayout()
  }

  const handleHomeClick = () => {
    // 首页：所有模块平铺在画布上，可拖拽 / 缩放 / 关闭
    activateHome(getMainAreaBounds())
    saveLayout()
  }

  return (
    <div className="sidebar" style={{ width: sidebarCollapsed ? 60 : 200 }}>
      <div className="sidebar-logo">
        <h1>{sidebarCollapsed ? '宇' : '宇界工作台'}</h1>
      </div>

      {/* 首页 */}
      <div
        className={`menu-item ${activeModule === HOME_ID ? 'active' : ''}`}
        onClick={handleHomeClick}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="menu-icon">🏠</span>
        {!sidebarCollapsed && <span>首页</span>}
      </div>

      {/* 搜索按钮 */}
      <div
        className="menu-item"
        onClick={() => setSearchVisible(true)}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="menu-icon">🔍</span>
        {!sidebarCollapsed && <span>搜索 (Ctrl+K)</span>}
      </div>

      <div className="sidebar-menu">
        {MENU_ITEMS.map((item) => (
          <div
            key={item.id}
            className={`menu-item ${activeModule === item.id ? 'active' : ''}`}
            onClick={() => handleModuleClick(item.id)}
          >
            <span className="menu-icon">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </div>
        ))}
      </div>

      {/* 界面缩放：整体放大字体（Ctrl+= / Ctrl+- 同效） */}
      <div className="sidebar-zoom">
        {sidebarCollapsed ? (
          <button
            type="button"
            className="zoom-btn"
            onClick={zoomIn}
            title={`当前 ${Math.round(zoom * 100)}%，点击放大`}
          >
            {Math.round(zoom * 100)}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="zoom-btn"
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              title="缩小界面 (Ctrl+-)"
            >
              A-
            </button>
            <button
              type="button"
              className="zoom-value"
              onClick={resetZoom}
              title="还原 100% (Ctrl+Shift+0)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="zoom-btn"
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              title="放大界面 (Ctrl+=)"
            >
              A+
            </button>
          </>
        )}
      </div>

      {/* 底部操作 */}
      <div
        className="menu-item"
        onClick={toggleSidebar}
        style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="menu-icon">{sidebarCollapsed ? '→' : '←'}</span>
        {!sidebarCollapsed && <span>收起侧栏</span>}
      </div>
    </div>
  )
}

export default Sidebar
