import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { message } from 'antd'
import { RefreshCw, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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

const PAGE_SIZE = 10

/**
 * 日志管理：以表格展示各模块的重点操作记录，支持筛选、删除、清空。
 * shadcn Table + Tabs：表头浅灰、hover 高亮、无斑马纹；分页右下角。
 */
const LogsModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [records, setRecords] = useState<LogEntry[]>([])
  const [clearOpen, setClearOpen] = useState(false)
  const [delRec, setDelRec] = useState<LogEntry | null>(null)
  const [filter, setFilter] = useState<LogFilter>('all')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

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

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const pageList = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const changeFilter = (v: LogFilter) => {
    setFilter(v)
    setPage(1)
  }

  const headerActions = actionsHost
    ? createPortal(
        <div className="logs-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Tabs value={filter} onValueChange={(v) => changeFilter(v as LogFilter)}>
            <TabsList>
              <TabsTrigger value="all">全部操作 {records.length}</TabsTrigger>
              <TabsTrigger value="done">
                项目完成 {records.filter((r) => r.action === 'done').length}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="sm" className="text-[#F53F3F]" onClick={() => setClearOpen(true)}>
            清空
          </Button>
          <Button variant="outline" size="sm" onClick={load} title="刷新">
            <RefreshCw className="h-4 w-4" />
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
        <div className="space-y-2" style={{ padding: '4px 0' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">操作</TableHead>
                  <TableHead className="w-[100px]">来源</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead className="w-[140px]">项目</TableHead>
                  <TableHead className="w-[130px]">时间</TableHead>
                  <TableHead className="w-[70px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-sm text-[#86909C]">
                      {filter === 'done' ? '暂无项目完成记录' : '暂无重点操作记录'}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageList.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium"
                          style={{ color: r.action === 'done' ? '#00B42A' : '#F53F3F' }}
                        >
                          <span
                            className="inline-block"
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: r.action === 'done' ? '#00B42A' : '#F53F3F',
                              boxShadow: '0 0 0 4px rgba(0,0,0,0.06)',
                            }}
                          />
                          {r.action === 'done' ? '完成' : '删除'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-primary">{r.moduleTitle}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[#1D2129]">{r.title}</span>
                        {r.content && (
                          <span className="ml-2 text-xs text-[#86909C]">{r.content}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[#4E5969]">{r.projectName || '-'}</TableCell>
                      <TableCell className="text-xs tabular-nums text-[#86909C]">
                        {dayjs(r.at).format('YYYY-MM-DD HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-[#F53F3F]" onClick={() => setDelRec(r)} title="删除日志">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 text-xs text-[#86909C]">
            <span>共 {visible.length} 条</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </Button>
            <span className="tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={clearOpen}
        title="清空全部日志"
        content="将删除全部日志记录，且不可恢复。确定清空吗？"
        danger
        okText="清空"
        onOk={clearAll}
        onOpenChange={(o) => { if (!o) setClearOpen(false) }}
      />

      <ConfirmDialog
        open={!!delRec}
        title="删除日志"
        content={delRec ? '确定删除「' + delRec.title + '」这条日志？' : ''}
        danger
        okText="删除"
        onOk={async () => { if (delRec) await remove(delRec.id) }}
        onOpenChange={(o) => { if (!o) setDelRec(null) }}
      />
    </div>
  )
}

export default LogsModule
