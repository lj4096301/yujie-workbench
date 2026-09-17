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

/** ③ 右：今日待办——未完成任务清单，勾选即完成 */
const TodayTodo: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [list, setList] = useState<TodoItem[]>([])

  const read = (): TodoItem[] => {
    try {
      const raw = localStorage.getItem('yujie-tasks') ?? localStorage.getItem('mimo-tasks')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  useEffect(() => {
    setList(read().filter((t) => !t.done))
  }, [])

  const toggle = (id: string) => {
    const all = read()
    const next = all.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    localStorage.setItem('yujie-tasks', JSON.stringify(next))
    setList(next.filter((t) => !t.done))
  }

  return (
    <div
      className="hw-card hw-card-link"
      onClick={() => onOpen('tasks')}
      title="进入待办任务"
      style={{ cursor: 'pointer' }}
    >
      <div className="hw-card-head">
        <span className="hw-card-title">✅ 今日待办</span>
      </div>
      <div className="hw-card-body">
        {list.length === 0 ? (
          <div className="td-empty">暂无待办，休息一下</div>
        ) : (
          <div className="td-list">
            {list.slice(0, 6).map((t) => (
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
            {list.length > 6 && <div className="td-empty">还有 {list.length - 6} 条待办</div>}
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
