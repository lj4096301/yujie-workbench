import React, { useEffect, useState } from 'react'
import { Checkbox, Dropdown } from '@arco-design/web-react'
import { IconApps } from '@arco-design/web-react/icon'
import { useLayoutStore, MODULE_ORDER } from '@/stores/layoutStore'
import { Button } from '@/components/ui/button'
import { MODULE_META } from '@/modules/registry'

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

function aqiClass(aqi?: number): string {
  if (aqi == null) return ''
  if (aqi <= 100) return 'hw-banner-aqi-ok'
  if (aqi <= 200) return 'hw-banner-aqi-mid'
  return 'hw-banner-aqi-bad'
}

/** ① 欢迎横幅：问候 + 时间日期 | 天气 hero + AQI | 模块管理 */
const HomeBanner: React.FC = () => {
  const panels = useLayoutStore((s) => s.panels)
  const togglePanelAt = useLayoutStore((s) => s.togglePanelAt)
  const resetHomeLayout = useLayoutStore((s) => s.resetHomeLayout)

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

  const metaById = new Map(MODULE_META.map((m) => [m.id, m]))

  const moduleDropdown = (
    <div className="hw-module-panel">
      <div className="hw-module-head">首页显示模块</div>
      {MODULE_ORDER.map((id) => {
        const mod = metaById.get(id)
        const panel = panels.find((p) => p.id === id)
        const on = !!panel?.isVisible
        return (
          <div
            key={id}
            className={'hw-module-item' + (on ? ' hw-module-item-on' : '')}
            onClick={() => togglePanelAt(id)}
          >
            <Checkbox checked={on} style={{ pointerEvents: 'none' }} />
            <span className="hw-module-icon">{mod?.icon}</span>
            <span>{mod?.title}</span>
          </div>
        )
      })}
      <div className="hw-module-reset" onClick={resetHomeLayout}>
        恢复默认布局
      </div>
    </div>
  )

  return (
    <div className="hw-card hw-banner">
      <div>
        <div className="hw-banner-greet">{greet}，宇界工作台</div>
        <div className="hw-banner-sub">
          <span className="hw-banner-clock">
            {hh}:{mm}:{ss}
          </span>
          <span className="hw-banner-dot">·</span>
          <span>{dateText}</span>
        </div>
      </div>
      <div className="hw-banner-right">
        <div className="hw-banner-weather">
          {weatherErr ? (
            <span className="hw-banner-wdesc">天气加载失败</span>
          ) : weather ? (
            <>
              <span className="hw-banner-wicon">{WMO_ICONS[weather.icon ?? ''] ?? '🌤️'}</span>
              <span className="hw-banner-temp">
                {weather.temp != null ? `${weather.temp}°C` : '--'}
              </span>
              <span className="hw-banner-wdesc">
                {weather.description ?? ''}
                {weather.feelsLike != null ? ` · 体感 ${weather.feelsLike}°C` : ''}
              </span>
              {weather.city && (
                <span className="hw-banner-wcity">
                  {weather.city}
                  {weather.admin1 ? ` · ${weather.admin1}` : ''}
                </span>
              )}
              {weather.aqi != null && (
                <span className={'hw-banner-aqi ' + aqiClass(weather.aqi)}>AQI {weather.aqi}</span>
              )}
            </>
          ) : (
            <span className="hw-banner-wdesc">--</span>
          )}
        </div>
        <Dropdown droplist={moduleDropdown} position="bl" trigger="click">
          <Button type="button" variant="outline" size="sm" className="hw-module-btn">
            <IconApps style={{ fontSize: 14 }} />
            模块管理
          </Button>
        </Dropdown>
      </div>
    </div>
  )
}

export default HomeBanner
