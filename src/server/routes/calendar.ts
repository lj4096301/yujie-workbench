import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.join(__dirname, '../../../data/calendar-events.json')

export function createCalendarRouter() {
  const router = Router()

  const ensureFile = () => {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]')
  }

  // 获取事件
  router.get('/events', async (req, res) => {
    try {
      ensureFile()
      const start = req.query.start as string
      const end = req.query.end as string

      // 读取本地事件
      let events = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))

      // 尝试同步飞书日历
      try {
        const feishuEvents = await fetchFeishuEvents(start, end)
        events = [...events, ...feishuEvents]
      } catch (err) {
        console.log('飞书日历同步跳过:', (err as Error).message)
      }

      // 待办（type:'todo'）归属「待办管理」，不出现在日程视图/月历卡
      events = events.filter((e: any) => e.type !== 'todo')

      // 按时间范围过滤
      if (start && end) {
        events = events.filter((e: any) => {
          const eStart = new Date(e.start).getTime()
          return eStart >= new Date(start).getTime() && eStart <= new Date(end).getTime() + 86400000
        })
      }

      res.json(events)
    } catch {
      res.json([])
    }
  })

  // 添加事件
  router.post('/events', (req, res) => {
    try {
      ensureFile()
      const events = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      events.push(req.body)
      fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2))
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '保存失败' })
    }
  })

  // 删除事件
  router.delete('/events/:id', (req, res) => {
    try {
      ensureFile()
      const events = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      const filtered = events.filter((e: any) => e.id !== req.params.id)
      fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2))
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '删除失败' })
    }
  })

  // 飞书 OAuth 回调
  router.get('/feishu/callback', async (req, res) => {
    try {
      const code = req.query.code as string
      if (!code) return res.status(400).json({ error: '缺少授权码' })

      const appId = process.env.FEISHU_APP_ID
      const appSecret = process.env.FEISHU_APP_SECRET

      if (!appId || !appSecret) {
        return res.status(500).json({ error: '飞书配置缺失' })
      }

      // 获取 user access token
      const tokenRes = await axios.post(
        'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
        {
          grant_type: 'authorization_code',
          code,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getAppAccessToken(appId, appSecret)}`,
          },
        }
      )

      const userToken = tokenRes.data?.data?.access_token
      if (userToken) {
        // 保存 token
        const tokenFile = path.join(__dirname, '../../../data/feishu-token.json')
        fs.writeFileSync(tokenFile, JSON.stringify({ access_token: userToken, updated: Date.now() }))
        res.json({ success: true })
      } else {
        res.status(400).json({ error: '获取 token 失败' })
      }
    } catch (err) {
      res.status(500).json({ error: '飞书授权失败' })
    }
  })

  return router
}

async function getAppAccessToken(appId: string, appSecret: string): Promise<string> {
  const res = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
    { app_id: appId, app_secret: appSecret }
  )
  return res.data?.app_access_token || ''
}

async function fetchFeishuEvents(start?: string, end?: string): Promise<any[]> {
  const tokenFile = path.join(__dirname, '../../../data/feishu-token.json')
  if (!fs.existsSync(tokenFile)) return []

  const { access_token } = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'))
  if (!access_token) return []

  try {
    const params: any = {}
    if (start) params.start_time = Math.floor(new Date(start).getTime() / 1000).toString()
    if (end) params.end_time = Math.floor(new Date(end).getTime() / 1000 + 86400).toString()

    const res = await axios.get(
      'https://open.feishu.cn/open-apis/calendar/v4/calendars/primary/events',
      {
        params,
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 4000,
      }
    )

    return (res.data?.data?.items || []).map((item: any) => ({
      id: `feishu-${item.event_id}`,
      title: item.summary || '无标题',
      start: new Date(item.start_time?.timestamp * 1000).toISOString(),
      end: new Date(item.end_time?.timestamp * 1000).toISOString(),
      color: '#367aab', // 飞书来源：低饱和雾蓝（设计规范 §2.1a）
      description: item.description || '',
      source: 'feishu',
      feishuEventId: item.event_id,
    }))
  } catch {
    return []
  }
}
