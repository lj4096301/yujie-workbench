import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Spin, Empty, Tag, Input, Select, Button, message, Popconfirm } from 'antd'
import { StarOutlined, StarFilled } from '@ant-design/icons'

interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  category: string
  isBookmarked: boolean
  isRead?: boolean
}

const CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'tech', label: '科技' },
  { value: 'ai', label: 'AI' },
  { value: 'finance', label: '财经' },
  { value: 'general', label: '综合' },
]

type ViewMode = 'all' | 'unread' | 'bookmarked'

const LegacyNewsPanel: React.FC = () => {  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<ViewMode>('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  // 已读 / 收藏持久化状态（Feedly 式，按 url 存服务端）
  const [readKeys, setReadKeys] = useState<string[]>([])
  const [bookmarkKeys, setBookmarkKeys] = useState<string[]>([])

  useEffect(() => {
    // 先取本地状态，再拉新闻（合并时后端已做，但本地保留一份用于增量更新）
    ;(async () => {
      try {
        const res = await fetch('/api/news/state')
        if (res.ok) {
          const s = await res.json()
          setReadKeys(s.read || [])
          setBookmarkKeys(s.bookmarks || [])
        }
      } catch {}
    })()
  }, [])

  const fetchNews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      const res = await fetch(`/api/news?${params}`)
      if (res.ok) {
        const data = await res.json()
        setNews(data)
      }
    } catch (err) {
      console.error('获取新闻失败:', err)
    } finally {
      setLoading(false)
    }
  }, [category, searchQuery])

  useEffect(() => {
    fetchNews()
  }, [category, fetchNews])

  /** 持久化状态（乐观更新 + PUT 覆盖） */
  const persistState = useCallback((nextRead: string[], nextBookmarks: string[]) => {
    try {
      fetch('/api/news/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: nextRead, bookmarks: nextBookmarks }),
      })
    } catch {}
  }, [])

  /** 打开新闻 → 标已读（Feedly 行为） */
  const handleOpen = (item: NewsItem) => {
    if (!readKeys.includes(item.url)) {
      const next = [item.url, ...readKeys]
      setReadKeys(next)
      persistState(next, bookmarkKeys)
    }
    if (item.url && item.url !== '#') window.open(item.url, '_blank')
  }

  const toggleBookmark = (item: NewsItem) => {
    const next = bookmarkKeys.includes(item.url)
      ? bookmarkKeys.filter((k) => k !== item.url)
      : [item.url, ...bookmarkKeys]
    setBookmarkKeys(next)
    persistState(readKeys, next)
    message.success(next.includes(item.url) ? '已收藏' : '已取消收藏')
  }

  const markAllRead = () => {
    const next = [...new Set([...readKeys, ...news.map((n) => n.url)])]
    setReadKeys(next)
    persistState(next, bookmarkKeys)
    message.success('已全部标为已读')
  }

  /** 视图 / 来源过滤后的列表 */
  const visibleNews = useMemo(() => {
    let list = news
    if (view === 'unread') list = list.filter((n) => !readKeys.includes(n.url))
    if (view === 'bookmarked') list = list.filter((n) => bookmarkKeys.includes(n.url))
    if (sourceFilter !== 'all') list = list.filter((n) => n.source === sourceFilter)
    return list
  }, [news, view, sourceFilter, readKeys, bookmarkKeys])

  const sources = useMemo(
    () => [...new Set(news.map((n) => n.source))].filter(Boolean),
    [news]
  )

  const unreadCount = useMemo(() => news.filter((n) => !readKeys.includes(n.url)).length, [news, readKeys])

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    return `${days} 天前`
  }

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = { tech: 'blue', ai: 'purple', finance: 'gold', general: 'default' }
    return colors[cat] || 'default'
  }

  return (
    <div>
      {/* 搜索 / 分类 / 刷新 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Input
          size="small"
          prefix="🔍"
          placeholder="搜索新闻..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPressEnter={fetchNews}
          style={{ flex: 1 }}
          allowClear
        />
        <Select
          size="small"
          value={category}
          onChange={setCategory}
          options={CATEGORIES}
          style={{ width: 80 }}
        />
        <Button size="small" icon="🔄" onClick={fetchNews} />
      </div>

      {/* 视图切换 / 来源 / 全部已读 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {([['all', '全部'], ['unread', `未读${unreadCount > 0 ? ` (${unreadCount})` : ''}`], ['bookmarked', '⭐ 收藏']] as Array<[ViewMode, string]>).map(
          ([v, label]) => (
            <Button key={v} size="small" type={view === v ? 'primary' : 'default'} onClick={() => setView(v)}>
              {label}
            </Button>
          )
        )}
        <Select
          size="small"
          value={sourceFilter}
          onChange={setSourceFilter}
          style={{ width: 110, marginLeft: 'auto' }}
          options={[{ value: 'all', label: '全部来源' }, ...sources.map((s) => ({ value: s, label: s }))]}
        />
        {view !== 'bookmarked' && unreadCount > 0 && (
          <Popconfirm title="把当前列表全部标为已读？" onConfirm={markAllRead} okText="确定" cancelText="取消">
            <Button size="small">✓ 全部已读</Button>
          </Popconfirm>
        )}
      </div>

      {/* 新闻列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
      ) : visibleNews.length > 0 ? (
        <div>
          {visibleNews.map((item) => {
            const isRead = readKeys.includes(item.url)
            const isBookmarked = bookmarkKeys.includes(item.url)
            return (
              <div
                key={item.id}
                className="news-item"
                onClick={() => handleOpen(item)}
                style={{ opacity: isRead ? 0.62 : 1 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {/* 未读蓝点（Feedly 式） */}
                    {!isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1677ff', flexShrink: 0 }} />}
                    <span className="news-source">{item.source}</span>
                    <Tag color={getCategoryColor(item.category)} style={{ fontSize: 10, margin: 0 }}>
                      {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                    </Tag>
                  </div>
                  <div className="news-title" style={{ fontWeight: isRead ? 400 : 600 }}>{item.title}</div>
                  {item.summary && (
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4, lineHeight: 1.4 }}>
                      {item.summary.length > 100 ? item.summary.slice(0, 100) + '...' : item.summary}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span className="news-time">{formatTime(item.publishedAt)}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleBookmark(item) }}
                      style={{ cursor: 'pointer', fontSize: 14 }}
                      title={isBookmarked ? '取消收藏' : '收藏'}
                    >
                      {isBookmarked ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined style={{ color: '#ccc' }} />}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty
          description={
            view === 'bookmarked' ? '还没有收藏的新闻' : view === 'unread' ? '没有未读新闻了 🎉' : '暂无新闻'
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  )
}

export default LegacyNewsPanel
