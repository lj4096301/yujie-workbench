import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Segmented, Spin, Empty, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

interface LogEntry {
  id: string
  action: string
  title: string
  content?: string
  projectName?: string
  priority?: string
  at: number
  module: string
  moduleTitle: string
  actionLabel: string
}

type LogFilter = 'all' | 'done'

/**
 * 日志管理：展示各模块的重点操作记录。
 * 顶部可切换「全部操作 / 项目完成」。
 */
const LogsModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [records, setRecords] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<LogFilter>('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/logs')
      if (res.ok) {
        const data = (await res.json()) as { records?: LogEntry[] }
        if (data && Array.isArray(data.records)) setRecords(data.records)
      }
    } catch {
      message.error('日志加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible =
    filter === 'all' ? records : records.filter((r) => r.action === 'done')

  const headerActions = actionsHost
    ? createPortal(
        <div className="logs-header-actions">
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as LogFilter)}
            options={[
              { label: `全部操作 (${records.length})`, value: 'all' },
              { label: `项目完成 (${records.filter((r) => r.action === 'done').length})`, value: 'done' },
            ]}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={load} title="刷新">
            刷新
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {headerActions}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : visible.length === 0 ? (
        <Empty
          style={{ marginTop: 48 }}
          description={filter === 'done' ? '暂无项目完成记录' : '暂无重点操作记录'}
        />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
          {visible.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 4px',
                borderBottom: '1px solid #f2f3f5',
              }}
            >
              <Tag
                color={r.action === 'done' ? 'success' : 'error'}
                style={{ marginTop: 1, flexShrink: 0 }}
              >
                {r.action === 'done' ? '✅ 完成' : '🗑️ 删除'}
              </Tag>
              <Tag color="arcoblue" style={{ marginTop: 1, flexShrink: 0, marginRight: 4 }}>
                {r.moduleTitle}
              </Tag>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{r.title}</div>
                {r.content && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#86909c',
                      marginTop: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {r.content}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#4e5969', marginTop: 2 }}>
                  {r.projectName ? `${r.projectName} · ` : ''}
                  {dayjs(r.at).format('YYYY-MM-DD HH:mm')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LogsModule
