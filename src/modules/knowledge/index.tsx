import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Tree, Dropdown, message as antMessage } from 'antd'
import {
  ReloadOutlined,
  FileAddOutlined,
  SaveOutlined,
  CloseOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { Plus, RefreshCw, FilePlus2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import SplitPane from '@/shared/split-pane'
import MarkdownView from './MarkdownView'
import GraphView from './GraphView'
import './knowledge.css'

interface KBFile {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: KBFile[]
  content?: string
  tags?: string[]
  links?: string[]
  snippet?: string
}

interface Backlink {
  path: string
  name: string
  snippet: string
}

interface Mention {
  path: string
  name: string
  snippet: string
}

interface KBFileDetail extends KBFile {
  frontmatter?: Record<string, unknown>
  backlinks?: Backlink[]
  unlinkedMentions?: Mention[]
}

type ViewMode = 'read' | 'edit' | 'split' | 'graph'

/** 展开文件树为一维列表（Quick Switcher 用） */
function flattenFiles(items: KBFile[], acc: KBFile[] = []): KBFile[] {
  for (const item of items) {
    if (item.type === 'file') acc.push(item)
    if (item.children) flattenFiles(item.children, acc)
  }
  return acc
}

/** 简易模糊匹配：子串命中优先，否则按子序列匹配 */
function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const idx = t.indexOf(q)
  if (idx === 0) return 0 // 文件名开头
  if (idx > 0) return idx <= 4 ? 1 : 2
  // 子序列
  let i = 0
  for (const ch of t) {
    if (ch === q[i]) i++
    if (i >= q.length) return 3
  }
  return -1
}

const KnowledgeModule: React.FC = () => {
  const [files, setFiles] = useState<KBFile[]>([])
  const [flatFiles, setFlatFiles] = useState<KBFile[]>([])
  const [selectedFile, setSelectedFile] = useState<KBFileDetail | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(() => {
    try {
      return localStorage.getItem('kb-selected-path')
    } catch { return null }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [loadError, setLoadError] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(() => {
    try {
      const saved = localStorage.getItem('kb-expanded-keys')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  // 视图模式：阅读 / 编辑 / 分屏 / 图谱
  const [mode, setMode] = useState<ViewMode>('read')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  // 新建笔记
  const [createOpen, setCreateOpen] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [creating, setCreating] = useState(false)

  // 重命名
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameFrom, setRenameFrom] = useState('')
  const [renameValue, setRenameValue] = useState('')

  // 删除确认（通用 ConfirmDialog）
  const [delTarget, setDelTarget] = useState<{ path: string; isFile: boolean } | null>(null)

  // Quick Switcher（Ctrl+P）
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickQuery, setQuickQuery] = useState('')
  const [quickIdx, setQuickIdx] = useState(0)

  // 反链面板
  const [panelOpen, setPanelOpen] = useState(true)

  // 加载 vault 文件树
  useEffect(() => {
    loadVault()
    // 全局搜索（Ctrl+K）接力：模块已挂载时通过事件立即打开
    const openFromSearch = (e: Event) => {
      const p = (e as CustomEvent).detail?.path
      if (p) void handleSelect(p)
    }
    window.addEventListener('mimo:open-kb', openFromSearch)
    return () => window.removeEventListener('mimo:open-kb', openFromSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadVault = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/knowledge/tree')
      if (res.ok) {
        const data: KBFile[] = await res.json()
        setFiles(data)
        setFlatFiles(flattenFiles(data))
        // 恢复上次的展开状态，或仅展开根目录
        try {
          const saved = localStorage.getItem('kb-expanded-keys')
          if (saved) {
            setExpandedKeys(JSON.parse(saved))
          } else {
            setExpandedKeys(collectFolderKeys(data).slice(0, 3)) // 只展开前3层
          }
        } catch {
          setExpandedKeys(collectFolderKeys(data).slice(0, 3))
        }
        // 全局搜索（Ctrl+K）接力：打开指定笔记
        const pending = sessionStorage.getItem('mimo-open-path')
        if (pending) {
          sessionStorage.removeItem('mimo-open-path')
          setTimeout(() => { void handleSelect(pending) }, 0)
        } else if (selectedPath) {
          // 恢复上次打开的文件
          setTimeout(() => { void handleSelect(selectedPath) }, 0)
        }
      } else {
        setLoadError(`服务返回异常（${res.status}）`)
      }
    } catch (err) {
      console.error('加载知识库失败:', err)
      setLoadError('无法连接服务。请确认应用已通过 scripts\\dev.bat 或 dev-web.bat 启动。')
    } finally {
      setLoading(false)
    }
  }

  // 收集所有文件夹 key 用于默认展开
  const collectFolderKeys = (items: KBFile[], acc: React.Key[] = []): React.Key[] => {
    for (const item of items) {
      if (item.type === 'folder') {
        acc.push(item.path)
        if (item.children) collectFolderKeys(item.children, acc)
      }
    }
    return acc
  }

  // 持久化展开状态
  useEffect(() => {
    try {
      localStorage.setItem('kb-expanded-keys', JSON.stringify(expandedKeys))
    } catch {}
  }, [expandedKeys])

  // 持久化选中文件
  useEffect(() => {
    try {
      if (selectedFile) {
        localStorage.setItem('kb-selected-path', selectedFile.path)
      }
    } catch {}
  }, [selectedFile])

  // 搜索（结果带上下文摘要）
  const handleSearch = async (value: string) => {
    setSearchQuery(value)
    if (value.length > 1) {
      setSearching(true)
      try {
        const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(value)}`)
        if (res.ok) {
          const data = await res.json()
          setFiles(data)
        }
      } catch {}
      setSearching(false)
    } else {
      loadVault()
    }
  }

  // 选中文件预览
  const handleSelect = useCallback(
    async (path?: string) => {
      // 取消选中（再次点击已选中节点）时 keys 为空，不处理
      if (!path) return
      let p = path.trim().replace(/\\/g, '/')
      if (!p.toLowerCase().endsWith('.md')) p += '.md'

      try {
        const res = await fetch(`/api/knowledge/file?path=${encodeURIComponent(p)}`)
        if (res.ok) {
          const data: KBFileDetail = await res.json()
          setSelectedFile(data)
          setPreviewContent(data.content || '')
          setEditContent(data.content || '')
          if (mode === 'graph') setMode('read')
        } else if (res.status === 404) {
          antMessage.warning(`未找到「${p}」，可能是尚未创建的链接`)
        }
      } catch {}
    },
    [mode]
  )

  // 转换为 Tree 数据（保留 snippet 供 titleRender 使用）
  const convertToTreeData = (items: KBFile[]): any[] => {
    return items.map((item) => ({
      title: item.name,
      key: item.path,
      path: item.path,
      type: item.type,
      snippet: item.snippet,
      isLeaf: item.type === 'file',
      children: item.children ? convertToTreeData(item.children) : undefined,
    }))
  }

  /* ---------- 新建 / 保存 ---------- */

  const handleCreate = async () => {
    let name = newFileName.trim().replace(/\\/g, '/')
    if (!name) {
      antMessage.warning('请输入文件名')
      return
    }
    if (!name.toLowerCase().endsWith('.md')) name += '.md'
    setCreating(true)
    try {
      const res = await fetch('/api/knowledge/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      antMessage.success('已创建')
      setCreateOpen(false)
      setNewFileName('')
      await loadVault()
      await handleSelect(name)
    } catch (err) {
      antMessage.error((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleSave = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      const res = await fetch('/api/knowledge/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path, content: editContent }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      antMessage.success('已保存')
      // 重新拉取，刷新标签 / 链接 / 反链等元数据
      await handleSelect(selectedFile.path)
    } catch (err) {
      antMessage.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /* ---------- 重命名（自动更新全库链接） ---------- */

  const openRename = (path: string) => {
    setRenameFrom(path)
    setRenameValue(path)
    setRenameOpen(true)
  }

  const handleRename = async () => {
    let to = renameValue.trim().replace(/\\/g, '/')
    if (!to) {
      antMessage.warning('请输入新路径')
      return
    }
    if (renameFrom.toLowerCase().endsWith('.md') && !to.toLowerCase().endsWith('.md')) to += '.md'
    if (to === renameFrom) {
      setRenameOpen(false)
      return
    }
    try {
      const res = await fetch('/api/knowledge/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: renameFrom, to }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      const n = data?.updatedLinks ?? 0
      antMessage.success(n > 0 ? `已重命名，并更新了 ${n} 处链接` : '已重命名')
      setRenameOpen(false)
      setSelectedFile((prev) => {
        if (!prev) return prev
        const normFrom = renameFrom.toLowerCase()
        if (prev.path.toLowerCase() === normFrom) return { ...prev, path: to, name: to.split('/').pop()!.replace(/\.md$/i, '') }
        if (prev.path.toLowerCase().startsWith(normFrom + '/')) return { ...prev, path: to + prev.path.slice(renameFrom.length) }
        return prev
      })
      await loadVault()
    } catch (err) {
      antMessage.error((err as Error).message)
    }
  }

  /* ---------- 删除（进 .trash 可找回） ---------- */

  const confirmDelete = (path: string) => {
    const isFile = path.toLowerCase().endsWith('.md')
    setDelTarget({ path, isFile })
  }

  const handleDelete = async () => {
    if (!delTarget) return
    const path = delTarget.path
    try {
      const res = await fetch(`/api/knowledge/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      antMessage.success('已删除（移入 .trash）')
      setSelectedFile((prev) => {
        if (!prev) return null
        const normPath = path.toLowerCase()
        if (prev.path.toLowerCase() === normPath || prev.path.toLowerCase().startsWith(normPath + '/')) return null
        return prev
      })
      await loadVault()
    } catch (err) {
      antMessage.error((err as Error).message)
    }
  }

  /* ---------- Quick Switcher (Ctrl+P) ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'p' || e.key === 'o')) {
        e.preventDefault()
        setQuickQuery('')
        setQuickIdx(0)
        setQuickOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const quickResults = useMemo(() => {
    const q = quickQuery.trim()
    if (!q) return flatFiles.slice(0, 20)
    return flatFiles
      .map((f) => ({ f, s: fuzzyMatch(q, f.name) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s || a.f.name.length - b.f.name.length)
      .slice(0, 20)
      .map((x) => x.f)
  }, [quickQuery, flatFiles])

  const openFromQuick = (f: KBFile) => {
    setQuickOpen(false)
    handleSelect(f.path)
  }

  /* ---------- 拖拽移动 ---------- */

  const allowDrop = ({ dragNode, dropNode, dropPosition }: { dragNode: any; dropNode: any; dropPosition: number }) => {
    if (dropPosition !== 0) return false // 只允许拖入节点内部（文件夹），不支持排序
    if (!dropNode) return false
    const dragKey = String(dragNode?.key ?? '')
    const dropKey = String(dropNode.key ?? '')
    if (dragKey && dropKey.toLowerCase().startsWith(dragKey.toLowerCase() + '/')) return false
    return true
  }

  const handleDrop = async (info: any) => {
    const dragPath = String(info.dragNode?.key ?? '')
    const dropPath = String(info.node?.key ?? '')
    if (!dragPath || !dropPath || info.dropToGap) return
    const name = dragPath.split('/').pop() ?? ''
    if (!name) return
    const targetPath = `${dropPath}/${name}`
    if (targetPath === dragPath) return
    try {
      const res = await fetch('/api/knowledge/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: dragPath, to: targetPath }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      antMessage.success(`已移动到「${dropPath.split('/').pop()}」`)
      setSelectedFile((prev) => {
        if (!prev) return prev
        const normDrag = dragPath.toLowerCase()
        if (prev.path.toLowerCase() === normDrag) {
          return { ...prev, path: targetPath, name: name.replace(/\.md$/i, '') }
        }
        if (prev.path.toLowerCase().startsWith(normDrag + '/')) {
          const rest = prev.path.slice(dragPath.length)
          return { ...prev, path: dropPath + '/' + name + rest }
        }
        return prev
      })
      await loadVault()
    } catch (err) {
      antMessage.error((err as Error).message)
    }
  }

  /* ---------- 渲染辅助 ---------- */

  const startEdit = () => {
    setEditContent(previewContent)
    setMode(mode === 'split' ? 'split' : 'edit')
  }

  const isEditing = mode === 'edit' || mode === 'split'

  // 字数统计（CJK 按字符计，英文按词计）
  const stats = useMemo(() => {
    const text = isEditing ? editContent : previewContent
    const chars = text.length
    const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const enWords = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length
    const words = cjk + enWords
    const minutes = Math.max(1, Math.ceil(words / 400))
    return { chars, words, minutes }
  }, [isEditing, editContent, previewContent])

  // 右键菜单
  const contextMenu = (nodeData: { type: string; path: string }) => {
    const isFile = nodeData.type === 'file'
    return {
      items: [
        isFile
          ? { key: 'open', icon: <LinkOutlined />, label: '打开' }
          : { key: 'new', icon: <FileAddOutlined />, label: '在此文件夹新建笔记' },
        { type: 'divider' as const },
        { key: 'rename', icon: <EditOutlined />, label: isFile ? '重命名' : '重命名文件夹' },
        { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === 'open') handleSelect(nodeData.path)
        if (key === 'new') {
          setNewFileName(nodeData.path + '/')
          setCreateOpen(true)
        }
        if (key === 'rename') openRename(nodeData.path)
        if (key === 'delete') confirmDelete(nodeData.path)
      },
    }
  }

  const titleRender = (nodeData: any) => {
    const isFile = nodeData.type === 'file'
    return (
      <Dropdown trigger={['contextMenu']} menu={contextMenu(nodeData)}>
        <span className="kb-node" title={nodeData.path}>
          <span role="img" aria-label={isFile ? 'file' : 'folder'} className="ant-tree-iconEle ant-tree-icon__customize">
            {isFile ? '📄' : '📁'}
          </span>
          <span className="kb-node-main">{nodeData.title ?? nodeData.name}</span>
          {nodeData.snippet && <div className="kb-snippet">{nodeData.snippet}</div>}
        </span>
      </Dropdown>
    )
  }

  /* ---------- 反链 / 正链 / 未链接提及 面板 ---------- */

  const backlinks = selectedFile?.backlinks ?? []
  const forwardLinks = selectedFile?.links ?? []
  const mentions = selectedFile?.unlinkedMentions ?? []

  const LinkPanel = selectedFile ? (
    <div className="kb-linkpanel">
      <div className="kb-linkpanel-head" onClick={() => setPanelOpen((v) => !v)}>
        <LinkOutlined />
        <span>
          反向链接 {backlinks.length} · 正向链接 {forwardLinks.length} · 未链接提及 {mentions.length}
        </span>
        <span className="kb-linkpanel-toggle">{panelOpen ? '▾' : '▸'}</span>
      </div>
      {panelOpen && (
        <div className="kb-linkpanel-body">
          <div className="kb-linkpanel-col">
            <div className="kb-linkpanel-title">反向链接（谁引用了我）</div>
            {backlinks.length === 0 ? (
              <div className="kb-linkpanel-empty">还没有笔记链接到这里</div>
            ) : (
              backlinks.map((b) => (
                <div key={b.path} className="kb-linkpanel-item" onClick={() => handleSelect(b.path)}>
                  <span className="kb-linkpanel-name">📄 {b.name}</span>
                  {b.snippet && <div className="kb-snippet">{b.snippet}</div>}
                </div>
              ))
            )}
          </div>
          <div className="kb-linkpanel-col">
            <div className="kb-linkpanel-title">正向链接（我引用了谁）</div>
            {forwardLinks.length === 0 ? (
              <div className="kb-linkpanel-empty">用 [[双链]] 连接其他笔记吧</div>
            ) : (
              forwardLinks.map((l) => (
                <div key={l} className="kb-linkpanel-item" onClick={() => handleSelect(l)}>
                  <span className="kb-linkpanel-name">🔗 {l}</span>
                </div>
              ))
            )}
          </div>
          <div className="kb-linkpanel-col">
            <div className="kb-linkpanel-title">未链接提及（正文提到但没建链）</div>
            {mentions.length === 0 ? (
              <div className="kb-linkpanel-empty">没有未链接的提及</div>
            ) : (
              mentions.map((m) => (
                <div key={m.path} className="kb-linkpanel-item" onClick={() => handleSelect(m.path)}>
                  <span className="kb-linkpanel-name">📄 {m.name}</span>
                  {m.snippet && <div className="kb-snippet">{m.snippet}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  ) : null

  const modeTabs = (
    <Tabs
      value={mode}
      onValueChange={(v) => {
        const next = v as ViewMode
        if ((next === 'edit' || next === 'split') && editContent !== previewContent) {
          setEditContent(previewContent)
        }
        setMode(next)
      }}
    >
      <TabsList>
        <TabsTrigger value="read" className="h-8 px-3">阅读</TabsTrigger>
        <TabsTrigger value="edit" className="h-8 px-3">编辑</TabsTrigger>
        <TabsTrigger value="split" className="h-8 px-3">分屏</TabsTrigger>
        <TabsTrigger value="graph" className="h-8 px-3">图谱</TabsTrigger>
      </TabsList>
    </Tabs>
  )

  /* ---------- 视图 ---------- */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
    <SplitPane
      storageKey="mimo-split-knowledge"
      defaultWidth={200}
      minWidth={200}
      maxWidth={520}
      left={
        <div style={{ paddingRight: 4 }}>
          {/* 左栏工具条 */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <Input
              placeholder="搜索笔记..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-8 min-w-0 flex-1"
            />
            <Button size="sm" variant="ghost" onClick={() => { setNewFileName(''); setCreateOpen(true) }} title="新建笔记">
              <FilePlus2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setQuickQuery(''); setQuickIdx(0); setQuickOpen(true) }} title="快速切换 (Ctrl+P)">
              <Search className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={loadVault} title="重新加载文件树">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {loadError ? (
            <div
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8,
                padding: '8px 12px', borderRadius: 8, background: '#ffece8',
                border: '1px solid #fbaca3', fontSize: 12, color: '#cb272d',
              }}
            >
              <span style={{ marginTop: 1 }}>⚠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>知识库加载失败</div>
                <div>{loadError}</div>
              </div>
              <Button size="sm" variant="outline" className="text-[#F53F3F]" onClick={loadVault}>
                重试
              </Button>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--text-muted)' }}>
              加载中...
            </div>
          ) : files.length > 0 ? (
            <Tree
              treeData={convertToTreeData(files)}
              onSelect={(keys) => handleSelect(keys[0] as string)}
              titleRender={titleRender}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys)}
              draggable={{ icon: false }}
              allowDrop={allowDrop}
              onDrop={handleDrop}
              style={{ fontSize: 14 }}
            />
          ) : (
            <div className="mod-empty" style={{ padding: '24px 8px' }}>
              {searchQuery ? '没有匹配的笔记' : '暂无笔记'}
            </div>
          )}
        </div>
      }
      right={
        mode === 'graph' ? (
          <GraphView width={0} height={0} onOpen={(path) => handleSelect(path)} />
        ) : selectedFile ? (
          <div className="kb-preview">
            <div className="kb-toolbar">
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{selectedFile.name}</h2>
              {selectedFile.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[#ff6700]">{tag}</Badge>
              ))}
              <span style={{ flex: 1 }} />
              <span className="kb-statusbar">{stats.words} 字 · 约 {stats.minutes} 分钟</span>
              {modeTabs}
              {isEditing && (
                <>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <SaveOutlined style={{ fontSize: 12, marginRight: 4 }} />
                    {saving ? '保存中…' : '保存'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMode('read')}>
                    <CloseOutlined style={{ fontSize: 12, marginRight: 4 }} />
                    取消
                  </Button>
                </>
              )}
            </div>
            <div className="kb-body">
              {mode === 'read' ? (
                <div className="kb-md-scroll">
                  <MarkdownView
                    content={previewContent}
                    onWikiLink={(name) => handleSelect(name + '.md')}
                  />
                </div>
              ) : mode === 'edit' ? (
                <div className="kb-editor-full">
                  <CodeMirror
                    value={editContent}
                    height="100%"
                    theme="light"
                    extensions={[markdown({ base: markdownLanguage })]}
                    onChange={setEditContent}
                    basicSetup={{ foldGutter: false, highlightActiveLine: true }}
                  />
                </div>
              ) : (
                <div className="kb-split">
                  <div className="kb-editor-half">
                    <CodeMirror
                      value={editContent}
                      height="100%"
                      theme="light"
                      extensions={[markdown({ base: markdownLanguage })]}
                      onChange={setEditContent}
                      basicSetup={{ foldGutter: false }}
                    />
                  </div>
                  <div className="kb-md-scroll kb-preview-half">
                    <MarkdownView
                      content={editContent}
                      onWikiLink={(name) => handleSelect(name + '.md')}
                    />
                  </div>
                </div>
              )}
              {LinkPanel}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="kb-toolbar">
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>选择一个笔记查看 · Ctrl+P 快速切换</span>
              <span style={{ flex: 1 }} />
              {modeTabs}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="mod-empty" style={{ padding: '80px 16px' }}>
                选择一个笔记查看；图谱模式在上方切换
              </div>
            </div>
          </div>
        )
      }
    />

      {/* 新建笔记弹窗 */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>新建笔记</DialogTitle>
          </DialogHeader>
          <div style={{ padding: '4px 0' }}>
            <Input
              placeholder="文件名，可含子文件夹，如：20_项目（project）/新笔记"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="h-8"
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              不写 .md 后缀会自动补上；用 / 分隔可顺便创建子文件夹。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名弹窗 */}
      <Dialog open={renameOpen} onOpenChange={(o) => !o && setRenameOpen(false)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>重命名（自动更新全库引用链接）</DialogTitle>
          </DialogHeader>
          <div style={{ padding: '4px 0' }}>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
              onFocus={(e) => e.target.select()}
              className="h-8"
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              修改路径中最后一段即可重命名；全库中 [[引用]] 会同步更新，别名和锚点保留。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button onClick={handleRename}>重命名</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Switcher */}
      <Dialog open={quickOpen} onOpenChange={(o) => !o && setQuickOpen(false)}>
        <DialogContent className="w-[480px] max-w-[calc(100vw-32px)] min-w-0">
          <div style={{ padding: '4px 0', minWidth: 0 }}>
            <Input
              placeholder="输入笔记名，模糊匹配，↑↓ 选择，Enter 打开…"
              value={quickQuery}
              onChange={(e) => {
                setQuickQuery(e.target.value)
                setQuickIdx(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setQuickIdx((i) => Math.min(i + 1, quickResults.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setQuickIdx((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Enter' && quickResults[quickIdx]) {
                  openFromQuick(quickResults[quickIdx])
                }
              }}
              autoFocus
              className="h-8"
            />
            <div className="kb-quick-list">
              {quickResults.length === 0 ? (
                <div className="kb-quick-empty">没有匹配的笔记</div>
              ) : (
                quickResults.map((f, i) => (
                  <div
                    key={f.path}
                    className={`kb-quick-item${i === quickIdx ? ' active' : ''}`}
                    onMouseEnter={() => setQuickIdx(i)}
                    onClick={() => openFromQuick(f)}
                  >
                    <span className="kb-quick-name">📄 {f.name}</span>
                    <span className="kb-quick-path">{f.path}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除二次确认（通用 ConfirmDialog） */}
      <ConfirmDialog
        open={!!delTarget}
        content={
          delTarget ? (
            <>
              <div style={{ fontWeight: 600, color: '#F53F3F' }}>{delTarget.path}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {delTarget.isFile ? '删除这个笔记？' : '删除这个文件夹？'}将移入知识库的 .trash 目录，可在文件管理器中找回。
              </div>
            </>
          ) : null
        }
        okText="删除"
        danger
        onOk={() => handleDelete()}
        onOpenChange={(o) => !o && setDelTarget(null)}
      />
    </div>
  )
}

export default KnowledgeModule
