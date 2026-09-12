import React from 'react'
import { useLayoutStore } from '@/stores/layoutStore'

interface PanelProps {
  id: string
  title: string
  icon?: string
  children: React.ReactNode
  onClose?: () => void
  /**
   * 在标题栏按下鼠标时触发。
   * 拖动事件直接绑在标题栏上（不再使用覆盖整条标题栏的透明拖拽层，
   * 那层会把标题栏的按钮全部挡住）。
   */
  onDragStart?: (e: React.MouseEvent, id: string, type: 'move') => void
}

const MaximizeIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
    <rect x="1.6" y="1.6" width="7.8" height="7.8" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const RestoreIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
    <rect x="1.2" y="3" width="6.6" height="6.6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3.6 3V2.6A1.4 1.4 0 0 1 5 1.2h3.4A1.4 1.4 0 0 1 9.8 2.6V6a1.4 1.4 0 0 1-1.4 1.4H8" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const Panel: React.FC<PanelProps> = ({ id, title, icon, children, onClose, onDragStart }) => {
  const panel = useLayoutStore((s) => s.panels.find((p) => p.id === id))
  const maximizePanel = useLayoutStore((s) => s.maximizePanel)
  const restorePanel = useLayoutStore((s) => s.restorePanel)
  const refreshPanel = useLayoutStore((s) => s.refreshPanel)
  const bringToFront = useLayoutStore((s) => s.bringToFront)
  const saveLayout = useLayoutStore((s) => s.saveLayout)

  const isMaximized = !!panel?.isMaximized

  const toggleMaximize = () => {
    if (isMaximized) restorePanel(id)
    else maximizePanel(id)
    saveLayout()
  }

  const handleRefresh = () => {
    // 递增 refreshKey → Layout 以 key 变化重建模块组件，从而重新拉取数据
    refreshPanel(id)
    saveLayout()
  }

  return (
    <div className="panel-container" onMouseDown={() => bringToFront(id)}>
      <div
        className="panel-header"
        onMouseDown={(e) => onDragStart?.(e, id, 'move')}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('.panel-actions')) return
          toggleMaximize()
        }}
      >
        <div className="panel-title">
          {icon && <span className="menu-icon">{icon}</span>}
          <span>{title}</span>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={handleRefresh} title="刷新" className="panel-btn">
            ↻
          </button>
          <button
            type="button"
            onClick={toggleMaximize}
            title={isMaximized ? '还原' : '最大化'}
            className="panel-btn"
          >
            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button type="button" onClick={onClose} title="关闭" className="panel-btn panel-close">
            ×
          </button>
        </div>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  )
}

export default Panel
