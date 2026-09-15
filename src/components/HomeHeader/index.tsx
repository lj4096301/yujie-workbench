import React, { useEffect, useState } from 'react'

/** 与天气模块一致的 WMO 图标映射 */
const WEATHER_ICONS: Record<string, string> = {
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
}

/**
 * 首页欢迎横幅（Arco Pro 工作台模式）：
 * 左 = 时段问候大标题 + 时间/日期副行；右 = 天气
 */
const HomeHeader: React.FC = () => {
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
    <div className="home-header">
      <div className="home-header-greet-block">
        <div className="home-header-greet-main">
          {greet}，宇界工作台
        </div>
        <div className="home-header-sub">
          <span className="home-header-clock">{hh}:{mm}:{ss}</span>
          <span className="home-header-dot">·</span>
          <span>{dateText}</span>
        </div>
      </div>
      <div className="home-header-weather">
        {weatherErr ? (
          <span className="home-header-weather-fallback">天气加载失败</span>
        ) : weather ? (
          <>
            <span className="home-header-wicon">{WEATHER_ICONS[weather.icon ?? ''] ?? '🌤️'}</span>
            <span className="home-header-temp">
              {weather.temp != null ? `${weather.temp}°C` : '--'}
            </span>
            <span className="home-header-desc">
              {weather.description ?? ''}
              {weather.feelsLike != null ? ` · 体感 ${weather.feelsLike}°C` : ''}
            </span>
            {weather.city && (
              <span className="home-header-city">
                {weather.city}
                {weather.admin1 ? ` · ${weather.admin1}` : ''}
              </span>
            )}
          </>
        ) : (
          <span>--</span>
        )}
      </div>
    </div>
  )
}

export default HomeHeader
