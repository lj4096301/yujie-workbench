import React, { useEffect, useState } from 'react'
import { Card, Progress, Statistic } from '@arco-design/web-react'
import { IconRight } from '@arco-design/web-react/icon'
import WeatherCard, { type TactileSource } from '@/modules/weather/tactile'
import './homecard.css'

interface HomeCardProps {
  moduleId: string
  title: string
  icon: string
  onOpen: (id: string) => void
  onClose: (id: string) => void
}

/** 天气卡片详情数据（来自 /api/weather 完整字段，供 tactile-weather 卡片使用） */
interface WeatherDetail {
  temp?: number
  feelsLike?: number
  humidity?: number
  windSpeed?: number
  windScale?: number
  windDir?: string
  uvIndex?: number | null
  icon?: string
  city?: string
  forecast?: Array<{ date: string; tempMax: number; tempMin: number; icon: string }>
  hourly?: Array<{ time: string; temp: number; icon: string }>
}

/** 卡片数据：各模块取数后转成统一的展示模型 */
interface Summary {
  main?: string | number
  tag?: string
  sub?: string
  list?: Array<{ text: string; time?: string }>
  stats?: Array<{ label: string; value: number; color: string }>
  progress?: number
  icon?: string
  weather?: WeatherDetail
}

/** 低频 / 无摘要数据模块：渲染纯入口卡 */
const ENTRY_ONLY = new Set(['novel', 'epic', 'news', 'tv', 'api-monitor', 'clipboard'])

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** 主数值行：Arco Statistic + 辅助说明（数值样式由 CSS 覆写 .arco-statistic-value） */
const StatRow: React.FC<{ s: Summary }> = ({ s }) => (
  <div className="hc-stat-row">
    <Statistic title={s.tag ?? '摘要'} value={s.main ?? '--'} />
    {s.sub && <span className="hc-stat-sub">{s.sub}</span>}
  </div>
)

/** 看板：Arco Statistic + 三态统计 + Arco Progress */
const KanbanBody: React.FC<{ s: Summary }> = ({ s }) => (
  <div className="hc-body">
    <div className="hc-section">
      <div className="hc-section-title">概览</div>
      <StatRow s={s} />
    </div>
    <div className="hc-section">
      <div className="hc-section-title">状态分布</div>
      <div className="hc-kanban-stats">
        {(s.stats ?? []).map((st) => (
          <div className="hc-kanban-stat" key={st.label}>
            <span className="hc-kanban-stat-value" style={{ color: st.color }}>
              {st.value}
            </span>
            <span className="hc-kanban-stat-label">{st.label}</span>
          </div>
        ))}
      </div>
      <div className="hc-progress">
        <Progress percent={s.progress ?? 0} size="small" status="success" />
        <span className="hc-progress-text">{s.progress ?? 0}%</span>
      </div>
    </div>
  </div>
)

/** 天气卡：tactile-weather wide-small 卡（图标 + 城市 + 大温度，成熟天气卡片设计） */
const WeatherBody: React.FC<{ s: Summary }> = ({ s }) => {
  const w = s.weather
  if (!w || w.temp == null) return <div className="hc-empty">暂无天气数据</div>
  const source: TactileSource = {
    temp: w.temp,
    humidity: w.humidity ?? 0,
    windSpeed: w.windSpeed ?? 0,
    icon: w.icon ?? 'sunny',
    forecast: w.forecast ?? [],
    hourly: w.hourly,
  }
  return (
    <div className="hc-body hc-weather">
      {/* 单个复合部件：内部已含当前 + 预报，仍给小标题说明这块内容是什么 */}
      <div className="hc-section">
        <div className="hc-section-title">今日天气</div>
        <WeatherCard source={source} size="wide-small" city={w.city ?? s.tag ?? '北京'} />
      </div>
    </div>
  )
}

/** 通用列表卡：待办 / 日程 / 书签 / 知识库（Statistic + 列表） */
const ListBody: React.FC<{ s: Summary }> = ({ s }) => (
  <div className="hc-body">
    <div className="hc-section">
      <div className="hc-section-title">概览</div>
      <StatRow s={s} />
    </div>
    <div className="hc-section">
      <div className="hc-section-title">最近条目</div>
      {s.list && s.list.length > 0 ? (
        <ul className="hc-list">
          {s.list.map((it, i) => (
            <li key={i}>
              {it.time && <span className="hc-list-time">{it.time}</span>}
              <span className="hc-list-text">{it.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="hc-empty">暂无内容</div>
      )}
    </div>
  </div>
)

/* ============ 主组件 ============ */

const HomeCard: React.FC<HomeCardProps> = ({ moduleId, title, icon, onOpen, onClose }) => {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let cancelled = false
    const done = (s: Summary | null) => {
      if (!cancelled) setSummary(s)
    }

    if (moduleId === 'kanban') {
      fetch('/api/kanban')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { projects?: unknown[]; cards?: Array<{ status?: string }> }) => {
          if (cancelled) return
          const cards = Array.isArray(d?.cards) ? d.cards : []
          const todo = cards.filter((c) => c.status === 'todo').length
          const doing = cards.filter((c) => c.status === 'doing').length
          const doneN = cards.filter((c) => c.status === 'done').length
          const proj = Array.isArray(d?.projects) ? d.projects.length : 0
          done({
            main: proj,
            tag: '个项目',
            sub: `共 ${cards.length} 张卡片`,
            stats: [
              { label: '待推进', value: todo, color: 'var(--text-muted)' },
              { label: '进行中', value: doing, color: '#ff6700' },
              { label: '已完成', value: doneN, color: '#00b42a' },
            ],
            progress: cards.length ? Math.round((doneN / cards.length) * 100) : 0,
          })
        })
        .catch(() => done(null))
      return
    }

    if (moduleId === 'tasks') {
      try {
        const raw = localStorage.getItem('yujie-tasks') ?? localStorage.getItem('mimo-tasks')
        const parsed = raw ? JSON.parse(raw) : []
        const arr = Array.isArray(parsed) ? parsed : []
        const openItems = arr.filter((t: { done?: boolean }) => !t.done)
        done({
          main: openItems.length,
          tag: '未完成',
          sub: `共 ${arr.length} 项`,
          list: openItems.slice(0, 3).map((t: { text?: string }) => ({
            text: t?.text ?? '待办事项',
          })),
        })
      } catch {
        done(null)
      }
      return
    }

    if (moduleId === 'weather') {
      fetch(`/api/weather?city=${encodeURIComponent('北京')}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: {
          temp?: number
          feelsLike?: number
          description?: string
          icon?: string
          city?: string
          humidity?: number
          windSpeed?: number
          windScale?: number
          windDir?: string
          uvIndex?: number | null
          forecast?: Array<{ date: string; tempMax: number; tempMin: number; icon: string }>
          hourly?: Array<{ time: string; temp: number; icon: string }>
        }) => {
          if (cancelled) return
          done({
            main: d.temp != null ? `${d.temp}°C` : '--',
            tag: d.city ?? '北京',
            sub: `${d.description ?? ''}${d.feelsLike != null ? ` · 体感 ${d.feelsLike}°C` : ''}`,
            weather: {
              temp: d.temp,
              feelsLike: d.feelsLike,
              humidity: d.humidity,
              windSpeed: d.windSpeed,
              windScale: d.windScale,
              windDir: d.windDir,
              uvIndex: d.uvIndex,
              icon: d.icon,
              city: d.city,
              forecast: d.forecast,
              hourly: d.hourly,
            },
          })
        })
        .catch(() => done(null))
      return
    }

    if (moduleId === 'calendar') {
      const today = fmtDate(new Date())
      fetch(`/api/calendar/events?start=${today}&end=${today}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: Array<{ title?: string; start?: string }>) => {
          if (cancelled) return
          const arr = Array.isArray(d) ? d : []
          done({
            main: arr.length,
            tag: '今日日程',
            list: arr.slice(0, 3).map((e) => {
              const t = e?.start
              const time =
                typeof t === 'string' && t.includes('T') ? t.slice(11, 16) : undefined
              return { text: e?.title ?? '日程', time }
            }),
          })
        })
        .catch(() => done(null))
      return
    }

    if (moduleId === 'bookmarks') {
      try {
        const raw = localStorage.getItem('mimo-bookmarks')
        const parsed = raw ? JSON.parse(raw) : []
        const arr = Array.isArray(parsed) ? parsed : []
        done({
          main: arr.length,
          tag: '收藏',
          list: arr.slice(0, 3).map((b: { title?: string; url?: string }) => ({
            text: b?.title ?? b?.url ?? '书签',
          })),
        })
      } catch {
        done(null)
      }
      return
    }

    if (moduleId === 'knowledge') {
      fetch('/api/knowledge/tree')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: Array<{ name?: string; children?: unknown[] }>) => {
          if (cancelled) return
          const roots = Array.isArray(d) ? d : [d as never]
          let count = 0
          const walk = (nodes: Array<{ children?: unknown[] }>) => {
            for (const n of nodes ?? []) {
              count++
              if (n.children) walk(n.children as Array<{ children?: unknown[] }>)
            }
          }
          walk(roots)
          done({
            main: count,
            tag: '知识条目',
            sub: `${roots.length} 个分类`,
            list: roots.slice(0, 2).map((r) => ({ text: r?.name ?? '文档' })),
          })
        })
        .catch(() => done(null))
      return
    }

    done(null)
  }, [moduleId])

  const isEntry = ENTRY_ONLY.has(moduleId)
  const handleOpen = () => onOpen(moduleId)

  let body: React.ReactNode
  if (isEntry || !summary) {
    body = (
      <div className="hc-entry">
        <span className="hc-entry-icon">{icon}</span>
        <span className="hc-entry-text">{title}</span>
        <span
          className="hc-entry-close"
          role="button"
          title="从首页移除"
          onClick={(e) => {
            e.stopPropagation()
            onClose(moduleId)
          }}
        >
          ×
        </span>
      </div>
    )
  } else if (moduleId === 'kanban') {
    body = <KanbanBody s={summary} />
  } else if (moduleId === 'weather') {
    body = <WeatherBody s={summary} />
  } else {
    body = <ListBody s={summary} />
  }

  // 宫格入口卡：无头（无标题栏），整卡可点，hover 显示移除按钮
  if (isEntry) {
    return (
      <Card
        className={'home-card home-card--' + moduleId + ' home-card-entry'}
        hoverable
        bordered
        onClick={handleOpen}
        style={{ height: '100%' }}
      >
        {body}
      </Card>
    )
  }

  return (
    <Card
      className={'home-card home-card--' + moduleId}
      hoverable
      bordered
      title={
        <div className="home-card-head">
          <span className="home-card-icon">{icon}</span>
          <span className="home-card-title">{title}</span>
        </div>
      }
      extra={
        <div className="home-card-extra">
          <span
            className="home-card-open"
            role="button"
            title="进入模块"
            onClick={(e) => {
              e.stopPropagation()
              handleOpen()
            }}
          >
            进入
            <IconRight />
          </span>
          <span
            className="home-card-close"
            role="button"
            title="从首页移除"
            onClick={(e) => {
              e.stopPropagation()
              onClose(moduleId)
            }}
          >
            ×
          </span>
        </div>
      }
      onClick={handleOpen}
      style={{ height: '100%' }}
    >
      {body}
    </Card>
  )
}

export default HomeCard
