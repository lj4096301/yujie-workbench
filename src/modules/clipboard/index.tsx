import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Input, Button, Tag, Empty, message } from 'antd'
import { useClipboardStore, ClipboardItem } from '@/stores/clipboardStore'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

const SOURCE_META: Record<ClipboardItem['source'], { label: string; color: string }> = {
  global: { label: '系统', color: 'blue' },
  copy: { label: '应用内复制', color: 'green' },
  manual: { label: '手动', color: 'default' },
}

const ClipboardModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  const items = useClipboardStore((s) => s.items)
  const add = useClipboardStore((s) => s.add)
  const remove = useClipboardStore((s) => s.remove)
  const clear = useClipboardStore((s) => s.clear)
  const [query, setQuery] = useState('')
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((i) => i.text.toLowerCase().includes(q)) : items
  }, [items, query])

  const copyBack = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制回剪贴板')
    } catch {
      message.error('复制失败（浏览器权限受限）')
    }
  }

  const captureNow = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) add(text, 'manual')
      else message.info('当前剪贴板为空')
    } catch {
      message.error('无法读取剪贴板（需在桌面端或授予权限）')
    }
  }

  const headerActions = actionsHost
    ? createPortal(
        <div className="cp-header-actions">
          <Input
            placeholder="搜索历史..."
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <Button size="small" onClick={captureNow} title="读取当前系统剪贴板">
            捕获
          </Button>
          <Button size="small" danger onClick={clear} disabled={items.length === 0}>
            清空
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div>
      {headerActions}

      {visible.length === 0 ? (
        <Empty
          description={
            items.length === 0
              ? '在应用内复制，或桌面端全局复制，都会记录到这里'
              : '无匹配结果'
          }
        />
      ) : (
        visible.map((i) => (
          <div key={i.id} className="mod-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="clip-text">{i.text}</div>
              <div className="mod-row-sub" style={{ marginTop: 4 }}>
                <span style={{ marginRight: 8 }}>{timeAgo(i.ts)}</span>
                <Tag color={SOURCE_META[i.source].color} style={{ marginRight: 0 }}>
                  {SOURCE_META[i.source].label}
                </Tag>
              </div>
            </div>
            <Button type="text" size="small" onClick={() => copyBack(i.text)}>
              复制
            </Button>
            <Button type="text" size="small" danger onClick={() => remove(i.id)}>
              删
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

export default ClipboardModule
