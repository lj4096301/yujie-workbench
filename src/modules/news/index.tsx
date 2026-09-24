import React, { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LegacyNewsPanel from './legacy'
import RssPanel from './RssPanel'

/**
 * 资讯精选：直接内嵌成熟的第三方聚合站（科技/AI 方向，经过站点方筛选）。
 *
 * iframe 可用性实测（2026-09-12，响应头无 X-Frame-Options/CSP 即可内嵌）：
 * - NewsNow 科技页：/c/tech 正常响应无反嵌头 ✅（首页 403 是爬虫拦截，与内嵌无关）
 * - AIbase 中文资讯：无反嵌头 ✅
 * - Hacker News 中文（hackernews.betacat.io）：无反嵌限制 ✅
 * - Readhub：无反嵌限制 ✅
 * - 机器之心：SAMEORIGIN ❌ 已排除
 * 另：Electron 主进程对白名单站点移除反嵌响应头，作为兜底保险。
 */
interface NewsSource {
  key: string
  label: string
  url: string
  desc: string
}

const SOURCES: NewsSource[] = [
  {
    key: 'newsnow-tech',
    label: 'NewsNow 科技',
    url: 'https://newsnow.busiyi.world/c/tech',
    desc: '开源聚合（10k+ Star）：GitHub Trending/HN/36kr/IT之家/虎嗅等科技热榜，站内可切分类',
  },
  {
    key: 'aibase',
    label: 'AIbase AI 资讯',
    url: 'https://www.aibase.com/zh/news',
    desc: 'AI 领域垂直聚合：模型发布/产品动态/行业新闻，更新极快',
  },
  {
    key: 'rss',
    label: 'RSS 订阅',
    url: '',
    desc: '10 个精选科技/AI 源，下拉随时切换；标题+摘要，点标题在系统浏览器看全文',
  },
  {
    key: 'hncn',
    label: 'HN 中文精选',
    url: 'https://hackernews.betacat.io/',
    desc: 'Hacker News 首页中文翻译版，技术圈高质量人工筛选',
  },
  {
    key: 'readhub',
    label: 'Readhub',
    url: 'https://readhub.cn/',
    desc: '科技资讯编辑精选，简洁干净',
  },
  {
    key: 'legacy',
    label: '经典列表',
    url: '',
    desc: '自研聚合（保留已读/收藏功能）',
  },
]

const NewsModule: React.FC = () => {
  const [source, setSource] = useState<NewsSource>(SOURCES[0])
  const [loading, setLoading] = useState(true)

  // 切源时重置加载态
  useEffect(() => {
    setLoading(true)
  }, [source])

  return (
    <div className="news-embed-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {/* 工具条：源切换（Tabs）+ 外部打开 */}
      <div
        className="news-toolbar"
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
      >
        <Tabs
          value={source.key}
          onValueChange={(k) => {
            const hit = SOURCES.find((s) => s.key === k)
            if (hit) setSource(hit)
          }}
        >
          <TabsList className="news-tabs-list" style={{ overflowX: 'auto' }}>
            {SOURCES.map((s) => (
              <TabsTrigger key={s.key} value={s.key} className="h-8 px-3">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {source.url && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            title="在系统浏览器/新标签页打开"
            onClick={() => window.open(source.url, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            打开
          </Button>
        )}
      </div>

      {/* 当前源说明 */}
      {source.key !== 'legacy' && source.key !== 'rss' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{source.desc}</div>
      )}

      {/* 内容区 */}
      {source.key === 'legacy' ? (
        <div className="news-embed-legacy" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <LegacyNewsPanel />
        </div>
      ) : source.key === 'rss' ? (
        <div className="news-embed-legacy" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <RssPanel />
        </div>
      ) : (
        <div className="news-embed-frame-wrap" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {loading && (
            <div
              className="news-embed-loading"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                zIndex: 2,
                fontSize: 14,
                color: 'var(--text-muted)',
              }}
            >
              正在加载 {source.label}...
            </div>
          )}
          <iframe
            key={source.key}
            src={source.url}
            title={source.label}
            className="news-embed-frame"
            style={{ width: '100%', height: '100%', border: 'none' }}
            onLoad={() => setLoading(false)}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      )}
    </div>
  )
}

export default NewsModule
