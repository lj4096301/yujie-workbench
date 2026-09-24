import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Input, Spin } from 'antd'
import { useLayoutStore } from '@/stores/layoutStore'
import { getMainAreaBounds } from '@/utils/layoutBounds'

interface SearchResult {
  id: string
  title: string
  source: string
  module: string
  snippet?: string
  /** 附加动作载荷（如知识库路径、小说章节 id），存 sessionStorage 供目标模块接力 */
  payload?: Record<string, string>
}

const MODULE_META: Record<string, { label: string; color: string; icon: string }> = {
  knowledge: { label: '知识库', color: 'blue', icon: '📚' },
  novel: { label: '小说', color: 'purple', icon: '✍️' },
  'tv': { label: '追剧', color: 'cyan', icon: '📺' },
  news: { label: '新闻', color: 'orange', icon: '📰' },
}

/** 搜索时高亮关键词 */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#ffe58f', padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

/** 带超时的 fetch */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

/** 各来源搜索器 */
const searchers: Array<(q: string) => Promise<SearchResult[]>> = [
  // 知识库：服务端全文搜索（带摘要）
  async (q) => {
    const res = await fetchWithTimeout(`/api/knowledge/search?q=${encodeURIComponent(q)}`, 5000)
    if (!res.ok) return []
    const data = await res.json()
    return data.slice(0, 6).map((d: any): SearchResult => ({
      id: `kb-${d.path}`,
      title: d.name,
      source: '知识库',
      module: 'knowledge',
      snippet: d.snippet,
      payload: { path: d.path },
    }))
  },
  // 小说：标题/正文/人物/灵感/世界观
  async (q) => {
    const res = await fetchWithTimeout('/api/novel/data', 4000)
    if (!res.ok) return []
    const d = await res.json()
    const ql = q.toLowerCase()
    const out: SearchResult[] = []
    for (const ch of d.chapters || []) {
      if (out.length >= 4) break
      const idx = (ch.content || '').toLowerCase().indexOf(ql)
      if ((ch.title || '').toLowerCase().includes(ql) || idx !== -1) {
        out.push({
          id: `nv-ch-${ch.id}`,
          title: ch.title || '未命名章节',
          source: '小说',
          module: 'novel',
          snippet: idx !== -1 ? (ch.content || '').slice(Math.max(0, idx - 15), idx + 45) : '章节标题匹配',
          payload: { chapterId: ch.id },
        })
      }
    }
    for (const c of d.characters || []) {
      if (out.length >= 6) break
      if ((c.name || '').toLowerCase().includes(ql) || (c.description || '').toLowerCase().includes(ql)) {
        out.push({ id: `nv-char-${c.id}`, title: `人物：${c.name}`, source: '小说', module: 'novel', snippet: c.description || '', payload: { characterId: c.id } })
      }
    }
    for (const n of d.notes || []) {
      if (out.length >= 6) break
      if ((n.content || '').toLowerCase().includes(ql)) {
        out.push({ id: `nv-note-${n.id}`, title: '灵感速记', source: '小说', module: 'novel', snippet: (n.content || '').slice(0, 60) })
      }
    }
    for (const w of d.worldDocs || []) {
      if (out.length >= 6) break
      if ((w.title || '').toLowerCase().includes(ql) || (w.content || '').toLowerCase().includes(ql)) {
        out.push({ id: `nv-world-${w.id}`, title: `设定：${w.title}`, source: '小说', module: 'novel', snippet: (w.content || '').slice(0, 60), payload: { worldId: w.id } })
      }
    }
    return out
  },
  // 追剧：剧名/平台/备注
  async (q) => {
    const res = await fetchWithTimeout('/api/tv/shows', 4000)
    if (!res.ok) return []
    const data = await res.json()
    const ql = q.toLowerCase()
    return data
      .filter((s: any) =>
        (s.title || '').toLowerCase().includes(ql) ||
        (s.platform || '').toLowerCase().includes(ql) ||
        (s.notes || '').toLowerCase().includes(ql)
      )
      .slice(0, 4)
      .map((s: any): SearchResult => ({
        id: `tv-${s.id}`,
        title: s.title,
        source: '追剧',
        module: 'tv',
        snippet: `进度 ${s.watchedEpisodes}/${s.totalEpisodes || '?'} · ${s.platform || '未知平台'}`,
      }))
  },
  // 新闻：标题/摘要（RSS 实时抓取，限 4 秒，超时静默放弃）
  async (q) => {
    const res = await fetchWithTimeout(`/api/news?q=${encodeURIComponent(q)}`, 4000)
    if (!res.ok) return []
    const data = await res.json()
    const items = Array.isArray(data) ? data : data.items || []
    return items.slice(0, 4).map((n: any, i: number): SearchResult => ({
      id: `nw-${i}-${n.link || n.title}`,
      title: n.title,
      source: '新闻',
      module: 'news',
      snippet: (n.summary || '').slice(0, 60),
    }))
  },
]

const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  // 同步镜像 activeIdx：连续快速按键时（事件间未重渲染）Enter 也能取到最新下标
  const activeRef = useRef(0)
  const setActive = useCallback((i: number) => {
    activeRef.current = i
    setActiveIdx(i)
  }, [])
  const inputRef = useRef<any>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const setSearchVisible = useLayoutStore((s) => s.setSearchVisible)
  const activateModule = useLayoutStore((s) => s.activateModule)
  const saveLayout = useLayoutStore((s) => s.saveLayout)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 防抖并行搜索（300ms）
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const settled = await Promise.allSettled(searchers.map((s) => s(q)))
      // 按来源顺序合并，失败的来源静默跳过
      const merged: SearchResult[] = []
      for (const r of settled) {
        if (r.status === 'fulfilled') merged.push(...r.value)
      }
      setResults(merged)
      setActive(0)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, setActive])

  const handleSelect = useCallback((result: SearchResult | undefined) => {
    if (!result) return
    // 接力打开具体条目：
    // 1) sessionStorage 供"模块尚未挂载"时挂载后读取
    // 2) CustomEvent 供"模块已挂载"时立即响应（此时不会再触发 mount 逻辑）
    if (result.payload) {
      for (const [k, v] of Object.entries(result.payload)) {
        sessionStorage.setItem(`mimo-open-${k}`, v)
      }
    }
    // 与侧栏点击保持一致：独占显示该模块并铺满主内容区
    activateModule(result.module, getMainAreaBounds())
    saveLayout()
    if (result.module === 'knowledge' && result.payload?.path) {
      window.dispatchEvent(new CustomEvent('mimo:open-kb', { detail: { path: result.payload.path } }))
    } else if (result.module === 'novel' && result.payload) {
      window.dispatchEvent(new CustomEvent('mimo:open-novel', { detail: result.payload }))
    }
    setSearchVisible(false)
  }, [activateModule, saveLayout, setSearchVisible])

  // 键盘导航（下标走 ref，防连续按键时批处理取旧值）
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(Math.min(activeRef.current + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max(activeRef.current - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(results[activeRef.current])
    } else if (e.key === 'Escape') {
      setSearchVisible(false)
    }
  }

  // 激活项滚动到可见区
  useEffect(() => {
    const el = listRef.current?.querySelector('.gs-item-active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('global-search-overlay')) {
      setSearchVisible(false)
    }
  }

  return (
    <div className="global-search-overlay" onClick={handleOverlayClick}>
      <div className="global-search-box">
        <div style={{ padding: '16px 16px 0' }}>
          <Input
            ref={inputRef}
            size="large"
            prefix="🔍"
            placeholder="搜索笔记、小说、剧集、新闻..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            allowClear
          />
        </div>
        <div ref={listRef} style={{ padding: '12px 16px 16px', maxHeight: 420, overflow: 'auto' }}>
          {searching && results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : results.length > 0 ? (
            results.map((item, i) => {
              const meta = MODULE_META[item.module] || { label: item.source, color: 'default', icon: '•' }
              return (
                <div
                  key={item.id}
                  className={`gs-item${i === activeIdx ? ' gs-item-active' : ''}`}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: i === activeIdx ? '#f0f5ff' : 'transparent',
                  }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => handleSelect(item)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12 }}>{meta.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Highlight text={item.title} query={query.trim()} />
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 4, padding: '1px 6px' }}>{meta.label}</span>
                  </div>
                  {item.snippet && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, paddingLeft: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Highlight text={item.snippet} query={query.trim()} />
                    </div>
                  )}
                </div>
              )
            })
          ) : query.trim().length >= 2 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
              未找到相关结果
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
              输入至少 2 个字符开始搜索（笔记 · 小说 · 剧集 · 新闻）
            </div>
          )}
        </div>
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}>
          <span>↑↓ 导航 · Enter 打开 · Esc 关闭</span>
          <span>Ctrl+K 切换搜索</span>
        </div>
      </div>
    </div>
  )
}

export default GlobalSearch
