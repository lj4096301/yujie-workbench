import React from 'react'
import { useLayoutStore } from '@/stores/layoutStore'

interface PanelProps {
  id: string
  title: string
  icon?: string
  children: React.ReactNode
  onClose?: () => void
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

const RefreshIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
    <path d="M9.5 3A6.5 6.5 0 1 1 3 9.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M9.5 3V7H5.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
          {icon && <span className="panel-icon">{icon}</span>}
          <span className="panel-title-text">{title}</span>
        </div>
        <div className="panel-actions">
          <button 
            type="button" 
            onClick={handleRefresh} 
            title="刷新" 
            className="panel-btn panel-btn-refresh"
            aria-label="刷新"
          >
            <RefreshIcon />
          </button>
          <button 
            type="button" 
            onClick={toggleMaximize}
            title={isMaximized ? '还原' : '最大化'} 
            className="panel-btn panel-btn-maximize"
            aria-label={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button 
            type="button" 
            onClick={onClose} 
            title="关闭" 
            className="panel-btn panel-btn-close"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  )
}

export default Panel
