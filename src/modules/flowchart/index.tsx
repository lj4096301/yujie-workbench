import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { message } from 'antd'
import { toPng, toSvg } from 'html-to-image'
import { Upload, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import './flowchart.css'

const STORAGE_KEY = 'yujie-flowchart'

type FlowNodeKind = 'start' | 'process' | 'decision' | 'end' | 'sub' | 'note'

interface FlowNodeData extends Record<string, unknown> {
  label: string
  nodeType: FlowNodeKind
}

type FlowNodeType = Node<FlowNodeData, 'flow'>

const NODE_PALETTE: { key: FlowNodeKind; label: string; hint: string }[] = [
  { key: 'start', label: '开始', hint: '流程起点' },
  { key: 'process', label: '处理', hint: '执行操作' },
  { key: 'decision', label: '判断', hint: '条件分支' },
  { key: 'sub', label: '子流程', hint: '嵌套流程' },
  { key: 'end', label: '结束', hint: '流程终点' },
  { key: 'note', label: '备注', hint: '说明文字' },
]

const NODE_COLOR: Record<FlowNodeKind, string> = {
  start: '#00b42a',
  process: '#ff6700',
  decision: '#ff7d00',
  sub: '#8c5dcc',
  end: '#f53f3f',
  note: '#86909c',
}

/** 自定义节点：双击编辑文字，形状按类型区分 */
function FlowNode({ id, data, selected }: NodeProps<FlowNodeType>) {
  const { setNodes, deleteElements } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(data.label)

  const save = useCallback(() => {
    const label = text.trim() || data.label
    setEditing(false)
    if (label === data.label) return
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } as FlowNodeData } : n))
    )
  }, [text, data.label, id, setNodes])

  const removeNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteElements({ nodes: [{ id }] })
    },
    [deleteElements, id]
  )

  return (
    <div
      className={`flow-node n-${data.nodeType}${selected ? ' selected' : ''}`}
      onDoubleClick={() => {
        setText(data.label)
        setEditing(true)
      }}
      title="双击编辑文字"
    >
      {data.nodeType === 'decision' && <div className="fn-shape" />}
      {data.nodeType !== 'note' && (
        <>
          <Handle type="target" position={Position.Left} />
          <Handle type="source" position={Position.Right} />
        </>
      )}
      {selected && (
        <span
          className="fn-del"
          role="button"
          title="删除节点"
          onClick={removeNode}
        >
          ✕
        </span>
      )}
      <div className="fn-content">
        {editing ? (
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                setText(data.label)
                setEditing(false)
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="fn-label">{data.label}</span>
        )}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = { flow: FlowNode }

function FlowEditor({ panelId }: { panelId?: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { screenToFlowPosition } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [savedAt, setSavedAt] = useState<string>('')
  const loadedRef = useRef(false)

  // 初始加载
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (Array.isArray(data.nodes)) setNodes(data.nodes)
        if (Array.isArray(data.edges)) setEdges(data.edges)
      }
    } catch {
      // 忽略损坏的缓存
    }
    loadedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 自动保存（防抖）
  useEffect(() => {
    if (!loadedRef.current) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }))
        setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      } catch {
        // 存储失败时静默
      }
    }, 400)
    return () => clearTimeout(t)
  }, [nodes, edges])

  // 标题栏操作按钮挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...conn, markerEnd: { type: MarkerType.ArrowClosed, color: '#ff6700' } },
          eds
        )
      ),
    [setEdges]
  )

  const addNode = useCallback(
    (kind: FlowNodeKind, position: { x: number; y: number }) => {
      const id = `${kind}-${Date.now()}`
      const meta = NODE_PALETTE.find((p) => p.key === kind)
      const node: FlowNodeType = {
        id,
        type: 'flow',
        position,
        data: { label: meta?.label ?? kind, nodeType: kind },
      }
      setNodes((nds) => [...nds, node])
    },
    [setNodes]
  )

  // 点击面板节点 → 添加到画布中心
  const addAtCenter = useCallback(
    (kind: FlowNodeKind) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      const cx = rect ? rect.width / 2 : 400
      const cy = rect ? rect.height / 2 : 300
      addNode(kind, screenToFlowPosition({ x: cx, y: cy }))
    },
    [addNode, screenToFlowPosition]
  )

  // 拖拽面板节点到画布
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const kind = e.dataTransfer.getData('application/flowchart') as FlowNodeKind
      if (!kind) return
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNode(kind, pos)
    },
    [addNode, screenToFlowPosition]
  )

  const doSaveFile = useCallback(async (payload: {
    defaultName: string
    content: string
    encoding?: 'utf8' | 'base64'
  }) => {
    const api = window.electronAPI
    if (api?.saveFile) {
      const res = await api.saveFile(payload)
      if (res?.canceled) return false
      if (res?.path) {
        message.success(`已保存到 ${res.path}`)
        return true
      }
    }
    // 浏览器模式兜底：直接下载
    const link = document.createElement('a')
    link.href = payload.encoding === 'base64'
      ? `data:application/octet-stream;base64,${payload.content}`
      : `data:application/json;charset=utf-8,${encodeURIComponent(payload.content)}`
    link.download = payload.defaultName
    link.click()
    message.success('已下载文件')
    return true
  }, [])

  const exportJson = useCallback(() => {
    const content = JSON.stringify({ nodes, edges }, null, 2)
    void doSaveFile({ defaultName: '流程图.json', content, encoding: 'utf8' })
  }, [nodes, edges, doSaveFile])

  const exportImage = useCallback(
    async (kind: 'png' | 'svg') => {
      const el = canvasRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
      if (!el) return
      try {
        const dataUrl =
          kind === 'png'
            ? await toPng(el, { pixelRatio: 2, backgroundColor: '#ffffff' })
            : await toSvg(el, { backgroundColor: '#ffffff' })
        const base64 = dataUrl.split(',')[1]
        if (!base64) {
          message.error('导出失败：无法生成图像数据')
          return
        }
        await doSaveFile({
          defaultName: kind === 'png' ? '流程图.png' : '流程图.svg',
          content: base64,
          encoding: 'base64',
        })
      } catch (err) {
        message.error(`导出失败：${String(err)}`)
      }
    },
    [doSaveFile]
  )

  const importJson = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result))
          if (!Array.isArray(data.nodes)) {
            message.error('文件格式不正确：缺少 nodes 数组')
            return
          }
          setNodes(data.nodes)
          setEdges(Array.isArray(data.edges) ? data.edges : [])
          message.success('导入成功')
        } catch {
          message.error('文件解析失败，请确认是流程图 JSON 文件')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [setNodes, setEdges])

  const [clearOpen, setClearOpen] = useState(false)
  const clearAll = useCallback(() => {
    setNodes([])
    setEdges([])
    message.success('画布已清空')
  }, [setNodes, setEdges])

  const headerActions = actionsHost
    ? createPortal(
        <div className="flow-header-actions">
          <Select
            value=""
            onValueChange={(key) => {
              if (key === 'png') void exportImage('png')
              else if (key === 'svg') void exportImage('svg')
              else if (key === 'json') exportJson()
            }}
          >
            <SelectTrigger className="h-8 w-[92px] text-xs">
              <Download className="h-3.5 w-3.5" /> 导出
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png" className="text-xs">导出 PNG</SelectItem>
              <SelectItem value="svg" className="text-xs">导出 SVG</SelectItem>
              <SelectItem value="json" className="text-xs">导出 JSON</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={importJson}>
            <Upload className="h-3.5 w-3.5" /> 导入
          </Button>
          <Button size="sm" variant="ghost" className="text-[#F53F3F]" onClick={() => setClearOpen(true)} disabled={nodes.length === 0}>
            <Trash2 className="h-3.5 w-3.5" /> 清空
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div className="flow-mod">
      <div className="flow-main">
        <div className="flow-panel">
          <div className="flow-panel-title">节点</div>
          {NODE_PALETTE.map((p) => (
            <div
              key={p.key}
              className="flow-panel-item"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/flowchart', p.key)}
              onClick={() => addAtCenter(p.key)}
              title={`拖入画布或点击添加「${p.hint}」`}
            >
              <span className="flow-dot" style={{ background: NODE_COLOR[p.key] }} />
              <span className="flow-panel-label">{p.label}</span>
            </div>
          ))}
          <div className="flow-panel-tip">点击添加 · 拖拽放置</div>
        </div>

        <div className="flow-canvas" ref={canvasRef} onDrop={onDrop} onDragOver={onDragOver}>
          {savedAt && <span className="flow-saved-float">已自动保存 {savedAt}</span>}
          {nodes.length === 0 && (
            <div className="flow-empty">
              <div className="flow-empty-icon">📐</div>
              <div>从左侧节点面板拖入或点击，开始绘制流程图</div>
              <div className="flow-empty-sub">双击节点可编辑文字 · 拖动节点/连线调整布局</div>
            </div>
          )}
          <ReactFlow<FlowNodeType>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: '#ff6700' },
              style: { stroke: '#ff6700', strokeWidth: 1.5 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#c9cdd4" />
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(n) => NODE_COLOR[(n.data as FlowNodeData).nodeType] ?? '#86909c'}
              nodeStrokeWidth={2}
            />
          </ReactFlow>
        </div>
      </div>
      {headerActions}

      <ConfirmDialog
        open={clearOpen}
        title="清空画布"
        content="将删除当前所有节点和连线，且不可恢复。确定清空吗？"
        danger
        okText="清空"
        onOk={clearAll}
        onOpenChange={(o) => { if (!o) setClearOpen(false) }}
      />
    </div>
  )
}

const FlowchartModule: React.FC<{ panelId?: string }> = ({ panelId }) => (
  <ReactFlowProvider>
    <FlowEditor panelId={panelId} />
  </ReactFlowProvider>
)

export default FlowchartModule
