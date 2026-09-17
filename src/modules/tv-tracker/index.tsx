import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Rate, message } from 'antd'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface TVShow {
  id: string
  title: string
  poster: string
  totalEpisodes: number
  watchedEpisodes: number
  status: 'watching' | 'completed' | 'dropped' | 'plan'
  rating?: number
  notes: string
  nextAirDate?: string
  platform: string
}

interface HistoryItem {
  showId: string
  title: string
  episode: number
  action: 'watch' | 'unwatch'
  at: string
}

const STATUS_MAP = {
  watching: { label: '追剧中', color: '#ff6700', icon: '▶️' },
  completed: { label: '已看完', color: '#00b42a', icon: '✅' },
  dropped: { label: '已弃剧', color: '#c9cdd4', icon: '⏸️' },
  plan: { label: '想看', color: '#ff7d00', icon: '🔖' },
} as const

type StatusKey = keyof typeof STATUS_MAP

const QUICK_STATUS: StatusKey[] = ['plan', 'watching', 'completed', 'dropped']

const StatusDot = ({ color, text }: { color: string; text: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary, #4e5969)' }}>
    <i style={{ width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 0 4px ${color}1f` }} />
    {text}
  </span>
)

const TVTrackerModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [shows, setShows] = useState<TVShow[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'added' | 'title' | 'progress' | 'nextAir'>('added')
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<TVShow | null>(null)
  const [delTarget, setDelTarget] = useState<TVShow | null>(null)
  const [formData, setFormData] = useState({
    title: '', platform: '', totalEpisodes: 0, watchedEpisodes: 0,
    status: 'plan' as StatusKey, nextAirDate: '', rating: 0, notes: '',
  })
  const resetForm = () => setFormData({
    title: '', platform: '', totalEpisodes: 0, watchedEpisodes: 0,
    status: 'plan' as StatusKey, nextAirDate: '', rating: 0, notes: '',
  })

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const [resShows, resHistory] = await Promise.all([
          fetch('/api/tv/shows'),
          fetch('/api/tv/history'),
        ])
        if (resShows.ok) setShows(await resShows.json())
        if (resHistory.ok) setHistory(await resHistory.json())
      } catch {} finally {
        setLoading(false)
      }
    })()
  }, [])

  /** 更新单部剧（乐观更新 + 落盘） */
  const patchShow = useCallback(async (id: string, patch: Partial<TVShow>) => {
    setShows((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    try {
      await fetch(`/api/tv/shows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } catch {}
  }, [])

  /** 追剧进度 +1/-1（修复：总集数为 0 时允许自由累加；自动落盘 + 记历史） */
  const updateProgress = useCallback(async (show: TVShow, delta: number) => {
    const cap = show.totalEpisodes > 0 ? show.totalEpisodes : Number.MAX_SAFE_INTEGER
    const newEp = Math.max(0, Math.min(cap, show.watchedEpisodes + delta))
    if (newEp === show.watchedEpisodes) return
    let newStatus: TVShow['status'] = show.status
    if (show.totalEpisodes > 0 && newEp >= show.totalEpisodes) newStatus = 'completed'
    else if (show.status === 'completed' && newEp < show.totalEpisodes) newStatus = 'watching'
    else if (show.status === 'plan') newStatus = 'watching'
    await patchShow(show.id, { watchedEpisodes: newEp, status: newStatus })
    // 写入观看历史
    const item: HistoryItem = {
      showId: show.id,
      title: show.title,
      episode: delta > 0 ? newEp : show.watchedEpisodes,
      action: delta > 0 ? 'watch' : 'unwatch',
      at: new Date().toISOString(),
    }
    setHistory((prev) => [item, ...prev].slice(0, 200))
    try {
      await fetch('/api/tv/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
    } catch {}
  }, [patchShow])

  const handleDelete = useCallback(async (id: string) => {
    setShows((prev) => prev.filter((s) => s.id !== id))
    setHistory((prev) => prev.filter((h) => h.showId !== id))
    try {
      await fetch(`/api/tv/shows/${id}`, { method: 'DELETE' })
    } catch {}
    message.success('已删除')
  }, [])

  /** 新建 / 编辑共用提交 */
  const handleSubmit = async () => {
    const values = formData
    if (!values.title.trim()) return
    if (editing) {
      await patchShow(editing.id, {
        title: values.title,
        platform: values.platform || '',
        totalEpisodes: values.totalEpisodes || 0,
        watchedEpisodes: values.watchedEpisodes || 0,
        status: values.status,
        rating: values.rating,
        notes: values.notes || '',
        nextAirDate: values.nextAirDate ? String(values.nextAirDate) : undefined,
      })
      message.success('已保存')
    } else {
      const show: TVShow = {
        id: Date.now().toString(),
        title: values.title,
        poster: '',
        totalEpisodes: values.totalEpisodes || 0,
        watchedEpisodes: values.watchedEpisodes || 0,
        status: values.status || 'plan',
        rating: values.rating,
        notes: values.notes || '',
        platform: values.platform || '',
      }
      setShows((prev) => [show, ...prev])
      try {
        await fetch('/api/tv/shows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(show),
        })
      } catch {}
      message.success('已添加')
    }
    setModalVisible(false)
    setEditing(null)
    resetForm()
  }

  const openEdit = (show: TVShow) => {
    setEditing(show)
    setFormData({
      title: show.title,
      platform: show.platform || '',
      totalEpisodes: show.totalEpisodes || 0,
      watchedEpisodes: show.watchedEpisodes || 0,
      status: show.status,
      nextAirDate: show.nextAirDate ? show.nextAirDate.slice(0, 10) : '',
      rating: show.rating || 0,
      notes: show.notes || '',
    })
    setModalVisible(true)
  }

  const openAdd = () => {
    setEditing(null)
    resetForm()
    setModalVisible(true)
  }

  const filteredShows = useMemo(() => {
    let list = filter === 'all' ? [...shows] : shows.filter((s) => s.status === filter)
    if (sortBy === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
    else if (sortBy === 'progress') list.sort((a, b) => (b.totalEpisodes ? b.watchedEpisodes / b.totalEpisodes : 0) - (a.totalEpisodes ? a.watchedEpisodes / a.totalEpisodes : 0))
    else if (sortBy === 'nextAir') list.sort((a, b) => (a.nextAirDate ? +new Date(a.nextAirDate) : Infinity) - (b.nextAirDate ? +new Date(b.nextAirDate) : Infinity))
    return list
  }, [shows, filter, sortBy])

  /** 统计栏（对标 SeriesGuide 顶部概览） */
  const stats = useMemo(() => {
    const watching = shows.filter((s) => s.status === 'watching').length
    const plan = shows.filter((s) => s.status === 'plan').length
    const completed = shows.filter((s) => s.status === 'completed').length
    const week = Date.now() + 7 * 86400000
    const upcoming = shows.filter((s) => s.nextAirDate && +new Date(s.nextAirDate) <= week).length
    return { watching, plan, completed, upcoming }
  }, [shows])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="show-card">
            <Skeleton className="h-[120px] w-[84px] shrink-0 rounded-md" />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const headerActions = actionsHost
    ? createPortal(
        <div className="tv-header-actions">
          {['all', 'watching', 'plan', 'completed', 'dropped'].map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : STATUS_MAP[f as StatusKey]?.label}
            </Button>
          ))}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'added' | 'title' | 'progress' | 'nextAir')}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="added" className="text-xs">按添加时间</SelectItem>
              <SelectItem value="title" className="text-xs">按剧名</SelectItem>
              <SelectItem value="progress" className="text-xs">按进度</SelectItem>
              <SelectItem value="nextAir" className="text-xs">按更新日</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> 追剧
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0 }}>
      {headerActions}
      {/* 统计栏 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary, #4e5969)', background: 'var(--bg-subtle, #f7f8fa)', borderRadius: 8, padding: '8px 12px' }}>
        <span>📺 共 {shows.length} 部</span>
        <span>▶️ 追剧中 {stats.watching}</span>
        <span>🔖 想看 {stats.plan}</span>
        <span>✅ 已看完 {stats.completed}</span>
        {stats.upcoming > 0 && <span style={{ color: 'var(--primary-color, #ff6700)' }}>🔔 7 天内更新 {stats.upcoming} 部</span>}
      </div>
      {/* 剧集列表 */}
      {filteredShows.length > 0 ? (
        <div>
          {filteredShows.map((show) => {
            const status = STATUS_MAP[show.status]
            const progress = show.totalEpisodes > 0
              ? Math.round((show.watchedEpisodes / show.totalEpisodes) * 100)
              : 0
            return (
              <div key={show.id} className="show-card">
                {show.poster ? (
                  <img src={show.poster} alt={show.title} className="show-poster" />
                ) : (
                  <div className="show-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: 'var(--bg-subtle, #f7f8fa)' }}>
                    📺
                  </div>
                )}
                <div className="show-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span className="show-title">{show.title}</span>
                    <StatusDot color={status.color} text={status.icon + ' ' + status.label} />
                    {/* 状态快捷切换（不进编辑弹窗也能改） */}
                    <Select value={show.status} onValueChange={(v) => patchShow(show.id, { status: v as StatusKey })}>
                      <SelectTrigger className="h-7 w-[76px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUICK_STATUS.map((k) => (
                          <SelectItem key={k} value={k} className="text-xs">{STATUS_MAP[k].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(show)} title="编辑">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-[#F53F3F]" onClick={() => setDelTarget(show)} title="删除">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                  {show.platform && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #86909c)', marginBottom: 4 }}>{show.platform}</div>
                  )}
                  <div className="show-progress">
                    进度：{show.watchedEpisodes} / {show.totalEpisodes || '?'} 集
                    {show.totalEpisodes > 0 && (
                      <span style={{ marginLeft: 8, color: 'var(--text-muted, #86909c)' }}>({progress}%)</span>
                    )}
                  </div>
                  {show.totalEpisodes > 0 && (
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-subtle, #f7f8fa)', overflow: 'hidden', marginTop: 4 }}>
                      <div style={{ height: '100%', width: Math.min(100, progress) + '%', background: show.status === 'completed' ? 'var(--success, #00b42a)' : 'var(--primary-color, #ff6700)', transition: 'width 0.2s ease' }} />
                    </div>
                  )}
                  {/* 操作按钮 */}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Button size="sm" variant={show.status === 'watching' ? 'default' : 'outline'} onClick={() => updateProgress(show, 1)}>+1 集</Button>
                    <Button size="sm" variant="outline" onClick={() => updateProgress(show, -1)}>-1 集</Button>
                    <Rate
                      value={show.rating || 0}
                      onChange={(v) => patchShow(show.id, { rating: v })}
                      style={{ fontSize: 12, marginLeft: 4 }}
                      tooltips={['1', '2', '3', '4', '5']}
                    />
                  </div>
                  {show.notes && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #4e5969)', marginTop: 6 }}>{show.notes}</div>
                  )}
                  {show.nextAirDate && (
                    <div style={{ fontSize: 11, color: 'var(--primary-color, #ff6700)', marginTop: 4 }}>
                      下次更新：{new Date(show.nextAirDate).toLocaleDateString('zh-CN')}
                      {+new Date(show.nextAirDate) <= Date.now() + 7 * 86400000 && ' 🔔'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mod-empty">还没有追剧记录</div>
      )}

      {/* 观看历史 */}
      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #86909c)', marginBottom: 6, fontWeight: 600 }}>🕐 最近观看</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #4e5969)', background: 'var(--bg-subtle, #f7f8fa)', borderRadius: 8, padding: '8px 12px' }}>
            {history.slice(0, 8).map((h, i) => (
              <div key={i} style={{ padding: '2px 0' }}>
                {new Date(h.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}
                <b>{h.title}</b>
                {' '}
                {h.action === 'watch' ? `看到第 ${h.episode} 集` : `回退（曾看到第 ${h.episode} 集）`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 添加 / 编辑弹窗 */}
      <Dialog open={modalVisible} onOpenChange={(o) => { if (!o) { setModalVisible(false); setEditing(null); resetForm() } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editing ? '✏️ 编辑剧集' : '📺 添加追剧'}</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">剧名</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="剧集名称" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">平台</Label>
              <Input value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value })} placeholder="观看平台（爱奇艺、Netflix 等）" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Label className="mb-1 block text-xs font-medium text-[#4E5969]">总集数（0=未定）</Label>
                <Input type="number" min={0} value={String(formData.totalEpisodes)} onChange={(e) => setFormData({ ...formData, totalEpisodes: Number(e.target.value) || 0 })} />
              </div>
              <div style={{ flex: 1 }}>
                <Label className="mb-1 block text-xs font-medium text-[#4E5969]">已看</Label>
                <Input type="number" min={0} value={String(formData.watchedEpisodes)} onChange={(e) => setFormData({ ...formData, watchedEpisodes: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">状态</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as StatusKey })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUICK_STATUS.map((k) => (
                    <SelectItem key={k} value={k}>{STATUS_MAP[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">下次更新日期</Label>
              <Input type="date" value={formData.nextAirDate} onChange={(e) => setFormData({ ...formData, nextAirDate: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">评分</Label>
              <Rate allowHalf value={formData.rating} onChange={(v) => setFormData({ ...formData, rating: v || 0 })} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">备注</Label>
              <Textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="观剧感想..." />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setModalVisible(false); setEditing(null); resetForm() }}>取消</Button>
            <Button onClick={handleSubmit}>{editing ? '保存' : '添加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除二次确认 */}
      <ConfirmDialog
        open={!!delTarget}
        title="删除剧集"
        content={delTarget ? '确定删除「' + delTarget.title + '」吗？删除后无法恢复。' : ''}
        danger
        okText="删除"
        onOk={async () => { if (delTarget) await handleDelete(delTarget.id) }}
        onOpenChange={(o) => { if (!o) setDelTarget(null) }}
      />
    </div>
  )
}

export default TVTrackerModule
