import { Router } from 'express'

/**
 * RSS 订阅源抓取路由（零新依赖：自研 RSS 2.0 / Atom 解析）。
 *
 * GET /api/rss?url=<feed 地址>
 * 返回 { title, items: [{ title, link, date, summary }] }
 *
 * - 每个 feed 内存缓存 15 分钟
 * - 上游失败时回落过期缓存（宁可给旧数据也不报错）
 * - 仅允许 http(s)，条目上限 30，摘要剥 HTML
 */

interface RssItem {
  title: string
  link: string
  date: string
  summary: string
}

interface FeedCache {
  fetchedAt: number
  title: string
  items: RssItem[]
}

const CACHE_TTL = 15 * 60 * 1000
const cache = new Map<string, FeedCache>()

/** 解码 XML 实体（&amp; 必须最后替换，避免二次解码） */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** 取第一个 <tag>...</tag> 的内容，自动解 CDATA */
function firstTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return undefined
  const cdata = m[1].match(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/)
  return decodeEntities(cdata ? cdata[1] : m[1]).trim()
}

/** Atom 的 <link href="..."/> 是自闭合标签，单独处理 */
function atomLink(xml: string): string | undefined {
  const m = xml.match(/<link\s+[^>]*href=["']([^"']+)["']/i)
  return m ? decodeEntities(m[1]).trim() : undefined
}

/** 剥 HTML 标签 + 压空白，摘要截 200 字 */
function toSummary(html: string | undefined): string {
  if (!html) return ''
  return decodeEntities(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

function parseFeed(xml: string): { title: string; items: RssItem[] } {
  // RSS 2.0 用 <item>，Atom 用 <entry>
  const itemRe = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi
  let blocks = [...xml.matchAll(itemRe)].map((m) => m[1])
  if (blocks.length === 0) {
    const entryRe = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi
    blocks = [...xml.matchAll(entryRe)].map((m) => m[1])
  }

  const title = firstTag(xml, 'title') || ''
  const items: RssItem[] = blocks.slice(0, 30).map((b) => {
    const link = firstTag(b, 'link') || atomLink(b) || firstTag(b, 'guid') || ''
    const rawDate = firstTag(b, 'pubDate') || firstTag(b, 'updated') || firstTag(b, 'published') || firstTag(b, 'dc:date') || ''
    const d = rawDate ? new Date(rawDate) : null
    return {
      title: firstTag(b, 'title') || '(无标题)',
      link,
      date: d && !isNaN(d.getTime()) ? d.toISOString() : '',
      summary: toSummary(firstTag(b, 'description') || firstTag(b, 'summary') || firstTag(b, 'content')),
    }
  })

  return { title, items }
}

export function createRssRouter(): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const url = String(req.query.url || '')
    if (!/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: '缺少合法的 feed url 参数' })
      return
    }

    const cached = cache.get(url)
    const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL
    if (fresh && cached) {
      res.json({ title: cached.title, items: cached.items, cached: true })
      return
    }

    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!resp.ok) throw new Error(`上游返回 ${resp.status}`)
      const xml = await resp.text()
      const parsed = parseFeed(xml)
      if (parsed.items.length === 0 && parsed.title === '') throw new Error('内容不是有效的 RSS/Atom feed')

      const entry: FeedCache = { fetchedAt: Date.now(), title: parsed.title, items: parsed.items }
      cache.set(url, entry)
      res.json({ title: entry.title, items: entry.items, cached: false })
    } catch (err) {
      // 回落过期缓存
      if (cached) {
        res.json({ title: cached.title, items: cached.items, cached: true, stale: true })
        return
      }
      res.status(502).json({ error: `抓取失败: ${err instanceof Error ? err.message : String(err)}` })
    }
  })

  return router
}
