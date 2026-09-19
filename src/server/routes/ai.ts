import { Router } from 'express'

const router = Router()

interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** OpenAI 兼容配置（.env 中 AI_BASE_URL / AI_API_KEY / AI_MODEL） */
const AI_BASE = (process.env.AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '')
const AI_KEY = process.env.AI_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat'

const SYSTEM_PROMPT =
  '你是「宇界工作台」的内置 AI 助手，帮助用户整理思路、规划任务、回答问题。' +
  '回答使用简体中文，简洁清晰，尽量结构化（分点、小标题）。'

/**
 * 聊天流式代理：POST /api/ai/chat
 * body: { messages: [{ role, content }] }（不含 system，由后端注入）
 * 响应：SSE，每行 data: {content: 增量}，结束 data: [DONE]；出错 data: {error}
 */
router.post('/chat', async (req, res) => {
  const msgs = (req.body as { messages?: ChatMsg[] } | undefined)?.messages
  if (!AI_KEY) {
    res.status(400).json({ error: '未配置 AI_API_KEY，请在 .env 中设置后重启后端' })
    return
  }
  if (!Array.isArray(msgs) || msgs.length === 0) {
    res.status(400).json({ error: 'messages 不能为空' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  try {
    const upstream = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...msgs],
        stream: true,
      }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '')
      res.write(`data: ${JSON.stringify({ error: `上游 ${upstream.status}：${errText.slice(0, 200)}` })}\n\n`)
      res.end()
      return
    }
    const reader = upstream.body.getReader()
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
          const json = JSON.parse(payload)
          const delta: string | undefined = json.choices?.[0]?.delta?.content
          if (delta) res.write(`data: ${JSON.stringify({ content: delta })}\n\n`)
        } catch {
          // 忽略无法解析的行（如 keep-alive）
        }
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
    res.end()
  }
})

export function createAIRouter() {
  return router
}
