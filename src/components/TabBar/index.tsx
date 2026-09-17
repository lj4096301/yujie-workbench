import React from 'react'
import { Dropdown } from '@arco-design/web-react'
import { useLayoutStore, HOME_ID, EXTRA_MODULE_IDS } from '@/stores/layoutStore'
import { getMainAreaBounds } from '@/utils/layoutBounds'
import { MODULE_META } from '@/modules/registry'

const EXTRA_SET = new Set(EXTRA_MODULE_IDS)

/** 高频模块直接展示在底部 Tab */
const MAIN_ITEMS = MODULE_META.filter((m) => !EXTRA_SET.has(m.id))

/** 低频模块收进「更多」弹出面板 */
const EXTRA_ITEMS = MODULE_META.filter((m) => EXTRA_SET.has(m.id))

/**
 * 底部 Tab 导航（平板竖屏 ≤768px 时替代侧栏）
 * 首页 + 高频模块 + 「更多」弹出低频模块
 */
const TabBar: React.FC = () => {
  const activeModule = useLayoutStore((s) => s.activeModule)
  const activateModule = useLayoutStore((s) => s.activateModule)
  const activateHome = useLayoutStore((s) => s.activateHome)
  const saveLayout = useLayoutStore((s) => s.saveLayout)

  const open = (id: string) => {
    if (id === HOME_ID) {
      activateHome(getMainAreaBounds())
    } else {
      activateModule(id, getMainAreaBounds())
    }
    saveLayout()
  }

  const morePanel = (
    <div className="tabbar-more-panel">
      {EXTRA_ITEMS.map((m) => (
        <div
          key={m.id}
          className={`tabbar-more-item${activeModule === m.id ? ' active' : ''}`}
          onClick={() => open(m.id)}
          role="button"
        >
          <span className="tabbar-more-icon">{m.icon}</span>
          <span className="tabbar-more-name">{m.title}</span>
        </div>
      ))}
    </div>
  )

  const item = (id: string, icon: string, label: string) => (
    <button
      type="button"
      key={id}
      className={`tabbar-item${activeModule === id ? ' active' : ''}`}
      onClick={() => open(id)}
    >
      <span className="tabbar-icon">{icon}</span>
      <span className="tabbar-label">{label}</span>
    </button>
  )

  return (
    <nav className="tabbar">
      {item(HOME_ID, '🏠', '首页')}
      {MAIN_ITEMS.map((m) => item(m.id, m.icon, m.title))}
      <Dropdown droplist={morePanel} position="top" trigger="click">
        <button type="button" className="tabbar-item">
          <span className="tabbar-icon">📦</span>
          <span className="tabbar-label">更多</span>
        </button>
      </Dropdown>
    </nav>
  )
}

export default TabBar
