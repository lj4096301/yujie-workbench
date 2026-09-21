import React, { useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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

/** 读取 localStorage（一次性迁移源） */
function readLocal(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 从后端拉取（data/tasks.json 持久化） */
async function fetchTasks(): Promise<Task[]> {
  try {
    const r = await fetch('/api/tasks')
    return r.ok ? (await r.json()) : []
  } catch {
    return []
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

const TasksModule: React.FC<{ panelId?: string }> = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'mid' | 'high'>('mid')
  const [due, setDue] = useState('') // yyyy-mm-dd
  // 删除二次确认（通用 ConfirmDialog）
  const [delTarget, setDelTarget] = useState<Task | null>(null)

  // 启动：先迁 localStorage 数据到后端（一次性），再读后端
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const local = readLocal()
      const server = await fetchTasks()
      if (local.length > 0 && server.length === 0) {
        try {
          await fetch('/api/tasks/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(local),
          })
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(LEGACY_KEY)
        } catch {
          /* 迁移失败则保留本地，不阻塞 */
        }
      }
      const fresh = await fetchTasks()
      if (!cancelled) setTasks(fresh)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const add = async () => {
    const t = title.trim()
    if (!t) {
      message.warning('请输入任务内容')
      return
    }
    try {
      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, priority, due: due || undefined }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const item = (await r.json()) as Task
      setTasks((list) => [item, ...list])
      setTitle('')
      setDue('')
      setPriority('mid')
    } catch {
      message.error('添加失败，请重试')
    }
  }

  const toggle = (id: string) => {
    const target = tasks.find((t) => t.id === id)
    if (!target) return
    const nextDone = !target.done
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, done: nextDone } : t)))
    fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: nextDone }),
    }).catch(() => undefined)
  }

  const remove = (id: string) => {
    setTasks((list) => list.filter((t) => t.id !== id))
    fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => undefined)
  }

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {/* 新增表单：常驻面板顶部（避免标题栏操作区溢出遮挡） */}
      <div
        className="tk-add-bar"
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
      >
        <Input
          placeholder="添加任务，回车确认"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="h-8 min-w-0 max-w-[320px] flex-1"
        />
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v as 'low' | 'mid' | 'high')}
        >
          <SelectTrigger className="h-8 w-[68px] shrink-0">
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
          className="h-8 w-[140px] shrink-0"
        />
        <Button size="sm" className="shrink-0" onClick={add}>
          <Plus className="h-4 w-4" />
          添加
        </Button>
      </div>

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
              <Button
                variant="ghost"
                size="sm"
                className="text-[#F53F3F]"
                onClick={() => setDelTarget(t)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* 删除二次确认（通用 ConfirmDialog） */}
      <ConfirmDialog
        open={!!delTarget}
        title="删除该任务？"
        content={`「${delTarget?.title}」删除后不可恢复。`}
        okText="删除"
        danger
        onOk={() => delTarget && remove(delTarget.id)}
        onOpenChange={(o) => !o && setDelTarget(null)}
      />
    </div>
  )
}

export default TasksModule
