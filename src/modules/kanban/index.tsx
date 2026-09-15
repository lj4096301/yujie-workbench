import React, { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Popconfirm,
  message,
  Tooltip,
  ConfigProvider,
  Segmented,
  Spin,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
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

interface KanbanState {
  projects: KanbanProject[]
  cards: KanbanCard[]
}

const STATUS_ORDER: Status[] = ['todo', 'doing', 'done']

const STATUS_META: Record<Status, { label: string; color: string }> = {
  todo: { label: '待推进', color: 'default' },
  doing: { label: '进行中', color: 'processing' },
  done: { label: '已完成', color: 'success' },
}

const DOT_COLOR: Record<Status, string> = {
  todo: '#8f959e',
  doing: '#3370ff',
  done: '#00b42a',
}

const PRIORITY_META: Record<'low' | 'mid' | 'high', { label: string; color: string }> = {
  high: { label: '高', color: 'red' },
  mid: { label: '中', color: 'gold' },
  low: { label: '低', color: 'default' },
}

const PRIORITY_ORDER: Array<'low' | 'mid' | 'high'> = ['low', 'mid', 'high']

/** 下拉弹出层渲染到 .panel-body 之外，避免被 overflow 裁剪 */
const popupContainer = (trigger?: HTMLElement) =>
  (trigger?.closest('.panel-body') as HTMLElement | null) ?? document.body

const KanbanModule: React.FC = () => {
  const [state, setState] = useState<KanbanState>({ projects: [], cards: [] })
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)
  const [editVisible, setEditVisible] = useState(false)
  const [editCard, setEditCard] = useState<KanbanCard | null>(null)
  const [editStatus, setEditStatus] = useState<Status>('todo')
  const [renameVisible, setRenameVisible] = useState(false)
  const [form] = Form.useForm()
  const [renameForm] = Form.useForm()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kanban')
      if (res.ok) {
        const data = (await res.json()) as KanbanState
        if (data && Array.isArray(data.projects) && Array.isArray(data.cards)) {
          setState(data)
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

  const onColDrop = (e: React.DragEvent<HTMLDivElement>, status: Status) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    setOverCol(null)
    setDraggingId(null)
    if (!id) return
    const card = state.cards.find((c) => c.id === id)
    if (!card || card.status === status) return
    const cards = state.cards.map((c) =>
      c.id === id ? { ...c, status, updatedAt: Date.now() } : c
    )
    persist({ ...state, cards })
  }

  /* ---------------- 新建 / 编辑 ---------------- */
  const openCreate = (status: Status = 'todo') => {
    setEditCard(null)
    setEditStatus(status)
    form.setFieldsValue({
      title: '',
      content: '',
      projectId: filter !== 'all' ? filter : state.projects[0]?.id,
      priority: 'mid',
    })
    setEditVisible(true)
  }

  const openEdit = (card: KanbanCard) => {
    setEditCard(card)
    setEditStatus(card.status)
    form.setFieldsValue({
      title: card.title,
      content: card.content,
      projectId: card.projectId,
      priority: card.priority,
    })
    setEditVisible(true)
  }

  const submitCard = async () => {
    const values = await form.validateFields()
    const title = String(values.title ?? '').trim()
    if (!title) {
      message.warning('请输入标题')
      return
    }
    const now = Date.now()
    const cards = editCard
      ? state.cards.map((c) =>
          c.id === editCard.id
            ? { ...c, ...values, title, updatedAt: now }
            : c
        )
      : [
          {
            id: `kb-${now}-${Math.random().toString(36).slice(2, 6)}`,
            ...values,
            title,
            status: editStatus,
            createdAt: now,
            updatedAt: now,
          },
          ...state.cards,
        ]
    await persist({ ...state, cards })
    setEditVisible(false)
  }

  const removeCard = (id: string) =>
    persist({ ...state, cards: state.cards.filter((c) => c.id !== id) })

  /* ---------------- 项目改名 ---------------- */
  const openRename = () => {
    renameForm.setFieldsValue({
      n1: state.projects[0]?.name ?? '',
      n2: state.projects[1]?.name ?? '',
    })
    setRenameVisible(true)
  }

  const submitRename = async () => {
    const v = await renameForm.validateFields()
    const projects = state.projects.map((p, i) => ({
      ...p,
      name: String(i === 0 ? v.n1 : v.n2 || p.name).trim() || p.name,
    }))
    await persist({ ...state, projects })
    setRenameVisible(false)
  }

  const visibleCards =
    filter === 'all' ? state.cards : state.cards.filter((c) => c.projectId === filter)

  return (
    <ConfigProvider getPopupContainer={popupContainer}>
      <div style={{ height: '100%', minHeight: 340, display: 'flex', flexDirection: 'column' }}>
        <div className="mod-bar" style={{ marginBottom: 10 }}>
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as string)}
            options={[
              { label: '全部', value: 'all' },
              ...state.projects.map((p) => ({ label: p.name, value: p.id })),
            ]}
          />
          <Tooltip title="重命名项目">
            <Button size="small" icon={<SettingOutlined />} onClick={openRename} style={{ marginLeft: 8 }} />
          </Tooltip>
          <span style={{ flex: 1 }} />
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openCreate('todo')}>
            新建卡片
          </Button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Spin />
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
                  <div className="kb-col-body">
                    {colCards.map((card) => (
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
                          <Tag color={PRIORITY_META[card.priority]?.color ?? 'default'} style={{ marginRight: 0 }}>
                            {PRIORITY_META[card.priority]?.label ?? '中'}
                          </Tag>
                          {filter === 'all' && (
                            <Tag style={{ marginRight: 0 }}>
                              {state.projects.find((p) => p.id === card.projectId)?.name ?? '?'}
                            </Tag>
                          )}
                          <span style={{ marginLeft: 'auto' }}>{dayjs(card.updatedAt).format('MM-DD HH:mm')}</span>
                          <Popconfirm
                            title="删除这张卡片？"
                            onConfirm={() => removeCard(card.id)}
                            okText="删除"
                            cancelText="取消"
                          >
                            <span className="kb-del" onClick={(e) => e.stopPropagation()} role="button">
                              <DeleteOutlined />
                            </span>
                          </Popconfirm>
                        </div>
                      </div>
                    ))}
                    {colCards.length === 0 ? (
                      <div className="kb-empty" onClick={() => openCreate(status)}>
                        + 添加卡片
                      </div>
                    ) : (
                      <Button type="dashed" block size="small" icon={<PlusOutlined />} onClick={() => openCreate(status)}>
                        添加
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        title={editCard ? '编辑卡片' : '新建卡片'}
        open={editVisible}
        onOk={submitCard}
        onCancel={() => setEditVisible(false)}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="优化方向标题" maxLength={80} />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={4} placeholder="记录优化内容、思路、验收标准…" maxLength={2000} />
          </Form.Item>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select options={state.projects.map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select
              options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重命名项目"
        open={renameVisible}
        onOk={submitRename}
        onCancel={() => setRenameVisible(false)}
        okText="保存"
        cancelText="取消"
        width={380}
      >
        <Form form={renameForm} layout="vertical">
          <Form.Item name="n1" label="项目一" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={12} placeholder="项目A" />
          </Form.Item>
          <Form.Item name="n2" label="项目二" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={12} placeholder="项目B" />
          </Form.Item>
        </Form>
      </Modal>
    </ConfigProvider>
  )
}

export default KanbanModule
