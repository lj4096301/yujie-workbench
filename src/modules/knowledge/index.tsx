import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Input, Tree, Empty, Spin, Tag, Alert, Button, Space, Modal, message, Segmented, Dropdown } from 'antd'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [loadError, setLoadError] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

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
        // 默认展开全部文件夹，避免"看起来是空的"
        setExpandedKeys(collectFolderKeys(data))
        // 全局搜索（Ctrl+K）接力：打开指定笔记
        const pending = sessionStorage.getItem('mimo-open-path')
        if (pending) {
          sessionStorage.removeItem('mimo-open-path')
          setTimeout(() => { void handleSelect(pending) }, 0)
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
          message.warning(`未找到「${p}」，可能是尚未创建的链接`)
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
      message.warning('请输入文件名')
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
      message.success('已创建')
      setCreateOpen(false)
      setNewFileName('')
      await loadVault()
      await handleSelect(name)
    } catch (err) {
      message.error((err as Error).message)
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
      message.success('已保存')
      // 重新拉取，刷新标签 / 链接 / 反链等元数据
      await handleSelect(selectedFile.path)
    } catch (err) {
      message.error((err as Error).message)
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
      message.warning('请输入新路径')
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
      message.success(n > 0 ? `已重命名，并更新了 ${n} 处链接` : '已重命名')
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
      message.error((err as Error).message)
    }
  }

  /* ---------- 删除（进 .trash 可找回） ---------- */

  const handleDelete = (path: string) => {
    const isFile = path.toLowerCase().endsWith('.md')
    Modal.confirm({
      title: isFile ? '删除这个笔记？' : '删除这个文件夹？',
      content: (
        <div>
          <div style={{ color: '#fa541c', fontWeight: 600 }}>{path}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
            将移入知识库的 .trash 目录，可在文件管理器中找回。
          </div>
        </div>
      ),
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch(`/api/knowledge/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
          message.success('已删除（移入 .trash）')
          setSelectedFile((prev) => {
            if (!prev) return null
            const normPath = path.toLowerCase()
            if (prev.path.toLowerCase() === normPath || prev.path.toLowerCase().startsWith(normPath + '/')) return null
            return prev
          })
          await loadVault()
        } catch (err) {
          message.error((err as Error).message)
        }
      },
    })
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
      message.success(`已移动到「${dropPath.split('/').pop()}」`)
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
      message.error((err as Error).message)
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
        if (key === 'delete') handleDelete(nodeData.path)
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

  /* ---------- 视图 ---------- */

  return (
    <div>
    <SplitPane
      storageKey="mimo-split-knowledge"
      defaultWidth={200}
      minWidth={140}
      maxWidth={520}
      left={
        <div style={{ paddingRight: 4 }}>
          <Space.Compact block style={{ marginBottom: 8 }}>
            <Input
              prefix="🔍"
              placeholder="搜索笔记..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              size="small"
              allowClear
            />
            <Button
              size="small"
              icon={<FileAddOutlined />}
              onClick={() => {
                setNewFileName('')
                setCreateOpen(true)
              }}
              title="新建笔记"
            />
            <Button
              size="small"
              icon={<SearchOutlined />}
              onClick={() => {
                setQuickQuery('')
                setQuickIdx(0)
                setQuickOpen(true)
              }}
              title="快速切换 (Ctrl+P)"
            />
            <Button size="small" icon={<ReloadOutlined />} onClick={loadVault} title="重新加载文件树" />
          </Space.Compact>
          {loadError ? (
            <Alert
              type="error"
              showIcon
              message="知识库加载失败"
              description={loadError}
              action={
                <Button size="small" danger onClick={loadVault}>
                  重试
                </Button>
              }
            />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
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
              style={{ fontSize: 13 }}
            />
          ) : (
            <Empty description={searchQuery ? '没有匹配的笔记' : '暂无笔记'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      }
      right={
        mode === 'graph' ? (
          <GraphView width={0} height={0} onOpen={(path) => handleSelect(path)} />
        ) : selectedFile ? (
          <div className="kb-preview">
            <div className="kb-toolbar">
              <h2 style={{ margin: 0, fontSize: 18 }}>{selectedFile.name}</h2>
              {selectedFile.tags?.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>)}
              <span style={{ flex: 1 }} />
              <span className="kb-statusbar">{stats.words} 字 · 约 {stats.minutes} 分钟</span>
              <Segmented
                size="small"
                value={mode}
                onChange={(v) => {
                  const next = v as ViewMode
                  if ((next === 'edit' || next === 'split') && editContent !== previewContent) {
                    setEditContent(previewContent)
                  }
                  setMode(next)
                }}
                options={[
                  { value: 'read', label: '阅读' },
                  { value: 'edit', label: '编辑' },
                  { value: 'split', label: '分屏' },
                  { value: 'graph', label: '图谱' },
                ]}
              />
              {isEditing && (
                <>
                  <Button size="small" type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                    保存
                  </Button>
                  <Button size="small" icon={<CloseOutlined />} onClick={() => setMode('read')}>
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
              <span style={{ fontSize: 12, color: '#999' }}>选择一个笔记查看 · Ctrl+P 快速切换</span>
              <span style={{ flex: 1 }} />
              <Segmented
                size="small"
                value={mode}
                onChange={(v) => setMode(v as ViewMode)}
                options={[
                  { value: 'read', label: '阅读' },
                  { value: 'edit', label: '编辑' },
                  { value: 'split', label: '分屏' },
                  { value: 'graph', label: '图谱' },
                ]}
              />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Empty description="选择一个笔记查看；图谱模式在上方切换" style={{ marginTop: 80 }} />
            </div>
          </div>
        )
      }
    />

      {/* 新建笔记弹窗 */}
      <Modal
        title="新建笔记"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginTop: 12 }}>
          <Input
            placeholder="文件名，可含子文件夹，如：20_项目（project）/新笔记"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onPressEnter={handleCreate}
            suffix=".md"
            autoFocus
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
            不写 .md 后缀会自动补上；用 / 分隔可顺便创建子文件夹。
          </div>
        </div>
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        title="重命名（自动更新全库引用链接）"
        open={renameOpen}
        onOk={handleRename}
        onCancel={() => setRenameOpen(false)}
        okText="重命名"
        cancelText="取消"
      >
        <div style={{ marginTop: 12 }}>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onPressEnter={handleRename}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
            修改路径中最后一段即可重命名；全库中 [[引用]] 会同步更新，别名和锚点保留。
          </div>
        </div>
      </Modal>

      {/* Quick Switcher */}
      <Modal
        title={null}
        open={quickOpen}
        onCancel={() => setQuickOpen(false)}
        footer={null}
        width={480}
        styles={{ body: { padding: '12px 16px 16px' } }}
      >
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
          prefix={<SearchOutlined style={{ color: '#999' }} />}
          autoFocus
          allowClear
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
      </Modal>
    </div>
  )
}

export default KnowledgeModule
