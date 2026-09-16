import React, { useEffect, useState } from 'react'
import { useLayoutStore, EXTRA_MODULE_IDS } from '@/stores/layoutStore'
import { MODULE_META } from '@/modules/registry'

const metaById = new Map(MODULE_META.map((m) => [m.id, m]))

/**
 * ⑤ 更多模块宫格：固定展示全部低频模块入口（一行 6 个）
 * - 不依赖 isVisible（低频模块默认隐藏，宫格作为常驻入口始终可见）
 * - hover 浮出 × 移除（session 记忆；模块管理重新勾选后恢复）
 */
const HomeMoreGrid: React.FC<{
  onOpen: (moduleId: string) => void
  onClose: (moduleId: string) => void
}> = ({ onOpen, onClose }) => {
  const panels = useLayoutStore((s) => s.panels)
  const [hidden, setHidden] = useState<string[]>([])

  // 模块管理重新勾选该模块时，从隐藏列表恢复显示
  useEffect(() => {
    setHidden((h) => h.filter((id) => panels.find((p) => p.id === id)?.isVisible))
  }, [panels])

  // 保持首页「更多模块」6 宫格一行，其余低频模块从侧栏「更多功能」进入
  const list = EXTRA_MODULE_IDS.filter((id) => !hidden.includes(id)).slice(0, 6)
  if (list.length === 0) return null

  const remove = (id: string) => {
    onClose(id)
    setHidden((h) => [...h, id])
  }

  return (
    <div className="hw-card">
      <div className="hw-card-head">
        <span className="hw-card-title">📦 更多模块</span>
      </div>
      <div className="hw-card-body">
        <div className="mg-grid">
          {list.map((id) => {
            const mod = metaById.get(id)
            return (
              <div
                key={id}
                className="mg-item"
                onClick={() => onOpen(id)}
                title={`进入${mod?.title ?? ''}`}
              >
                <span className="mg-icon">{mod?.icon}</span>
                <span className="mg-name">{mod?.title}</span>
                <span
                  className="mg-close"
                  role="button"
                  title="从首页移除"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(id)
                  }}
                >
                  ×
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default HomeMoreGrid
