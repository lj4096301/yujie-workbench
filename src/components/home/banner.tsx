import React, { useEffect, useState } from 'react'

/** 与天气模块一致的 WMO 图标映射 */
const WMO_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  overcast: '☁️',
  rain: '🌧️',
  snow: '🌨️',
  fog: '🌫️',
  thunder: '⛈️',
}

interface HomeWeather {
  temp?: number
  feelsLike?: number
  description?: string
  icon?: string
  city?: string
  admin1?: string
  aqi?: number
  uvIndex?: number
}

/** ① 欢迎横幅：问候 + 时间日期 | 简天气 */
const HomeBanner: React.FC = () => {

  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<HomeWeather | null>(null)
  const [weatherErr, setWeatherErr] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/weather?city=北京')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) {
          setWeather(d as HomeWeather)
          setWeatherErr(false)
        }
      })
      .catch(() => {
        if (!cancelled) setWeatherErr(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const week = '日一二三四五六'[now.getDay()]
  const dateText = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${week}`
  const hour = now.getHours()
  const greet =
    hour < 6 ? '凌晨好' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className="hw-card hw-banner">
      <div className="hw-banner-left">
        <div className="hw-banner-greet">{greet}，宇界工作台</div>
        <div className="hw-banner-date">{dateText}</div>
      </div>
      <div className="hw-banner-right">
        <div className="hw-banner-clock" title="当前时间">
          <span className="hw-banner-clock-hm">{hh}:{mm}</span>
          <span className="hw-banner-clock-sec">:{ss}</span>
        </div>
        <div className="hw-banner-weather" title="天气">
          {weatherErr ? (
            <span className="hw-banner-wdesc">天气加载失败</span>
          ) : weather ? (
            <>
              <span className="hw-banner-wicon">{WMO_ICONS[weather.icon ?? ''] ?? '🌤️'}</span>
              <span className="hw-banner-temp">
                {weather.temp != null ? `${weather.temp}°` : '--'}
              </span>
              <span className="hw-banner-wdesc">{weather.description ?? ''}</span>
            </>
          ) : (
            <span className="hw-banner-wdesc">--</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default HomeBanner
