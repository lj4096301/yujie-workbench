import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.join(__dirname, '../../../data/holidays.json')
const API = 'https://timor.tech/api/holiday/year/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

export interface HolidayItem {
  date: string // YYYY-MM-DD
  name: string
  type: 'holiday' | 'workday' // 放假 / 调休上班
}

function loadCache(): Record<string, HolidayItem[]> {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveCache(cache: Record<string, HolidayItem[]>): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), 'utf-8')
}

export function createHolidayRouter() {
  const router = Router()

  /**
   * 国家法定休息日：GET /api/holiday?year=2026
   * 优先读本地缓存 data/holidays.json；未缓存时请求 timor.tech 并落缓存
   */
  router.get('/', async (req, res) => {
    const year = String(req.query.year || new Date().getFullYear())
    if (!/^\d{4}$/.test(year)) {
      res.status(400).json({ error: 'year 参数格式错误' })
      return
    }
    const cache = loadCache()
    if (cache[year]?.length) {
      res.json({ year, list: cache[year], cached: true })
      return
    }
    try {
      const upstream = await fetch(`${API}${year}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(30_000),
      })
      if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`)
      const json = (await upstream.json()) as {
        holiday?: Record<string, { holiday: boolean; name?: string; date?: string }>
      }
      const items: HolidayItem[] = []
      const seen = new Set<string>()
      for (const v of Object.values(json.holiday ?? {})) {
        if (!v?.date || seen.has(v.date)) continue
        seen.add(v.date)
        items.push({
          date: v.date,
          name: v.name || (v.holiday ? '节假日' : '调休上班'),
          type: v.holiday ? 'holiday' : 'workday',
        })
      }
      items.sort((a, b) => a.date.localeCompare(b.date))
      cache[year] = items
      saveCache(cache)
      res.json({ year, list: items, cached: false })
    } catch (err) {
      res.status(502).json({ error: '获取节假日失败：' + String(err) })
    }
  })

  return router
}
