import React, { useState, useEffect, useRef, useMemo } from 'react'
import { message } from 'antd'
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Check,
  Loader2,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
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

const STATUS_META: Record<Chapter['status'], { label: string; dot: string }> = {
  draft: { label: '草稿', dot: '#c9cdd4' },
  writing: { label: '写作中', dot: '#ff6700' },
  done: { label: '已完成', dot: '#00b42a' },
}

/** 通用删除确认目标：区分章节/人物/设定/灵感 */
type DelTarget =
  | { kind: 'chapter'; id: string; name: string }
  | { kind: 'character'; id: string; name: string }
  | { kind: 'world'; id: string; name: string }
  | { kind: 'note'; id: string; name: string }

const NovelModule: React.FC = () => {
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

  // 弹窗（手写表单 state）
  const [noteModalVisible, setNoteModalVisible] = useState(false)
  const [noteForm, setNoteForm] = useState({ content: '', tags: '' })
  const [charModalVisible, setCharModalVisible] = useState(false)
  const [editingChar, setEditingChar] = useState<Character | null>(null)
  const [charForm, setCharForm] = useState({ name: '', age: '', personality: '', background: '', notes: '' })
  const [worldModalVisible, setWorldModalVisible] = useState(false)
  const [worldTitle, setWorldTitle] = useState('')

  // 人物关系编辑的临时状态
  const [relTarget, setRelTarget] = useState<string | undefined>()
  const [relLabel, setRelLabel] = useState('')

  // 删除二次确认（通用 ConfirmDialog）
  const [delTarget, setDelTarget] = useState<DelTarget | null>(null)

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

  const openAddCharacter = () => {
    setEditingChar(null)
    setCharForm({ name: '', age: '', personality: '', background: '', notes: '' })
    setCharModalVisible(true)
  }

  const openEditCharacter = (c: Character) => {
    setEditingChar(c)
    setCharForm({
      name: c.name,
      age: c.age || '',
      personality: c.personality || '',
      background: c.background || '',
      notes: c.notes || '',
    })
    setCharModalVisible(true)
  }

  const handleCharModalOk = () => {
    if (!charForm.name.trim()) {
      message.warning('请填写姓名')
      return
    }
    if (editingChar) {
      update((prev) => ({
        ...prev,
        characters: prev.characters.map((c) => (c.id === editingChar.id ? { ...c, ...charForm } : c)),
      }))
      message.success('人物已更新')
    } else {
      const character: Character = {
        id: Date.now().toString(),
        name: charForm.name.trim(),
        age: charForm.age,
        personality: charForm.personality,
        background: charForm.background,
        relationships: [],
        notes: charForm.notes,
      }
      update((prev) => ({ ...prev, characters: [...prev.characters, character] }))
      setSelectedCharacterId(character.id)
      message.success('人物已添加')
    }
    setCharModalVisible(false)
    setEditingChar(null)
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

  const addWorldDoc = () => {
    if (!worldTitle.trim()) {
      message.warning('请填写设定名称')
      return
    }
    const doc: WorldDoc = { id: Date.now().toString(), title: worldTitle.trim(), content: '' }
    update((prev) => ({ ...prev, worldDocs: [...prev.worldDocs, doc] }))
    setSelectedWorldId(doc.id)
    setWorldModalVisible(false)
    setWorldTitle('')
  }

  const removeWorldDoc = (id: string) => {
    if (selectedWorldId === id) setSelectedWorldId(null)
    update((prev) => ({ ...prev, worldDocs: prev.worldDocs.filter((w) => w.id !== id) }))
  }

  /* ---------- 灵感操作 ---------- */

  const handleAddNote = () => {
    if (!noteForm.content.trim()) {
      message.warning('写点什么...')
      return
    }
    const note: Note = {
      id: Date.now().toString(),
      content: noteForm.content,
      tags: noteForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    }
    update((prev) => ({ ...prev, notes: [note, ...(prev.notes || [])] }))
    setNoteModalVisible(false)
    setNoteForm({ content: '', tags: '' })
    message.success('灵感已记录')
  }

  const removeNote = (id: string) =>
    update((prev) => ({ ...prev, notes: (prev.notes || []).filter((n) => n.id !== id) }))

  /* ---------- 删除统一确认 ---------- */

  const askDelete = (t: DelTarget) => setDelTarget(t)

  const doDelete = () => {
    if (!delTarget) return
    if (delTarget.kind === 'chapter') removeChapter(delTarget.id)
    if (delTarget.kind === 'character') removeCharacter(delTarget.id)
    if (delTarget.kind === 'world') removeWorldDoc(delTarget.id)
    if (delTarget.kind === 'note') removeNote(delTarget.id)
  }

  /* ---------- 渲染 ---------- */

  const statusButtons = (ch: Chapter) => (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      {(['draft', 'writing', 'done'] as const).map((s) => (
        <Button
          key={s}
          size="sm"
          variant={ch.status === s ? 'default' : 'outline'}
          className={ch.status === s && s === 'done' ? 'bg-[#00b42a] hover:bg-[#00b42a]' : ''}
          onClick={() => patchChapter(ch.id, { status: s })}
        >
          {STATUS_META[s].label}
        </Button>
      ))}
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
            <span style={{ fontSize: 14, fontWeight: 600 }}>章节</span>
            <Button variant="ghost" size="sm" onClick={addChapter} title="新建章节">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {chapters.map((ch, i) => (
            <div
              key={ch.id}
              onClick={() => setSelectedChapterId(ch.id)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 8,
                marginBottom: 4,
                background: selectedChapterId === ch.id ? '#fff3e8' : 'transparent',
                borderLeft: selectedChapterId === ch.id ? '3px solid #ff6700' : '3px solid transparent',
                fontSize: 14,
                position: 'relative',
              }}
            >
              <div style={{ fontWeight: 500, paddingRight: 40 }}>{ch.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i
                  style={{
                    display: 'inline-block',
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: STATUS_META[ch.status].dot,
                    boxShadow: `0 0 0 3px ${STATUS_META[ch.status].dot}22`,
                  }}
                />
                {STATUS_META[ch.status].label}
                <span>· {countWords(ch.content || '')} 字</span>
              </div>
              <span
                style={{ position: 'absolute', right: 4, top: 6, display: 'flex', flexDirection: 'column', gap: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-5 min-w-0 p-0"
                  disabled={i === 0}
                  onClick={() => moveChapter(ch.id, -1)}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-5 min-w-0 p-0"
                  disabled={i === chapters.length - 1}
                  onClick={() => moveChapter(ch.id, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
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
                  className="h-8"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#F53F3F] shrink-0"
                  title="删除章节"
                  onClick={() => askDelete({ kind: 'chapter', id: selectedChapter.id, name: selectedChapter.title })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                value={selectedChapter.content}
                onChange={(e) =>
                  patchChapter(selectedChapter.id, {
                    content: e.target.value,
                    wordCount: e.target.value.length,
                  })
                }
                placeholder="开始写作..."
                style={{ fontSize: 14, lineHeight: 1.9, minHeight: 320 }}
              />
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {statusButtons(selectedChapter)}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: '#4E5969' }}>
                  本章 {countWords(selectedChapter.content || '')} 字
                  {selectedChapter.target ? ` / 目标 ${selectedChapter.target}` : ''}
                </span>
                <Input
                  type="number"
                  className="h-8 w-[90px]"
                  placeholder="目标字数"
                  value={selectedChapter.target ?? ''}
                  onChange={(e) =>
                    patchChapter(selectedChapter.id, { target: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
              {selectedChapter.target ? (
                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: '#f2f3f5', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round((countWords(selectedChapter.content || '') / selectedChapter.target) * 100))}%`,
                      background:
                        countWords(selectedChapter.content || '') >= selectedChapter.target ? '#00b42a' : '#ff6700',
                      borderRadius: 2,
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mod-empty" style={{ padding: '48px 16px' }}>选择一个章节开始写作</div>
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
            <span style={{ fontSize: 14, fontWeight: 600 }}>人物</span>
            <Button variant="ghost" size="sm" onClick={openAddCharacter} title="添加人物">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {data.characters.map((char) => (
            <div
              key={char.id}
              onClick={() => setSelectedCharacterId(char.id)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 8,
                marginBottom: 4,
                background: selectedCharacterId === char.id ? '#fff3e8' : 'transparent',
                borderLeft: selectedCharacterId === char.id ? '3px solid #ff6700' : '3px solid transparent',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: '#ff6700' }}>👤</span>
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{selectedCharacter.name}</h3>
                <span style={{ flex: 1 }} />
                <Button size="sm" variant="outline" onClick={() => openEditCharacter(selectedCharacter)}>
                  <Pencil className="h-3.5 w-3.5" />
                  编辑资料
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[#F53F3F]"
                  onClick={() => askDelete({ kind: 'character', id: selectedCharacter.id, name: selectedCharacter.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div
                style={{
                  marginBottom: 12,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                  background: '#fff',
                  fontSize: 14,
                  lineHeight: 1.8,
                }}
              >
                {selectedCharacter.age && <p style={{ margin: 0 }}><strong>年龄：</strong>{selectedCharacter.age}</p>}
                {selectedCharacter.personality && <p style={{ margin: 0 }}><strong>性格：</strong>{selectedCharacter.personality}</p>}
                {selectedCharacter.background && <p style={{ margin: 0 }}><strong>背景：</strong>{selectedCharacter.background}</p>}
                {selectedCharacter.notes && <p style={{ margin: 0 }}><strong>备注：</strong>{selectedCharacter.notes}</p>}
                {!selectedCharacter.age && !selectedCharacter.personality && !selectedCharacter.background && !selectedCharacter.notes && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>还没有资料，点「编辑资料」补充</span>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>人物关系</div>
              {(selectedCharacter.relationships || []).length > 0 && (
                <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedCharacter.relationships.map((r, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer text-[#ff6700]"
                      onClick={() => removeRelationship(i)}
                      title="点击移除关系"
                    >
                      {charName(r.targetId)} · {r.relation} ×
                    </Badge>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Select value={relTarget} onValueChange={setRelTarget}>
                  <SelectTrigger className="h-8 w-[130px]">
                    <SelectValue placeholder="选择人物" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.characters
                      .filter((c) => c.id !== selectedCharacter.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 w-[150px]"
                  placeholder="关系，如：师徒/宿敌"
                  value={relLabel}
                  onChange={(e) => setRelLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRelationship()}
                />
                <Button size="sm" variant="outline" onClick={addRelationship}>添加关系</Button>
              </div>
            </div>
          ) : (
            <div className="mod-empty" style={{ padding: '48px 16px' }}>选择一个人物查看</div>
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
            <span style={{ fontSize: 14, fontWeight: 600 }}>世界观设定</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setWorldTitle('')
                setWorldModalVisible(true)
              }}
              title="新建设定"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {data.worldDocs.map((w) => (
            <div
              key={w.id}
              onClick={() => setSelectedWorldId(w.id)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 8,
                marginBottom: 4,
                background: selectedWorldId === w.id ? '#fff3e8' : 'transparent',
                borderLeft: selectedWorldId === w.id ? '3px solid #ff6700' : '3px solid transparent',
                fontSize: 14,
              }}
            >
              🌍 {w.title}
            </div>
          ))}
          {data.worldDocs.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px' }}>
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
                  className="h-8"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#F53F3F] shrink-0"
                  onClick={() => askDelete({ kind: 'world', id: selectedWorld.id, name: selectedWorld.title })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                value={selectedWorld.content}
                onChange={(e) =>
                  update((prev) => ({
                    ...prev,
                    worldDocs: prev.worldDocs.map((w) => (w.id === selectedWorld.id ? { ...w, content: e.target.value } : w)),
                  }))
                }
                placeholder="自由填写设定内容…"
                style={{ fontSize: 14, lineHeight: 1.8, minHeight: 320 }}
              />
            </div>
          ) : (
            <div className="mod-empty" style={{ padding: '48px 16px' }}>选择一条设定查看；用「＋」新建</div>
          )}
        </div>
      }
    />
  )

  const renderNotes = () => (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>灵感速记</span>
        <Button size="sm" onClick={() => setNoteModalVisible(true)}>
          <Plus className="h-4 w-4" />
          新速记
        </Button>
      </div>
      {(data.notes || []).length > 0 ? (
        data.notes.map((note) => (
          <div
            key={note.id}
            style={{
              marginBottom: 8,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #f0f0f0',
              background: '#fff',
              position: 'relative',
            }}
          >
            <p style={{ margin: 0, fontSize: 14, paddingRight: 24, lineHeight: 1.6 }}>{note.content}</p>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {note.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[#ff6700]">{tag}</Badge>
              ))}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {new Date(note.createdAt).toLocaleString()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-[#F53F3F]"
                onClick={() => askDelete({ kind: 'note', id: note.id, name: '这条灵感' })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))
      ) : (
        <div className="mod-empty" style={{ padding: '48px 16px' }}>还没有灵感记录</div>
      )}
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 写作统计条（对标 novelWriter 的 Writing Targets）+ 导出 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '6px 12px',
          borderBottom: '1px solid #f0f0f0',
          fontSize: 12,
          color: '#4E5969',
          flexWrap: 'wrap',
        }}
      >
        <span>📖 写作统计</span>
        <span>
          总字数 <strong style={{ color: '#ff6700', fontVariantNumeric: 'tabular-nums' }}>{totalWords}</strong>
        </span>
        <span>
          今日 <strong style={{ color: '#00b42a', fontVariantNumeric: 'tabular-nums' }}>+{todayWords}</strong>
        </span>
        <span>
          章节完成 <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{doneCount}</strong>/{chapters.length}
        </span>
        <span style={{ flex: 1 }} />
        {saveState === 'saved' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#00b42a' }}>
            <Check className="h-3.5 w-3.5" /> 已自动保存
          </span>
        ) : saveState === 'saving' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ff6700' }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中…
          </span>
        ) : (
          <span style={{ color: '#ff7d00' }}>待保存…</span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open('/api/novel/export')}
          title="导出全本"
        >
          <Download className="h-4 w-4" />
          导出
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <TabsList>
          <TabsTrigger value="outline" className="h-8 px-3">📖 大纲</TabsTrigger>
          <TabsTrigger value="characters" className="h-8 px-3">👤 人物</TabsTrigger>
          <TabsTrigger value="world" className="h-8 px-3">🌍 世界观</TabsTrigger>
          <TabsTrigger value="notes" className="h-8 px-3">💡 灵感</TabsTrigger>
        </TabsList>
        <div style={{ flex: 1, minHeight: 0, paddingTop: 8, overflow: 'auto' }}>
          {activeTab === 'outline' && renderOutline()}
          {activeTab === 'characters' && renderCharacters()}
          {activeTab === 'world' && renderWorld()}
          {activeTab === 'notes' && renderNotes()}
        </div>
      </Tabs>

      {/* 灵感速记弹窗 */}
      <Dialog open={noteModalVisible} onOpenChange={(o) => !o && setNoteModalVisible(false)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>💡 灵感速记</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
            <Textarea
              placeholder="记录你的灵感..."
              value={noteForm.content}
              onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
              style={{ minHeight: 90 }}
            />
            <Input
              placeholder="标签（可选）：角色, 情节, 对话"
              value={noteForm.tags}
              onChange={(e) => setNoteForm({ ...noteForm, tags: e.target.value })}
              className="h-8"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteModalVisible(false)}>
              取消
            </Button>
            <Button onClick={handleAddNote}>保存灵感</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加/编辑人物弹窗 */}
      <Dialog open={charModalVisible} onOpenChange={(o) => !o && setCharModalVisible(false)}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingChar ? `✏️ 编辑人物：${editingChar.name}` : '👤 添加人物'}</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>姓名 *</div>
              <Input
                placeholder="人物姓名"
                value={charForm.name}
                onChange={(e) => setCharForm({ ...charForm, name: e.target.value })}
                className="h-8"
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>年龄</div>
              <Input
                placeholder="年龄"
                value={charForm.age}
                onChange={(e) => setCharForm({ ...charForm, age: e.target.value })}
                className="h-8"
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>性格</div>
              <Textarea
                placeholder="性格特点"
                value={charForm.personality}
                onChange={(e) => setCharForm({ ...charForm, personality: e.target.value })}
                style={{ minHeight: 56 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>背景</div>
              <Textarea
                placeholder="人物背景故事"
                value={charForm.background}
                onChange={(e) => setCharForm({ ...charForm, background: e.target.value })}
                style={{ minHeight: 56 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>备注</div>
              <Textarea
                placeholder="其他备注"
                value={charForm.notes}
                onChange={(e) => setCharForm({ ...charForm, notes: e.target.value })}
                style={{ minHeight: 56 }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCharModalVisible(false)
                setEditingChar(null)
              }}
            >
              取消
            </Button>
            <Button onClick={handleCharModalOk}>{editingChar ? '保存' : '添加人物'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建世界观设定弹窗 */}
      <Dialog open={worldModalVisible} onOpenChange={(o) => !o && setWorldModalVisible(false)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>🌍 新建设定</DialogTitle>
          </DialogHeader>
          <div style={{ padding: '4px 0' }}>
            <Input
              placeholder="如：青云宗、修炼体系、世界地图"
              value={worldTitle}
              onChange={(e) => setWorldTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWorldDoc()}
              autoFocus
              className="h-8"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorldModalVisible(false)}>
              取消
            </Button>
            <Button onClick={addWorldDoc}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除二次确认（通用 ConfirmDialog） */}
      <ConfirmDialog
        open={!!delTarget}
        content={
          delTarget
            ? delTarget.kind === 'note'
              ? '删除这条灵感？'
              : `删除${delTarget.kind === 'character' ? '人物' : delTarget.kind === 'world' ? '设定' : '章节'}「${delTarget.name}」？`
            : null
        }
        okText="删除"
        danger
        onOk={doDelete}
        onOpenChange={(o) => !o && setDelTarget(null)}
      />
    </div>
  )
}

export default NovelModule
