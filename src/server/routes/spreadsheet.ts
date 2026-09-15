/**
 * 表格页后端 API
 * 
 * 提供表格数据的 CRUD 接口
 * 数据持久化到 JSON 文件
 */
import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.join(__dirname, '../../../data/spreadsheet-data.json')

export function createSpreadsheetRouter() {
  const router = Router()

  // 确保数据文件存在
  function ensureDataFile() {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ sheets: [] }, null, 2))
  }

  // 读取数据
  function readData() {
    ensureDataFile()
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    } catch {
      return { sheets: [] }
    }
  }

  // 保存数据
  function writeData(data: any) {
    ensureDataFile()
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
  }

  // 获取所有工作表（移除 type 字段避免 AG Grid warning #36）
  router.get('/sheets', (_req: Request, res: Response) => {
    try {
      const data = readData()
      const sheets = (data.sheets || []).map((sheet: any) => ({
        ...sheet,
        columns: sheet.columns?.map(({ type, ...col }: any) => col) || [],
      }))
      res.json(sheets)
    } catch (err) {
      res.status(500).json({ error: '读取数据失败' })
    }
  })

  // 初始化默认数据
  router.post('/init', (req: Request, res: Response) => {
    try {
      const { sheets } = req.body
      if (!sheets || !Array.isArray(sheets)) {
        return res.status(400).json({ error: '缺少 sheets 参数' })
      }
      writeData({ sheets })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: '初始化失败' })
    }
  })

  // 更新工作表（支持 rows 和 columns 同时更新）
  router.post('/update', (req: Request, res: Response) => {
    try {
      const { sheetId, rows, columns } = req.body
      if (!sheetId) {
        return res.status(400).json({ error: '缺少 sheetId 参数' })
      }

      const data = readData()
      const sheetIndex = data.sheets.findIndex((s: any) => s.id === sheetId)
      if (sheetIndex === -1) {
        return res.status(404).json({ error: '工作表不存在' })
      }

      if (Array.isArray(rows)) {
        data.sheets[sheetIndex].rows = rows
      }
      if (Array.isArray(columns)) {
        data.sheets[sheetIndex].columns = columns
      }
      
      writeData(data)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: '更新失败' })
    }
  })

  // 更新列定义
  router.post('/columns', (req: Request, res: Response) => {
    try {
      const { sheetId, columns } = req.body
      if (!sheetId || !Array.isArray(columns)) {
        return res.status(400).json({ error: '缺少必要参数' })
      }

      const data = readData()
      const sheetIndex = data.sheets.findIndex((s: any) => s.id === sheetId)
      if (sheetIndex === -1) {
        return res.status(404).json({ error: '工作表不存在' })
      }

      data.sheets[sheetIndex].columns = columns
      writeData(data)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: '更新失败' })
    }
  })

  return router
}
