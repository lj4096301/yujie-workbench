import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Tabs, Input, Button, Card, Tag, Empty, Modal, Form, message, Progress, Popconfirm, Select, Tooltip } from 'antd'
import {
  UserOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CheckCircleFilled,
  LoadingOutlined,
  EditOutlined,
} from '@ant-design/icons'
import SplitPane from '@/shared/split-pane'

interface Chapter {
  id: string
  title: string
  order: number
  content: string
  status: 'draft' | 'writing' | 'done'
  wordCount: number
  target?: number
}

interface Character {
  id: string
  name: string
  age: string
  personality: string
  background: string
  relationships: { targetId: string; relation: string }[]
  notes: string
}

interface Note {
  id: string
  content: string
  tags: string[]
  createdAt: string
}

interface WorldDoc {
  id: string
  title: string
  content: string
}

interface NovelData {
  chapters: Chapter[]
  characters: Character[]
  notes: Note[]
  worldDocs: WorldDoc[]
}

const EMPTY: NovelData = { chapters: [], characters: [], notes: [], worldDocs: [] }

/** 字数统计：CJK 按字符、英文按词 */
function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const en = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length
  return cjk + en
}

const NovelModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [activeTab, setActiveTab] = useState('outline')
  const [data, setData] = useState<NovelData>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const dirtyRef = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data

  // 选中项（存 id，从最新 state 派生，避免编辑时对象过期）
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null)

  // 弹窗
  const [noteModalVisible, setNoteModalVisible] = useState(false)
  const [charModalVisible, setCharModalVisible] = useState(false)
  const [editingChar, setEditingChar] = useState<Character | null>(null)
  const [worldModalVisible, setWorldModalVisible] = useState(false)
  const [noteForm] = Form.useForm()
  const [charForm] = Form.useForm()
  const [worldForm] = Form.useForm()

  // 人物关系编辑的临时状态
  const [relTarget, setRelTarget] = useState<string | undefined>()
  const [relLabel, setRelLabel] = useState('')

  // 加载数据
  useEffect(() => {
    loadNovelData()
    const handleNewNote = () => setNoteModalVisible(true)
    // 全局搜索（Ctrl+K）接力：模块已挂载时通过事件立即打开
    const openFromSearch = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      if (d.chapterId) setSelectedChapterId(d.chapterId)
      if (d.characterId) setSelectedCharacterId(d.characterId)
      if (d.worldId) setSelectedWorldId(d.worldId)
    }
    window.addEventListener('mimo:new-note', handleNewNote)
    window.addEventListener('mimo:open-novel', openFromSearch)
    return () => {
      window.removeEventListener('mimo:new-note', handleNewNote)
      window.removeEventListener('mimo:open-novel', openFromSearch)
    }
  }, [])

  const loadNovelData = async () => {
    try {
      const res = await fetch('/api/novel/data')
      if (res.ok) {
        const d = await res.json()
        const next: NovelData = {
          chapters: d.chapters || [],
          characters: d.characters || [],
          notes: d.notes || [],
          worldDocs: d.worldDocs || [],
        }
        setData(next)
        setLoaded(true)
        // 全局搜索（Ctrl+K）接力：打开指定章节/人物/设定
        const pendChapter = sessionStorage.getItem('mimo-open-chapterId')
        const pendChar = sessionStorage.getItem('mimo-open-characterId')
        const pendWorld = sessionStorage.getItem('mimo-open-worldId')
        if (pendChapter) { sessionStorage.removeItem('mimo-open-chapterId'); setSelectedChapterId(pendChapter) }
        if (pendChar) { sessionStorage.removeItem('mimo-open-characterId'); setSelectedCharacterId(pendChar) }
        if (pendWorld) { sessionStorage.removeItem('mimo-open-worldId'); setSelectedWorldId(pendWorld) }
      }
    } catch {}
  }

  // 通用变更：更新 state + 标脏（防抖自动保存）
  const update = (fn: (prev: NovelData) => NovelData) => {
    setData((prev) => fn(prev))
    dirtyRef.current = true
    setSaveState('unsaved')
  }

  // 防抖自动保存（修复"内容只存内存、刷新即丢"）
  useEffect(() => {
    if (saveState !== 'unsaved') return
    const t = setTimeout(async () => {
      setSaveState('saving')
      try {
        await fetch('/api/novel/data', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataRef.current),
        })
        dirtyRef.current = false
        setSaveState('saved')
      } catch {
        setSaveState('unsaved')
        message.error('自动保存失败，请检查服务是否在运行')
      }
    }, 800)
    return () => clearTimeout(t)
  }, [data, saveState])

  // 离开页面前兜底保存
  useEffect(() => {
    const onBeforeUnload = () => {
      if (dirtyRef.current) {
        navigator.sendBeacon?.(
          '/api/novel/data',
          new Blob([JSON.stringify(dataRef.current)], { type: 'application/json' })
        )
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  /* ---------- 统计（novelWriter 写作目标思路） ---------- */

  const chapters = useMemo(
    () => data.chapters.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [data.chapters]
  )
  const totalWords = useMemo(() => chapters.reduce((s, c) => s + countWords(c.content || ''), 0), [chapters])
  const doneCount = chapters.filter((c) => c.status === 'done').length

  // 今日新增字数（当天首次打开时记基线）
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayWords = useMemo(() => {
    if (!loaded) return 0
    const key = 'mimo-novel-daily-v1'
    try {
      const rec = JSON.parse(localStorage.getItem(key) || 'null')
      if (!rec || rec.date !== todayKey) {
        localStorage.setItem(key, JSON.stringify({ date: todayKey, startWords: totalWords }))
        return 0
      }
      return Math.max(0, totalWords - (rec.startWords || 0))
    } catch {
      return 0
    }
  }, [totalWords, loaded, todayKey])

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null
  const selectedCharacter = data.characters.find((c) => c.id === selectedCharacterId) ?? null
  const selectedWorld = data.worldDocs.find((w) => w.id === selectedWorldId) ?? null

  /* ---------- 章节操作 ---------- */

  const addChapter = () =>
    update((prev) => {
      const maxOrder = prev.chapters.reduce((m, c) => Math.max(m, c.order ?? 0), -1)
      const ch: Chapter = {
        id: Date.now().toString(),
        title: `第 ${prev.chapters.length + 1} 章`,
        order: maxOrder + 1,
        content: '',
        status: 'draft',
        wordCount: 0,
      }
      setSelectedChapterId(ch.id)
      return { ...prev, chapters: [...prev.chapters, ch] }
    })

  const removeChapter = (id: string) =>
    update((prev) => {
      if (selectedChapterId === id) setSelectedChapterId(null)
      return { ...prev, chapters: prev.chapters.filter((c) => c.id !== id) }
    })

  const moveChapter = (id: string, dir: -1 | 1) =>
    update((prev) => {
      const sorted = prev.chapters.slice().sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((c) => c.id === id)
      const j = idx + dir
      if (idx < 0 || j < 0 || j >= sorted.length) return prev
      ;[sorted[idx], sorted[j]] = [sorted[j], sorted[idx]]
      const orderMap = new Map(sorted.map((c, i) => [c.id, i]))
      return { ...prev, chapters: prev.chapters.map((c) => ({ ...c, order: orderMap.get(c.id) ?? c.order })) }
    })

  const patchChapter = (id: string, patch: Partial<Chapter>) =>
    update((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))

  /* ---------- 人物操作 ---------- */

  const openEditCharacter = (c: Character) => {
    setEditingChar(c)
    charForm.setFieldsValue(c)
    setCharModalVisible(true)
  }

  const handleCharModalOk = async () => {
    const values = await charForm.validateFields()
    if (editingChar) {
      update((prev) => ({
        ...prev,
        characters: prev.characters.map((c) => (c.id === editingChar.id ? { ...c, ...values } : c)),
      }))
      message.success('人物已更新')
    } else {
      const character: Character = {
        id: Date.now().toString(),
        name: values.name,
        age: values.age || '',
        personality: values.personality || '',
        background: values.background || '',
        relationships: [],
        notes: values.notes || '',
      }
      update((prev) => ({ ...prev, characters: [...prev.characters, character] }))
      setSelectedCharacterId(character.id)
      message.success('人物已添加')
    }
    setCharModalVisible(false)
    setEditingChar(null)
    charForm.resetFields()
  }

  const removeCharacter = (id: string) => {
    if (selectedCharacterId === id) setSelectedCharacterId(null)
    update((prev) => ({ ...prev, characters: prev.characters.filter((c) => c.id !== id) }))
  }

  const addRelationship = () => {
    if (!selectedCharacter || !relTarget || !relLabel.trim()) return
    update((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === selectedCharacter.id
          ? {
              ...c,
              relationships: [...(c.relationships || []), { targetId: relTarget, relation: relLabel.trim() }],
            }
          : c
      ),
    }))
    setRelTarget(undefined)
    setRelLabel('')
  }

  const removeRelationship = (idx: number) => {
    if (!selectedCharacter) return
    update((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === selectedCharacter.id
          ? { ...c, relationships: (c.relationships || []).filter((_, i) => i !== idx) }
          : c
      ),
    }))
  }

  /* ---------- 世界观操作 ---------- */

  const addWorldDoc = async () => {
    const values = await worldForm.validateFields()
    const doc: WorldDoc = { id: Date.now().toString(), title: values.title, content: '' }
    update((prev) => ({ ...prev, worldDocs: [...prev.worldDocs, doc] }))
    setSelectedWorldId(doc.id)
    setWorldModalVisible(false)
    worldForm.resetFields()
  }

  const removeWorldDoc = (id: string) => {
    if (selectedWorldId === id) setSelectedWorldId(null)
    update((prev) => ({ ...prev, worldDocs: prev.worldDocs.filter((w) => w.id !== id) }))
  }

  /* ---------- 灵感操作 ---------- */

  const handleAddNote = async (values: any) => {
    const note: Note = {
      id: Date.now().toString(),
      content: values.content,
      tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      createdAt: new Date().toISOString(),
    }
    update((prev) => ({ ...prev, notes: [note, ...(prev.notes || [])] }))
    setNoteModalVisible(false)
    noteForm.resetFields()
    message.success('灵感已记录')
  }

  const removeNote = (id: string) =>
    update((prev) => ({ ...prev, notes: (prev.notes || []).filter((n) => n.id !== id) }))

  /* ---------- 渲染 ---------- */

  const statusButtons = (ch: Chapter) => (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <Button
        size="small"
        type={ch.status === 'draft' ? 'primary' : 'default'}
        onClick={() => patchChapter(ch.id, { status: 'draft' })}
      >
        草稿
      </Button>
      <Button
        size="small"
        type={ch.status === 'writing' ? 'primary' : 'default'}
        onClick={() => patchChapter(ch.id, { status: 'writing' })}
      >
        写作中
      </Button>
      <Button
        size="small"
        type={ch.status === 'done' ? 'primary' : 'default'}
        style={ch.status === 'done' ? { background: '#52c41a', borderColor: '#52c41a' } : undefined}
        onClick={() => patchChapter(ch.id, { status: 'done' })}
      >
        已完成
      </Button>
    </div>
  )

  const renderOutline = () => (
    <SplitPane
      storageKey="mimo-split-novel-outline"
      defaultWidth={200}
      minWidth={150}
      maxWidth={420}
      leftStyle={{ paddingRight: 4 }}
      left={
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>章节</span>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={addChapter} title="新建章节" />
          </div>
          {chapters.map((ch, i) => (
            <div
              key={ch.id}
              onClick={() => setSelectedChapterId(ch.id)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 6,
                marginBottom: 4,
                background: selectedChapterId === ch.id ? '#e6f4ff' : 'transparent',
                borderLeft: selectedChapterId === ch.id ? '3px solid #1677ff' : '3px solid transparent',
                fontSize: 13,
                position: 'relative',
              }}
            >
              <div style={{ fontWeight: 500, paddingRight: 40 }}>{ch.title}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag
                  color={ch.status === 'done' ? 'green' : ch.status === 'writing' ? 'blue' : 'default'}
                  style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}
                >
                  {ch.status === 'done' ? '已完成' : ch.status === 'writing' ? '写作中' : '草稿'}
                </Tag>
                {countWords(ch.content || '')} 字
              </div>
              <span
                style={{ position: 'absolute', right: 4, top: 6, display: 'flex', flexDirection: 'column', gap: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={i === 0}
                  onClick={() => moveChapter(ch.id, -1)}
                  style={{ height: 16, width: 20, minWidth: 0, fontSize: 10 }}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={i === chapters.length - 1}
                  onClick={() => moveChapter(ch.id, 1)}
                  style={{ height: 16, width: 20, minWidth: 0, fontSize: 10 }}
                />
              </span>
            </div>
          ))}
        </>
      }
      right={
        <div style={{ paddingLeft: 4 }}>
          {selectedChapter ? (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Input
                  value={selectedChapter.title}
                  onChange={(e) => patchChapter(selectedChapter.id, { title: e.target.value })}
                  style={{ fontWeight: 600 }}
                />
                <Popconfirm title="确定删除这个章节？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => removeChapter(selectedChapter.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} title="删除章节" />
                </Popconfirm>
              </div>
              <Input.TextArea
                value={selectedChapter.content}
                onChange={(e) =>
                  patchChapter(selectedChapter.id, {
                    content: e.target.value,
                    wordCount: e.target.value.length,
                  })
                }
                placeholder="开始写作..."
                style={{ fontSize: 14, lineHeight: 1.9 }}
                autoSize={{ minRows: 16 }}
              />
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {statusButtons(selectedChapter)}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: '#666' }}>
                  本章 {countWords(selectedChapter.content || '')} 字
                  {selectedChapter.target ? ` / 目标 ${selectedChapter.target}` : ''}
                </span>
                <Input
                  type="number"
                  size="small"
                  style={{ width: 90 }}
                  placeholder="目标字数"
                  value={selectedChapter.target ?? ''}
                  onChange={(e) =>
                    patchChapter(selectedChapter.id, { target: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              {selectedChapter.target ? (
                <Progress
                  size="small"
                  style={{ marginTop: 6 }}
                  percent={Math.min(100, Math.round((countWords(selectedChapter.content || '') / selectedChapter.target) * 100))}
                  status={countWords(selectedChapter.content || '') >= selectedChapter.target ? 'success' : 'active'}
                />
              ) : null}
            </div>
          ) : (
            <Empty description="选择一个章节开始写作" />
          )}
        </div>
      }
    />
  )

  const charName = (id: string) => data.characters.find((c) => c.id === id)?.name ?? '（已删除）'

  const renderCharacters = () => (
    <SplitPane
      storageKey="mimo-split-novel-characters"
      defaultWidth={180}
      minWidth={130}
      maxWidth={420}
      leftStyle={{ paddingRight: 4 }}
      left={
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>人物</span>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingChar(null)
                charForm.resetFields()
                setCharModalVisible(true)
              }}
            />
          </div>
          {data.characters.map((char) => (
            <div
              key={char.id}
              onClick={() => setSelectedCharacterId(char.id)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 6,
                marginBottom: 4,
                background: selectedCharacterId === char.id ? '#e6f4ff' : 'transparent',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <UserOutlined style={{ color: '#1677ff' }} />
              <span>{char.name}</span>
            </div>
          ))}
        </>
      }
      right={
        <div style={{ paddingLeft: 4 }}>
          {selectedCharacter ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{selectedCharacter.name}</h3>
                <span style={{ flex: 1 }} />
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditCharacter(selectedCharacter)}>
                  编辑资料
                </Button>
                <Popconfirm title="确定删除这个人物？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => removeCharacter(selectedCharacter.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
              <Card size="small" style={{ marginBottom: 12 }}>
                {selectedCharacter.age && <p><strong>年龄：</strong>{selectedCharacter.age}</p>}
                {selectedCharacter.personality && <p><strong>性格：</strong>{selectedCharacter.personality}</p>}
                {selectedCharacter.background && <p><strong>背景：</strong>{selectedCharacter.background}</p>}
                {selectedCharacter.notes && <p><strong>备注：</strong>{selectedCharacter.notes}</p>}
                {!selectedCharacter.age && !selectedCharacter.personality && !selectedCharacter.background && !selectedCharacter.notes && (
                  <span style={{ color: '#999', fontSize: 12 }}>还没有资料，点「编辑资料」补充</span>
                )}
              </Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>人物关系</div>
              {(selectedCharacter.relationships || []).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {selectedCharacter.relationships.map((r, i) => (
                    <Tag
                      key={i}
                      closable
                      onClose={(e) => {
                        e.preventDefault()
                        removeRelationship(i)
                      }}
                      color="blue"
                      style={{ fontSize: 12, marginBottom: 4 }}
                    >
                      {charName(r.targetId)} · {r.relation}
                    </Tag>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <Select
                  size="small"
                  placeholder="选择人物"
                  style={{ width: 130 }}
                  value={relTarget}
                  onChange={setRelTarget}
                  options={data.characters
                    .filter((c) => c.id !== selectedCharacter.id)
                    .map((c) => ({ value: c.id, label: c.name }))}
                />
                <Input
                  size="small"
                  placeholder="关系，如：师徒/宿敌"
                  style={{ width: 150 }}
                  value={relLabel}
                  onChange={(e) => setRelLabel(e.target.value)}
                  onPressEnter={addRelationship}
                />
                <Button size="small" onClick={addRelationship}>添加关系</Button>
              </div>
            </div>
          ) : (
            <Empty description="选择一个人物查看" />
          )}
        </div>
      }
    />
  )

  const renderWorld = () => (
    <SplitPane
      storageKey="mimo-split-novel-world"
      defaultWidth={180}
      minWidth={130}
      maxWidth={420}
      leftStyle={{ paddingRight: 4 }}
      left={
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>世界观设定</span>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setWorldModalVisible(true)} />
          </div>
          {data.worldDocs.map((w) => (
            <div
              key={w.id}
              onClick={() => setSelectedWorldId(w.id)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 6,
                marginBottom: 4,
                background: selectedWorldId === w.id ? '#e6f4ff' : 'transparent',
                fontSize: 13,
              }}
            >
              🌍 {w.title}
            </div>
          ))}
          {data.worldDocs.length === 0 && (
            <div style={{ fontSize: 12, color: '#bbb', padding: '8px 10px' }}>
              地点、势力、功法、年表…都可以放这里
            </div>
          )}
        </>
      }
      right={
        <div style={{ paddingLeft: 4 }}>
          {selectedWorld ? (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Input
                  value={selectedWorld.title}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      worldDocs: prev.worldDocs.map((w) => (w.id === selectedWorld.id ? { ...w, title: e.target.value } : w)),
                    }))
                  }
                  style={{ fontWeight: 600 }}
                />
                <Popconfirm title="确定删除这条设定？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => removeWorldDoc(selectedWorld.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
              <Input.TextArea
                value={selectedWorld.content}
                onChange={(e) =>
                  update((prev) => ({
                    ...prev,
                    worldDocs: prev.worldDocs.map((w) => (w.id === selectedWorld.id ? { ...w, content: e.target.value } : w)),
                  }))
                }
                placeholder="自由填写设定内容…"
                style={{ fontSize: 13, lineHeight: 1.8 }}
                autoSize={{ minRows: 16 }}
              />
            </div>
          ) : (
            <Empty description="选择一条设定查看；用「＋」新建" />
          )}
        </div>
      }
    />
  )

  const renderNotes = () => (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>灵感速记</span>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setNoteModalVisible(true)}>
          新速记
        </Button>
      </div>
      {(data.notes || []).length > 0 ? (
        data.notes.map((note) => (
          <Card key={note.id} size="small" style={{ marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 13, paddingRight: 24 }}>{note.content}</p>
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {note.tags.map((tag) => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
              <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>
                {new Date(note.createdAt).toLocaleString()}
              </span>
              <Popconfirm title="删除这条灵感？" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => removeNote(note.id)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ height: 20, width: 20, minWidth: 0 }} />
              </Popconfirm>
            </div>
          </Card>
        ))
      ) : (
        <Empty description="还没有灵感记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  )

  const headerActions = actionsHost
    ? createPortal(
        <div className="novel-header-actions">
          <Button size="small" icon={<DownloadOutlined />} onClick={() => window.open('/api/novel/export')}>
            导出全本
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {headerActions}
      {/* 写作统计条（对标 novelWriter 的 Writing Targets） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '6px 12px',
          borderBottom: '1px solid #f0f0f0',
          fontSize: 12,
          color: '#555',
          flexWrap: 'wrap',
        }}
      >
        <span>📖 写作统计</span>
        <span>总字数 <strong style={{ color: '#1677ff' }}>{totalWords}</strong></span>
        <span>今日 <strong style={{ color: '#52c41a' }}>+{todayWords}</strong></span>
        <span>章节完成 <strong>{doneCount}</strong>/{chapters.length}</span>
        <span style={{ flex: 1 }} />
        {saveState === 'saved' ? (
          <Tag color="success" style={{ margin: 0 }}><CheckCircleFilled /> 已自动保存</Tag>
        ) : saveState === 'saving' ? (
          <Tag color="processing" style={{ margin: 0 }}><LoadingOutlined /> 保存中…</Tag>
        ) : (
          <Tag color="warning" style={{ margin: 0 }}>待保存…</Tag>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        style={{ flex: 1, minHeight: 0 }}
        items={[
          { key: 'outline', label: <span>📖 大纲</span>, children: renderOutline() },
          { key: 'characters', label: <span>👤 人物</span>, children: renderCharacters() },
          { key: 'world', label: <span>🌍 世界观</span>, children: renderWorld() },
          { key: 'notes', label: <span>💡 灵感</span>, children: renderNotes() },
        ]}
      />

      {/* 灵感速记弹窗 */}
      <Modal
        title="💡 灵感速记"
        open={noteModalVisible}
        onCancel={() => setNoteModalVisible(false)}
        footer={null}
        width={400}
      >
        <Form form={noteForm} onFinish={handleAddNote} layout="vertical">
          <Form.Item name="content" rules={[{ required: true, message: '写点什么...' }]}>
            <Input.TextArea placeholder="记录你的灵感..." autoSize={{ minRows: 3 }} />
          </Form.Item>
          <Form.Item name="tags" help="用逗号分隔多个标签">
            <Input placeholder="标签（可选）：角色, 情节, 对话" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>保存灵感</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加/编辑人物弹窗 */}
      <Modal
        title={editingChar ? `✏️ 编辑人物：${editingChar.name}` : '👤 添加人物'}
        open={charModalVisible}
        onOk={handleCharModalOk}
        onCancel={() => {
          setCharModalVisible(false)
          setEditingChar(null)
          charForm.resetFields()
        }}
        okText={editingChar ? '保存' : '添加人物'}
        cancelText="取消"
        width={500}
      >
        <Form form={charForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="人物姓名" />
          </Form.Item>
          <Form.Item name="age" label="年龄">
            <Input placeholder="年龄" />
          </Form.Item>
          <Form.Item name="personality" label="性格">
            <Input.TextArea placeholder="性格特点" autoSize={{ minRows: 2 }} />
          </Form.Item>
          <Form.Item name="background" label="背景">
            <Input.TextArea placeholder="人物背景故事" autoSize={{ minRows: 2 }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="其他备注" autoSize={{ minRows: 2 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建世界观设定弹窗 */}
      <Modal
        title="🌍 新建设定"
        open={worldModalVisible}
        onOk={addWorldDoc}
        onCancel={() => {
          setWorldModalVisible(false)
          worldForm.resetFields()
        }}
        okText="创建"
        cancelText="取消"
        width={400}
      >
        <Form form={worldForm} layout="vertical">
          <Form.Item name="title" label="设定名称" rules={[{ required: true, message: '例如：青云宗 / 大梁王朝 / 修炼体系' }]}>
            <Input placeholder="如：青云宗、修炼体系、世界地图" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NovelModule
