import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Input,
  Button,
  Modal,
  Empty,
  Popconfirm,
  message,
  Checkbox,
  Spin,
  Alert,
  Tree,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, CheckCircleOutlined } from '@ant-design/icons'
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
const BookmarksModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks())
  const [query, setQuery] = useState('')
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)
  const [form, setForm] = useState({ title: '', url: '', icon: '🔗', group: '' })

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

  const headerActions = actionsHost
    ? createPortal(
        <div className="bm-header-actions">
          <Input
            placeholder="搜索书签..."
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <Button size="small" icon={<UploadOutlined />} onClick={openImport} title="从 Edge / Chrome / Brave 导入书签">
            导入
          </Button>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAdd}>
            新增
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div>
      {headerActions}

      {/* ── 书签列表 ──────────────────────────────────────────────────── */}
      {bookmarks.length === 0 ? (
        <Empty description="还没有书签，点右上角新增或导入浏览器书签" />
      ) : (
        groups.map(([group, items]) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <div className="mod-muted" style={{ margin: '4px 2px' }}>
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
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(b)
                  }}
                />
                <Popconfirm
                  title="删除该书签？"
                  onConfirm={() => remove(b.id)}
                  okText="删除"
                  cancelText="取消"
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </div>
            ))}
          </div>
        ))
      )}

      {/* ── 新增 / 编辑弹窗 ────────────────────────────────────────────── */}
      <Modal
        title={editing ? '编辑书签' : '新增书签'}
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <div className="mod-muted" style={{ marginBottom: 4 }}>标题</div>
            <Input
              placeholder="例如：GitHub"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <div className="mod-muted" style={{ marginBottom: 4 }}>网址</div>
            <Input
              placeholder="github.com 或 https://..."
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: '0 0 90px' }}>
              <div className="mod-muted" style={{ marginBottom: 4 }}>图标</div>
              <Input
                placeholder="🔗"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="mod-muted" style={{ marginBottom: 4 }}>分组（可选）</div>
              <Input
                placeholder="如：开发 / 资讯"
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── 导入弹窗 ──────────────────────────────────────────────────── */}
      <Modal
        title="导入浏览器书签"
        open={importModalOpen}
        onOk={handleImportConfirm}
        onCancel={() => setImportModalOpen(false)}
        okText={`导入 ${selectedKeys.length} 条`}
        cancelText="取消"
        width={560}
        bodyStyle={{ maxHeight: 480, overflowY: 'auto' }}
        destroyOnClose
      >
        {importLoading && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Spin tip="正在读取浏览器书签..." />
          </div>
        )}

        {!importLoading && importError && (
          <Alert
            message="读取失败"
            description={importError}
            type="warning"
            showIcon
            style={{ marginBottom: 8 }}
          />
        )}

        {!importLoading && imported.length > 0 && (
          <>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
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
      </Modal>
    </div>
  )
}

export default BookmarksModule
