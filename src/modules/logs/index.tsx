import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Segmented, Table, Tag, Popconfirm, message, Tooltip } from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
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
 * 日志管理：以表格展示各模块的重点操作记录，支持筛选、删除、清空。
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
    setLoading(true)
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

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/logs/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id))
        message.success('已删除该条日志')
      }
    } catch {
      message.error('删除失败')
    }
  }

  const clearAll = async () => {
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' })
      if (res.ok) {
        setRecords([])
        message.success('日志已清空')
      }
    } catch {
      message.error('清空失败')
    }
  }

  const visible =
    filter === 'all' ? records : records.filter((r) => r.action === 'done')

  const columns: ColumnsType<LogEntry> = [
    {
      title: '操作',
      dataIndex: 'action',
      width: 100,
      render: (_, r) => (
        <Tag color={r.action === 'done' ? 'success' : 'error'} style={{ marginInlineEnd: 0 }}>
          {r.action === 'done' ? '✅ 完成' : '🗑️ 删除'}
        </Tag>
      ),
    },
    {
      title: '来源',
      dataIndex: 'moduleTitle',
      width: 110,
      render: (t: string) => <Tag color="arcoblue">{t}</Tag>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (t: string, r) =>
        r.content ? (
          <Tooltip title={<div style={{ maxWidth: 480 }}>{r.content}</div>}>
            <span style={{ color: '#1d2129' }}>{t}</span>
          </Tooltip>
        ) : (
          <span style={{ color: '#1d2129' }}>{t}</span>
        ),
    },
    {
      title: '项目',
      dataIndex: 'projectName',
      width: 150,
      ellipsis: true,
      render: (v?: string) => v || '-',
    },
    {
      title: '时间',
      dataIndex: 'at',
      width: 165,
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'ops',
      width: 76,
      render: (_, r) => (
        <Popconfirm title="删除这条日志？" onConfirm={() => remove(r.id)} okText="删除" cancelText="取消">
          <Button type="text" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ]

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
          <Popconfirm title="清空全部日志？" onConfirm={clearAll} okText="清空" cancelText="取消">
            <Button size="small" danger>
              清空
            </Button>
          </Popconfirm>
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
      <Table<LogEntry>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={visible}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
        }}
        locale={{ emptyText: filter === 'done' ? '暂无项目完成记录' : '暂无重点操作记录' }}
        style={{ flex: 1 }}
      />
    </div>
  )
}

export default LogsModule
