import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '../../../data/novels')

export function createNovelRouter() {
  const router = Router()

  // 确保数据目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  // 获取小说数据
  router.get('/data', (req, res) => {
    try {
      const dataFile = path.join(DATA_DIR, 'project.json')
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))
        res.json(data)
      } else {
        res.json({ chapters: [], characters: [], notes: [], worldDocs: [] })
      }
    } catch {
      res.json({ chapters: [], characters: [], notes: [], worldDocs: [] })
    }
  })

  // 保存灵感速记
  router.post('/notes', (req, res) => {
    try {
      const dataFile = path.join(DATA_DIR, 'project.json')
      let data: any = { chapters: [], characters: [], notes: [], worldDocs: [] }
      if (fs.existsSync(dataFile)) {
        data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))
      }
      data.notes = [req.body, ...(data.notes || [])]
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '保存失败' })
    }
  })

  // 添加人物
  router.post('/characters', (req, res) => {
    try {
      const dataFile = path.join(DATA_DIR, 'project.json')
      let data: any = { chapters: [], characters: [], notes: [], worldDocs: [] }
      if (fs.existsSync(dataFile)) {
        data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))
      }
      data.characters = [...(data.characters || []), req.body]
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '保存失败' })
    }
  })

  // 更新整个小说数据
  router.put('/data', (req, res) => {
    try {
      const dataFile = path.join(DATA_DIR, 'project.json')
      fs.writeFileSync(dataFile, JSON.stringify(req.body, null, 2))
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '保存失败' })
    }
  })

  // 全本导出（novelWriter/manuskript 的 manuscript export）
  router.get('/export', (req, res) => {
    try {
      const dataFile = path.join(DATA_DIR, 'project.json')
      if (!fs.existsSync(dataFile)) return res.status(404).json({ error: '还没有小说数据' })
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))
      const chapters = (data.chapters || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      if (chapters.length === 0) return res.status(404).json({ error: '没有章节可导出' })

      const lines: string[] = []
      for (const ch of chapters) {
        lines.push(`\n\n${'='.repeat(24)} ${ch.title} ${'='.repeat(24)}\n`)
        lines.push((ch.content || '').trim())
      }
      const text = lines.join('\n')
      const filename = encodeURIComponent(`manuscript-${new Date().toISOString().slice(0, 10)}.txt`)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`)
      res.send(text)
    } catch {
      res.status(500).json({ error: '导出失败' })
    }
  })

  return router
}
