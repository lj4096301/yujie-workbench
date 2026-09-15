import { Router } from 'express'
import fs from 'fs'
import { dataFile } from '../paths'

interface KanbanProject {
  id: string
  name: string
}

interface KanbanCard {
  id: string
  projectId: string
  title: string
  content: string
  status: string
  priority: string
  createdAt: number
  updatedAt: number
}

export interface KanbanState {
  projects: KanbanProject[]
  cards: KanbanCard[]
}

const DEFAULT_STATE: KanbanState = {
  projects: [
    { id: 'p1', name: '项目A' },
    { id: 'p2', name: '项目B' },
  ],
  cards: [],
}

function loadState(): KanbanState {
  const file = dataFile('kanban.json')
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8')
      return DEFAULT_STATE
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (!parsed || !Array.isArray(parsed.projects) || !Array.isArray(parsed.cards)) return DEFAULT_STATE
    return parsed as KanbanState
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state: KanbanState) {
  fs.writeFileSync(dataFile('kanban.json'), JSON.stringify(state, null, 2), 'utf-8')
}

export function createKanbanRouter() {
  const router = Router()

  router.get('/', (_req, res) => {
    try {
      res.json(loadState())
    } catch {
      res.status(500).json({ error: '读取失败' })
    }
  })

  router.post('/state', (req, res) => {
    try {
      const body = req.body as KanbanState
      if (!body || !Array.isArray(body.projects) || !Array.isArray(body.cards)) {
        res.status(400).json({ error: '数据结构不合法' })
        return
      }
      saveState(body)
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '保存失败' })
    }
  })

  return router
}
