import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { message } from 'antd'
import { Send, Square, Trash2, Sparkles, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
        <span className="ai-model">
          <Sparkles className="h-3 w-3" />
          OpenAI 兼容接口
        </span>
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
