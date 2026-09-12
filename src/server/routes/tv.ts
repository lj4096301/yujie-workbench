import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.join(__dirname, '../../../data/tv-shows.json')
const HISTORY_FILE = path.join(__dirname, '../../../data/tv-history.json')

export function createTVRouter() {
  const router = Router()

  // 确保数据文件存在
  const ensureFile = () => {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]')
  }

  router.get('/shows', (req, res) => {
    try {
      ensureFile()
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      res.json(data)
    } catch {
      res.json([])
    }
  })

  router.post('/shows', (req, res) => {
    try {
      ensureFile()
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      data.unshift(req.body)
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '保存失败' })
    }
  })

  router.put('/shows/:id', (req, res) => {
    try {
      ensureFile()
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      const idx = data.findIndex((s: any) => s.id === req.params.id)
      if (idx !== -1) {
        data[idx] = { ...data[idx], ...req.body }
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
      }
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '更新失败' })
    }
  })

  router.delete('/shows/:id', (req, res) => {
    try {
      ensureFile()
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      const filtered = data.filter((s: any) => s.id !== req.params.id)
      fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2))
      // 同步清理该剧集的观看历史
      try {
        const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.filter((h: any) => h.showId !== req.params.id), null, 2))
      } catch {}
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '删除失败' })
    }
  })

  // ===================== 观看历史（对标 SeriesGuide History） =====================
  const ensureHistory = () => {
    const dir = path.dirname(HISTORY_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]')
  }

  router.get('/history', (req, res) => {
    try {
      ensureHistory()
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
      res.json(data)
    } catch {
      res.json([])
    }
  })

  router.post('/history', (req, res) => {
    try {
      ensureHistory()
      const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
      history.unshift({ ...req.body, at: req.body?.at || new Date().toISOString() })
      // 上限 200 条，防无限膨胀
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 200), null, 2))
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '记录失败' })
    }
  })

  return router
}
