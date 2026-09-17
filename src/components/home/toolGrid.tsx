import React, { useEffect, useState } from 'react'

const WMO_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  overcast: '☁️',
  rain: '🌧️',
  snow: '🌨️',
  fog: '🌫️',
  thunder: '⛈️',
}

interface Hour {
  time?: string
  temp?: number
  icon?: string
}

interface WeatherData {
  humidity?: number
  windDir?: string
  windScale?: number
  uvIndex?: number
  hourly?: Hour[]
}

interface CalEvent {
  id?: string
  title?: string
  start?: string
  end?: string
}

interface TreeNode {
  name?: string
  path?: string
  type?: 'folder' | 'file'
  children?: TreeNode[]
}

interface Bookmark {
  id?: string
  title?: string
  url?: string
}

function fmtToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** 天气卡（小米风格）：大温度 + 指标行 + AQI 圆点 + 逐时条 */
interface WeatherFull extends WeatherData {
  temp?: number
  description?: string
  aqi?: number
  city?: string
}

function aqiState(aqi?: number): { text: string; cls: string } {
  if (aqi == null) return { text: '', cls: '' }
  if (aqi <= 100) return { text: aqi <= 50 ? '优' : '良', cls: 'wx-aqi-ok' }
  if (aqi <= 200) return { text: aqi <= 150 ? '轻度' : '中度', cls: 'wx-aqi-mid' }
  return { text: '重度', cls: 'wx-aqi-bad' }
}

const WeatherTool: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [w, setW] = useState<WeatherFull | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/weather?city=北京')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setW(d as WeatherFull)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const hours = (w?.hourly ?? []).slice(0, 5)
  const icon = WMO_ICONS[w?.hourly?.[0]?.icon ?? ''] ?? '🌤️'
  const aqi = aqiState(w?.aqi)

  return (
    <div
      className="hw-card wx-card"
      onClick={() => onOpen('weather')}
      title="进入天气预报"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">🌤 {w?.city ?? '北京'} · {w?.description ?? '天气'}</span>
        {aqi.cls && (
          <span className={'wx-aqi ' + aqi.cls} title={'AQI ' + (w?.aqi ?? '')}>
            <i className="wx-aqi-dot" />
            <span className="num-mono">{aqi.text} {w?.aqi}</span>
          </span>
        )}
      </div>
      <div className="hw-card-body wx-body">
        <div className="wx-hero">
          <span className="wx-temp">{w?.temp != null ? `${w.temp}°` : '--'}</span>
          <span className="wx-icon">{icon}</span>
        </div>
        <div className="wx-metrics">
          <div className="wx-metric">
            湿度<b>{w?.humidity != null ? `${w.humidity}%` : '--'}</b>
          </div>
          <div className="wx-metric">
            风
            <b>
              {w?.windDir ?? ''}
              {w?.windScale != null ? `${w.windScale}级` : ''}
            </b>
          </div>
          <div className="wx-metric">
            紫外线<b>{w?.uvIndex != null ? `${w.uvIndex}` : '--'}</b>
          </div>
        </div>
        <div className="tg-weather-hourly">
          {hours.map((h, i) => {
            const t = h.time ?? ''
            const label = i === 0 ? '现在' : t.slice(11, 16) || `${i}h`
            return (
              <div key={i} className="tg-hour">
                <span>{label}</span>
                <span className="tg-hour-icon">{WMO_ICONS[h.icon ?? ''] ?? '🌤️'}</span>
                <span className="tg-hour-temp">{h.temp != null ? `${h.temp}°` : '--'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 日程卡：今日事件列表 */
const CalendarTool: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [events, setEvents] = useState<CalEvent[]>([])

  useEffect(() => {
    let cancelled = false
    const today = fmtToday()
    fetch(`/api/calendar/events?start=${today}&end=${today}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setEvents(Array.isArray(d) ? (d as CalEvent[]) : [])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className="hw-card"
      onClick={() => onOpen('calendar')}
      title="进入日程管理"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">📅 日程</span>
      </div>
      <div className="hw-card-body">
        {events.length === 0 ? (
          <div className="tg-empty">今日暂无安排</div>
        ) : (
          <div className="tg-list">
            {events.slice(0, 4).map((e, i) => (
              <div key={e.id ?? i} className="tg-list-item">
                <span className="tg-list-title">🔸 {e.title ?? ''}</span>
                {e.start && <span className="tg-list-time">{e.start.slice(11, 16)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** 知识卡：最近文件 */
const KnowledgeTool: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [files, setFiles] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/knowledge/tree')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((roots) => {
        if (cancelled) return
        const out: string[] = []
        const walk = (nodes: TreeNode[]) => {
          for (const n of nodes ?? []) {
            if (n.type === 'file') out.push(n.name ?? '')
            if (n.children) walk(n.children)
          }
        }
        walk(Array.isArray(roots) ? (roots as TreeNode[]) : [])
        setFiles(out.slice(0, 3))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className="hw-card"
      onClick={() => onOpen('knowledge')}
      title="进入知识库"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">📚 知识</span>
      </div>
      <div className="hw-card-body">
        {files.length === 0 ? (
          <div className="tg-empty">知识库为空</div>
        ) : (
          <div className="tg-list">
            {files.map((f, i) => (
              <div key={i} className="tg-list-item" onClick={() => onOpen('knowledge')}>
                <span className="tg-list-title">📄 {f}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** 书签卡 */
const BookmarksTool: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [items, setItems] = useState<Bookmark[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('mimo-bookmarks')
      const parsed = raw ? JSON.parse(raw) : []
      setItems(Array.isArray(parsed) ? (parsed as Bookmark[]) : [])
    } catch {
      setItems([])
    }
  }, [])

  return (
    <div
      className="hw-card"
      onClick={() => onOpen('bookmarks')}
      title="进入书签启动"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">🔖 书签</span>
      </div>
      <div className="hw-card-body">
        {items.length === 0 ? (
          <div className="tg-empty">暂无收藏</div>
        ) : (
          <div className="tg-list">
            {items.slice(0, 3).map((b, i) => (
              <div key={b.id ?? i} className="tg-list-item" onClick={() => onOpen('bookmarks')}>
                <span className="tg-list-title">🔖 {b.title ?? b.url ?? ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** ④ 效率工具：天气(2) 日程(2) 知识(1) 书签(1) */
const HomeToolGrid: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  return (
    <div className="hw-tools">
      <WeatherTool onOpen={onOpen} />
      <CalendarTool onOpen={onOpen} />
      <KnowledgeTool onOpen={onOpen} />
      <BookmarksTool onOpen={onOpen} />
    </div>
  )
}

export default HomeToolGrid
