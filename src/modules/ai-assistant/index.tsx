import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { message } from 'antd'
import { Send, Square, Trash2, Sparkles, Bot, Settings, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import './ai-assistant.css'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'yujie-ai-chat'

function loadHistory(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      if (Array.isArray(d)) return d.filter((m) => m && typeof m.content === 'string')
    }
  } catch {
    // 忽略损坏缓存
  }
  return []
}

const AIModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [messages, setMessages] = useState<ChatMsg[]>(loadHistory)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [clearOpen, setClearOpen] = useState(false)

  // 设置弹窗
  const [cfgOpen, setCfgOpen] = useState(false)
  const [cfg, setCfg] = useState({ baseUrl: '', apiKey: '', model: '' })
  const [cfgMasked, setCfgMasked] = useState('')
  const [cfgLoading, setCfgLoading] = useState(false)
  const [cfgSaving, setCfgSaving] = useState(false)
  const [modelsList, setModelsList] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)

  const fetchModels = async () => {
    if (!cfg.apiKey.trim()) {
      message.warning('请先填写 API Key 再获取模型')
      return
    }
    setFetchingModels(true)
    setModelsList([])
    try {
      const res = await fetch('/api/ai/models')
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string }
        message.error(e.error || '获取失败')
        return
      }
      const d = (await res.json()) as { models?: string[] }
      if (Array.isArray(d.models) && d.models.length) {
        setModelsList(d.models)
        if (!cfg.model) setCfg((c) => ({ ...c, model: d.models![0] }))
      } else {
        message.info('未获取到模型列表，可手动填写')
      }
    } catch {
      message.error('获取模型失败')
    } finally {
      setFetchingModels(false)
    }
  }

  const openCfg = async () => {
    setCfgOpen(true)
    setCfgLoading(true)
    try {
      const res = await fetch('/api/ai/config')
      const d = (await res.json()) as { baseUrl?: string; apiKeyMasked?: string; model?: string }
      setCfg({ baseUrl: d.baseUrl || '', apiKey: '', model: d.model || '' })
      setCfgMasked(d.apiKeyMasked || '')
    } catch {
      message.error('读取配置失败')
    } finally {
      setCfgLoading(false)
    }
  }

  const saveCfg = async () => {
    if (!cfg.baseUrl.trim()) {
      message.warning('请填写接口地址')
      return
    }
    if (!cfg.model.trim()) {
      message.warning('请填写模型名称')
      return
    }
    setCfgSaving(true)
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: cfg.baseUrl.trim(),
          apiKey: cfg.apiKey.trim(),
          model: cfg.model.trim(),
        }),
      })
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string }
        message.error(e.error || '保存失败')
        return
      }
      message.success('配置已保存，立即生效')
      setCfgOpen(false)
    } catch {
      message.error('保存失败')
    } finally {
      setCfgSaving(false)
    }
  }

  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 滚动到底
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  // 会话持久化（非流式时）
  useEffect(() => {
    if (streaming) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
    } catch {
      // 存储失败静默
    }
  }, [messages, streaming])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setError('')
    setStreaming(true)

    const assistantIdx = next.length
    const ab = new AbortController()
    abortRef.current = ab
    let acc = ''
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
        signal: ab.signal,
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setError(err.error || `请求失败（${res.status}）`)
        setMessages((ms) => ms.slice(0, assistantIdx))
        setStreaming(false)
        abortRef.current = null
        return
      }
      if (!res.body) {
        setError('响应为空')
        setStreaming(false)
        abortRef.current = null
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const payload = t.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload) as { error?: string; content?: string }
            if (json.error) {
              setError(json.error)
              continue
            }
            const delta = json.content ?? ''
            if (delta) {
              acc += delta
              const cur = acc
              setMessages((ms) => ms.map((m, i) => (i === assistantIdx ? { ...m, content: cur } : m)))
            }
          } catch {
            // 忽略坏行
          }
        }
      }
      setMessages((ms) => ms.map((m, i) => (i === assistantIdx ? { ...m, content: acc || '（无回复）' } : m)))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('请求失败：' + String(err))
        setMessages((ms) => ms.slice(0, assistantIdx))
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const clearAll = () => {
    setMessages([])
    setError('')
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 忽略
    }
  }

  const headerActions = actionsHost
    ? createPortal(
        <div className="ai-header-actions">
          <Button
            size="sm"
            variant="ghost"
            className="text-[#F53F3F]"
            onClick={() => setClearOpen(true)}
            title="清空对话"
          >
            <Trash2 className="h-3.5 w-3.5" /> 清空
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div className="ai-mod">
      <div className="ai-status">
        <span className="ai-status-dot" style={{ background: streaming ? '#ff6700' : '#00b42a' }} />
        <span>{streaming ? '正在思考…' : '就绪'}</span>
        <Button size="sm" variant="ghost" className="ai-settings-btn" onClick={openCfg} title="AI 接口设置">
          <Settings className="h-3.5 w-3.5" /> 设置
        </Button>
      </div>

      <div className="ai-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="ai-empty">
            <Bot className="ai-empty-icon" />
            <div className="ai-empty-title">你好，我是宇界工作台 AI 助手</div>
            <div className="ai-empty-desc">可以帮你整理思路、规划项目、答疑解惑。</div>
            <div className="ai-empty-hints">
              <button type="button" onClick={() => setInput('帮我规划本周的优化方向')}>
                帮我规划本周的优化方向
              </button>
              <button type="button" onClick={() => setInput('把这段话总结成 3 个要点：')}>
                总结要点
              </button>
              <button type="button" onClick={() => setInput('列出做个人工作台的功能清单')}>
                功能清单
              </button>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={'ai-msg ai-' + m.role}>
              <div className="ai-bubble">{m.content || (streaming && i === messages.length - 1 ? '…' : '')}</div>
            </div>
          ))
        )}
        {error && <div className="ai-error">{error}</div>}
      </div>

      <div className="ai-input-bar">
        <Textarea
          className="ai-input"
          value={input}
          rows={1}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          disabled={streaming}
        />
        {streaming ? (
          <Button size="icon" variant="outline" className="ai-send" onClick={stop} title="停止生成">
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="icon" className="ai-send" onClick={() => void send()} disabled={!input.trim()} title="发送">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {headerActions}

      <Dialog open={cfgOpen} onOpenChange={(o) => !o && setCfgOpen(false)}>
        <DialogContent className="ai-cfg-dialog">
          <DialogHeader>
            <DialogTitle>AI 接口设置</DialogTitle>
            <DialogDescription>
              兼容 OpenAI 接口协议，支持 DeepSeek、通义、本地 Ollama 等。
            </DialogDescription>
          </DialogHeader>

          {cfgLoading ? (
            <div className="ai-cfg-loading">读取配置中…</div>
          ) : (
            <div className="ai-cfg-body">
              <div className="ai-cfg-field">
                <Label htmlFor="ai-base">接口地址（Base URL）</Label>
                <Input
                  id="ai-base"
                  value={cfg.baseUrl}
                  onChange={(e) => setCfg((c) => ({ ...c, baseUrl: e.target.value }))}
                  placeholder="https://api.deepseek.com/v1"
                />
              </div>
              <div className="ai-cfg-field">
                <Label htmlFor="ai-key">API Key</Label>
                <Input
                  id="ai-key"
                  type="password"
                  value={cfg.apiKey}
                  onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))}
                  placeholder={cfgMasked || '粘贴你的 API Key'}
                />
                {cfgMasked && (
                  <p className="ai-cfg-tip">当前已配置：{cfgMasked}，留空表示不修改。</p>
                )}
              </div>
              <div className="ai-cfg-field">
                <Label htmlFor="ai-model">模型（Model）</Label>
                <div className="ai-cfg-model-row">
                  <Input
                    id="ai-model"
                    value={cfg.model}
                    onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
                    placeholder="deepseek-chat"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchModels}
                    disabled={fetchingModels}
                    title="在线获取模型列表"
                  >
                    {fetchingModels ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    获取
                  </Button>
                </div>
                {modelsList.length > 0 && (
                  <div className="ai-cfg-models">
                    {modelsList.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={'ai-cfg-model-chip' + (cfg.model === m ? ' active' : '')}
                        onClick={() => setCfg((c) => ({ ...c, model: m }))}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="ai-cfg-note">
                配置会写入项目根目录 .env 并立即生效，无需重启。Key 仅保存在本机。
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCfgOpen(false)} disabled={cfgSaving}>
              取消
            </Button>
            <Button onClick={saveCfg} disabled={cfgSaving || cfgLoading}>
              {cfgSaving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={clearOpen}
        title="清空对话"
        content="将删除当前全部对话记录，且不可恢复。确定清空吗？"
        danger
        okText="清空"
        onOk={clearAll}
        onOpenChange={(o) => {
          if (!o) setClearOpen(false)
        }}
      />
    </div>
  )
}

export default AIModule
