import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toCanvasDelta } from '@/utils/zoom'

/**
 * 模块内部左右分栏容器：中间的竖条可以拖动，用来调整左侧栏宽度。
 *
 * 适用于「树形/列表侧栏 + 内容区」这类布局（知识库文件树、小说章节列表等）。
 * 宽度按 storageKey 记在 localStorage 里，双击分隔条复位。
 *
 * 两个宽度概念要分开：
 *   - preferredWidth：用户设定的偏好宽度（持久化）
 *   - renderWidth：实际渲染宽度 = preferredWidth 按当前容器夹取后的值
 * 否则在窄面板里（比如首页 3 列平铺）宽度会被夹到最小值并**写回存储**，
 * 面板变宽后就再也回不到用户原来设的宽度了。
 */

const DIVIDER_W = 8
/** 右侧内容区至少要留下的宽度 */
const MIN_RIGHT = 160

interface SplitPaneProps {
  /** localStorage 键名，用于记住左栏宽度（不同模块用不同的键） */
  storageKey: string
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  left: React.ReactNode
  right: React.ReactNode
  leftStyle?: React.CSSProperties
  rightStyle?: React.CSSProperties
}

function readWidth(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}

const SplitPane: React.FC<SplitPaneProps> = ({
  storageKey,
  defaultWidth = 200,
  minWidth = 120,
  maxWidth = 520,
  left,
  right,
  leftStyle,
  rightStyle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ startX: 0, startW: 0 })
  const [containerW, setContainerW] = useState(0)
  const [preferredWidth, setPreferredWidth] = useState(() => readWidth(storageKey, defaultWidth))
  const [dragging, setDragging] = useState(false)

  /** 按容器可用宽度夹取：不小于 minWidth，也不挤掉右侧内容区 */
  const clamp = useCallback(
    (w: number, cw: number) => {
      let upper = maxWidth
      if (cw > 0) upper = Math.min(maxWidth, Math.max(minWidth, cw - MIN_RIGHT - DIVIDER_W))
      return Math.round(Math.min(Math.max(w, minWidth), Math.max(minWidth, upper)))
    },
    [minWidth, maxWidth]
  )

  const renderWidth = clamp(preferredWidth, containerW)

  // 跟踪容器宽度（面板被拖大拖小、切换首页/独占视图都会变）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => setContainerW(el.clientWidth)
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 拖动分隔条
  useEffect(() => {
    if (!dragging) return

    document.body.classList.add('is-resizing')

    const onMove = (e: MouseEvent) => {
      // 鼠标增量是视口像素，分栏宽度是 CSS 像素：缩放不为 1 时必须换算
      const delta = toCanvasDelta(e.clientX - dragRef.current.startX)
      const cw = containerRef.current?.clientWidth ?? 0
      setPreferredWidth(clamp(dragRef.current.startW + delta, cw))
    }
    const onUp = () => setDragging(false)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.body.classList.remove('is-resizing')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragging, clamp])

  // 记住用户设定的宽度（存的是 preferredWidth，不是被夹取后的值）
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(preferredWidth))
    } catch {
      /* 忽略存储失败 */
    }
  }, [storageKey, preferredWidth])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startX: e.clientX, startW: renderWidth }
    setDragging(true)
  }

  return (
    <div ref={containerRef} className="split-pane">
      <div className="split-pane-left" style={{ width: renderWidth, ...leftStyle }}>
        {left}
      </div>

      <div
        className={`split-pane-divider${dragging ? ' active' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setPreferredWidth(defaultWidth)}
        title="拖动调整宽度，双击复位"
        role="separator"
        aria-orientation="vertical"
      />

      <div className="split-pane-right" style={rightStyle}>
        {right}
      </div>
    </div>
  )
}

export default SplitPane
