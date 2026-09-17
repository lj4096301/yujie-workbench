// 必须放在所有路由 import 之前：路由模块会在顶层读取 process.env
import './env'
import fs from 'fs'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { createKnowledgeRouter } from './routes/knowledge'
import { createNovelRouter } from './routes/novel'
import { createWeatherRouter } from './routes/weather'
import { createEpicRouter } from './routes/epic'
import { createNewsRouter } from './routes/news'
import { createRssRouter } from './routes/rss'
import { createTVRouter } from './routes/tv'
import { createPricingRouter } from './routes/pricing'
import { createCalendarRouter } from './routes/calendar'
import { createKanbanRouter } from './routes/kanban'
import spreadsheetRouter from './routes/spreadsheet'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = Number(process.env.WEB_SERVER_PORT) || 3001

app.use(cors())
app.use(express.json())

// 静态文件（仅当 dist 存在时）
const distPath = path.join(__dirname, '../../dist')
try {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath))
  }
} catch {}

// API 路由
app.use('/api/knowledge', createKnowledgeRouter())
app.use('/api/novel', createNovelRouter())
app.use('/api/weather', createWeatherRouter())
app.use('/api/epic', createEpicRouter())
app.use('/api/news', createNewsRouter())
app.use('/api/rss', createRssRouter())
app.use('/api/tv', createTVRouter())
app.use('/api/pricing', createPricingRouter())
app.use('/api/calendar', createCalendarRouter())
app.use('/api/kanban', createKanbanRouter())
app.use('/api/spreadsheet', spreadsheetRouter)

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '(未配置，使用默认路径)'
  const feishuReady = Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET)

  console.log('----------------------------------------------')
  console.log(`宇界工作台 Web 服务器已启动`)
  console.log(`  本机访问   : http://localhost:${PORT}`)
  console.log(`  局域网访问 : http://0.0.0.0:${PORT}`)
  console.log(`  知识库路径 : ${vaultPath}`)
  console.log(`  飞书日历   : ${feishuReady ? '已配置凭据（待授权）' : '未配置'}`)
  console.log(`  天气 API   : Open-Meteo（免密钥，多城市）`)
  console.log(`  API 价格   : 内置参考价 + 自定义（data/pricing-custom.json）`)
  console.log('----------------------------------------------')
})

export default app
