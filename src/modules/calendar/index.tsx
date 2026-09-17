import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Spin, Button, Modal, Form, Input, DatePicker, message } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import localeData from 'dayjs/plugin/localeData'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { getDayLunarInfo, getUpcomingFestivals } from './lunarUtils'
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

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7:00 - 22:00
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

type ViewMode = 'month' | 'week' | 'day'

const CalendarModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<ViewMode>('month')
  // isoWeek 下 startOf('isoWeek') 即周一，不能再额外加一天
  const [currentWeekStart, setCurrentWeekStart] = useState(dayjs().startOf('isoWeek'))
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'))
  const [activeDay, setActiveDay] = useState(dayjs())
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  // 当前视图需要展示的日期范围（用于拉取日程）
  const range = useMemo(() => {
    if (view === 'day') return { start: activeDay, end: activeDay }
    if (view === 'week') return { start: currentWeekStart, end: currentWeekStart.add(6, 'day') }
    return { start: currentMonth.startOf('month'), end: currentMonth.endOf('month') }
  }, [view, activeDay, currentWeekStart, currentMonth])

  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start.format('YYYY-MM-DD'), range.end.format('YYYY-MM-DD')])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar/events?start=${range.start.format('YYYY-MM-DD')}&end=${range.end.format('YYYY-MM-DD')}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  const getEventsForSlot = (day: Dayjs, hour: number) => {
    return events.filter((e) => {
      const start = dayjs(e.start)
      return start.isSame(day, 'day') && start.hour() === hour
    })
  }

  const getEventsForDay = (day: Dayjs) =>
    events.filter((e) => dayjs(e.start).isSame(day, 'day'))

  const handlePrev = () => {
    if (view === 'day') {
      const prev = activeDay.subtract(1, 'day')
      setActiveDay(prev)
      setCurrentWeekStart(prev.startOf('isoWeek'))
      setCurrentMonth(prev.startOf('month'))
    } else if (view === 'week') {
      setCurrentWeekStart(currentWeekStart.subtract(1, 'week'))
    } else {
      setCurrentMonth(currentMonth.subtract(1, 'month'))
    }
  }

  const handleNext = () => {
    if (view === 'day') {
      const next = activeDay.add(1, 'day')
      setActiveDay(next)
      setCurrentWeekStart(next.startOf('isoWeek'))
      setCurrentMonth(next.startOf('month'))
    } else if (view === 'week') {
      setCurrentWeekStart(currentWeekStart.add(1, 'week'))
    } else {
      setCurrentMonth(currentMonth.add(1, 'month'))
    }
  }

  const handleToday = () => {
    const now = dayjs()
    setCurrentWeekStart(now.startOf('isoWeek'))
    setCurrentMonth(now.startOf('month'))
    setActiveDay(now)
  }

  /** 月视图点击某天 → 跳到日视图看详情 */
  const openDay = (d: Dayjs) => {
    setActiveDay(d)
    setCurrentWeekStart(d.startOf('isoWeek'))
    setView('day')
  }

  const handleAddEvent = async (values: any) => {
    const event: CalendarEvent = {
      id: Date.now().toString(),
      title: values.title,
      start: values.timeRange[0].toISOString(),
      end: values.timeRange[1].toISOString(),
      color: values.color || '#1677ff',
      description: values.description,
      source: 'local',
    }
    setEvents([...events, event])
    setModalVisible(false)
    form.resetFields()
    message.success('日程已添加')
    try {
      await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })
    } catch {}
  }

  const viewTitle = view === 'day'
    ? activeDay.format('YYYY年M月D日 ddd')
    : view === 'week'
      ? `${currentWeekStart.format('YYYY年M月')} 第${currentWeekStart.format('W')}周`
      : currentMonth.format('YYYY年M月')

  // ============ 月视图：6 行 × 7 列网格 ============
  const monthCells = useMemo(() => {
    const gridStart = currentMonth.startOf('month').startOf('isoWeek')
    return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'))
  }, [currentMonth])

  const upcomingFestivals = useMemo(
    () => (view === 'month' ? getUpcomingFestivals(60, 8) : []),
    [view]
  )

  const today = dayjs()

  const weekDays = view === 'day'
    ? [activeDay]
    : Array.from({ length: 7 }, (_, i) => currentWeekStart.add(i, 'day'))

  const dayLunar = getDayLunarInfo(activeDay.toDate())

  const headerActions = actionsHost
    ? createPortal(
        <div className="cal-header-actions">
          <Button size="small" icon="←" onClick={handlePrev} />
          <Button size="small" onClick={handleToday}>今天</Button>
          <Button size="small" icon="→" onClick={handleNext} />
          <span style={{ width: 10 }} />
          <Button size="small" type={view === 'month' ? 'primary' : 'default'} onClick={() => setView('month')}>月</Button>
          <Button size="small" type={view === 'week' ? 'primary' : 'default'} onClick={() => setView('week')}>周</Button>
          <Button
            size="small"
            type={view === 'day' ? 'primary' : 'default'}
            onClick={() => {
              if (!activeDay.isSame(currentMonth, 'month')) setActiveDay(dayjs())
              setView('day')
            }}
          >
            日
          </Button>
          <Button size="small" type="primary" icon="＋" onClick={() => setModalVisible(true)} />
        </div>,
        actionsHost
      )
    : null

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0 }}>
      {headerActions}
      <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
        {viewTitle}
        {view === 'day' && dayLunar.full && (
          <div style={{ fontSize: 11, color: '#888' }}>
            {dayLunar.full} · {dayLunar.ganZhi}
            {dayLunar.festival ? ` · ${dayLunar.festival}` : ''}
          </div>
        )}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : view === 'month' ? (
        <>
          {/* ===== 月视图 ===== */}
          <div className="cal-month-grid">
            {WEEK_LABELS.map((w) => (
              <div key={w} className={`cal-month-weekday${w === '六' || w === '日' ? ' weekend' : ''}`}>{w}</div>
            ))}
            {monthCells.map((d) => {
              const inMonth = d.isSame(currentMonth, 'month')
              const isToday = d.isSame(today, 'day')
              const info = getDayLunarInfo(d.toDate())
              const dayEvents = getEventsForDay(d)
              return (
                <div
                  key={d.format('YYYY-MM-DD')}
                  className={`cal-month-cell${inMonth ? '' : ' dim'}${isToday ? ' today' : ''}`}
                  onClick={() => openDay(d)}
                  title={info.festival || info.full}
                >
                  <div className="cal-cell-date">
                    <span className={`cal-solar${isToday ? ' today-num' : ''}`}>{d.date()}</span>
                    <span className={`cal-lunar${info.highlight ? ' fest' : ''}`}>{info.label}</span>
                  </div>
                  <div className="cal-cell-events">
                    {dayEvents.slice(0, 2).map((e) => (
                      <div key={e.id} className="cal-cell-event" style={{ borderLeftColor: e.color || '#1677ff' }}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="cal-cell-more">还有 {dayEvents.length - 2} 项</div>
                    )}
                  </div>
                </div>
              )
            })}
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
        </>
      ) : (
        <>
          {/* ===== 周 / 日视图 ===== */}
          <div
            className="calendar-week-grid"
            style={{ fontSize: 11, gridTemplateColumns: `44px repeat(${weekDays.length}, minmax(0, 1fr))` }}
          >
            {/* 表头 */}
            <div className="calendar-day-header" style={{ background: '#fafafa' }}>时间</div>
            {weekDays.map((day) => {
              const info = getDayLunarInfo(day.toDate())
              return (
                <div
                  key={day.format('YYYY-MM-DD')}
                  className="calendar-day-header"
                  style={{
                    background: day.isSame(today, 'day') ? '#e6f4ff' : '#fafafa',
                    fontWeight: day.isSame(today, 'day') ? 700 : 600,
                  }}
                >
                  <div>{day.format('ddd')}</div>
                  <div style={{ fontSize: 14 }}>{day.format('D')}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, color: info.highlight ? '#f5222d' : '#999' }}>
                    {info.label}
                  </div>
                </div>
              )
            })}

            {/* 时间格 */}
            {HOURS.map((hour) => (
              <React.Fragment key={hour}>
                <div className="calendar-time-slot">{`${hour}:00`}</div>
                {weekDays.map((day) => {
                  const slotEvents = getEventsForSlot(day, hour)
                  return (
                    <div
                      key={`${day.format('YYYY-MM-DD')}-${hour}`}
                      style={{
                        borderBottom: '1px solid #f5f5f5',
                        borderRight: '1px solid #f5f5f5',
                        padding: 2,
                        minHeight: 48,
                        position: 'relative',
                      }}
                    >
                      {slotEvents.map((e) => (
                        <div
                          key={e.id}
                          className="calendar-event"
                          style={{ borderLeftColor: e.color || '#1677ff' }}
                          title={`${e.title}\n${e.description || ''}`}
                        >
                          {e.title}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {/* 飞书同步状态 */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#999' }}>
        <span>📅 飞书日历：未连接</span>
        <Button size="small" type="link" style={{ fontSize: 11, padding: 0 }}>
          去连接
        </Button>
      </div>

      {/* 添加日程弹窗 */}
      <Modal title="📅 添加日程" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={400}>
        <Form form={form} onFinish={handleAddEvent} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="日程标题" />
          </Form.Item>
          <Form.Item name="timeRange" label="时间" rules={[{ required: true }]}>
            <DatePicker.RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="color" label="颜色" initialValue="#1677ff">
            <div style={{ display: 'flex', gap: 8 }}>
              {['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'].map((c) => (
                <div
                  key={c}
                  onClick={() => form.setFieldsValue({ color: c })}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    cursor: 'pointer',
                    border: form.getFieldValue('color') === c ? '2px solid #333' : '2px solid transparent',
                  }}
                />
              ))}
            </div>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="日程描述（可选）" autoSize={{ minRows: 2 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>添加日程</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CalendarModule
