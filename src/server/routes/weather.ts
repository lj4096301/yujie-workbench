import { Router } from 'express'
import axios from 'axios'

/**
 * 天气数据源：Open-Meteo（https://open-meteo.com）
 *
 * 选它的原因：完全免密钥、无需注册，且同时提供
 *   1) 城市地理编码（中英文皆可）
 *   2) 实时天气 + 7 天预报
 *   3) 空气质量（PM2.5 / AQI）
 * 因此「多城市 + 搜索」不需要用户额外申请 QWeather Key 就能真正跑通。
 */

const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_API = 'https://api.open-meteo.com/v1/forecast'
const AIR_API = 'https://air-quality-api.open-meteo.com/v1/air-quality'

const CACHE_TTL = 10 * 60 * 1000 // 10 分钟
const HTTP_TIMEOUT = 12000

export interface CityHit {
  id: string
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
  timezone?: string
}

interface CacheItem {
  at: number
  data: unknown
}

const weatherCache = new Map<string, CacheItem>()
const cityCache = new Map<string, CacheItem>()

function readCache<T>(map: Map<string, CacheItem>, key: string): T | null {
  const hit = map.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL) {
    map.delete(key)
    return null
  }
  return hit.data as T
}

function writeCache(map: Map<string, CacheItem>, key: string, data: unknown) {
  map.set(key, { at: Date.now(), data })
}

/** WMO 天气代码 → 中文描述 + 内部图标名（前端用 emoji 渲染） */
function describeWmo(code: number): { description: string; icon: string } {
  const table: Record<number, { description: string; icon: string }> = {
    0: { description: '晴', icon: 'sunny' },
    1: { description: '晴间多云', icon: 'sunny' },
    2: { description: '局部多云', icon: 'cloudy' },
    3: { description: '阴', icon: 'overcast' },
    45: { description: '雾', icon: 'fog' },
    48: { description: '雾凇', icon: 'fog' },
    51: { description: '小毛毛雨', icon: 'rain' },
    53: { description: '毛毛雨', icon: 'rain' },
    55: { description: '大毛毛雨', icon: 'rain' },
    56: { description: '冻毛毛雨', icon: 'rain' },
    57: { description: '强冻毛毛雨', icon: 'rain' },
    61: { description: '小雨', icon: 'rain' },
    63: { description: '中雨', icon: 'rain' },
    65: { description: '大雨', icon: 'rain' },
    66: { description: '冻雨', icon: 'rain' },
    67: { description: '强冻雨', icon: 'rain' },
    71: { description: '小雪', icon: 'snow' },
    73: { description: '中雪', icon: 'snow' },
    75: { description: '大雪', icon: 'snow' },
    77: { description: '米雪', icon: 'snow' },
    80: { description: '阵雨', icon: 'rain' },
    81: { description: '中阵雨', icon: 'rain' },
    82: { description: '强阵雨', icon: 'rain' },
    85: { description: '小阵雪', icon: 'snow' },
    86: { description: '强阵雪', icon: 'snow' },
    95: { description: '雷阵雨', icon: 'thunder' },
    96: { description: '雷阵雨伴冰雹', icon: 'thunder' },
    99: { description: '强雷暴伴冰雹', icon: 'thunder' },
  }
  return table[code] ?? { description: '未知', icon: 'cloudy' }
}

/** 风向角度 → 中文方位 */
function windDirection(degrees: number): string {
  const dirs = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风']
  if (!Number.isFinite(degrees)) return ''
  return dirs[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]
}

/** km/h → 蒲福风级 */
function beaufort(kmh: number): number {
  const table = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117]
  if (!Number.isFinite(kmh)) return 0
  for (let i = 0; i < table.length; i++) {
    if (kmh < table[i]) return i
  }
  return 12
}

/** 城市搜索：支持中英文，返回候选列表 */
async function searchCities(query: string, count = 8): Promise<CityHit[]> {
  const key = `${query.toLowerCase()}__${count}`
  const cached = readCache<CityHit[]>(cityCache, key)
  if (cached) return cached

  const res = await axios.get(GEO_API, {
    params: { name: query, count, language: 'zh', format: 'json' },
    timeout: HTTP_TIMEOUT,
  })

  const hits: CityHit[] = (res.data?.results || []).map((r: any) => ({
    id: String(r.id),
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }))

  writeCache(cityCache, key, hits)
  return hits
}

/** 拉取某个坐标的实时天气 + 7 天预报 + 空气质量 */
async function fetchWeather(latitude: number, longitude: number) {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`
  const cached = readCache<any>(weatherCache, key)
  if (cached) return cached

  const [forecastRes, airRes] = await Promise.all([
    axios.get(FORECAST_API, {
      params: {
        latitude,
        longitude,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m',
        hourly: 'temperature_2m,precipitation_probability,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
        timezone: 'auto',
        forecast_days: 7,
      },
      timeout: HTTP_TIMEOUT,
    }),
    // 空气质量是独立域名；拉不到也不影响主流程
    axios
      .get(AIR_API, {
        params: { latitude, longitude, current: 'pm2_5,us_aqi', timezone: 'auto' },
        timeout: HTTP_TIMEOUT,
      })
      .catch(() => null),
  ])

  const current = forecastRes.data?.current || {}
  const daily = forecastRes.data?.daily || {}
  const hourly = forecastRes.data?.hourly || {}
  const air = airRes?.data?.current || {}

  const forecast = (daily.time || []).map((date: string, i: number) => {
    const wmo = describeWmo(daily.weather_code?.[i])
    return {
      date,
      tempMax: Math.round(daily.temperature_2m_max?.[i] ?? 0),
      tempMin: Math.round(daily.temperature_2m_min?.[i] ?? 0),
      description: wmo.description,
      icon: wmo.icon,
      precipProbability: daily.precipitation_probability_max?.[i] ?? null,
      sunrise: daily.sunrise?.[i] ?? null,
      sunset: daily.sunset?.[i] ?? null,
      uvIndex: daily.uv_index_max?.[i] ?? null,
    }
  })

  // 未来 24 小时逐时预报（从当前小时起，整点对齐）
  const nowHour = new Date()
  nowHour.setMinutes(0, 0, 0)
  const hourlyList: Array<{ time: string; temp: number; precipProbability: number | null; description: string; icon: string }> = []
  for (let i = 0; i < (hourly.time || []).length && hourlyList.length < 24; i++) {
    const t = new Date(hourly.time[i])
    if (t < nowHour) continue
    const wmo = describeWmo(hourly.weather_code?.[i])
    hourlyList.push({
      time: hourly.time[i],
      temp: Math.round(hourly.temperature_2m?.[i] ?? 0),
      precipProbability: hourly.precipitation_probability?.[i] ?? null,
      description: wmo.description,
      icon: wmo.icon,
    })
  }

  const wmo = describeWmo(current.weather_code)
  const wind = current.wind_speed_10m ?? 0

  const payload = {
    temp: Math.round(current.temperature_2m ?? 0),
    feelsLike: Math.round(current.apparent_temperature ?? 0),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    windSpeed: Math.round(wind),
    windScale: beaufort(wind),
    windDir: windDirection(current.wind_direction_10m),
    description: wmo.description,
    icon: wmo.icon,
    aqi: Math.round(air.us_aqi ?? 0),
    aqiScale: 'US AQI',
    pm25: air.pm2_5 != null ? Math.round(air.pm2_5 * 10) / 10 : null,
    forecast,
    hourly: hourlyList,
    sunrise: forecast[0]?.sunrise ?? null,
    sunset: forecast[0]?.sunset ?? null,
    uvIndex: forecast[0]?.uvIndex ?? null,
    updatedAt: new Date().toISOString(),
    source: 'Open-Meteo',
  }

  writeCache(weatherCache, key, payload)
  return payload
}

export function createWeatherRouter() {
  const router = Router()

  /**
   * 城市搜索：/api/weather/search?q=上海
   * 用于天气模块「新增城市」的下拉候选
   */
  router.get('/search', async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    if (!q) return res.json({ results: [] })

    try {
      const results = await searchCities(q)
      res.json({ results })
    } catch (err) {
      console.error('[weather] 城市搜索失败:', (err as Error).message)
      res.status(502).json({ error: '城市搜索失败，请检查网络连接' })
    }
  })

  /**
   * 天气查询：
   *   /api/weather?city=北京          按城市名
   *   /api/weather?lat=39.9&lon=116.4 按坐标（多城市列表用这个，避免重复解析城市名）
   */
  router.get('/', async (req, res) => {
    try {
      let latitude = Number(req.query.lat)
      let longitude = Number(req.query.lon)
      let city = String(req.query.city ?? '').trim()
      let admin1: string | undefined

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        // 没给坐标 → 用城市名解析
        const name = city || '北京'
        const hits = await searchCities(name, 1)
        if (!hits.length) {
          return res.status(404).json({ error: `未找到城市「${name}」，换个名称试试（支持中英文）` })
        }
        latitude = hits[0].latitude
        longitude = hits[0].longitude
        city = hits[0].name
        admin1 = hits[0].admin1
      }

      const data = await fetchWeather(latitude, longitude)
      res.json({ ...data, city: city || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`, admin1, latitude, longitude })
    } catch (err) {
      console.error('[weather] 天气获取失败:', (err as Error).message)
      res.status(502).json({ error: '天气数据获取失败，请检查网络连接后重试' })
    }
  })

  return router
}
