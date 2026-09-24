import React, { useEffect, useState } from 'react'
import { message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { DatePicker } from 'antd'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export type TodoPriority = 'low' | 'mid' | 'high'

/** 待办数据（与后端 calendar-events.json 中 type:'todo' 对齐） */
export interface TodoData {
  id: string
  title: string
  done?: boolean
  createdAt?: number
  due?: string // yyyy-mm-dd
  priority?: TodoPriority
  type?: 'todo'
  start?: string
  end?: string
  source?: string
}

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  low: '低',
  mid: '中',
  high: '高',
}

/** 分段按钮样式（与日历模块一致） */
function segBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 0',
    fontSize: 14,
    borderRadius: 6,
    cursor: 'pointer',
    border: active ? '1px solid var(--primary-color)' : '1px solid var(--border)',
    background: active ? 'var(--primary-subtle)' : '#fff',
    color: active ? 'var(--primary-color)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 400,
  }
}

/**
 * 保存待办：create → POST /api/tasks；edit → PUT /api/tasks/:id（后端合并保留其余字段）。
 * 待办物理存储在 data/calendar-events.json（type:'todo'），被「待办管理」与首页待办卡统一读取。
 */
export async function saveTodo(
  initial: TodoData | null,
  values: { title: string; due?: string; priority: TodoPriority }
): Promise<TodoData> {
  const title = values.title.trim()
  if (!title) {
    message.warning('请输入待办内容')
    throw new Error('EMPTY_TITLE')
  }
  if (initial) {
    const r = await fetch(`/api/tasks/${initial.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, due: values.due || undefined, priority: values.priority }),
    })
    if (!r.ok) {
      message.error('保存失败，请重试')
      throw new Error('UPDATE_FAILED')
    }
    return (await r.json()) as TodoData
  }
  const r = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, due: values.due || undefined, priority: values.priority }),
  })
  if (!r.ok) {
    message.error('添加失败，请重试')
    throw new Error('CREATE_FAILED')
  }
  return (await r.json()) as TodoData
}

/** 表单主体（可被日历内嵌复用，避免两套待办 UI 重复） */
export const TodoFormFields: React.FC<{
  title: string
  onTitle: (v: string) => void
  due: Dayjs | null
  onDue: (v: Dayjs | null) => void
  priority: TodoPriority
  onPriority: (v: TodoPriority) => void
  autoFocus?: boolean
}> = ({ title, onTitle, due, onDue, priority, onPriority, autoFocus }) => (
  <div className="space-y-4">
    <div className="space-y-1.5">
      <Label htmlFor="todo-title">标题</Label>
      <Input
        id="todo-title"
        value={title}
        placeholder="待办内容"
        autoFocus={autoFocus}
        onChange={(e) => onTitle(e.target.value)}
      />
    </div>
    <div className="space-y-1.5">
      <Label>日期（可选）</Label>
      <DatePicker
        style={{ width: '100%' }}
        value={due}
        onChange={(v) => onDue(v as Dayjs | null)}
      />
    </div>
    <div className="space-y-1.5">
      <Label>优先级</Label>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['low', 'mid', 'high'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPriority(p)}
            style={segBtnStyle(priority === p)}
          >
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </div>
    </div>
  </div>
)

/** 完整弹窗（待办管理模块的新建 / 编辑使用） */
export const TodoDialog: React.FC<{
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: TodoData | null
  onSaved?: (item: TodoData) => void
}> = ({ open, onOpenChange, initial, onSaved }) => {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<Dayjs | null>(null)
  const [priority, setPriority] = useState<TodoPriority>('mid')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '')
      setDue(initial?.due ? dayjs(initial.due) : null)
      setPriority(initial?.priority ?? 'mid')
      setSaving(false)
    }
  }, [open, initial])

  const handleSave = async () => {
    setSaving(true)
    try {
      const item = await saveTodo(initial ?? null, {
        title,
        due: due ? due.format('YYYY-MM-DD') : undefined,
        priority,
      })
      onSaved?.(item)
      onOpenChange(false)
    } catch {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑待办' : '添加待办'}</DialogTitle>
        </DialogHeader>
        <TodoFormFields
          title={title}
          onTitle={setTitle}
          due={due}
          onDue={setDue}
          priority={priority}
          onPriority={setPriority}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {initial ? '保存' : '添加待办'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TodoDialog
