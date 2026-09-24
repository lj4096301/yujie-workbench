import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 待办数据统一归属「日程管理」：物理存储在 data/calendar-events.json，
 * 与日程事件共存同一份文件，仅用 type 字段区分（'todo' = 待办，'event' = 日程）。
 * 这样在「日程管理」里新建的待办，会自动出现在「待办管理」模块与首页待办卡。
 */
const CAL_FILE = path.join(__dirname, '../../../data/calendar-events.json')
const LEGACY_FILE = path.join(__dirname, '../../../data/tasks.json')

type Priority = 'low' | 'mid' | 'high'

interface CalItem {
  id: string
  title: string
  start?: string
  end?: string
  color?: string
  description?: string
  source?: string
  type?: 'event' | 'todo'
  done?: boolean
  due?: string
  priority?: Priority
  createdAt?: number
}

function ensureCal(): CalItem[] {
  const dir = path.dirname(CAL_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(CAL_FILE)) {
    fs.writeFileSync(CAL_FILE, '[]', 'utf-8')
    return []
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CAL_FILE, 'utf-8'))
    return Array.isArray(parsed) ? (parsed as CalItem[]) : []
  } catch {
    return []
  }
}

function saveCal(list: CalItem[]) {
  fs.writeFileSync(CAL_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

function todosOf(list: CalItem[]): CalItem[] {
  return list.filter((x) => x.type === 'todo')
}

/** 首次把旧 tasks.json 里的待办迁移到日程数据里（去重 + 清空旧文件，避免重复迁移） */
function migrateLegacy(): void {
  if (!fs.existsSync(LEGACY_FILE)) return
  let legacy: any[] = []
  try {
    legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf-8'))
  } catch {
    legacy = []
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return

  const list = ensureCal()
  if (todosOf(list).length > 0) {
    // 已迁移过，直接清空旧文件占位
    try {
      fs.writeFileSync(LEGACY_FILE, '[]', 'utf-8')
    } catch {
      /* ignore */
    }
    return
  }

  const existingIds = new Set(list.map((x) => x.id))
  const now = Date.now()
  const migrated: CalItem[] = legacy
    .filter((x) => x && typeof x.title === 'string' && x.title.trim())
    .map((x) => {
      const due = typeof x.due === 'string' ? x.due : undefined
      const start = due ? `${due}T12:00:00.000Z` : new Date(now).toISOString()
      const id =
        typeof x.id === 'string' && x.id && !existingIds.has(x.id)
          ? x.id
          : `tk-${now}-${Math.random().toString(36).slice(2, 6)}`
      return {
        id,
        title: String(x.title).trim(),
        type: 'todo',
        done: Boolean(x.done),
        priority: ['low', 'mid', 'high'].includes(x.priority) ? (x.priority as Priority) : 'mid',
        due,
        createdAt: typeof x.createdAt === 'number' ? x.createdAt : now,
        start,
        end: start,
        source: 'local',
      } as CalItem
    })

  saveCal([...list, ...migrated])
  try {
    fs.writeFileSync(LEGACY_FILE, '[]', 'utf-8')
  } catch {
    /* ignore */
  }
}

function genId(): string {
  return `tk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function startFromDue(due?: string): string {
  if (due) return `${due}T12:00:00.000Z`
  return new Date().toISOString()
}

export function createTasksRouter() {
  const router = Router()

  // 全量读取（触发一次性迁移）
  router.get('/', (_req, res) => {
    migrateLegacy()
    res.json(todosOf(ensureCal()))
  })

  // 新增待办（归属日程数据）
  router.post('/', (req, res) => {
    try {
      const { title, due, priority } = req.body ?? {}
      const t = String(title ?? '').trim()
      if (!t) {
        res.status(400).json({ error: '标题不能为空' })
        return
      }
      const item: CalItem = {
        id: genId(),
        title: t,
        type: 'todo',
        done: false,
        createdAt: Date.now(),
        due: due ? String(due) : undefined,
        priority: ['low', 'mid', 'high'].includes(priority) ? (priority as Priority) : 'mid',
        source: 'local',
      }
      const s = startFromDue(item.due)
      item.start = s
      item.end = s
      const list = ensureCal()
      list.unshift(item)
      saveCal(list)
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
      const list = ensureCal()
      const existingIds = new Set(list.map((x) => x.id))
      const now = Date.now()
      const clean: CalItem[] = items
        .filter((x: any) => x && typeof x.title === 'string' && x.title.trim())
        .map((x: any) => {
          const due = typeof x.due === 'string' ? x.due : undefined
          const s = startFromDue(due)
          const id =
            typeof x.id === 'string' && x.id && !existingIds.has(x.id)
              ? x.id
              : `tk-${now}-${Math.random().toString(36).slice(2, 6)}`
          return {
            id,
            title: String(x.title).trim(),
            type: 'todo',
            done: Boolean(x.done),
            createdAt: typeof x.createdAt === 'number' ? x.createdAt : now,
            due,
            priority: ['low', 'mid', 'high'].includes(x.priority) ? (x.priority as Priority) : 'mid',
            start: s,
            end: s,
            source: 'local',
          } as CalItem
        })
      const merged = [...clean, ...list]
      const seen = new Set<string>()
      const dedup = merged.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
      saveCal(dedup)
      res.json({ count: todosOf(dedup).length })
    } catch {
      res.status(500).json({ error: '写入失败' })
    }
  })

  // 更新（勾选完成/改标题/改截止/改优先级）
  router.put('/:id', (req, res) => {
    try {
      const id = req.params.id
      const patch = req.body ?? {}
      const list = ensureCal()
      const item = list.find((t) => t.id === id)
      if (!item) {
        res.status(404).json({ error: '任务不存在' })
        return
      }
      if (typeof patch.done === 'boolean') item.done = patch.done
      if (typeof patch.title === 'string' && patch.title.trim()) item.title = patch.title.trim()
      if (typeof patch.due === 'string' || patch.due === null) {
        item.due = patch.due || undefined
        if (item.due) {
          const s = `${item.due}T12:00:00.000Z`
          item.start = s
          item.end = s
        }
      }
      if (['low', 'mid', 'high'].includes(patch.priority)) item.priority = patch.priority
      item.type = 'todo'
      saveCal(list)
      res.json(item)
    } catch {
      res.status(500).json({ error: '写入失败' })
    }
  })

  // 删除
  router.delete('/:id', (req, res) => {
    try {
      const id = req.params.id
      const list = ensureCal()
      const next = list.filter((t) => t.id !== id)
      if (next.length === list.length) {
        res.status(404).json({ error: '任务不存在' })
        return
      }
      saveCal(next)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: '写入失败' })
    }
  })

  return router
}
