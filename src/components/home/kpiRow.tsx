import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface KpiItem {
  key: string
  label: string
  value: number | string
  sub?: string
  icon: string
  color: string
  moduleId: string
}

function fmtToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

/** ② KPI 摘要行：项目 / 进行中 / 今日日程 / 知识条目，点击进入对应模块 */
const HomeKpiRow: React.FC<{ onOpen: (moduleId: string) => void }> = ({ onOpen }) => {
  const [kpis, setKpis] = useState<KpiItem[]>([])

  useEffect(() => {
    let cancelled = false
    const today = fmtToday()

    const fetchJson = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .catch(() => null)

    Promise.all([
      fetchJson('/api/kanban'),
      fetchJson(`/api/calendar/events?start=${today}&end=${today}`),
      fetchJson('/api/tasks'),
    ]).then(([kanban, calEvents, taskList]) => {
      if (cancelled) return

      const tasksArr = Array.isArray(taskList) ? (taskList as Array<{ done?: boolean }>) : []
      const tasksOpen = tasksArr.filter((t) => !t.done).length

      const projects = (kanban as { projects?: unknown[] } | null)?.projects ?? []
      const cards = (kanban as { cards?: unknown[] } | null)?.cards ?? []
      const doingCards = (cards as Array<{ status?: string }>).filter((c) => c.status === 'doing').length

      const calArr = Array.isArray(calEvents) ? (calEvents as unknown[]) : []

      setKpis([
        {
          key: 'project',
          label: '项目',
          value: projects.length,
          sub: `共 ${cards.length} 张卡片`,
          icon: '🎯',
          color: '#ff6700',
          moduleId: 'kanban',
        },
        {
          key: 'doing',
          label: '进行中',
          value: doingCards,
          sub: '看板进行中',
          icon: '⚡',
          color: '#ff7d00',
          moduleId: 'kanban',
        },
        {
          key: 'todo',
          label: '待办',
          value: tasksOpen,
          sub: '未完成任务',
          icon: '✅',
          color: '#00b42a',
          moduleId: 'tasks',
        },
        {
          key: 'today',
          label: '今日日程',
          value: calArr.length,
          sub: today,
          icon: '📅',
          color: '#165dff',
          moduleId: 'calendar',
        },
      ])
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (kpis.length === 0) {
    // 加载中：骨架卡展示
    return (
      <div className="hw-kpis">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="hw-kpi-card">
            <div className="hw-kpi-card-head">
              <Skeleton className="h-3 w-14 rounded" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-7 w-16 rounded" />
            <Skeleton className="mt-2 h-3 w-20 rounded" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="hw-kpis">
      {kpis.map((k) => (
        <Card
          key={k.key}
          className="hw-kpi-card"
          onClick={() => onOpen(k.moduleId)}
          title={`进入 ${k.label}`}
        >
          <div className="hw-kpi-card-head">
            <span className="hw-kpi-card-label">{k.label}</span>
            <span className="hw-kpi-card-icon" style={{ color: k.color }}>
              {k.icon}
            </span>
          </div>
          <CardContent className="p-0">
            <div className="hw-kpi-card-value">{k.value}</div>
            {k.sub && <div className="hw-kpi-card-sub">{k.sub}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default HomeKpiRow
