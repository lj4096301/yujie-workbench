import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { message } from 'antd'
import { Plus, Settings, History, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import './kanban.css'

type Status = 'todo' | 'doing' | 'done'

interface KanbanProject {
  id: string
  name: string
}

interface KanbanCard {
  id: string
  projectId: string
  title: string
  content: string
  status: Status
  priority: 'low' | 'mid' | 'high'
  createdAt: number
  updatedAt: number
}

interface KanbanRecord {
  id: string
  action: 'done' | 'deleted'
  title: string
  content?: string
  projectName: string
  priority?: 'low' | 'mid' | 'high'
  at: number
}

interface KanbanState {
  projects: KanbanProject[]
  cards: KanbanCard[]
  records: KanbanRecord[]
}

interface ConfirmReq {
  title: string
  content: string
  okText: string
  danger?: boolean
  onOk: () => void
}

const STATUS_ORDER: Status[] = ['todo', 'doing', 'done']

const STATUS_META: Record<Status, { label: string; color: string }> = {
  todo: { label: '待推进', color: 'default' },
  doing: { label: '进行中', color: 'processing' },
  done: { label: '待完成', color: 'processing' },
}

const DOT_COLOR: Record<Status, string> = {
  todo: '#c9cdd4',
  doing: '#ff6700',
  done: '#00b42a',
}

const PRIORITY_META: Record<'low' | 'mid' | 'high', { label: string; color: string }> = {
  high: { label: '高', color: 'red' },
  mid: { label: '中', color: 'gold' },
  low: { label: '低', color: 'default' },
}

const PRIORITY_DOT: Record<'low' | 'mid' | 'high', string> = {
  low: '#c9cdd4',
  mid: '#ff6700',
  high: '#f53f3f',
}

const PRIORITY_ORDER: Array<'low' | 'mid' | 'high'> = ['low', 'mid', 'high']

const KanbanModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [state, setState] = useState<KanbanState>({ projects: [], cards: [], records: [] })
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)
  const [overZone, setOverZone] = useState<'noop' | 'done' | 'del' | null>(null)

  // 新建 / 编辑卡片表单（手写 state，替代 antd Form）
  const [editVisible, setEditVisible] = useState(false)
  const [editCard, setEditCard] = useState<KanbanCard | null>(null)
  const [editStatus, setEditStatus] = useState<Status>('todo')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editPriority, setEditPriority] = useState<KanbanCard['priority']>('mid')

  // 项目管理（手写数组，替代 antd Form.List）
  const [manageVisible, setManageVisible] = useState(false)
  const [manageRows, setManageRows] = useState<Array<{ id: string; name: string }>>([])

  // 统一二次确认弹窗（替代 antd Modal.confirm）
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null)

  // 操作记录
  const [recordVisible, setRecordVisible] = useState(false)
  const [recTab, setRecTab] = useState<'all' | 'done' | 'deleted'>('all')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kanban')
      if (res.ok) {
        const data = (await res.json()) as KanbanState
        if (data && Array.isArray(data.projects) && Array.isArray(data.cards)) {
          setState({ ...data, records: Array.isArray(data.records) ? data.records : [] })
        }
      }
    } catch {
      message.error('看板数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const persist = useCallback(async (next: KanbanState) => {
    setState(next)
    try {
      await fetch('/api/kanban/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
    } catch {
      message.error('看板保存失败')
    }
  }, [])

  /* ---------------- 拖拽换列 ---------------- */
  const onCardDragStart = (e: React.DragEvent<HTMLDivElement>, card: KanbanCard) => {
    e.dataTransfer.setData('text/plain', card.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(card.id)
  }

  const onCardDragEnd = () => {
    setDraggingId(null)
    setOverCol(null)
    setOverZone(null)
  }

  const onColDragOver = (e: React.DragEvent<HTMLDivElement>, status: Status) => {
    if (!draggingId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overCol !== status) setOverCol(status)
  }

  const onColDragLeave = (e: React.DragEvent<HTMLDivElement>, status: Status) => {
    const target = e.relatedTarget as Node | null
    if (!target || !e.currentTarget.contains(target)) {
      if (overCol === status) setOverCol(null)
    }
  }

  const makeRecord = (action: 'done' | 'deleted', card: KanbanCard): KanbanRecord => ({
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    title: card.title,
    content: card.content || undefined,
    projectName: state.projects.find((p) => p.id === card.projectId)?.name ?? '未知项目',
    priority: card.priority,
    at: Date.now(),
  })

  const askConfirm = (req: ConfirmReq) => setConfirmReq(req)

  const onColDrop = (e: React.DragEvent<HTMLDivElement>, status: Status) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    setOverCol(null)
    setDraggingId(null)
    if (!id) return
    const card = state.cards.find((c) => c.id === id)
    if (!card || card.status === status) return
    // 完成操作需要确认；完成 = 标记为已完成并从看板移除（归档）
    if (status === 'done') {
      askConfirm({
        title: '确认已完成？',
        content: `「${card.title}」将标记为已完成并从看板移除，归档到操作记录页。`,
        okText: '已完成',
        onOk: () => {
          const cards = state.cards.filter((c) => c.id !== id)
          const records = [makeRecord('done', card), ...state.records]
          persist({ ...state, cards, records })
        },
      })
    } else {
      const cards = state.cards.map((c) =>
        c.id === id ? { ...c, status, updatedAt: Date.now() } : c
      )
      persist({ ...state, cards, records: state.records })
    }
  }

  /* ---------------- 已完成列三区投放 ---------------- */
  const onZoneDragOver = (e: React.DragEvent<HTMLDivElement>, zone: 'noop' | 'done' | 'del') => {
    if (!draggingId) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (overZone !== zone) setOverZone(zone)
  }

  const onZoneDragLeave = (e: React.DragEvent<HTMLDivElement>, zone: 'noop' | 'done' | 'del') => {
    const target = e.relatedTarget as Node | null
    if (!target || !e.currentTarget.contains(target)) {
      if (overZone === zone) setOverZone(null)
    }
  }

  const onZoneDrop = (e: React.DragEvent<HTMLDivElement>, zone: 'noop' | 'done' | 'del') => {
    e.preventDefault()
    e.stopPropagation()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    setOverCol(null)
    setOverZone(null)
    setDraggingId(null)
    if (!id) return
    if (zone === 'noop') return // 无操作区：不执行任何操作
    const card = state.cards.find((c) => c.id === id)
    if (!card) return
    if (zone === 'done') {
      // 完成 = 标记为已完成并从看板移除（归档）
      askConfirm({
        title: '确认已完成？',
        content: `「${card.title}」将标记为已完成并从看板移除，归档到操作记录页。`,
        okText: '已完成',
        onOk: () => {
          const cards = state.cards.filter((c) => c.id !== id)
          const records = [makeRecord('done', card), ...state.records]
          persist({ ...state, cards, records })
        },
      })
    } else {
      askConfirm({
        title: '确认删除这张卡片？',
        content: `「${card.title}」将被删除，并归档到操作记录页。`,
        okText: '确认删除',
        danger: true,
        onOk: () => {
          const cards = state.cards.filter((c) => c.id !== id)
          const records = [makeRecord('deleted', card), ...state.records]
          persist({ ...state, cards, records })
        },
      })
    }
  }

  /* ---------------- 新建 / 编辑 ---------------- */
  const openCreate = (status: Status = 'todo') => {
    setEditCard(null)
    setEditStatus(status)
    setEditTitle('')
    setEditContent('')
    setEditProjectId(filter !== 'all' ? filter : state.projects[0]?.id ?? '')
    setEditPriority('mid')
    setEditVisible(true)
  }

  const openEdit = (card: KanbanCard) => {
    setEditCard(card)
    setEditStatus(card.status)
    setEditTitle(card.title)
    setEditContent(card.content)
    setEditProjectId(card.projectId)
    setEditPriority(card.priority)
    setEditVisible(true)
  }

  const submitCard = async () => {
    const title = editTitle.trim()
    if (!title) {
      message.warning('请输入标题')
      return
    }
    const now = Date.now()
    const cards = editCard
      ? state.cards.map((c) =>
          c.id === editCard.id
            ? {
                ...c,
                title,
                content: editContent,
                projectId: editProjectId,
                priority: editPriority,
                updatedAt: now,
              }
            : c
        )
      : [
          {
            id: `kb-${now}-${Math.random().toString(36).slice(2, 6)}`,
            title,
            content: editContent,
            projectId: editProjectId,
            priority: editPriority,
            status: editStatus,
            createdAt: now,
            updatedAt: now,
          },
          ...state.cards,
        ]
    await persist({ ...state, cards, records: state.records })
    setEditVisible(false)
  }

  const removeCard = (id: string) => {
    const card = state.cards.find((c) => c.id === id)
    if (!card) return
    const records = [makeRecord('deleted', card), ...state.records]
    persist({ ...state, cards: state.cards.filter((c) => c.id !== id), records })
  }

  /* ---------------- 项目管理（增删改） ---------------- */
  const openManage = () => {
    setManageRows(state.projects.map((p) => ({ id: p.id, name: p.name })))
    setManageVisible(true)
  }

  const removeManageRow = (idx: number) =>
    setManageRows((rows) => rows.filter((_, i) => i !== idx))

  const submitManage = async () => {
    const rows = manageRows
    const names = rows.map((r) => String(r?.name ?? '').trim()).filter(Boolean)
    if (names.length === 0) {
      message.warning('至少保留一个项目')
      return
    }
    // 同名去重：只保留第一个出现的 id
    const seen = new Map<string, string>()
    for (const r of rows) {
      const n = String(r?.name ?? '').trim()
      if (!n || seen.has(n)) continue
      seen.set(n, String(r?.id ?? ''))
    }
    const existing = state.projects
    const projects = names.map((name) => {
      const oldId = seen.get(name)
      const hit = oldId ? existing.find((e) => e.id === oldId) : existing.find((e) => e.name === name)
      return {
        id: hit?.id ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name,
      }
    })
    // 被删除项目下的卡片一并移除
    const removedIds = new Set(
      existing.filter((e) => !projects.some((n) => n.id === e.id)).map((e) => e.id)
    )
    const cards = state.cards.filter((c) => !removedIds.has(c.projectId))
    await persist({ projects, cards, records: state.records })
    if (filter !== 'all' && !projects.some((p) => p.id === filter)) setFilter('all')
    setManageVisible(false)
  }

  const [delCard, setDelCard] = useState<KanbanCard | null>(null)
  const [clearRecOpen, setClearRecOpen] = useState(false)

  const clearRecords = () => persist({ ...state, records: [] })

  const visibleCards =
    filter === 'all' ? state.cards : state.cards.filter((c) => c.projectId === filter)

  const recList =
    recTab === 'all' ? state.records : state.records.filter((r) => r.action === recTab)

  const headerActions = actionsHost
    ? createPortal(
        <div className="kb-header-actions">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              {state.projects.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>{p.name}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => setRecordVisible(true)} title="操作记录（完成 / 删除归档）">
            <History className="h-4 w-4" />
            记录
            {state.records.length > 0 && (
              <Badge variant="secondary" className="kb-rec-badge">
                {state.records.length}
              </Badge>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={openManage} title="管理项目（增删改）">
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => openCreate('todo')}>
            <Plus className="h-4 w-4" />
            新建卡片
          </Button>
        </div>,
        actionsHost
      )
    : null

  const renderCard = (card: KanbanCard) => (
    <div
      key={card.id}
      className={`kb-card${draggingId === card.id ? ' dragging' : ''}`}
      draggable
      onDragStart={(e) => onCardDragStart(e, card)}
      onDragEnd={onCardDragEnd}
      onClick={() => openEdit(card)}
    >
      <div className="kb-card-title">{card.title}</div>
      {card.content && <div className="kb-card-content">{card.content}</div>}
      <div className="kb-card-meta">
        <span className="kb-pri">
          <span className="kb-dot" style={{ background: PRIORITY_DOT[card.priority] }} />
          {PRIORITY_META[card.priority].label}
        </span>
        {filter === 'all' && (
          <span className="kb-proj">
            {state.projects.find((p) => p.id === card.projectId)?.name ?? '?'}
          </span>
        )}
        <span className="kb-time">{dayjs(card.updatedAt).format('MM-DD HH:mm')}</span>
        <span
          className="kb-del"
          onClick={(e) => { e.stopPropagation(); setDelCard(card) }}
          role="button"
          title="删除卡片"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  )

  const renderColBody = (status: Status) => {
    const colCards = visibleCards
      .filter((c) => c.status === status)
      .sort((a, b) => b.createdAt - a.createdAt)
    return (
      <div className="kb-col-body">
        {colCards.map(renderCard)}
        {colCards.length === 0 ? (
          <div className="kb-empty" onClick={() => openCreate(status)}>
            + 添加卡片
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => openCreate(status)}>
            <Plus className="h-4 w-4" />
            添加
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
    <div style={{ height: '100%', minHeight: 340, display: 'flex', flexDirection: 'column' }}>
        {headerActions}

        {loading ? (
          <div className="kb-board">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="kb-col">
                <div className="kb-col-head">
                  <span className="kb-dot" style={{ background: DOT_COLOR[status] }} />
                  {STATUS_META[status].label}
                </div>
                <div className="kb-col-body">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="kb-board">
            {STATUS_ORDER.map((status) => {
              const colCards = visibleCards
                .filter((c) => c.status === status)
                .sort((a, b) => b.createdAt - a.createdAt)
              return (
                <div
                  key={status}
                  className={`kb-col${overCol === status ? ' drag-over' : ''}`}
                  onDragOver={(e) => onColDragOver(e, status)}
                  onDragLeave={(e) => onColDragLeave(e, status)}
                  onDrop={(e) => onColDrop(e, status)}
                >
                  <div className="kb-col-head">
                    <span className="kb-dot" style={{ background: DOT_COLOR[status] }} />
                    <span>{STATUS_META[status].label}</span>
                    <span className="kb-count">{colCards.length}</span>
                  </div>
                  {status === 'done' ? (
                    <>
                      {/* 无操作区：待完成卡片列表，拖入不执行操作 */}
                      <div
                        className={`kb-zone kb-zone-noop${overZone === 'noop' ? ' drag-over' : ''}`}
                        onDragOver={(e) => onZoneDragOver(e, 'noop')}
                        onDragLeave={(e) => onZoneDragLeave(e, 'noop')}
                        onDrop={(e) => onZoneDrop(e, 'noop')}
                      >
                        <div className="kb-zone-head">待完成卡片</div>
                        {renderColBody(status)}
                      </div>
                      {/* 已完成投放区：拖入 → 二次确认标记完成 */}
                      <div
                        className={`kb-zone kb-zone-done${overZone === 'done' ? ' drag-over' : ''}`}
                        onDragOver={(e) => onZoneDragOver(e, 'done')}
                        onDragLeave={(e) => onZoneDragLeave(e, 'done')}
                        onDrop={(e) => onZoneDrop(e, 'done')}
                      >
                        <div className="kb-zone-head">拖入此处 → 已完成（移出看板）</div>
                      </div>
                      {/* 删除投放区：拖入 → 二次确认删除 */}
                      <div
                        className={`kb-zone kb-zone-del${overZone === 'del' ? ' drag-over' : ''}`}
                        onDragOver={(e) => onZoneDragOver(e, 'del')}
                        onDragLeave={(e) => onZoneDragLeave(e, 'del')}
                        onDrop={(e) => onZoneDrop(e, 'del')}
                      >
                        <div className="kb-zone-head">拖入此处 → 删除卡片</div>
                      </div>
                    </>
                  ) : (
                    renderColBody(status)
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 新建 / 编辑卡片 */}
      <Dialog open={editVisible} onOpenChange={setEditVisible}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editCard ? '编辑卡片' : '新建卡片'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kb-title">标题</Label>
              <Input
                id="kb-title"
                value={editTitle}
                maxLength={80}
                placeholder="优化方向标题"
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-content">内容</Label>
              <Textarea
                id="kb-content"
                rows={4}
                value={editContent}
                maxLength={2000}
                placeholder="记录优化内容、思路、验收标准…"
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>所属项目</Label>
              <Select value={editProjectId} onValueChange={setEditProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {state.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>优先级</Label>
              <Select
                value={editPriority}
                onValueChange={(v) => setEditPriority(v as KanbanCard['priority'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVisible(false)}>
              取消
            </Button>
            <Button onClick={submitCard}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 项目管理 */}
      <Dialog open={manageVisible} onOpenChange={setManageVisible}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>项目管理</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {manageRows.map((row, idx) => {
              const cnt = row.id ? state.cards.filter((c) => c.projectId === row.id).length : 0
              return (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={row.name}
                    maxLength={12}
                    placeholder="项目名称"
                    onChange={(e) =>
                      setManageRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#F53F3F]"
                    disabled={manageRows.length <= 1}
                    onClick={() => {
                      const pname = row.name || '该项目'
                      if (cnt > 0) {
                        askConfirm({
                          title: `删除「${pname}」？`,
                          content: `该项目下有 ${cnt} 张卡片，将一并删除。`,
                          okText: '删除',
                          danger: true,
                          onOk: () => removeManageRow(idx),
                        })
                      } else {
                        removeManageRow(idx)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setManageRows((rows) => [...rows, { id: '', name: '' }])}
            >
              <Plus className="h-4 w-4" />
              添加项目
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageVisible(false)}>
              取消
            </Button>
            <Button onClick={submitManage}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 二次确认弹窗（完成 / 删除 / 删项目） */}
      <Dialog open={!!confirmReq} onOpenChange={(o) => !o && setConfirmReq(null)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{confirmReq?.title}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{confirmReq?.content}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReq(null)}>
              取消
            </Button>
            <Button
              variant={confirmReq?.danger ? 'destructive' : 'default'}
              onClick={() => {
                const fn = confirmReq?.onOk
                setConfirmReq(null)
                fn?.()
              }}
            >
              {confirmReq?.okText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 操作记录 */}
      <Dialog open={recordVisible} onOpenChange={setRecordVisible}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>📋 操作记录（完成 / 删除）</DialogTitle>
          </DialogHeader>
          <Tabs value={recTab} onValueChange={(v) => setRecTab(v as 'all' | 'done' | 'deleted')}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all">全部 {state.records.length}</TabsTrigger>
              <TabsTrigger value="done">
                完成 {state.records.filter((r) => r.action === 'done').length}
              </TabsTrigger>
              <TabsTrigger value="deleted">
                删除 {state.records.filter((r) => r.action === 'deleted').length}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {recList.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#86909C]">
              暂无记录，完成或删除的卡片会归档到这里
            </div>
          ) : (
            <div className="max-h-[380px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">操作</TableHead>
                    <TableHead>标题 / 内容</TableHead>
                    <TableHead className="w-[110px]">项目</TableHead>
                    <TableHead className="w-[120px]">时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recList.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium"
                          style={{ color: r.action === 'done' ? '#00B42A' : '#F53F3F' }}
                        >
                          <span
                            className="kb-dot"
                            style={{ background: r.action === 'done' ? '#00B42A' : '#F53F3F' }}
                          />
                          {r.action === 'done' ? '完成' : '删除'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-[#1D2129]">{r.title}</div>
                        {r.content && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-[#86909C]">
                            {r.content}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-[#4E5969]">{r.projectName}</TableCell>
                      <TableCell className="text-xs tabular-nums text-[#86909C]">
                        {dayjs(r.at).format('YYYY-MM-DD HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="text-[#F53F3F]" onClick={() => setClearRecOpen(true)}>
              清空记录
            </Button>
            <Button onClick={() => setRecordVisible(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除卡片二次确认 */}
      <ConfirmDialog
        open={!!delCard}
        title="删除卡片"
        content={delCard ? '确定删除「' + delCard.title + '」？删除后将进入操作记录。' : ''}
        danger
        okText="删除"
        onOk={async () => { if (delCard) await removeCard(delCard.id) }}
        onOpenChange={(o) => { if (!o) setDelCard(null) }}
      />

      {/* 清空操作记录二次确认 */}
      <ConfirmDialog
        open={clearRecOpen}
        title="清空操作记录"
        content="将删除全部操作记录，且不可恢复。确定清空吗？"
        danger
        okText="清空"
        onOk={clearRecords}
        onOpenChange={(o) => { if (!o) setClearRecOpen(false) }}
      />
    </>
  )
}

export default KanbanModule
