import React, { useEffect, useState } from 'react'
import { Layout, Menu, Dropdown } from '@arco-design/web-react'
import { useLayoutStore, HOME_ID, EXTRA_MODULE_IDS } from '@/stores/layoutStore'
import { useUIStore, ZOOM_MAX, ZOOM_MIN } from '@/stores/uiStore'
import { getMainAreaBounds } from '@/utils/layoutBounds'
import { MODULE_META } from '@/modules/registry'
import { THEMES, getTheme } from '@/themes'

const { Sider } = Layout
const MenuItem = Menu.Item
const SubMenu = Menu.SubMenu

const EXTRA_SET = new Set(EXTRA_MODULE_IDS)

/** 高频模块直接展示在侧栏 */
const MAIN_ITEMS = MODULE_META.filter((m) => !EXTRA_SET.has(m.id)).map((m) => ({
  id: m.id,
  icon: m.icon,
  label: m.title,
}))

/** 低频模块收进「更多功能」子菜单 */
const EXTRA_ITEMS = MODULE_META.filter((m) => EXTRA_SET.has(m.id)).map((m) => ({
  id: m.id,
  icon: m.icon,
  label: m.title,
}))

/** 主题切换下拉菜单（Arco Dropdown + Menu） */
const themeMenu = (
  <Menu
    selectedKeys={[useUIStore.getState().themeId]}
    onClickMenuItem={(key) => useUIStore.getState().setTheme(String(key))}
    style={{ borderRadius: 8 }}
  >
    {THEMES.map((t) => (
      <MenuItem key={t.id}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: 3,
              background: t.preview.sidebar,
              border: `1.5px solid ${t.preview.primary}`,
              flexShrink: 0,
            }}
          />
          <span>{t.label}</span>
        </span>
      </MenuItem>
    ))}
  </Menu>
)

/**
 * 侧边导航（Arco Layout.Sider + Menu）
 * 可收起：收起时仅保留图标，悬停显示 Tooltip（Arco 官方能力）
 */
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

  const handleMenuClick = (key: string) => {
    if (key === HOME_ID) {
      activateHome(getMainAreaBounds())
      saveLayout()
      return
    }
    if (key === '__search') {
      setSearchVisible(true)
      return
    }
    activateModule(key, getMainAreaBounds())
    saveLayout()
  }

  // 低频模块被激活时自动展开「更多功能」子菜单
  const [openKeys, setOpenKeys] = useState<string[]>([])
  useEffect(() => {
    if (activeModule && EXTRA_SET.has(activeModule)) setOpenKeys(['__more'])
  }, [activeModule])

  return (
    <Sider
      className="sidebar"
      width={200}
      collapsible
      collapsed={sidebarCollapsed}
      onCollapse={toggleSidebar}
      trigger={null}
      style={{ borderRight: '1px solid var(--sidebar-border)' }}
    >
      <div className="sidebar-logo">
        <h1>{sidebarCollapsed ? '宇' : '宇界工作台'}</h1>
      </div>

      <Menu
        className="sidebar-menu"
        selectedKeys={[activeModule === HOME_ID ? HOME_ID : activeModule]}
        onClickMenuItem={(key) => handleMenuClick(String(key))}
        collapse={sidebarCollapsed}
        openKeys={openKeys}
        onClickSubMenu={(_, keys) => setOpenKeys((keys as string[]) ?? [])}
        style={{ border: 'none', background: 'transparent', padding: '8px' }}
      >
        <MenuItem key={HOME_ID}>
          <span className="menu-icon">🏠</span>
          <span>首页</span>
        </MenuItem>
        <MenuItem key="__search">
          <span className="menu-icon">🔍</span>
          <span>搜索 (Ctrl+K)</span>
        </MenuItem>
        {MAIN_ITEMS.map((item) => (
          <MenuItem key={item.id}>
            <span className="menu-icon">{item.icon}</span>
            <span>{item.label}</span>
          </MenuItem>
        ))}
        <SubMenu
          key="__more"
          title={
            <>
              <span className="menu-icon">📦</span>
              {!sidebarCollapsed && <span>更多功能</span>}
            </>
          }
        >
          {EXTRA_ITEMS.map((item) => (
            <MenuItem key={item.id}>
              <span className="menu-icon">{item.icon}</span>
              <span>{item.label}</span>
            </MenuItem>
          ))}
        </SubMenu>
      </Menu>

      <div className="sidebar-bottom">
        <div className="sidebar-theme">
          <Dropdown droplist={themeMenu} position="br" trigger="click">
            <div className="theme-trigger" title="切换主题">
              <span
                className="theme-swatch"
                style={{ background: getTheme(useUIStore.getState().themeId).preview.primary }}
              />
              {!sidebarCollapsed && (
                <span>{getTheme(useUIStore.getState().themeId).label}</span>
              )}
            </div>
          </Dropdown>
        </div>

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

        <div
          className="menu-item sidebar-collapse"
          onClick={toggleSidebar}
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          <span className="menu-icon">{sidebarCollapsed ? '→' : '←'}</span>
          {!sidebarCollapsed && <span>收起侧栏</span>}
        </div>
      </div>
    </Sider>
  )
}

export default Sidebar
