import React, { useEffect, useState } from 'react'
import { useLayoutStore, EXTRA_MODULE_IDS } from '@/stores/layoutStore'
import { MODULE_META } from '@/modules/registry'

const metaById = new Map(MODULE_META.map((m) => [m.id, m]))

/**
 * ⑤ 更多功能卡：低频模块统一收进一张卡片（知识/书签/流程图/思维导图等）
 * - 不依赖 isVisible（低频模块默认隐藏，卡片作为常驻入口始终可见）
 * - 点击单个图标直接跳转对应模块
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

  // 低频入口：知识库/书签（原工具四卡）+ 扩展低频模块，统一收进一张卡片
  const list = ['knowledge', 'bookmarks', ...EXTRA_MODULE_IDS].filter((id) => !hidden.includes(id))
  if (list.length === 0) return null

  const remove = (id: string) => {
    onClose(id)
    setHidden((h) => [...h, id])
  }

  return (
    <div className="hw-card">
      <div className="hw-card-head">
        <span className="hw-card-title">🧰 更多功能</span>
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
