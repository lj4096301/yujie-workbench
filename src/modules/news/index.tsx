import React, { useEffect, useState } from 'react'
import { Button, Spin } from 'antd'
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
    <div className="news-embed-root">
      {/* 源切换工具条 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {SOURCES.map((s) => (
          <Button
            key={s.key}
            size="small"
            type={source.key === s.key ? 'primary' : 'default'}
            onClick={() => setSource(s)}
          >
            {s.label}
          </Button>
        ))}
        {source.url && (
          <Button
            size="small"
            icon="↗"
            style={{ marginLeft: 'auto' }}
            title="在系统浏览器/新标签页打开"
            onClick={() => window.open(source.url, '_blank')}
          />
        )}
      </div>

      {/* 当前源说明 */}
      {source.key !== 'legacy' && source.key !== 'rss' && (
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{source.desc}</div>
      )}

      {/* 内容区 */}
      {source.key === 'legacy' ? (
        <div className="news-embed-legacy">
          <LegacyNewsPanel />
        </div>
      ) : source.key === 'rss' ? (
        <div className="news-embed-legacy">
          <RssPanel />
        </div>
      ) : (
        <div className="news-embed-frame-wrap">
          {loading && (
            <div className="news-embed-loading">
              <Spin tip={`正在加载 ${source.label}...`} />
            </div>
          )}
          <iframe
            key={source.key}
            src={source.url}
            title={source.label}
            className="news-embed-frame"
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
