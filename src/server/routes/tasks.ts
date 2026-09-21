import { Router } from 'express'
import fs from 'fs'
import { dataFile } from '../paths'

export interface TaskItem {
  id: string
  title: string
  done: boolean
  createdAt: number
  due?: string // yyyy-mm-dd
  priority?: 'low' | 'mid' | 'high'
}

/** 待办持久化：data/tasks.json（与看板/日历同惯例，跨环境不丢） */
function loadTasks(): TaskItem[] {
  const file = dataFile('tasks.json')
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '[]', 'utf-8')
      return []
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return Array.isArray(parsed) ? (parsed as TaskItem[]) : []
  } catch {
    return []
  }
}

function saveTasks(list: TaskItem[]) {
  fs.writeFileSync(dataFile('tasks.json'), JSON.stringify(list, null, 2), 'utf-8')
}

export function createTasksRouter() {
  const router = Router()

  // 全量读取
  router.get('/', (_req, res) => {
    res.json(loadTasks())
  })

  // 新增
  router.post('/', (req, res) => {
    try {
      const { title, due, priority } = req.body ?? {}
      const t = String(title ?? '').trim()
      if (!t) {
        res.status(400).json({ error: '标题不能为空' })
        return
      }
      const item: TaskItem = {
        id: `tk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: t,
        done: false,
        createdAt: Date.now(),
        due: due ? String(due) : undefined,
        priority: ['low', 'mid', 'high'].includes(priority) ? priority : 'mid',
      }
      const list = loadTasks()
      list.unshift(item)
      saveTasks(list)
      res.json(item)
    } catch {
      res.status(500).json({ error: '写入失败' })
    }
  })

  // 批量新增（localStorage 迁移用）
  router.post('/batch', (req, res) => {
    try {
      const body = req.body
      const items = Array.isArray(body) ? body : []
      const clean = items
        .filter((x) => x && typeof x.title === 'string' && x.title.trim())
        .map((x) => ({
          id: typeof x.id === 'string' && x.id ? x.id : `tk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: String(x.title).trim(),
          done: Boolean(x.done),
          createdAt: typeof x.createdAt === 'number' ? x.createdAt : Date.now(),
          due: typeof x.due === 'string' ? x.due : undefined,
          priority: ['low', 'mid', 'high'].includes(x.priority) ? x.priority : 'mid',
        }))
      const list = loadTasks()
      const merged = [...clean, ...list]
      // 按 id 去重
      const seen = new Set<string>()
      const dedup = merged.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
      saveTasks(dedup)
      res.json({ count: dedup.length })
    } catch {
      res.status(500).json({ error: '写入失败' })
    }
  })

  // 更新（勾选完成/改标题/改截止/改优先级）
  router.put('/:id', (req, res) => {
    try {
      const id = req.params.id
      const patch = req.body ?? {}
      const list = loadTasks()
      const item = list.find((t) => t.id === id)
      if (!item) {
        res.status(404).json({ error: '任务不存在' })
        return
      }
      if (typeof patch.done === 'boolean') item.done = patch.done
      if (typeof patch.title === 'string' && patch.title.trim()) item.title = patch.title.trim()
      if (typeof patch.due === 'string' || patch.due === null) item.due = patch.due || undefined
      if (['low', 'mid', 'high'].includes(patch.priority)) item.priority = patch.priority
      saveTasks(list)
      res.json(item)
    } catch {
      res.status(500).json({ error: '写入失败' })
    }
  })

  // 删除
  router.delete('/:id', (req, res) => {
    try {
      const id = req.params.id
      const list = loadTasks()
      const next = list.filter((t) => t.id !== id)
      if (next.length === list.length) {
        res.status(404).json({ error: '任务不存在' })
        return
      }
      saveTasks(next)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: '写入失败' })
    }
  })

  return router
}
