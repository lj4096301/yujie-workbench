import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DatePicker, message } from 'antd'
import { CalendarDays, Plus } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import localeData from 'dayjs/plugin/localeData'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import zhCnLocale from '@fullcalendar/core/locales/zh-cn'
import type { DatesSetArg, DayCellContentArg, DayHeaderContentArg, EventClickArg } from '@fullcalendar/core'
import { getDayLunarInfo, getUpcomingFestivals } from './lunarUtils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import './calendar.css'

dayjs.extend(isoWeek)
dayjs.extend(weekOfYear)
dayjs.extend(localeData)
dayjs.extend(customParseFormat)

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  color?: string
  description?: string
  source: 'local' | 'feishu'
}

interface HolidayItem {
  date: string
  name: string
  type: 'holiday' | 'workday'
}

const EVENT_COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']

/** 连续同名日期合并为一组 */
function groupHolidays(list: HolidayItem[]) {
  const groups: Array<{ name: string; type: string; dates: string[] }> = []
  for (const it of list) {
    const last = groups[groups.length - 1]
    const prevDate = last ? last.dates[last.dates.length - 1] : ''
    const isConsecutive = !!prevDate && dayjs(it.date).diff(dayjs(prevDate), 'day') === 1
    if (last && last.name === it.name && isConsecutive) last.dates.push(it.date)
    else groups.push({ name: it.name, type: it.type, dates: [it.date] })
  }
  return groups
}

const CalendarModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  // 添加日程表单
  const [evTitle, setEvTitle] = useState('')
  const [evRange, setEvRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [evColor, setEvColor] = useState('#1677ff')
  const [evDesc, setEvDesc] = useState('')

  // 国家法定休息日
  const [holidayMap, setHolidayMap] = useState<Map<string, HolidayItem>>(new Map())
  const [holidayOpen, setHolidayOpen] = useState(false)
  const [holidayYear, setHolidayYear] = useState(String(dayjs().year()))
  const [holidayList, setHolidayList] = useState<HolidayItem[]>([])
  const [holidayLoading, setHolidayLoading] = useState(false)

  // 预取今年与明年法定休息日（月视图标记用）
  useEffect(() => {
    const year = dayjs().year()
    const load = async () => {
      try {
        const [a, b] = await Promise.all([
          fetch(`/api/holiday?year=${year}`).then((r) => r.json()),
          fetch(`/api/holiday?year=${year + 1}`).then((r) => r.json()),
        ])
        const m = new Map<string, HolidayItem>()
        ;[a, b].forEach((d) => {
          ;(d.list || []).forEach((h: HolidayItem) => m.set(h.date, h))
        })
        setHolidayMap(m)
      } catch {
        // 网络失败静默，月视图不加标记
      }
    }
    void load()
  }, [])

  // 弹窗年份切换时拉取对应年份
  useEffect(() => {
    if (!holidayOpen) return
    setHolidayLoading(true)
    fetch(`/api/holiday?year=${holidayYear}`)
      .then((r) => r.json())
      .then((d) => setHolidayList((d.list || []) as HolidayItem[]))
      .catch(() => message.error('获取节假日失败'))
      .finally(() => setHolidayLoading(false))
  }, [holidayYear, holidayOpen])

  const fetchEvents = useCallback(async (start: Dayjs, end: Dayjs) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/calendar/events?start=${start.format('YYYY-MM-DD')}&end=${end.format('YYYY-MM-DD')}`
      )
      if (res.ok) {
        const data = (await res.json()) as CalendarEvent[]
        setEvents(data)
      }
    } catch {
      // 网络失败静默
    } finally {
      setLoading(false)
    }
  }, [])

  /** FullCalendar 视图范围变化 → 拉取日程 */
  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      void fetchEvents(dayjs(arg.start).subtract(1, 'day'), dayjs(arg.end).add(1, 'day'))
    },
    [fetchEvents]
  )

  /** 点空白日期 → 打开添加弹窗并预填 */
  const handleDateClick = useCallback((arg: { date: Date }) => {
    const d = dayjs(arg.date)
    setEvTitle('')
    setEvRange([d.startOf('day'), d.startOf('day').add(1, 'hour')])
    setEvColor(EVENT_COLORS[0])
    setEvDesc('')
    setModalVisible(true)
  }, [])

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const e = arg.event
    message.open({
      type: 'info',
      content: `${e.title}${e.extendedProps?.description ? `｜${e.extendedProps.description}` : ''}`,
      duration: 3,
    })
  }, [])

  /** 月视图格子：农历 + 休/班标 */
  const dayCell = useCallback(
    (arg: DayCellContentArg) => {
      const d = dayjs(arg.date)
      const info = getDayLunarInfo(arg.date)
      const h = holidayMap.get(d.format('YYYY-MM-DD'))
      return (
        <div className="fc-daycell">
          <div className="fc-daycell-top">
            <span className="fc-daycell-num">{arg.dayNumberText}</span>
            {h && <span className={`cal-hmark ${h.type}`}>{h.type === 'holiday' ? '休' : '班'}</span>}
          </div>
          <div className="fc-daycell-lunar">
            <span className={`fc-lunar${info.highlight ? ' fest' : ''}`}>{info.label}</span>
            {h && <span className="cal-hname">{h.name}</span>}
          </div>
        </div>
      )
    },
    [holidayMap]
  )

  /** 周/日视图列头：农历 + 休/班标 */
  const dayHeader = useCallback(
    (arg: DayHeaderContentArg) => {
      const d = dayjs(arg.date)
      const info = getDayLunarInfo(arg.date)
      const h = holidayMap.get(d.format('YYYY-MM-DD'))
      return (
        <div className="fc-dayheader">
          <div className="fc-dayheader-text">{arg.text}</div>
          <div className="fc-dayheader-sub">
            <span className={`fc-lunar${info.highlight ? ' fest' : ''}`}>{info.label}</span>
            {h && <span className={`cal-hmark ${h.type}`}>{h.type === 'holiday' ? '休' : '班'}</span>}
          </div>
        </div>
      )
    },
    [holidayMap]
  )

  const fcEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    color: e.color || '#1677ff',
    extendedProps: { description: e.description || '' },
  }))

  const submitAdd = () => {
    const title = evTitle.trim()
    if (!title) {
      message.warning('请输入日程标题')
      return
    }
    if (!evRange) {
      message.warning('请选择时间')
      return
    }
    const event: CalendarEvent = {
      id: Date.now().toString(),
      title,
      start: evRange[0].toISOString(),
      end: evRange[1].toISOString(),
      color: evColor,
      description: evDesc.trim() || undefined,
      source: 'local',
    }
    setEvents([...events, event])
    setModalVisible(false)
    message.success('日程已添加')
    try {
      void fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })
    } catch {
      // 网络失败静默
    }
  }

  const upcomingFestivals = getUpcomingFestivals(60, 8)

  function openAdd() {
    setEvTitle('')
    setEvRange(null)
    setEvColor('#1677ff')
    setEvDesc('')
    setModalVisible(true)
  }

  const headerActions = actionsHost
    ? createPortal(
        <div className="cal-header-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button size="sm" variant="outline" onClick={() => setHolidayOpen(true)} title="国家法定休息日">
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {headerActions}
      {loading && (
        <div style={{ position: 'absolute', top: 40, right: 12, zIndex: 10, fontSize: 12, color: '#86909c' }}>
          加载中…
        </div>
      )}
      <div className="cal-fc-wrap">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locales={[zhCnLocale]}
          locale="zh-cn"
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{ today: '今天', month: '月', week: '周', day: '日', list: '列表' }}
          events={fcEvents}
          height="100%"
          dayMaxEvents={3}
          nowIndicator
          selectable={false}
          editable={false}
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          dayCellContent={dayCell}
          dayHeaderContent={dayHeader}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        />
      </div>

      {/* 节日 / 节气预告 */}
      {upcomingFestivals.length > 0 && (
        <div className="cal-festival-box">
          <div className="cal-festival-title">📌 近 60 天节日 · 节气预告</div>
          <div className="cal-festival-list">
            {upcomingFestivals.map((f) => (
              <div key={`${f.name}-${f.date}`} className="cal-festival-item">
                <span className={`cal-festival-name${f.isJieQi ? ' jieqi' : ''}`}>{f.name}</span>
                <span className="cal-festival-date">
                  {f.date.slice(5)}
                  {f.lunarText ? ` · ${f.lunarText}` : ''}
                </span>
                <span className={`cal-festival-away${f.daysAway <= 3 ? ' soon' : ''}`}>
                  {f.daysAway === 0 ? '今天' : `${f.daysAway} 天后`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 飞书同步状态 */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#999' }}>
        <span>📅 飞书日历：未连接</span>
        <Button variant="link" size="sm" style={{ fontSize: 11, padding: 0 }}>
          去连接
        </Button>
      </div>

      {/* 国家法定休息日弹窗 */}
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>国家法定休息日</DialogTitle>
          </DialogHeader>
          <div className="holiday-year-tabs">
            {[String(dayjs().year() - 1), String(dayjs().year()), String(dayjs().year() + 1)].map((y) => (
              <Button
                key={y}
                size="sm"
                variant={holidayYear === y ? 'default' : 'outline'}
                onClick={() => setHolidayYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
          <div className="holiday-body">
            {holidayLoading ? (
              <div className="holiday-loading">加载中…</div>
            ) : holidayList.length === 0 ? (
              <div className="holiday-loading">暂无数据</div>
            ) : (
              groupHolidays(holidayList).map((g, i) => {
                const start = dayjs(g.dates[0])
                const end = dayjs(g.dates[g.dates.length - 1])
                const rangeText =
                  g.dates.length > 1 ? `${start.format('M月D日')} - ${end.format('M月D日')}` : start.format('M月D日')
                const isHoliday = g.type === 'holiday'
                return (
                  <div key={i} className="holiday-item">
                    <span className={`holiday-dot ${g.type}`} />
                    <span className={`holiday-name${isHoliday ? '' : ' work'}`}>{g.name}</span>
                    <span className="holiday-range">{rangeText}</span>
                    <span className={`holiday-tag ${g.type}`}>
                      {isHoliday ? `放假${g.dates.length}天` : '上班'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加日程弹窗 */}
      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>📅 添加日程</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">标题</Label>
              <Input
                id="ev-title"
                value={evTitle}
                placeholder="日程标题"
                onChange={(e) => setEvTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>时间</Label>
              <DatePicker.RangePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
                value={evRange}
                onChange={(v) => setEvRange(v as [Dayjs, Dayjs] | null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>颜色</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {EVENT_COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setEvColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c,
                      cursor: 'pointer',
                      border: evColor === c ? '2px solid #333' : '2px solid transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">描述</Label>
              <Textarea
                id="ev-desc"
                rows={2}
                value={evDesc}
                placeholder="日程描述（可选）"
                onChange={(e) => setEvDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalVisible(false)}>
              取消
            </Button>
            <Button onClick={submitAdd}>添加日程</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CalendarModule
