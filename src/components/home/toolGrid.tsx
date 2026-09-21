import React, { useEffect, useState } from 'react'
import WeatherCard, { type TactileSource } from '@/modules/weather/tactile'

interface Hour {
  time: string
  temp: number
  icon?: string
}

interface WeatherData {
  humidity?: number
  windDir?: string
  windScale?: number
  windSpeed?: number
  uvIndex?: number
  hourly?: Hour[]
}

interface CalEvent {
  id?: string
  title?: string
  start?: string
  end?: string
}

function fmtToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** 天气卡（tactile-weather wide-small 成熟卡片） */
interface WeatherFull extends WeatherData {
  temp?: number
  description?: string
  aqi?: number
  city?: string
  icon?: string
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

  const source: TactileSource | null =
    w?.temp != null
      ? {
          temp: w.temp,
          humidity: w.humidity ?? 0,
          windSpeed: w.windSpeed ?? 0,
          icon: w.icon ?? 'sunny',
          forecast: [],
          hourly: w.hourly,
        }
      : null

  const aqi = aqiState(w?.aqi)

  return (
    <div
      className="hw-card hw-card-link wx-card"
      onClick={() => onOpen('weather')}
      title="进入天气预报"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">🌤 天气预报</span>
        {aqi.cls && (
          <span className={'wx-aqi ' + aqi.cls} title={'AQI ' + (w?.aqi ?? '')}>
            <i className="wx-aqi-dot" />
            <span className="num-mono">{aqi.text} {w?.aqi}</span>
          </span>
        )}
      </div>
      <div className="hw-card-body wx-body">
        <WeatherCard source={source} size="wide-small" city={w?.city ?? '北京'} />
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
      className="hw-card hw-card-link"
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

export { WeatherTool, CalendarTool }
