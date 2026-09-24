import React, { useEffect, useState } from 'react'
import { CalendarTool } from './toolGrid'

interface KanbanProject {
  id: string
  name: string
}

interface KanbanCard {
  id: string
  title: string
  projectId?: string
  priority?: string
  status?: string
  updatedAt?: number
}

interface KanbanData {
  projects?: KanbanProject[]
  cards?: KanbanCard[]
}

interface TodoItem {
  id: string
  title?: string
  done?: boolean
}

const STATUS_TEXT: Record<string, string> = {
  todo: '待推进',
  doing: '进行中',
  done: '已完成',
}

function statusBadge(status?: string): string {
  return 'wo-status wo-status-' + (status === 'done' ? 'done' : status === 'doing' ? 'doing' : 'todo')
}

interface CalEvent {
  id?: string
  title?: string
  start?: string
  end?: string
  color?: string
  source?: string
}

function fmtTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 日程事件时间标签（保留存储的 ISO 墙钟，避免时区漂移） */
function fmtEventWhen(s?: string): string {
  if (!s) return ''
  return (s.slice(0, 16) || '').replace('T', ' ')
}

/** ③ 左：看板总览——项目进度条 + 三态计数 + 最近卡片 */
const KanbanOverview: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [data, setData] = useState<KanbanData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/kanban')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setData(d as KanbanData)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const projects = data?.projects ?? []
  const cards = data?.cards ?? []
  const todoCount = cards.filter((c) => c.status === 'todo').length
  const doingCount = cards.filter((c) => c.status === 'doing').length
  const doneCount = cards.filter((c) => c.status === 'done').length

  // 项目进度 = 该项目卡片中 done 占比
  const projectProgress = (pid: string) => {
    const pc = cards.filter((c) => c.projectId === pid)
    if (pc.length === 0) return 0
    return Math.round((pc.filter((c) => c.status === 'done').length / pc.length) * 100)
  }

  // 最近更新的卡片（无卡片时显示空态）
  const recent = [...cards]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 2)

  return (
    <div
      className="hw-card hw-card-link"
      onClick={() => onOpen('kanban')}
      title="进入项目看板"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">🎯 看板总览</span>
      </div>
      <div className="hw-card-body">
        {projects.length === 0 ? (
          <div className="wo-empty">暂无项目，去看板创建第一个项目</div>
        ) : (
          projects.map((p) => {
            const pCount = cards.filter((c) => c.projectId === p.id).length
            const pct = projectProgress(p.id)
            return (
              <div key={p.id} className="wo-project">
                <div className="wo-project-row">
                  <span>{p.name}</span>
                  <span className="wo-project-count">
                    {pCount} 张卡片 · {pct}%
                  </span>
                </div>
                <div className="wo-progress">
                  <div
                    className="wo-progress-fill"
                    style={{ width: `${pct}%`, background: pct >= 100 ? '#00b42a' : '#ff6700' }}
                  />
                </div>
              </div>
            )
          })
        )}

        <div className="wo-stats">
          <div className="wo-stat">
            待推进 <b>{todoCount}</b>
          </div>
          <div className="wo-stat">
            进行中 <b>{doingCount}</b>
          </div>
          <div className="wo-stat">
            已完成 <b>{doneCount}</b>
          </div>
        </div>

        <div className="wo-recent">
          {recent.length === 0 ? (
            <div className="wo-empty">最近没有卡片动态</div>
          ) : (
            recent.map((c) => (
              <div key={c.id} className="wo-recent-item">
                <span className={statusBadge(c.status)} title={STATUS_TEXT[c.status ?? 'todo']} />
                <span className="wo-recent-title">📌 {c.title}</span>
                {c.priority === 'high' && <span className="wo-status wo-status-pri" title="高优先级" />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** ③ 右：今日待办（微软待办风格）——未完成计数徽标 + 勾选列表，数据走后端持久化
 *  合并展示：未完成任务（tasks.json）+ 即将到来的日程（calendar-events.json），
 *  让「在日程上建立的待办」也能在首页待办卡看到 */
const TodayTodo: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [tasks, setTasks] = useState<TodoItem[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])

  useEffect(() => {
    let cancelled = false
    const today = fmtTodayStr()
    const end = (() => {
      const d = new Date()
      d.setDate(d.getDate() + 60)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()
    const startTs = new Date(`${today}T00:00:00`).getTime()

    const pTasks = fetch('/api/tasks')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => (Array.isArray(d) ? d : []).filter((t: TodoItem) => !t.done))
      .catch(() => [] as TodoItem[])

    const pEvents = fetch(`/api/calendar/events?start=${today}&end=${end}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        (Array.isArray(d) ? d : []).filter(
          (e: CalEvent) => new Date(e.start ?? '').getTime() >= startTs
        )
      )
      .catch(() => [] as CalEvent[])

    Promise.all([pTasks, pEvents]).then(([t, e]) => {
      if (!cancelled) {
        setTasks(t)
        setEvents(e)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (id: string) => {
    const target = tasks.find((t) => t.id === id)
    if (!target) return
    const nextDone = !target.done
    setTasks(tasks.filter((t) => t.id !== id))
    fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: nextDone }),
    }).catch(() => undefined)
  }

  const upcoming = [...events]
    .sort((a, b) => new Date(a.start ?? '').getTime() - new Date(b.start ?? '').getTime())
    .slice(0, 4)

  const total = tasks.length + upcoming.length

  return (
    <div
      className="hw-card hw-card-link"
      onClick={() => onOpen('tasks')}
      title="进入待办任务"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">✅ 待办 · 日程</span>
        {total > 0 && (
          <span className="td-badge num-mono" title={`${total} 条未完成 / 待办`}>{total}</span>
        )}
      </div>
      <div className="hw-card-body">
        {total === 0 ? (
          <div className="td-empty">
            <span className="td-empty-emoji">🎉</span>
            <span>待办已清空，休息一下</span>
          </div>
        ) : (
          <div className="td-list">
            {tasks.slice(0, 6).map((t) => (
              <div key={t.id} className="td-item">
                <span
                  className="td-check"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(t.id)
                  }}
                  title="标记完成"
                >
                  ✓
                </span>
                <span className="td-title">{t.title ?? ''}</span>
              </div>
            ))}
            {upcoming.length > 0 && (
              <>
                <div className="td-sep">📅 来自日程</div>
                {upcoming.map((e) => (
                  <div
                    key={e.id}
                    className="td-item td-event"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onOpen('calendar')
                    }}
                    title="进入日程查看"
                  >
                    <span className="td-cal-dot" style={{ background: e.color || '#1677ff' }} />
                    <span className="td-title">{e.title ?? ''}</span>
                    <span className="td-date num-mono">{fmtEventWhen(e.start)}</span>
                  </div>
                ))}
              </>
            )}
            {tasks.length > 6 && <div className="td-empty">还有 {tasks.length - 6} 条待办</div>}
          </div>
        )}
      </div>
    </div>
  )
}

/** ③ 主工作区：看板总览 / 今日待办 / 日程 —— 一行三列 */
const HomeMainArea: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  return (
    <div className="hw-main">
      <KanbanOverview onOpen={onOpen} />
      <TodayTodo onOpen={onOpen} />
      <CalendarTool onOpen={onOpen} />
    </div>
  )
}

export default HomeMainArea
