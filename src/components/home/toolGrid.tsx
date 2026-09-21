import React, { useEffect, useState } from 'react'
import { Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning } from 'lucide-react'

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

/** 天气卡（Windows 11 小组件/锁屏风格：城市+大温度+天气描述+高低温） */
interface ForecastDay {
  date?: string
  tempMax?: number
  tempMin?: number
  description?: string
  icon?: string
}

interface WeatherFull extends WeatherData {
  temp?: number
  feelsLike?: number
  description?: string
  aqi?: number
  city?: string
  admin1?: string
  icon?: string
  forecast?: ForecastDay[]
}

function aqiState(aqi?: number): { text: string; cls: string } {
  if (aqi == null) return { text: '', cls: '' }
  if (aqi <= 100) return { text: aqi <= 50 ? '优' : '良', cls: 'wx-aqi-ok' }
  if (aqi <= 200) return { text: aqi <= 150 ? '轻度' : '中度', cls: 'wx-aqi-mid' }
  return { text: '重度', cls: 'wx-aqi-bad' }
}

/** WMO icon 键 → lucide 图标（Windows Fluent 线性风格） */
function WeatherGlyph({ icon, className }: { icon?: string; className?: string }) {
  const size = 22
  switch (icon) {
    case 'sunny':
      return <Sun size={size} className={className} strokeWidth={1.6} />
    case 'cloudy':
      return <CloudSun size={size} className={className} strokeWidth={1.6} />
    case 'overcast':
      return <Cloud size={size} className={className} strokeWidth={1.6} />
    case 'rain':
      return <CloudRain size={size} className={className} strokeWidth={1.6} />
    case 'snow':
      return <CloudSnow size={size} className={className} strokeWidth={1.6} />
    case 'fog':
      return <CloudFog size={size} className={className} strokeWidth={1.6} />
    case 'thunder':
      return <CloudLightning size={size} className={className} strokeWidth={1.6} />
    default:
      return <Sun size={size} className={className} strokeWidth={1.6} />
  }
}

const WeatherTool: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [w, setW] = useState<WeatherFull | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

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

  const aqi = aqiState(w?.aqi)
  const week = '日一二三四五六'[now.getDay()]
  const month = now.getMonth() + 1
  const day = now.getDate()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const today = w?.forecast?.[0]
  const city = w?.city ?? '北京'
  const desc = w?.description ?? '--'

  return (
    <div
      className="hw-card hw-card-link wx-card"
      onClick={() => onOpen('weather')}
      title="进入天气预报"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">📍 {city} · {month}月{day}日 · 周{week}</span>
        {aqi.cls && (
          <span className={'wx-aqi ' + aqi.cls} title={'AQI ' + (w?.aqi ?? '')}>
            <i className="wx-aqi-dot" />
            <span className="num-mono">{aqi.text} {w?.aqi}</span>
          </span>
        )}
      </div>
      <div className="hw-card-body wx-body">
        {/* Windows 小组件主区：大温度 + 图标/描述 */}
        <div className="wx-win-main">
          <span className="wx-win-temp num-mono">{w?.temp != null ? `${w.temp}°` : '--'}</span>
          <div className="wx-win-right">
            <WeatherGlyph icon={w?.icon} className="wx-win-icon" />
            <span className="wx-win-desc">{desc}</span>
            {w?.feelsLike != null && <span className="wx-win-feel">体感 {w.feelsLike}°</span>}
          </div>
        </div>
        {/* Windows 锁屏式副信息：高低温 + 湿度 */}
        <div className="wx-win-meta">
          <span className="wx-win-meta-item">最高 <b className="num-mono">{today?.tempMax != null ? `${today.tempMax}°` : '--'}</b></span>
          <span className="wx-win-meta-item">最低 <b className="num-mono">{today?.tempMin != null ? `${today.tempMin}°` : '--'}</b></span>
          <span className="wx-win-meta-item">湿度 <b className="num-mono">{w?.humidity != null ? `${w.humidity}%` : '--'}</b></span>
          <span className="wx-win-meta-time num-mono" title="当前时间">{hh}:{mm}</span>
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
