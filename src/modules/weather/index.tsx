import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Spin, Empty, Select, Alert, Button, message } from 'antd'

interface ForecastDay {
  date: string
  tempMax: number
  tempMin: number
  description: string
  icon: string
  precipProbability: number | null
  sunrise?: string | null
  sunset?: string | null
  uvIndex?: number | null
}

interface HourlyItem {
  time: string
  temp: number
  precipProbability: number | null
  description: string
  icon: string
}

interface WeatherData {
  city: string
  admin1?: string
  latitude: number
  longitude: number
  temp: number
  feelsLike: number
  humidity: number
  /** km/h */
  windSpeed: number
  /** 蒲福风级 */
  windScale: number
  windDir: string
  description: string
  icon: string
  aqi: number
  pm25: number | null
  forecast: ForecastDay[]
  hourly?: HourlyItem[]
  sunrise?: string | null
  sunset?: string | null
  uvIndex?: number | null
  updatedAt?: string
  source?: string
}

/** 用户维护的城市列表项 */
interface CityItem {
  id: string
  name: string
  admin1?: string
  latitude: number
  longitude: number
}

interface CityHit {
  id: string
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

const STORAGE_KEY = 'mimo-weather-cities-v1'
const DEFAULT_CITY = '北京'

function loadCities(): CityItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c) => c && typeof c.latitude === 'number' && typeof c.longitude === 'number')
  } catch {
    return []
  }
}

function saveCities(cities: CityItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cities))
  } catch {
    /* 忽略存储失败 */
  }
}

const getWeatherIcon = (icon: string) => {
  const iconMap: Record<string, string> = {
    sunny: '☀️',
    cloudy: '☁️',
    overcast: '☁️',
    rain: '🌧️',
    snow: '🌨️',
    fog: '🌫️',
    thunder: '⛈️',
    wind: '💨',
  }
  return iconMap[icon] || '🌤️'
}

const getAqiLevel = (aqi: number) => {
  if (aqi <= 50) return { text: '优', color: '#52c41a' }
  if (aqi <= 100) return { text: '良', color: '#1677ff' }
  if (aqi <= 150) return { text: '轻度污染', color: '#faad14' }
  if (aqi <= 200) return { text: '中度污染', color: '#ff7a45' }
  if (aqi <= 300) return { text: '重度污染', color: '#f5222d' }
  return { text: '严重污染', color: '#a8071a' }
}

/** 紫外线等级（WHO 标准） */
const getUvLevel = (uv: number) => {
  if (uv < 3) return { text: '弱', color: '#52c41a', advice: '紫外线弱，无需防护' }
  if (uv < 6) return { text: '中等', color: '#faad14', advice: '紫外线中等，建议涂防晒霜' }
  if (uv < 8) return { text: '强', color: '#ff7a45', advice: '紫外线强，戴帽子太阳镜' }
  if (uv < 11) return { text: '很强', color: '#f5222d', advice: '紫外线很强，避免正午外出' }
  return { text: '极强', color: '#a8071a', advice: '紫外线极强，尽量不外出' }
}

/** 生活指数（对标和风/彩云，由天气要素本地派生） */
function getLifeIndices(weather: WeatherData): Array<{ icon: string; name: string; level: string; color: string; desc: string }> {
  const t = weather.temp
  const hasRain = weather.description.includes('雨')
  const hasSnow = weather.description.includes('雪')
  const maxPrecip = Math.max(0, ...weather.forecast.slice(0, 1).map((d) => d.precipProbability ?? 0))
  const uv = weather.uvIndex ?? 0
  const uvLevel = getUvLevel(uv)
  return [
    {
      icon: '👕',
      name: '穿衣',
      level: t >= 28 ? '短袖' : t >= 22 ? '短袖/薄外套' : t >= 15 ? '外套' : t >= 5 ? '大衣/羽绒服' : '厚羽绒服',
      color: '#1677ff',
      desc: t >= 28 ? '天气炎热，穿透气短袖' : t >= 15 ? '早晚温差大，备件外套' : '气温低，注意保暖',
    },
    {
      icon: '☂️',
      name: '雨伞',
      level: hasRain || hasSnow || maxPrecip >= 40 ? '带伞' : maxPrecip >= 20 ? '建议携带' : '不用带',
      color: hasRain || maxPrecip >= 40 ? '#f5222d' : '#52c41a',
      desc: maxPrecip > 0 ? `今日降水概率 ${maxPrecip}%` : '今天基本不会下雨',
    },
    {
      icon: '🌞',
      name: '紫外线',
      level: uvLevel.text,
      color: uvLevel.color,
      desc: uvLevel.advice,
    },
    {
      icon: '🏃',
      name: '运动',
      level: t > 32 || t < -5 || hasRain ? '较不宜' : t >= 10 && t <= 28 ? '适宜' : '一般',
      color: t >= 10 && t <= 28 && !hasRain ? '#52c41a' : '#faad14',
      desc: t > 32 ? '高温天运动易中暑' : t < -5 ? '严寒天气户外运动伤身' : hasRain ? '雨天路滑，建议室内运动' : '气温舒适，适合户外活动',
    },
    {
      icon: '🚗',
      name: '洗车',
      level: maxPrecip >= 40 || hasRain ? '不宜' : maxPrecip >= 20 ? '一般' : '适宜',
      color: maxPrecip >= 40 || hasRain ? '#f5222d' : '#52c41a',
      desc: maxPrecip >= 40 ? '未来有雨，洗了白洗' : '近期无雨，可以洗车',
    },
    {
      icon: '🤧',
      name: '感冒',
      level: t >= 15 && t <= 25 && weather.humidity <= 70 ? '低发' : t < 5 || weather.humidity > 85 ? '易发' : '较易发',
      color: t >= 15 && t <= 25 ? '#52c41a' : '#f5222d',
      desc: t < 5 ? '气温骤冷，注意添衣保暖' : weather.humidity > 85 ? '湿冷天气，谨防着凉' : '温差适中，注意通风',
    },
  ]
}

/** ISO 时间 → HH:mm（本地时区，Open-Meteo 已按城市时区返回） */
const fmtTime = (iso?: string | null) => {
  if (!iso) return '--:--'
  return iso.slice(11, 16)
}

const WeatherModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  const [cities, setCities] = useState<CityItem[]>(() => loadCities())
  const [activeId, setActiveId] = useState<string>('')
  const [dataMap, setDataMap] = useState<Record<string, WeatherData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 城市搜索
  const [options, setOptions] = useState<CityHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchValue, setSearchValue] = useState<string | undefined>(undefined)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  /** 按坐标取天气（多城市统一走坐标，避免重复解析城市名） */
  const fetchByCoords = useCallback(
    async (city: CityItem, opts: { silent?: boolean } = {}): Promise<WeatherData | null> => {
      if (!opts.silent) setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/weather?lat=${city.latitude}&lon=${city.longitude}&city=${encodeURIComponent(city.name)}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        const weather = data as WeatherData
        setDataMap((prev) => ({ ...prev, [city.id]: weather }))
        return weather
      } catch (err) {
        setError((err as Error).message)
        return null
      } finally {
        if (!opts.silent) setLoading(false)
      }
    },
    []
  )

  /** 首次进入：没有城市列表时用默认城市初始化（顺便拿到坐标） */
  useEffect(() => {
    if (cities.length > 0) {
      setActiveId((prev) => prev || cities[0].id)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/weather?city=${encodeURIComponent(DEFAULT_CITY)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        if (cancelled) return

        const city: CityItem = {
          id: String(data.latitude) + ',' + String(data.longitude),
          name: data.city || DEFAULT_CITY,
          admin1: data.admin1,
          latitude: data.latitude,
          longitude: data.longitude,
        }
        const next = [city]
        setCities(next)
        saveCities(next)
        setActiveId(city.id)
        setDataMap({ [city.id]: data as WeatherData })
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cities])

  // 切换城市时按需拉取
  useEffect(() => {
    if (!activeId) return
    if (dataMap[activeId]) return
    const city = cities.find((c) => c.id === activeId)
    if (city) fetchByCoords(city)
  }, [activeId, cities, dataMap, fetchByCoords])

  /** 城市搜索（防抖 300ms） */
  const handleSearch = (value: string) => {
    setSearchValue(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = value.trim()
    if (q.length < 1) {
      setOptions([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/weather/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        setOptions(data.results || [])
      } catch {
        setOptions([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const handleAddCity = async (hitId: string) => {
    const hit = options.find((o) => o.id === hitId)
    if (!hit) return

    const id = `${hit.latitude},${hit.longitude}`
    if (cities.some((c) => c.id === id)) {
      message.info(`「${hit.name}」已经在列表里了`)
      setActiveId(id)
      setSearchValue(undefined)
      setOptions([])
      return
    }

    const city: CityItem = { id, name: hit.name, admin1: hit.admin1, latitude: hit.latitude, longitude: hit.longitude }
    const next = [...cities, city]
    setCities(next)
    saveCities(next)
    setActiveId(id)
    setSearchValue(undefined)
    setOptions([])
    await fetchByCoords(city)
  }

  const handleRemoveCity = (city: CityItem) => {
    const next = cities.filter((c) => c.id !== city.id)
    setCities(next)
    saveCities(next)
    setDataMap((prev) => {
      const copy = { ...prev }
      delete copy[city.id]
      return copy
    })
    if (activeId === city.id) setActiveId(next[0]?.id || '')
    message.success(`已移除「${city.name}」`)
  }

  const refresh = () => {
    const city = cities.find((c) => c.id === activeId)
    if (city) fetchByCoords(city, { silent: true })
  }

  const activeCity = useMemo(() => cities.find((c) => c.id === activeId), [cities, activeId])
  const weather = activeId ? dataMap[activeId] : undefined

  /**
   * 省 / 市级副标题。
   * 按坐标查询时后端不返回 admin1，这里回落到城市列表里存的 admin1；
   * 「北京 / 北京市」这种同义重复不显示，只在跨省同名城市时用来消歧。
   */
  const regionLabel = (() => {
    const raw = weather?.admin1 || activeCity?.admin1
    if (!raw || !weather) return null
    const short = raw.replace(/(市|省|自治区|特别行政区|自治州|地区)$/g, '')
    if (!short || short === weather.city || weather.city.includes(short)) return null
    return raw
  })()

  const citySearch = (
    <Select
      size="small"
      showSearch
      allowClear
      value={searchValue}
      placeholder="🔍 搜索添加城市"
      style={{ width: 220 }}
      filterOption={false}
      onSearch={handleSearch}
      onSelect={handleAddCity}
      onClear={() => {
        setSearchValue(undefined)
        setOptions([])
      }}
      notFoundContent={searching ? <Spin size="small" /> : searchValue ? '未找到匹配城市' : '输入城市名开始搜索'}
      options={options.map((o) => ({
        value: o.id,
        label: [o.name, o.admin1, o.country].filter(Boolean).join(' · '),
      }))}
    />
  )
  const headerActions = actionsHost
    ? createPortal(<div className="weather-header-actions">{citySearch}</div>, actionsHost)
    : null

  return (
    <div>
      {headerActions}

      {/* 城市标签 */}
      {cities.length > 0 && (
        <div className="weather-cities">
          {cities.map((c) => (
            <span
              key={c.id}
              className={`weather-city-tab${c.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(c.id)}
              title={[c.name, c.admin1].filter(Boolean).join(' · ')}
            >
              {c.name}
              <span
                className="weather-city-remove"
                title="移除该城市"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveCity(c)
                }}
              >
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 10 }}
          message={error}
          action={
            <Button size="small" onClick={refresh}>
              重试
            </Button>
          }
        />
      )}

      {/* 无城市 */}
      {cities.length === 0 && !loading && !error && (
        <Empty description="还没有城市，用上方搜索框添加一个" />
      )}

      {/* 加载中 */}
      {loading && !weather && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Spin />
        </div>
      )}

      {/* 当前天气 */}
      {weather && (
        <>
          <div className="weather-card">
            <div className="weather-temp">{weather.temp}°</div>
            <div className="weather-info">
              <div className="city">
                {weather.city}
                {regionLabel && (
                  <span style={{ fontSize: 12, color: '#999', fontWeight: 400, marginLeft: 6 }}>
                    {regionLabel}
                  </span>
                )}
              </div>
              <div className="desc">
                {getWeatherIcon(weather.icon)} {weather.description}
              </div>
              <div className="desc">
                体感 {weather.feelsLike}° · 湿度 {weather.humidity}%
              </div>
              <div className="desc">
                {weather.windDir} {weather.windScale}级（{weather.windSpeed} km/h）
              </div>
              {weather.aqi > 0 && (
                <div className="desc">
                  AQI{' '}
                  <span style={{ color: getAqiLevel(weather.aqi).color, fontWeight: 600 }}>{weather.aqi}</span>
                  <span style={{ opacity: 0.8 }}> ({getAqiLevel(weather.aqi).text})</span>
                  {weather.pm25 != null && <span style={{ opacity: 0.7 }}> · PM2.5 {weather.pm25}μg/m³</span>}
                </div>
              )}
              {(weather.sunrise || weather.sunset) && (
                <div className="desc">
                  🌅 日出 {fmtTime(weather.sunrise)} · 🌇 日落 {fmtTime(weather.sunset)}
                </div>
              )}
            </div>
          </div>

          {/* 24 小时逐时预报 */}
          {(weather.hourly?.length ?? 0) > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#666' }}>24小时预报</div>
              <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 4 }}>
                {weather.hourly!.map((h, i) => (
                  <div
                    key={h.time}
                    style={{
                      flex: '0 0 48px',
                      textAlign: 'center',
                      padding: '6px 2px',
                      background: i === 0 ? '#e6f4ff' : '#fafafa',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    title={`${h.time.slice(11, 16)} ${h.description}`}
                  >
                    <div style={{ color: '#999', marginBottom: 3 }}>{i === 0 ? '现在' : h.time.slice(11, 13) + '时'}</div>
                    <div style={{ fontSize: 15 }}>{getWeatherIcon(h.icon)}</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{h.temp}°</div>
                    {h.precipProbability != null && h.precipProbability > 0 && (
                      <div style={{ color: '#1677ff', fontSize: 10 }}>💧{h.precipProbability}%</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7天预报 */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#666' }}>7天预报</div>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
              {weather.forecast.map((day, i) => (
                <div
                  key={day.date}
                  style={{
                    flex: '1 0 52px',
                    textAlign: 'center',
                    padding: '8px 4px',
                    background: i === 0 ? '#e6f4ff' : '#fafafa',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  title={day.description}
                >
                  <div style={{ color: '#999', marginBottom: 4 }}>
                    {i === 0 ? '今天' : new Date(day.date).toLocaleDateString('zh-CN', { weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{getWeatherIcon(day.icon)}</div>
                  <div style={{ fontWeight: 600 }}>{day.tempMax}°</div>
                  <div style={{ color: '#999' }}>{day.tempMin}°</div>
                  {day.precipProbability != null && day.precipProbability > 0 && (
                    <div style={{ color: '#1677ff', marginTop: 2 }}>💧{day.precipProbability}%</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 出行建议 */}
          <div style={{ marginTop: 12, padding: 10, background: '#f6ffed', borderRadius: 8, fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 出行建议</div>
            <div style={{ color: '#666', lineHeight: 1.6 }}>
              {weather.temp > 30
                ? '天气炎热，注意防晒补水'
                : weather.temp < 5
                  ? '天气寒冷，注意保暖'
                  : weather.temp < 15
                    ? '天气较凉，建议穿外套'
                    : '气温适宜，适合外出'}
              {weather.aqi > 100 && '，空气质量较差，建议佩戴口罩'}
              {(weather.description.includes('雨') || weather.description.includes('雪')) && '，记得带伞'}
              {weather.windScale >= 6 && '，风力较大，注意高空坠物'}
            </div>
          </div>

          {/* 生活指数（对标和风/彩云，本地派生） */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#666' }}>生活指数</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
              {getLifeIndices(weather).map((idx) => (
                <div key={idx.name} style={{ background: '#fafafa', borderRadius: 8, padding: '8px 10px' }} title={idx.desc}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12 }}>{idx.icon} {idx.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: idx.color }}>{idx.level}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 3, lineHeight: 1.4 }}>{idx.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 11, color: '#aaa' }}>
            数据源：{weather.source || 'Open-Meteo'}
            {weather.updatedAt && ` · 更新于 ${new Date(weather.updatedAt).toLocaleTimeString('zh-CN')}`}
            {' · 缓存 10 分钟，可点 🔄 刷新'}
          </div>
        </>
      )}

      {/* 有城市但数据还没到（切换瞬间） */}
      {activeCity && !weather && !loading && !error && (
        <div style={{ fontSize: 12, color: '#999', padding: 12 }}>正在获取 {activeCity.name} 的天气…</div>
      )}
    </div>
  )
}

export default WeatherModule
