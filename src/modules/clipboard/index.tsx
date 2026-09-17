import React, { useMemo, useState } from 'react'
import { message } from 'antd'
import { Copy, Eraser, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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

const SOURCE_META: Record<ClipboardItem['source'], { label: string; dot: string }> = {
  global: { label: '系统', dot: '#ff6700' },
  copy: { label: '应用内复制', dot: '#00b42a' },
  manual: { label: '手动', dot: '#c9cdd4' },
}

const ClipboardModule: React.FC = () => {
  const items = useClipboardStore((s) => s.items)
  const add = useClipboardStore((s) => s.add)
  const remove = useClipboardStore((s) => s.remove)
  const clear = useClipboardStore((s) => s.clear)
  const [query, setQuery] = useState('')
  // 清空二次确认（通用 ConfirmDialog）
  const [clearOpen, setClearOpen] = useState(false)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {/* 工具条：常驻面板顶部（限宽搜索 + 捕获 + 清空） */}
      <div
        className="cp-toolbar"
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
      >
        <Input
          placeholder="搜索历史..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 min-w-0 max-w-[320px] flex-1"
        />
        <Button size="sm" variant="outline" className="shrink-0" onClick={captureNow} title="读取当前系统剪贴板">
          <ScanLine className="h-4 w-4" />
          捕获
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 text-[#F53F3F]"
          onClick={() => setClearOpen(true)}
          disabled={items.length === 0}
        >
          <Eraser className="h-4 w-4" />
          清空
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="mod-empty">
          {items.length === 0
            ? '在应用内复制，或桌面端全局复制，都会记录到这里'
            : '无匹配结果'}
        </div>
      ) : (
        visible.map((i) => (
          <div key={i.id} className="mod-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="clip-text">{i.text}</div>
              <div className="mod-row-sub" style={{ marginTop: 4 }}>
                <span style={{ marginRight: 8 }}>{timeAgo(i.ts)}</span>
                <span className="src-dot" style={{ color: SOURCE_META[i.source].dot }}>
                  <i
                    style={{
                      display: 'inline-block',
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: SOURCE_META[i.source].dot,
                      boxShadow: `0 0 0 3px ${SOURCE_META[i.source].dot}22`,
                      marginRight: 6,
                      verticalAlign: 'middle',
                    }}
                  />
                  {SOURCE_META[i.source].label}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => copyBack(i.text)}>
              <Copy className="h-3.5 w-3.5" />
              复制
            </Button>
            <Button variant="ghost" size="sm" className="text-[#F53F3F]" onClick={() => remove(i.id)}>
              删
            </Button>
          </div>
        ))
      )}

      {/* 清空二次确认（通用 ConfirmDialog） */}
      <ConfirmDialog
        open={clearOpen}
        title="清空全部记录？"
        content={`将删除全部 ${items.length} 条剪贴板记录，此操作不可恢复。`}
        okText="清空"
        danger
        onOk={() => clear()}
        onOpenChange={(o) => !o && setClearOpen(false)}
      />
    </div>
  )
}

export default ClipboardModule
