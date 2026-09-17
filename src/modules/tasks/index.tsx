import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Popconfirm, message } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

const PRIORITY_DOT: Record<string, string> = {
  low: '#c9cdd4',
  mid: '#ff6700',
  high: '#f53f3f',
}

type FilterKey = 'all' | 'active' | 'done'

const TasksModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [filter, setFilter] = useState<FilterKey>('all')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'mid' | 'high'>('mid')
  const [due, setDue] = useState('') // yyyy-mm-dd

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
      due: due || undefined,
    }
    setTasks((list) => [item, ...list])
    setTitle('')
    setDue('')
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

  const headerActions = actionsHost
    ? createPortal(
        <div className="tk-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            placeholder="添加任务，回车确认"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            style={{ width: 200 }}
          />
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as 'low' | 'mid' | 'high')}
          >
            <SelectTrigger className="w-[72px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['low', 'mid', 'high'] as const).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            style={{ width: 130 }}
          />
          <Button size="sm" onClick={add}>
            <Plus className="h-4 w-4" />
            添加
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {headerActions}

      <div className="mod-bar" style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="active">进行中</TabsTrigger>
            <TabsTrigger value="done">已完成</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="mod-muted" style={{ marginLeft: 'auto', fontSize: 12, color: '#86909C' }}>
          剩余 {activeCount}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {visible.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#86909C]">
            {filter === 'done' ? '还没有完成的任务' : '暂无任务'}
          </div>
        ) : (
          visible.map((t) => (
            <div
              key={t.id}
              className="mod-row"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid #f2f3f5',
              }}
            >
              <Checkbox
                checked={t.done}
                onCheckedChange={() => toggle(t.id)}
                style={{ marginTop: 3 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="mod-row-title"
                  style={{
                    textDecoration: t.done ? 'line-through' : 'none',
                    color: t.done ? '#86909C' : '#1D2129',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {t.title}
                </div>
                <div
                  className="mod-row-sub"
                  style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#86909C' }}
                >
                  {t.due && <span>📅 {t.due}</span>}
                  {t.priority && (
                    <span className="inline-flex items-center gap-1.5" style={{ color: '#4E5969' }}>
                      <span
                        className="inline-block"
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          background: PRIORITY_DOT[t.priority],
                          boxShadow: '0 0 0 4px rgba(0,0,0,0.05)',
                        }}
                      />
                      {PRIORITY_META[t.priority].label}
                    </span>
                  )}
                </div>
              </div>
              <Popconfirm
                title="删除该任务？"
                onConfirm={() => remove(t.id)}
                okText="删除"
                cancelText="取消"
              >
                <Button variant="ghost" size="sm" className="text-[#F53F3F]">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Popconfirm>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default TasksModule
