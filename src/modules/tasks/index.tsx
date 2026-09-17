import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Input, Button, Checkbox, Tag, Popconfirm, Empty, message, DatePicker, Select, ConfigProvider } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

interface Task {
  id: string
  title: string
  done: boolean
  createdAt: number
  due?: string // yyyy-mm-dd
  priority?: 'low' | 'mid' | 'high'
}

const STORAGE_KEY = 'yujie-tasks'
const LEGACY_KEY = 'mimo-tasks'

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : []
    // 旧键数据自动迁移到新键（一次性）
    if (localStorage.getItem(STORAGE_KEY) === null && localStorage.getItem(LEGACY_KEY) !== null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      localStorage.removeItem(LEGACY_KEY)
    }
    return list
  } catch {
    return []
  }
}

function saveTasks(list: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* 忽略存储失败 */
  }
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'red' },
  mid: { label: '中', color: 'gold' },
  low: { label: '低', color: 'default' },
}

type FilterKey = 'all' | 'active' | 'done'

const TasksModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [filter, setFilter] = useState<FilterKey>('all')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'mid' | 'high'>('mid')
  const [due, setDue] = useState<dayjs.Dayjs | null>(null)

    // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  const add = () => {
    const t = title.trim()
    if (!t) {
      message.warning('请输入任务内容')
      return
    }
    const item: Task = {
      id: `tk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: t,
      done: false,
      createdAt: Date.now(),
      priority,
      due: due ? due.format('YYYY-MM-DD') : undefined,
    }
    setTasks((list) => [item, ...list])
    setTitle('')
    setDue(null)
    setPriority('mid')
  }

  const toggle = (id: string) =>
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))

  const remove = (id: string) => setTasks((list) => list.filter((t) => t.id !== id))

  const visible = useMemo(() => {
    const list =
      filter === 'all'
        ? tasks
        : filter === 'active'
        ? tasks.filter((t) => !t.done)
        : tasks.filter((t) => t.done)
    // 未完成置顶，其余按创建时间倒序
    return [...list].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)
  }, [tasks, filter])

  const activeCount = tasks.filter((t) => !t.done).length

  // 下拉弹出层渲染到 .panel-body 之外，避免被 overflow:auto 裁剪
  const popupContainer = (trigger?: HTMLElement) =>
    (trigger?.closest('.panel-body') as HTMLElement | null) ?? document.body

  const headerActions = actionsHost
    ? createPortal(
        <div className="tk-header-actions">
          <Input
            placeholder="添加任务，回车确认"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onPressEnter={add}
            style={{ width: 200 }}
          />
          <Select
            value={priority}
            onChange={setPriority}
            style={{ width: 70 }}
            options={[
              { value: 'low', label: '低' },
              { value: 'mid', label: '中' },
              { value: 'high', label: '高' },
            ]}
          />
          <DatePicker value={due} onChange={setDue} placeholder="截止" style={{ width: 120 }} />
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={add}>
            添加
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0 }}>
      <ConfigProvider getPopupContainer={popupContainer}>
        {headerActions}

        <div className="mod-bar" style={{ marginBottom: 8 }}>
        <Button size="small" type={filter === 'all' ? 'primary' : 'default'} onClick={() => setFilter('all')}>
          全部
        </Button>
        <Button size="small" type={filter === 'active' ? 'primary' : 'default'} onClick={() => setFilter('active')}>
          进行中
        </Button>
        <Button size="small" type={filter === 'done' ? 'primary' : 'default'} onClick={() => setFilter('done')}>
          已完成
        </Button>
          <span className="mod-muted" style={{ marginLeft: 'auto' }}>
            剩余 {activeCount}
          </span>
        </div>
      </ConfigProvider>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {visible.length === 0 ? (
          <Empty description={filter === 'done' ? '还没有完成的任务' : '暂无任务'} />
        ) : (
          visible.map((t) => (
          <div key={t.id} className="mod-row">
            <Checkbox checked={t.done} onChange={() => toggle(t.id)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="mod-row-title"
                style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#999' : '#333' }}
              >
                {t.title}
              </div>
              <div className="mod-row-sub">
                {t.due && <span style={{ marginRight: 8 }}>📅 {t.due}</span>}
                {t.priority && (
                  <Tag color={PRIORITY_META[t.priority].color} style={{ marginRight: 0 }}>
                    {PRIORITY_META[t.priority].label}
                  </Tag>
                )}
              </div>
            </div>
            <Popconfirm title="删除该任务？" onConfirm={() => remove(t.id)} okText="删除" cancelText="取消">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        ))
        )}
      </div>
    </div>
  )
}

export default TasksModule
