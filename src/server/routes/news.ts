import { Router } from 'express'
import axios from 'axios'
import RSSParser from 'rss-parser'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const STATE_FILE = path.join(__dirname, '../../../data/news-state.json')

/** 已读 / 收藏状态（Feedly 式，按 url 持久化；上限各 1000 条防膨胀） */
interface NewsState {
  read: string[]
  bookmarks: string[]
}

function readState(): NewsState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
    return { read: raw.read || [], bookmarks: raw.bookmarks || [] }
  } catch {
    return { read: [], bookmarks: [] }
  }
}

function writeState(state: NewsState) {
  const dir = path.dirname(STATE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    read: state.read.slice(0, 1000),
    bookmarks: state.bookmarks.slice(0, 1000),
  }, null, 2))
}

const RSS_FEEDS: Record<string, string[]> = {
  tech: [
    'https://36kr.com/feed',
    'https://www.ifanr.com/feed',
  ],
  ai: [
    'https://www.jiqizhixin.com/rss',
  ],
  finance: [
    'https://www.cls.cn/rss',
  ],
  general: [
    'https://news.sina.com.cn/rss/tech/',
  ],
}

export function createNewsRouter() {
  const router = Router()
  const parser = new RSSParser()

  router.get('/', async (req, res) => {
    try {
      const category = (req.query.category as string) || 'all'
      const query = (req.query.q as string) || ''

      const feeds = category === 'all'
        ? Object.values(RSS_FEEDS).flat()
        : RSS_FEEDS[category] || []

      const allItems: any[] = []

      // 并发抓取 RSS
      const results = await Promise.allSettled(
        feeds.map(async (feedUrl) => {
          try {
            const feed = await parser.parseURL(feedUrl)
            return feed.items.slice(0, 10).map((item) => ({
              id: item.guid || item.link || Date.now().toString(),
              title: item.title || '',
              summary: item.contentSnippet?.slice(0, 200) || item.content?.slice(0, 200) || '',
              source: feed.title || new URL(feedUrl).hostname,
              url: item.link || '',
              publishedAt: item.pubDate || new Date().toISOString(),
              category: getCategoryForFeed(feedUrl),
              isBookmarked: false,
            }))
          } catch {
            return []
          }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allItems.push(...result.value)
        }
      }

      // 按时间排序
      allItems.sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      )

      // 关键词过滤
      const filtered = query
        ? allItems.filter((n) =>
            n.title.toLowerCase().includes(query.toLowerCase()) ||
            n.summary.toLowerCase().includes(query.toLowerCase())
          )
        : allItems

      // 合并已读 / 收藏状态（RSS 重抓不会丢）
      const state = readState()
      const merged = filtered.map((n: any) => ({
        ...n,
        isRead: state.read.includes(n.url),
        isBookmarked: state.bookmarks.includes(n.url),
      }))

      res.json(merged.length > 0 ? merged.slice(0, 50) : getMockNews())
    } catch (err) {
      console.error('新闻获取失败:', err)
      res.json(getMockNews())
    }
  })

  // 读取已读 / 收藏状态
  router.get('/state', (_req, res) => {
    res.json(readState())
  })

  // 保存已读 / 收藏状态（整份覆盖，前端维护增量）
  router.put('/state', (req, res) => {
    try {
      const state: NewsState = {
        read: Array.isArray(req.body?.read) ? req.body.read : [],
        bookmarks: Array.isArray(req.body?.bookmarks) ? req.body.bookmarks : [],
      }
      writeState(state)
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: '保存状态失败' })
    }
  })

  return router
}

function getCategoryForFeed(url: string): string {
  for (const [cat, feeds] of Object.entries(RSS_FEEDS)) {
    if (feeds.includes(url)) return cat
  }
  return 'general'
}

function getMockNews() {
  return [
    {
      id: 'mock-1',
      title: '宇界工作台项目启动',
      summary: '一站式个人工作台正式开始开发，集成知识管理、小说创作、信息聚合等功能。',
      source: '宇界',
      url: '#',
      publishedAt: new Date().toISOString(),
      category: 'tech',
      isBookmarked: false,
    },
    {
      id: 'mock-2',
      title: 'AI 价格战持续：多家平台下调 API 价格',
      summary: 'DeepSeek、硅基流动等平台纷纷下调大模型 API 调用价格，开发者迎来利好。',
      source: 'AI 快讯',
      url: '#',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      category: 'ai',
      isBookmarked: false,
    },
  ]
}
