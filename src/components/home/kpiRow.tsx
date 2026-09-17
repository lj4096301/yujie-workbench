import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'

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
      fetchJson('/api/knowledge/tree'),
    ]).then(([kanban, calEvents, knowledge]) => {
      if (cancelled) return

      let tasksOpen = 0
      try {
        const raw = localStorage.getItem('yujie-tasks') ?? localStorage.getItem('mimo-tasks')
        const parsed = raw ? JSON.parse(raw) : []
        if (Array.isArray(parsed)) tasksOpen = parsed.filter((t: { done?: boolean }) => !t.done).length
      } catch {
        /* 忽略 */
      }

      const projects = (kanban as { projects?: unknown[] } | null)?.projects ?? []
      const cards = (kanban as { cards?: unknown[] } | null)?.cards ?? []
      const doingCards = (cards as Array<{ status?: string }>).filter((c) => c.status === 'doing').length

      const roots = Array.isArray(knowledge) ? (knowledge as Array<{ children?: unknown[] }>) : []
      let kCount = 0
      const walk = (nodes: Array<{ children?: unknown[] }>) => {
        for (const n of nodes ?? []) {
          kCount++
          if (n.children) walk(n.children as Array<{ children?: unknown[] }>)
        }
      }
      walk(roots)

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
          value: doingCards + tasksOpen,
          sub: `看板 ${doingCards} · 待办 ${tasksOpen}`,
          icon: '⚡',
          color: '#ff7d00',
          moduleId: 'tasks',
        },
        {
          key: 'today',
          label: '今日日程',
          value: calArr.length,
          sub: today,
          icon: '📅',
          color: '#00b42a',
          moduleId: 'calendar',
        },
        {
          key: 'knowledge',
          label: '知识条目',
          value: kCount,
          sub: `${roots.length} 个分类`,
          icon: '📚',
          color: '#722ed1',
          moduleId: 'knowledge',
        },
      ])
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (kpis.length === 0) return null

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
