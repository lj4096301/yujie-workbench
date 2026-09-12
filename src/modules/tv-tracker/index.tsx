import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Spin, Empty, Tag, Button, Modal, Form, Input, InputNumber, Rate, Select, Popconfirm, Progress, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

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
  watching: { label: '追剧中', color: 'blue', icon: '▶️' },
  completed: { label: '已看完', color: 'green', icon: '✅' },
  dropped: { label: '已弃剧', color: 'default', icon: '⏸️' },
  plan: { label: '想看', color: 'orange', icon: '🔖' },
} as const

type StatusKey = keyof typeof STATUS_MAP

const QUICK_STATUS: StatusKey[] = ['plan', 'watching', 'completed', 'dropped']

const TVTrackerModule: React.FC = () => {
  const [shows, setShows] = useState<TVShow[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'added' | 'title' | 'progress' | 'nextAir'>('added')
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<TVShow | null>(null)
  const [form] = Form.useForm()

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
  const handleSubmit = async (values: any) => {
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
    form.resetFields()
  }

  const openEdit = (show: TVShow) => {
    setEditing(show)
    form.setFieldsValue({
      ...show,
      nextAirDate: show.nextAirDate ? show.nextAirDate.slice(0, 10) : undefined,
    })
    setModalVisible(true)
  }

  const openAdd = () => {
    setEditing(null)
    form.resetFields()
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
    return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
  }

  return (
    <div>
      {/* 统计栏 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', fontSize: 12, color: '#666', background: '#fafafa', borderRadius: 8, padding: '8px 12px' }}>
        <span>📺 共 {shows.length} 部</span>
        <span>▶️ 追剧中 {stats.watching}</span>
        <span>🔖 想看 {stats.plan}</span>
        <span>✅ 已看完 {stats.completed}</span>
        {stats.upcoming > 0 && <span style={{ color: '#1677ff' }}>🔔 7 天内更新 {stats.upcoming} 部</span>}
      </div>

      {/* 筛选 / 排序 / 添加 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'watching', 'plan', 'completed', 'dropped'].map((f) => (
          <Button
            key={f}
            size="small"
            type={filter === f ? 'primary' : 'default'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '全部' : STATUS_MAP[f as StatusKey]?.label}
          </Button>
        ))}
        <Select
          size="small"
          value={sortBy}
          onChange={setSortBy}
          style={{ width: 110 }}
          options={[
            { value: 'added', label: '按添加时间' },
            { value: 'title', label: '按剧名' },
            { value: 'progress', label: '按进度' },
            { value: 'nextAir', label: '按更新日' },
          ]}
        />
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openAdd} style={{ marginLeft: 'auto' }}>
          追剧
        </Button>
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
                  <div className="show-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: '#f0f5ff' }}>
                    📺
                  </div>
                )}
                <div className="show-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span className="show-title">{show.title}</span>
                    <Tag color={status.color} style={{ fontSize: 10 }}>
                      {status.icon} {status.label}
                    </Tag>
                    {/* 状态快捷切换（不进编辑弹窗也能改） */}
                    <Select
                      size="small"
                      variant="borderless"
                      value={show.status}
                      onChange={(v) => patchShow(show.id, { status: v })}
                      style={{ fontSize: 11, minWidth: 76 }}
                      options={QUICK_STATUS.map((k) => ({ value: k, label: STATUS_MAP[k].label }))}
                    />
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(show)} title="编辑" />
                      <Popconfirm title="确定删除这部剧？" onConfirm={() => handleDelete(show.id)} okText="删除" cancelText="取消">
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} title="删除" />
                      </Popconfirm>
                    </span>
                  </div>
                  {show.platform && (
                    <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{show.platform}</div>
                  )}
                  <div className="show-progress">
                    进度：{show.watchedEpisodes} / {show.totalEpisodes || '?'} 集
                    {show.totalEpisodes > 0 && (
                      <span style={{ marginLeft: 8, color: '#999' }}>({progress}%)</span>
                    )}
                  </div>
                  {show.totalEpisodes > 0 ? (
                    <Progress percent={progress} size="small" showInfo={false} strokeColor={show.status === 'completed' ? '#52c41a' : '#1677ff'} style={{ marginTop: 4, marginBottom: 0 }} />
                  ) : null}
                  {/* 操作按钮 */}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Button size="small" type={show.status === 'dropped' ? 'default' : 'primary'} ghost={show.status === 'watching'} onClick={() => updateProgress(show, 1)}>+1 集</Button>
                    <Button size="small" onClick={() => updateProgress(show, -1)}>-1 集</Button>
                    <Rate
                      value={show.rating || 0}
                      onChange={(v) => patchShow(show.id, { rating: v })}
                      style={{ fontSize: 12, marginLeft: 4 }}
                      tooltips={['1', '2', '3', '4', '5']}
                    />
                  </div>
                  {show.notes && (
                    <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>{show.notes}</div>
                  )}
                  {show.nextAirDate && (
                    <div style={{ fontSize: 11, color: '#1677ff', marginTop: 4 }}>
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
        <Empty description="还没有追剧记录" />
      )}

      {/* 观看历史 */}
      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 6, fontWeight: 600 }}>🕐 最近观看</div>
          <div style={{ fontSize: 11, color: '#666', background: '#fafafa', borderRadius: 8, padding: '8px 12px' }}>
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
      <Modal
        title={editing ? '✏️ 编辑剧集' : '📺 添加追剧'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditing(null); form.resetFields() }}
        footer={null}
        width={400}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="title" label="剧名" rules={[{ required: true }]}>
            <Input placeholder="剧集名称" />
          </Form.Item>
          <Form.Item name="platform" label="平台">
            <Input placeholder="观看平台（爱奇艺、Netflix 等）" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="totalEpisodes" label="总集数" style={{ flex: 1 }}>
              <InputNumber placeholder="0 = 未定" min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="watchedEpisodes" label="已看" style={{ flex: 1 }}>
              <InputNumber placeholder="0" min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="status" label="状态" initialValue="plan">
            <Select
              options={QUICK_STATUS.map((k) => ({ value: k, label: STATUS_MAP[k].label }))}
            />
          </Form.Item>
          <Form.Item name="nextAirDate" label="下次更新日期">
            <Input type="date" placeholder="选填" />
          </Form.Item>
          <Form.Item name="rating" label="评分">
            <Rate allowHalf />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="观剧感想..." autoSize={{ minRows: 2 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>{editing ? '保存' : '添加'}</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TVTrackerModule
