import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DatePicker, message } from 'antd'
import { Plus } from 'lucide-react'
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
import { TodoFormFields, saveTodo } from './TodoDialog'
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
  type?: 'event' | 'todo'
}

interface HolidayItem {
  date: string
  name: string
  type: 'holiday' | 'workday'
}

interface DetailEvent {
  id: string
  title: string
  start: string
  end: string
  color?: string
  description?: string
  source?: string
}

const EVENT_COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']

const PRIORITY_LABEL: Record<'low' | 'mid' | 'high', string> = {
  low: '低',
  mid: '中',
  high: '高',
}

/** 分段按钮样式（日程/待办、优先级通用） */
function segBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 0',
    fontSize: 13,
    borderRadius: 6,
    cursor: 'pointer',
    border: active ? '1px solid #1677ff' : '1px solid #e5e6eb',
    background: active ? '#e8f3ff' : '#fff',
    color: active ? '#1677ff' : '#4e5969',
    fontWeight: active ? 600 : 400,
  }
}

const CalendarModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  // FullCalendar 实例引用（日期跳转用）
  const calRef = useRef<FullCalendar>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [pickerDate, setPickerDate] = useState<Dayjs>(dayjs())

  // 事件详情弹窗
  const [detailEvent, setDetailEvent] = useState<DetailEvent | null>(null)
  const [detailConfirm, setDetailConfirm] = useState(false)

  // 添加表单：类型（日程/待办）+ 对应字段
  const [evType, setEvType] = useState<'event' | 'todo'>('event')
  const [evTitle, setEvTitle] = useState('')
  const [evRange, setEvRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [evDue, setEvDue] = useState<Dayjs | null>(null)
  const [evPriority, setEvPriority] = useState<'low' | 'mid' | 'high'>('mid')
  const [evColor, setEvColor] = useState('#1677ff')
  const [evDesc, setEvDesc] = useState('')

  // 国家法定休息日（仅用于月视图标记与预告，不提供可选入口）
  const [holidayMap, setHolidayMap] = useState<Map<string, HolidayItem>>(new Map())

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

  const fetchAbortRef = useRef<AbortController | null>(null)
  const lastRangeRef = useRef('')
  const fetchEvents = useCallback(
    async (start: Dayjs, end: Dayjs, signal?: AbortSignal) => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/calendar/events?start=${start.format('YYYY-MM-DD')}&end=${end.format('YYYY-MM-DD')}`,
          { signal }
        )
        if (res.ok) {
          const data = (await res.json()) as CalendarEvent[]
          setEvents(data)
        }
      } catch {
        // 网络失败或中止静默
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /** FullCalendar 视图范围变化 → 拉取日程（同范围去重 + 6s 超时） */
  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const rangeKey = `${dayjs(arg.start).format('YYYY-MM-DD')}_${dayjs(arg.end).format('YYYY-MM-DD')}`
      if (lastRangeRef.current === rangeKey) return
      lastRangeRef.current = rangeKey
      fetchAbortRef.current?.abort()
      const ctrl = new AbortController()
      fetchAbortRef.current = ctrl
      const timer = setTimeout(() => ctrl.abort(), 6000)
      void fetchEvents(dayjs(arg.start).subtract(1, 'day'), dayjs(arg.end).add(1, 'day'), ctrl.signal).finally(() =>
        clearTimeout(timer)
      )
    },
    [fetchEvents]
  )

  /** 日期选择器跳转 */
  const handlePickerChange = useCallback((d: Dayjs | null) => {
    if (!d) return
    setPickerDate(d)
    calRef.current?.getApi().gotoDate(d.toDate())
  }, [])

  /** 点空白日期 → 打开添加弹窗并预填 */
  const handleDateClick = useCallback((arg: { date: Date }) => {
    const d = dayjs(arg.date)
    setEvTitle('')
    setEvRange([d.startOf('day'), d.startOf('day').add(1, 'hour')])
    setEvColor(EVENT_COLORS[0])
    setEvDesc('')
    setModalVisible(true)
  }, [])

  /** 点击事件 → 打开详情弹窗（查看/删除） */
  const handleEventClick = useCallback((arg: EventClickArg) => {
    const e = arg.event
    setDetailConfirm(false)
    setDetailEvent({
      id: e.id,
      title: e.title,
      start: e.start?.toISOString?.() || e.startStr,
      end: e.end?.toISOString?.() || e.endStr || e.startStr,
      color: e.backgroundColor || e.borderColor || '#1677ff',
      description: (e.extendedProps?.description as string | undefined) || '',
      source: e.extendedProps?.source as string | undefined,
    })
  }, [])

  /** 删除日程（二次确认后） */
  const handleDeleteEvent = useCallback(async () => {
    if (!detailEvent) return
    try {
      const res = await fetch(`/api/calendar/events/${detailEvent.id}`, { method: 'DELETE' })
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== detailEvent.id))
        setDetailEvent(null)
        setDetailConfirm(false)
        message.success('日程已删除')
      } else {
        message.error('删除失败')
      }
    } catch {
      message.error('删除失败，请检查服务')
    }
  }, [detailEvent])

  /** 月视图格子：农历 + 休/班标 */
  const dayCell = useCallback(
    (arg: DayCellContentArg) => {
      const d = dayjs(arg.date)
      const info = getDayLunarInfo(arg.date)
      const h = holidayMap.get(d.format('YYYY-MM-DD'))
      // 去重：法定节假日 API 的 name（如「中秋节」）与农历库算出的节日名相同时，只显示一个，
      // 避免同一天出现两个「中秋节」
      const lunarLabel = info.label
      const holidayName = h?.name
      const showHolidayName =
        !!holidayName && !(lunarLabel.includes(holidayName) || holidayName.includes(lunarLabel))
      return (
        <div className="fc-daycell">
          <div className="fc-daycell-top">
            <span className="fc-daycell-num">{arg.dayNumberText}</span>
            {h && <span className={`cal-hmark ${h.type}`}>{h.type === 'holiday' ? '休' : '班'}</span>}
          </div>
          <div className="fc-daycell-lunar">
            <span className={`fc-lunar${info.highlight ? ' fest' : ''}`}>{info.label}</span>
            {showHolidayName && <span className="cal-hname">{h?.name}</span>}
          </div>
        </div>
      )
    },
    [holidayMap]
  )

  /** 给月视图格子打 class：周末 / 调休上班 / 法定假日 / 节日节气，用于底色 */
  const dayCellClassNames = useCallback(
    (arg: { date: Date }) => {
      const d = dayjs(arg.date)
      const classes: string[] = []
      const dow = d.day() // 0=周日, 6=周六
      if (dow === 0 || dow === 6) classes.push('cal-cell-weekend')
      const h = holidayMap.get(d.format('YYYY-MM-DD'))
      if (h?.type === 'holiday') classes.push('cal-cell-holiday')
      else if (h?.type === 'workday') classes.push('cal-cell-workday')
      if (getDayLunarInfo(arg.date).highlight) classes.push('cal-cell-festival')
      return classes
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

  const fcEvents = events
    .filter((e) => e.type !== 'todo')
    .map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      color: e.color || '#1677ff',
      extendedProps: { description: e.description || '', source: e.source },
    }))

  const submitAdd = () => {
    const title = evTitle.trim()
    if (!title) {
      message.warning(evType === 'todo' ? '请输入待办内容' : '请输入日程标题')
      return
    }

    // 待办：复用共享 TodoDialog 的保存逻辑（type:'todo'，写入 calendar-events.json）
    if (evType === 'todo') {
      setModalVisible(false)
      saveTodo(null, {
        title,
        due: evDue ? evDue.format('YYYY-MM-DD') : undefined,
        priority: evPriority,
      })
        .then(() => message.success('待办已添加到「待办管理」'))
        .catch(() => undefined)
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
    setEvType('event')
    setEvTitle('')
    setEvRange(null)
    setEvDue(null)
    setEvPriority('mid')
    setEvColor('#1677ff')
    setEvDesc('')
    setModalVisible(true)
  }

  const headerActions = actionsHost
    ? createPortal(
        <div className="cal-header-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <DatePicker
            size="small"
            value={pickerDate}
            onChange={handlePickerChange}
            allowClear={false}
            suffixIcon={null}
            style={{ width: 128 }}
          />
          <Button size="sm" onClick={openAdd} title="添加日程">
            <Plus className="h-4 w-4" />
          </Button>
        </div>,
        actionsHost
      )
    : null

  const fmtTime = (iso: string) => {
    const d = dayjs(iso)
    if (!d.isValid()) return iso
    return d.format('YYYY-MM-DD HH:mm')
  }

  return (
    <div ref={bodyRef} style={{ display: 'flex', padding: 0, gap: 12, alignItems: 'flex-start' }}>
      {headerActions}
      {loading && (
        <div style={{ position: 'absolute', top: 40, right: 12, zIndex: 10, fontSize: 12, color: '#86909c' }}>
          加载中…
        </div>
      )}
      <div className="cal-fc-wrap">
        <FullCalendar
          ref={calRef}
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
          height="auto"
          dayMaxEvents={3}
          nowIndicator
          selectable={false}
          editable={false}
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          dayCellContent={dayCell}
          dayCellClassNames={dayCellClassNames}
          dayHeaderContent={dayHeader}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        />
      </div>

      {/* 右栏：节日 / 节气预告 + 飞书状态 */}
      <div className="cal-sidebar">
        {upcomingFestivals.length > 0 && (
          <div className="cal-festival-box">
            <div className="cal-festival-title">📌 近 60 天节日 · 节气</div>
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
        <div className="cal-feishu-status">
          <span>📅 飞书日历：未连接</span>
          <Button variant="link" size="sm" style={{ fontSize: 11, padding: 0 }}>
            去连接
          </Button>
        </div>
      </div>

      {/* 事件详情弹窗：查看 + 删除（二次确认） */}
      <Dialog open={!!detailEvent} onOpenChange={(o) => { if (!o) { setDetailEvent(null); setDetailConfirm(false) } }}>
        <DialogContent className="max-w-[420px]">
          {!detailConfirm ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: detailEvent?.color || '#1677ff',
                    }}
                  />
                  {detailEvent?.title || '日程详情'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className="w-14 flex-shrink-0 text-[#86909c]">时间</span>
                  <span className="text-[#1d2129]">
                    {detailEvent ? `${fmtTime(detailEvent.start)} → ${fmtTime(detailEvent.end)}` : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-14 flex-shrink-0 text-[#86909c]">来源</span>
                  <span className="text-[#1d2129]">{detailEvent?.source === 'feishu' ? '飞书日历' : '本地日程'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-14 flex-shrink-0 text-[#86909c]">描述</span>
                  <span className="text-[#4e5969] whitespace-pre-wrap">{detailEvent?.description || '—'}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailEvent(null)}>
                  关闭
                </Button>
                <Button variant="destructive" onClick={() => setDetailConfirm(true)}>
                  删除
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>确认删除</DialogTitle>
              </DialogHeader>
              <div className="text-sm text-[#4e5969]">
                确定要删除日程「{detailEvent?.title}」吗？删除后不可恢复。
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailConfirm(false)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={handleDeleteEvent}>
                  确认删除
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 添加日程弹窗 */}
      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{evType === 'todo' ? '✅ 添加待办' : '📅 添加日程'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 类型：日程 / 待办（共用日程数据） */}
            <div className="space-y-1.5">
              <Label>类型</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setEvType('event')} style={segBtnStyle(evType === 'event')}>
                  📅 日程
                </button>
                <button type="button" onClick={() => setEvType('todo')} style={segBtnStyle(evType === 'todo')}>
                  ✅ 待办
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">标题</Label>
              <Input
                id="ev-title"
                value={evTitle}
                placeholder={evType === 'todo' ? '待办内容' : '日程标题'}
                onChange={(e) => setEvTitle(e.target.value)}
              />
            </div>

            {evType === 'todo' ? (
              <TodoFormFields
                title={evTitle}
                onTitle={setEvTitle}
                due={evDue}
                onDue={setEvDue}
                priority={evPriority}
                onPriority={setEvPriority}
              />
            ) : (
              <>
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
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">描述</Label>
              <Textarea
                id="ev-desc"
                rows={2}
                value={evDesc}
                placeholder="描述（可选）"
                onChange={(e) => setEvDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalVisible(false)}>
              取消
            </Button>
            <Button onClick={submitAdd}>{evType === 'todo' ? '添加待办' : '添加日程'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CalendarModule
