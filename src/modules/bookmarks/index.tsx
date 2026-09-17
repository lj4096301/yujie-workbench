import React, { useEffect, useMemo, useState } from 'react'
import { message, Tree } from 'antd'
import { Plus, Trash2, Pencil, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DataNode } from 'antd/es/tree'

interface Bookmark {
  id: string
  title: string
  url: string
  icon: string
  group?: string
}

interface ImportedBookmark {
  id: string
  title: string
  url: string
  icon: string
  group: string
}

const STORAGE_KEY = 'mimo-bookmarks'

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveBookmarks(list: Bookmark[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* 忽略存储失败 */
  }
}

/** 补全协议：github.com → https://github.com；已是 http(s) 则原样返回 */
function normalizeUrl(url: string): string {
  const u = url.trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return `https://${u}`
  return u
}

// ── 把书签列表转成 AntD Tree DataNode（按 group 分组）─────────────────────
function bookmarksToTreeData(bookmarks: ImportedBookmark[]): DataNode[] {
  const groupMap = new Map<string, ImportedBookmark[]>()
  for (const b of bookmarks) {
    if (!groupMap.has(b.group)) groupMap.set(b.group, [])
    groupMap.get(b.group)!.push(b)
  }

  return Array.from(groupMap.entries()).map(([group, items]) => {
    // 虚拟父节点（不选中，仅作折叠）
    const title = (
      <span style={{ fontSize: 12, color: '#888' }}>
        {group} · {items.length} 条
      </span>
    )
    return {
      key: `group-${group}`,
      title,
      selectable: false,
      children: items.map((b) => ({
        key: b.id,
        title: (
          <span style={{ fontSize: 13 }}>
            <span style={{ marginRight: 6 }}>{b.icon}</span>
            <span style={{ color: '#333' }}>{b.title}</span>
            <span style={{ marginLeft: 8, fontSize: 11, color: '#aaa' }}>{b.url}</span>
          </span>
        ),
      })),
    }
  })
}

// ── 主组件 ───────────────────────────────────────────────────────────────
const BookmarksModule: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks())
  const [query, setQuery] = useState('')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)
  const [form, setForm] = useState({ title: '', url: '', icon: '🔗', group: '' })
  // 删除二次确认（通用 ConfirmDialog）
  const [delTarget, setDelTarget] = useState<Bookmark | null>(null)

  // ── 导入相关状态 ──────────────────────────────────────────────────────
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [imported, setImported] = useState<ImportedBookmark[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  // ── 持久化 ────────────────────────────────────────────────────────────
  useEffect(() => {
    saveBookmarks(bookmarks)
  }, [bookmarks])

  // ── 手动增删改 ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null)
    setForm({ title: '', url: '', icon: '🔗', group: '' })
    setOpen(true)
  }

  const openEdit = (b: Bookmark) => {
    setEditing(b)
    setForm({ title: b.title, url: b.url, icon: b.icon || '🔗', group: b.group || '' })
    setOpen(true)
  }

  const handleSave = () => {
    const url = normalizeUrl(form.url)
    if (!form.title.trim() || !url) {
      message.warning('请填写标题和有效网址')
      return
    }
    if (editing) {
      setBookmarks((list) =>
        list.map((b) =>
          b.id === editing.id
            ? {
                ...b,
                title: form.title.trim(),
                url,
                icon: form.icon.trim() || '🔗',
                group: form.group.trim() || undefined,
              }
            : b
        )
      )
    } else {
      const item: Bookmark = {
        id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: form.title.trim(),
        url,
        icon: form.icon.trim() || '🔗',
        group: form.group.trim() || undefined,
      }
      setBookmarks((list) => [item, ...list])
    }
    setOpen(false)
  }

  const remove = (id: string) => setBookmarks((list) => list.filter((b) => b.id !== id))

  // ── 分组过滤渲染 ──────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? bookmarks.filter(
          (b) =>
            b.title.toLowerCase().includes(q) ||
            b.url.toLowerCase().includes(q) ||
            (b.group || '').toLowerCase().includes(q)
        )
      : bookmarks
    const map = new Map<string, Bookmark[]>()
    for (const b of filtered) {
      const g = b.group || '未分组'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(b)
    }
    return Array.from(map.entries())
  }, [bookmarks, query])

  // ── 导入流程 ──────────────────────────────────────────────────────────
  const openImport = () => {
    setImportModalOpen(true)
    setImportLoading(true)
    setImportError('')
    setImported([])
    setSelectedKeys([])

    const api = window.electronAPI
    if (!api?.importBookmarks) {
      setImportLoading(false)
      setImportError('当前为浏览器模式，无法读取本机书签。请在桌面应用中打开。')
      return
    }

    api.importBookmarks().then((items) => {
      setImportLoading(false)
      if (items.length === 0) {
        setImportError('未在系统中检测到任何浏览器书签。请确认已安装 Edge / Chrome / Brave 并添加过书签。')
      } else {
        setImported(items)
        // 默认全选
        setSelectedKeys(items.map((b) => b.id))
      }
    }).catch((err) => {
      setImportLoading(false)
      setImportError(`读取书签失败: ${String(err)}`)
    })
  }

  const handleImportConfirm = () => {
    const toAdd = imported.filter((b) => selectedKeys.includes(b.id))
    if (toAdd.length === 0) {
      message.warning('请至少选择一条书签')
      return
    }
    const newItems: Bookmark[] = toAdd.map((b) => ({
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: b.title,
      url: b.url,
      icon: b.icon,
      group: b.group,
    }))
    setBookmarks((list) => {
      // 避免重复 url 混入
      const existingUrls = new Set(list.map((b) => b.url))
      const unique = newItems.filter((b) => !existingUrls.has(b.url))
      message.success(`已导入 ${unique.length} 条书签`)
      return [...unique, ...list]
    })
    setImportModalOpen(false)
  }

  // AntD Tree 的 check 事件：选中父节点 group-* 时全选其下所有子节点
  const handleTreeCheck = (checkedKeys: React.Key[] | { checked: React.Key[]; halfChecked: React.Key[] }) => {
    const keys = Array.isArray(checkedKeys) ? checkedKeys : checkedKeys.checked
    setSelectedKeys(keys as string[])
  }

  const importedTreeData = useMemo(() => bookmarksToTreeData(imported), [imported])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {/* 工具条：搜索（限宽）+ 导入 + 新增 */}
      <div
        className="bm-toolbar"
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
      >
        <Input
          placeholder="搜索书签..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 min-w-0 max-w-[320px] flex-1"
        />
        <Button size="sm" variant="outline" className="shrink-0" onClick={openImport} title="从 Edge / Chrome / Brave 导入书签">
          <Upload className="h-4 w-4" />
          导入
        </Button>
        <Button size="sm" className="shrink-0" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          新增
        </Button>
      </div>

      {/* ── 书签列表 ──────────────────────────────────────────────────── */}
      {bookmarks.length === 0 ? (
        <div className="mod-empty">还没有书签，点上方新增或导入浏览器书签</div>
      ) : (
        groups.map(([group, items]) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <div className="mod-muted" style={{ margin: '4px 2px', color: '#86909C' }}>
              {group} · {items.length}
            </div>
            {items.map((b) => (
              <div
                key={b.id}
                className="mod-row mod-click"
                onClick={() => window.open(b.url, '_blank')}
              >
                <span style={{ fontSize: 16 }}>{b.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mod-row-title">{b.title}</div>
                  <div
                    className="mod-row-sub"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {b.url}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(b)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#F53F3F]"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDelTarget(b)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ))
      )}

      {/* ── 新增 / 编辑弹窗 ────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑书签' : '新增书签'}</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
            <div>
              <Label>标题</Label>
              <Input
                placeholder="例如：GitHub"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-8"
              />
            </div>
            <div>
              <Label>网址</Label>
              <Input
                placeholder="github.com 或 https://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="h-8"
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: '0 0 90px' }}>
                <Label>图标</Label>
                <Input
                  placeholder="🔗"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="h-8"
                />
              </div>
              <div style={{ flex: 1 }}>
                <Label>分组（可选）</Label>
                <Input
                  placeholder="如：开发 / 资讯"
                  value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 导入弹窗（Tree 内核保留） ──────────────────────────────────── */}
      <Dialog open={importModalOpen} onOpenChange={(o) => !o && setImportModalOpen(false)}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>导入浏览器书签</DialogTitle>
          </DialogHeader>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {importLoading && (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#86909C' }}>
                正在读取浏览器书签...
              </div>
            )}

            {!importLoading && importError && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  padding: '8px 12px',
                  marginBottom: 8,
                  borderRadius: 8,
                  background: '#fff7e8',
                  border: '1px solid #ffd666',
                  fontSize: 12,
                  color: '#ad6800',
                }}
              >
                <span style={{ marginTop: 1 }}>⚠</span>
                <span>{importError}</span>
              </div>
            )}

            {!importLoading && imported.length > 0 && (
              <>
                <div style={{ marginBottom: 8, fontSize: 12, color: '#86909C' }}>
                  <CheckCircle2 style={{ width: 13, height: 13, color: '#00b42a', marginRight: 4, verticalAlign: -2 }} />
                  检测到 {imported.length} 条书签，按浏览器分组显示。勾选要导入的条目。
                </div>
                <Tree
                  checkable
                  selectable={false}
                  defaultExpandAll
                  treeData={importedTreeData}
                  checkedKeys={selectedKeys}
                  onCheck={handleTreeCheck}
                  style={{ background: 'transparent' }}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleImportConfirm} disabled={imported.length === 0}>
              导入 {selectedKeys.length} 条
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 删除二次确认（通用 ConfirmDialog） ─────────────────────────── */}
      <ConfirmDialog
        open={!!delTarget}
        content={`删除书签「${delTarget?.title}」？`}
        okText="删除"
        danger
        onOk={() => delTarget && remove(delTarget.id)}
        onOpenChange={(o) => !o && setDelTarget(null)}
      />
    </div>
  )
}

export default BookmarksModule
