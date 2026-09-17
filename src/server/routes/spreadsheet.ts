import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()
const dataFile = path.join(__dirname, '../../data/spreadsheet-data.json')

function loadData() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { sheets: [] }
  }
}

function saveData(data: any) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))
}

router.get('/sheets', (req, res) => {
  const data = loadData()
  res.json(data.sheets || [])
})

router.post('/update', (req, res) => {
  const { columns, rows } = req.body
  const data = loadData()
  let sheet = data.sheets[0]
  if (!sheet) {
    sheet = { id: 'default', name: '默认表格', columns: [], rows: [] }
    data.sheets.push(sheet)
  }
  sheet.columns = columns
  sheet.rows = rows
  saveData(data)
  res.json({ ok: true })
})

router.post('/init', (req, res) => {
  const { sheets } = req.body
  saveData({ sheets })
  res.json({ ok: true })
})

export default router
