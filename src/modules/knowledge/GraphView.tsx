import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface GraphNode {
  id: string
  name: string
  degree: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: Array<[string, string]>
}

interface P {
  width: number
  height: number
  onOpen: (path: string) => void
}

interface LayoutNode extends GraphNode {
  x: number
  y: number
}

/**
 * 简易力导向布局（Fruchterman-Reingold 简化版，静态迭代后一次渲染）。
 * 移植自 Foam / Obsidian 图谱的思路：节点 = 笔记，连线 = wikilink，度数决定节点大小。
 */
function computeLayout(nodes: GraphNode[], edges: Array<[string, string]>, W: number, H: number): LayoutNode[] {
  const n = nodes.length
  if (n === 0) return []
  const index = new Map(nodes.map((nd, i) => [nd.id, i]))
  const pos: LayoutNode[] = nodes.map((nd, i) => {
    const angle = (2 * Math.PI * i) / n
    const r = Math.min(W, H) * 0.38
    return { ...nd, x: W / 2 + r * Math.cos(angle), y: H / 2 + r * Math.sin(angle) }
  })

  const springs = edges
    .map(([a, b]) => [index.get(a), index.get(b)] as [number, number])
    .filter(([a, b]) => a !== undefined && b !== undefined)

  const k = Math.sqrt((W * H) / Math.max(1, n)) * 0.85 // 理想边长
  const iterations = n > 400 ? 120 : 300
  const cooling = 0.95
  let temp = Math.min(W, H) / 8

  for (let it = 0; it < iterations; it++) {
    const fx = new Array(n).fill(0)
    const fy = new Array(n).fill(0)
    // 斥力
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x
        let dy = pos[i].y - pos[j].y
        let dist2 = dx * dx + dy * dy
        if (dist2 < 1) {
          dx = (Math.random() - 0.5) * 2
          dy = (Math.random() - 0.5) * 2
          dist2 = 4
        }
        const dist = Math.sqrt(dist2)
        const f = (k * k) / dist2
        const ux = dx / dist
        const uy = dy / dist
        fx[i] += ux * f
        fy[i] += uy * f
        fx[j] -= ux * f
        fy[j] -= uy * f
      }
    }
    // 弹力
    for (const [a, b] of springs) {
      const dx = pos[a].x - pos[b].x
      const dy = pos[a].y - pos[b].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (dist * dist) / k
      const ux = dx / dist
      const uy = dy / dist
      fx[a] -= ux * f
      fy[a] -= uy * f
      fx[b] += ux * f
      fy[b] += uy * f
    }
    // 位移限幅 + 向心
    for (let i = 0; i < n; i++) {
      const dx = fx[i] + (W / 2 - pos[i].x) * 0.02
      const dy = fy[i] + (H / 2 - pos[i].y) * 0.02
      const disp = Math.sqrt(dx * dx + dy * dy) || 1
      const limit = Math.min(disp, temp)
      pos[i].x = Math.max(20, Math.min(W - 20, pos[i].x + (dx / disp) * limit))
      pos[i].y = Math.max(20, Math.min(H - 20, pos[i].y + (dy / disp) * limit))
    }
    temp *= cooling
  }
  return pos
}

const GraphView: React.FC<P> = ({ width, height, onOpen }) => {
  const [data, setData] = useState<GraphData | null>(null)
  const [error, setError] = useState('')
  const [hover, setHover] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: width || 800, h: height || 520 })

  // 视口变换：平移 + 缩放（Obsidian 图谱交互）
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  // 节点位置（布局计算结果 + 用户拖拽覆盖）
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map())

  useEffect(() => {
    fetch('/api/knowledge/graph')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError((e as Error).message))
  }, [])

  // 自适应容器尺寸
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      const el = containerRef.current
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const layout = useMemo(
    () => (data ? computeLayout(data.nodes, data.edges, size.w, size.h) : []),
    [data, size.w, size.h]
  )

  // 布局变化时重置节点位置和视口
  useEffect(() => {
    setPositions(new Map(layout.map((n) => [n.id, { x: n.x, y: n.y }])))
    setView({ x: 0, y: 0, k: 1 })
  }, [layout])

  const posById = useMemo(() => positions, [positions])

  // 滚轮缩放（以鼠标位置为锚点）；React 合成 onWheel 是 passive 的，必须用原生监听
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
        const k = Math.max(0.25, Math.min(5, v.k * factor))
        // 保持鼠标下的图坐标不动：mx = v.x + v.k * gx
        const x = mx - ((mx - v.x) * k) / v.k
        const y = my - ((my - v.y) * k) / v.k
        return { x, y, k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [data])

  // 背景平移 + 节点拖拽（统一 mousemove/mouseup 管理）
  const dragRef = useRef<{
    type: 'pan' | 'node'
    nodeId?: string
    startX: number
    startY: number
    orig: { x: number; y: number; k?: number }
    moved?: boolean
  } | null>(null)

  const onSvgMouseDown = (e: React.MouseEvent) => {
    // 背景按下 → 平移
    if ((e.target as Element).tagName !== 'svg') return
    dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, orig: { ...view } }
  }

  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const p = posById.get(id)
    if (!p) return
    dragRef.current = {
      type: 'node',
      nodeId: id,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...p, k: view.k },
      moved: false,
    }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (d.type === 'pan') {
        setView((v) => ({ ...v, x: d.orig.x + dx, y: d.orig.y + dy }))
      } else if (d.type === 'node' && d.nodeId) {
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
        const k = d.orig.k || 1
        setPositions((prev) => {
          const next = new Map(prev)
          next.set(d.nodeId!, { x: d.orig.x + dx / k, y: d.orig.y + dy / k })
          return next
        })
      }
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const resetView = () => setView({ x: 0, y: 0, k: 1 })

  if (error) return <div className="mod-empty">图谱加载失败：{error}</div>
  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 24 }}>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted, #86909c)', marginTop: 8 }}>正在分析双链关系…</div>
    </div>
  )
  if (data.nodes.length === 0) return <div className="mod-empty">还没有笔记之间建立 [[双链]]，先在笔记里写几个 [[链接]] 吧</div>

  const maxDeg = Math.max(...layout.map((n) => n.degree), 1)
  const neighbors = new Set<string>()
  if (hover) {
    data.edges.forEach(([a, b]) => {
      if (a === hover) neighbors.add(b)
      if (b === hover) neighbors.add(a)
    })
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        style={{ display: 'block', cursor: dragRef.current?.type === 'pan' ? 'grabbing' : 'default' }}
        onMouseDown={onSvgMouseDown}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {data.edges.map(([a, b], i) => {
            const pa = posById.get(a)
            const pb = posById.get(b)
            if (!pa || !pb) return null
            const active = hover && (a === hover || b === hover)
            return (
              <line
                key={i}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={active ? '#ff6700' : '#e5e6eb'}
                strokeWidth={(active ? 1.6 : 0.7) / view.k}
                opacity={hover && !active ? 0.25 : 0.9}
              />
            )
          })}
          {layout.map((n) => {
            const p = posById.get(n.id) ?? n
            const r = (4 + (n.degree / maxDeg) * 10) / Math.sqrt(view.k)
            const dim = hover && hover !== n.id && !neighbors.has(n.id)
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={dim ? 0.3 : 1}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => onNodeMouseDown(e, n.id)}
                onClick={() => {
                  // 拖拽结束的 mouseup 不当作点击
                  if (!dragRef.current?.moved) onOpen(n.id)
                }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
              >
                <circle r={r} fill={hover === n.id ? '#ff6700' : n.degree >= maxDeg * 0.6 ? '#ffb37e' : '#d0d3d8'} />
                <text
                  x={r + 3}
                  y={4}
                  fontSize={11 / view.k}
                  fill={hover === n.id ? '#ff6700' : '#4e5969'}
                  style={{ userSelect: 'none' }}
                >
                  {n.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      <Button
        size="sm"
        variant="outline"
        onClick={resetView}
        className="absolute right-2 top-2 h-8 w-8 p-0"
        title="重置视图"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 8px' }}>
        {data.nodes.length} 个笔记 · {data.edges.length} 条链接 · 滚轮缩放 / 拖背景平移 / 拖节点重排 / 点节点打开
      </div>
    </div>
  )
}

export default GraphView
