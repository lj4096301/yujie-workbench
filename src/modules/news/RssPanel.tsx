import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

/**
 * RSS 订阅 tab：精选科技/AI 源，源下拉随时切换。
 *
 * 源可用性实测 2026-09-12（全部 200）；知乎官方 RSS 被反爬（空响应）已剔除。
 * rsshub.dicomp.net 为虫部落帖子推荐的公共 RSSHub 实例，
 * 把无官方 RSS 的站（知乎热榜类、AIbase、OpenAI、虎嗅、36氪）转成标准 feed。
 */
interface RssFeed {
  label: string
  url: string
  site: string
  group: 'AI' | '科技'
}

export const RSS_FEEDS: RssFeed[] = [
  { label: '每日AI资讯', url: 'https://rsshub.dicomp.net/ai-bot/daily-ai-news', site: 'ai-bot.cn', group: 'AI' },
  { label: 'AIbase 资讯', url: 'https://rsshub.dicomp.net/aibase/news', site: 'aibase.com', group: 'AI' },
  { label: 'AIbase AI日报', url: 'https://rsshub.dicomp.net/aibase/daily', site: 'aibase.com', group: 'AI' },
  { label: 'OpenAI 新闻', url: 'https://rsshub.dicomp.net/openai/news', site: 'openai.com', group: 'AI' },
  { label: '36氪快讯', url: 'https://rsshub.dicomp.net/36kr/newsflashes', site: '36kr.com', group: '科技' },
  { label: 'IT之家', url: 'https://www.ithome.com/rss/', site: 'ithome.com', group: '科技' },
  { label: '虎嗅资讯', url: 'https://rsshub.dicomp.net/huxiu/article', site: 'huxiu.com', group: '科技' },
  { label: '36氪热榜', url: 'https://rsshub.dicomp.net/36kr/hot-list', site: '36kr.com', group: '科技' },
  { label: '少数派', url: 'https://sspai.com/feed', site: 'sspai.com', group: '科技' },
  { label: '钛媒体', url: 'https://www.tmtpost.com/feed', site: 'tmtpost.com', group: '科技' },
]

interface RssItem {
  title: string
  link: string
  date: string
  summary: string
}

interface FeedData {
  title: string
  items: RssItem[]
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}-${d.getDate()}`
}

const RssPanel: React.FC = () => {
  const [feedUrl, setFeedUrl] = useState(RSS_FEEDS[0].url)
  const [data, setData] = useState<FeedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (url: string) => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch(`/api/rss?url=${encodeURIComponent(url)}`)
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`)
      setData({ title: json.title, items: json.items })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(feedUrl)
  }, [feedUrl, load])

  const current = RSS_FEEDS.find((f) => f.url === feedUrl)

  return (
    <div className="rss-panel">
      {/* 源切换工具条 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <Select value={feedUrl} onValueChange={setFeedUrl}>
          <SelectTrigger className="h-8 min-w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RSS_FEEDS.map((f) => (
              <SelectItem key={f.url} value={f.url} className="text-xs">
                {f.group === 'AI' ? '🤖' : '💻'} {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => load(feedUrl)} disabled={loading} title="重新抓取">
          <RefreshCw className="h-3.5 w-3.5" /> 刷新
        </Button>
        {current && (
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-8 w-8"
            title="打开源站"
            onClick={() => window.open('https://' + current.site, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {loading && !data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rss-item">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-1 h-3 w-1/4" />
              <Skeleton className="mt-1.5 h-3 w-full" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--danger, #f53f3f)', fontSize: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          抓取失败：{error}
          <Button size="sm" variant="outline" onClick={() => load(feedUrl)}>
            重试
          </Button>
        </div>
      )}

      {data && !loading && (
        <div className="rss-list">
          {data.items.map((item, i) => (
            <div key={i} className="rss-item">
              <a
                className="rss-item-title"
                href={item.link}
                target="_blank"
                rel="noreferrer"
                title="在系统浏览器打开全文"
              >
                {item.title}
              </a>
              <div className="rss-item-meta">
                {item.date && <span>{formatDate(item.date)}</span>}
              </div>
              {item.summary && <div className="rss-item-summary">{item.summary}</div>}
            </div>
          ))}
          {data.items.length === 0 && (
            <div style={{ color: 'var(--text-muted, #86909c)', fontSize: 12, padding: 16, textAlign: 'center' }}>
              该源暂无内容
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RssPanel
