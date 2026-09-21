import React, { useMemo } from 'react'
import { WeatherWidget } from 'tactile-weather'
import type { WeatherData as TactileData } from 'tactile-weather'

/**
 * tactile-weather 适配层
 * ------------------------------------------------------------
 * 上游：tactile-weather@0.0.5（MIT，锤子天气组件库，Open-Meteo 数据格式）
 * 归档：D:\docker-ai\复用资源\组件\tactile-weather\（tarball + 解包）
 *
 * 职责：
 *  1. 把项目 /api/weather 返回的数据结构映射为组件需要的 Open-Meteo 结构
 *  2. 统一包装 WeatherWidget，供天气模块页（large）与首页卡片（small/wide-small）复用
 * 主题：--twx-* CSS 变量已在 design-tokens.css 覆盖为 Mi Console v3 Token
 */

/** 项目天气数据的最小依赖结构（与 src/modules/weather/index.tsx 字段对齐） */
export interface TactileSource {
  temp: number
  humidity: number
  windSpeed: number
  icon: string
  forecast: Array<{ date: string; tempMax: number; tempMin: number; icon: string }>
  hourly?: Array<{ time: string; temp: number }>
  updatedAt?: string
}

/** 项目天气 icon 文案 → WMO weather code（Open-Meteo 标准） */
const ICON_TO_WMO: Record<string, number> = {
  sunny: 0, // 晴
  cloudy: 2, // 少云
  overcast: 3, // 阴
  rain: 61, // 小雨
  snow: 71, // 小雪
  fog: 45, // 雾
  thunder: 95, // 雷暴
  wind: 1, // 基本晴（风）
}

const DEFAULT_WMO = 0

/** 项目 icon → WMO code（未知回退晴天） */
export function iconToWmo(icon?: string | null): number {
  if (!icon) return DEFAULT_WMO
  return ICON_TO_WMO[icon] ?? DEFAULT_WMO
}

/** 把项目天气数据映射为 tactile-weather 的 Open-Meteo 结构 */
export function toTactileData(w: TactileSource): TactileData {
  const now = new Date()
  const isDay = now.getHours() >= 6 && now.getHours() < 19 ? 1 : 0

  // 组件按"当前小时"索引 hourly（fallback 0 → 组件内部 || 50 / || 当前温度）
  const humidityByHour = new Array(24).fill(0)
  const feelsByHour = new Array(24).fill(0)
  w.hourly?.forEach((h) => {
    const hour = new Date(h.time).getHours()
    if (hour >= 0 && hour < 24) {
      humidityByHour[hour] = w.humidity
      feelsByHour[hour] = h.temp
    }
  })

  return {
    current_weather: {
      temperature: w.temp,
      windspeed: w.windSpeed,
      winddirection: 0,
      weathercode: iconToWmo(w.icon),
      time: w.updatedAt ?? now.toISOString(),
      is_day: isDay,
    },
    daily: {
      time: w.forecast.map((d) => d.date),
      weather_code: w.forecast.map((d) => iconToWmo(d.icon)),
      temperature_2m_max: w.forecast.map((d) => d.tempMax),
      temperature_2m_min: w.forecast.map((d) => d.tempMin),
    },
    hourly: {
      relative_humidity_2m: humidityByHour,
      apparent_temperature: feelsByHour,
      time: w.hourly?.map((h) => h.time) ?? [],
    },
    timezone: 'auto',
  }
}

export type TactileSize = 'large' | 'medium' | 'small' | 'mini' | 'wide-small' | 'wide-medium' | 'micro'

interface WeatherCardProps {
  /** 项目天气数据；null 时显示加载骨架 */
  source: TactileSource | null
  size: TactileSize
  city: string
  loading?: boolean
  unit?: 'C' | 'F'
  onRefresh?: () => void
}

/**
 * tactile-weather 统一包装。
 * - 数据实时映射（每次渲染由 useMemo 按 source 重建）
 * - 单位切换回调：默认 no-op（项目温度恒为 °C，避免误切）
 */
export const WeatherCard: React.FC<WeatherCardProps> = ({
  source,
  size,
  city,
  loading = false,
  unit = 'C',
  onRefresh,
}) => {
  const data = useMemo(() => (source ? toTactileData(source) : null), [source])

  return (
    <div className="tactile-root">
      <WeatherWidget
        size={size}
        data={data}
        loading={loading || !source}
        unit={unit}
        locationName={city}
        lang="zh"
        onToggleUnit={() => {}}
        onRefresh={onRefresh ?? (() => {})}
      />
    </div>
  )
}

export default WeatherCard
