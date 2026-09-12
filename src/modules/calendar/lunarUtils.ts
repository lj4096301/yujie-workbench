import lunarLib from 'lunar-javascript'

const Solar = lunarLib.Solar

/**
 * 日历模块的农历工具层。
 *
 * lunar-javascript 的 API 是纯同步的纯函数，但按天构造对象有开销，
 * 月视图一次要算 42 格，所以按日期做一层内存缓存（应用生命周期内足够）。
 */

export interface DayLunarInfo {
  /** 日期格里的农历标签：节日/节气名 > 每月初一显示月名 > 农历日（初二、十五…） */
  label: string
  /** 是否节日 / 节气（红色显示） */
  highlight: boolean
  /** 完整农历，如：二〇二六年八月初一 */
  full: string
  /** 干支生肖，如：丙午年 · 马 */
  ganZhi: string
  /** 当天的节日 / 节气名（「 · 」连接），无则空串 */
  festival: string
}

const dayCache = new Map<string, DayLunarInfo>()

/** lunar-javascript 的内置节日名个别带「节」字，显示上统一 */
function prettify(name: string): string {
  return name === '元旦节' ? '元旦' : name
}

export function getDayLunarInfo(date: Date): DayLunarInfo {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const hit = dayCache.get(key)
  if (hit) return hit

  let info: DayLunarInfo
  try {
    const solar = Solar.fromDate(date)
    const lunar = solar.getLunar()
    const jieQi = lunar.getJieQi() || ''
    const festivals = [...solar.getFestivals(), ...lunar.getFestivals()].map(prettify)
    const festival = jieQi ? [jieQi, ...festivals] : festivals

    // 农历标签：有节日/节气优先展示；每月初一改显示月名（八月），其余显示农历日
    let label = lunar.getDayInChinese()
    if (label === '初一') label = `${lunar.getMonthInChinese()}月`
    if (festival.length > 0) label = festival.join(' ')

    info = {
      label,
      highlight: festival.length > 0,
      full: lunar.toString(),
      ganZhi: `${lunar.getYearInGanZhi()}年 · ${lunar.getYearShengXiao()}`,
      festival: festival.join(' · '),
    }
  } catch {
    info = { label: '', highlight: false, full: '', ganZhi: '', festival: '' }
  }

  dayCache.set(key, info)
  return info
}

export interface FestivalPreview {
  name: string
  /** YYYY-MM-DD */
  date: string
  /** 农历描述，节气日为空 */
  lunarText: string
  /** 距今天数（0 = 今天） */
  daysAway: number
  isJieQi: boolean
}

/**
 * 未来 days 天内的节日与节气预告（按时间顺序）。
 * 从今天逐日向后扫，直接复用 getDayLInfo 的数据源，逻辑简单且不会漏掉
 * 「公历节日 / 农历节日 / 节气」任何一类。
 */
export function getUpcomingFestivals(days = 60, limit = 8): FestivalPreview[] {
  const out: FestivalPreview[] = []
  const today = new Date()

  for (let i = 0; i < days && out.length < limit; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    const info = getDayLunarInfo(d)
    if (!info.festival) continue

    const jieQi = info.festival.split(' · ')[0]
    const isJieQi = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'].includes(jieQi) && info.festival === jieQi

    const solar = Solar.fromDate(d)
    const lunar = solar.getLunar()
    out.push({
      name: info.festival.split(' · ')[0],
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      lunarText: isJieQi ? '' : `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      daysAway: i,
      isJieQi,
    })
  }

  return out
}
