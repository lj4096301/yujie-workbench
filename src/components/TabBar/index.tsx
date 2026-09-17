import React from 'react'
import { Dropdown } from '@arco-design/web-react'
import { useLayoutStore, HOME_ID } from '@/stores/layoutStore'
import { getMainAreaBounds } from '@/utils/layoutBounds'
import { MODULE_META } from '@/modules/registry'

/**
 * 底部 Tab 导航（手机 <600px 时替代侧栏）
 * 首页 / 模块（宫格弹层）/ 搜索 / 通知 / 我的
 * 触控热区 ≥48vp
 */
const TabBar: React.FC = () => {
  const activeModule = useLayoutStore((s) => s.activeModule)
  const activateModule = useLayoutStore((s) => s.activateModule)
  const activateHome = useLayoutStore((s) => s.activateHome)
  const setSearchVisible = useLayoutStore((s) => s.setSearchVisible)
  const saveLayout = useLayoutStore((s) => s.saveLayout)

  const open = (id: string) => {
    if (id === HOME_ID) {
      activateHome(getMainAreaBounds())
    } else {
      activateModule(id, getMainAreaBounds())
    }
    saveLayout()
  }

  const modulePanel = (
    <div className="tabbar-module-panel">
      {MODULE_META.map((m) => (
        <div
          key={m.id}
          className={`tabbar-module-item${activeModule === m.id ? ' active' : ''}`}
          onClick={() => open(m.id)}
          role="button"
        >
          <span className="tabbar-module-icon">{m.icon}</span>
          <span className="tabbar-module-name">{m.title}</span>
        </div>
      ))}
    </div>
  )

  const notifPanel = (
    <div className="tabbar-pop">
      <div className="tabbar-pop-head">通知中心</div>
      <div className="tabbar-pop-empty">暂无新通知</div>
    </div>
  )

  const userMenu = (
    <div className="tabbar-pop">
      <div
        className="tabbar-pop-item"
        role="button"
        onClick={() => window.dispatchEvent(new CustomEvent('mimo:show-about'))}
      >
        关于 宇界工作台
      </div>
    </div>
  )

  const tab = (
    icon: string,
    label: string,
    onClick: () => void,
    active: boolean,
    key: string
  ) => (
    <button
      type="button"
      key={key}
      className={`tabbar-item${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <span className="tabbar-icon">{icon}</span>
      <span className="tabbar-label">{label}</span>
    </button>
  )

  return (
    <nav className="tabbar">
      {tab('🏠', '首页', () => open(HOME_ID), activeModule === HOME_ID, 'home')}
      <Dropdown droplist={modulePanel} position="top" trigger="click" key="modules">
        <button type="button" className="tabbar-item">
          <span className="tabbar-icon">🧩</span>
          <span className="tabbar-label">模块</span>
        </button>
      </Dropdown>
      {tab('⌕', '搜索', () => setSearchVisible(true), false, 'search')}
      <Dropdown droplist={notifPanel} position="top" trigger="click" key="notif">
        <button type="button" className="tabbar-item">
          <span className="tabbar-icon">🔔</span>
          <span className="tabbar-label">通知</span>
        </button>
      </Dropdown>
      <Dropdown droplist={userMenu} position="top" trigger="click" key="user">
        <button type="button" className="tabbar-item">
          <span className="tabbar-icon">👤</span>
          <span className="tabbar-label">我的</span>
        </button>
      </Dropdown>
    </nav>
  )
}

export default TabBar
