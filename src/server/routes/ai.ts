import { Router } from 'express'
import fs from 'fs'
import { ENV_PATH } from '../env'

const router = Router()

interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 每次请求实时读取（保存配置后立即生效，无需重启） */
const getBase = () => (process.env.AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '')
const getKey = () => process.env.AI_API_KEY || ''
const getModel = () => process.env.AI_MODEL || 'deepseek-chat'

/** 写入/更新 .env 中 AI_* 键值（保留其他配置，CRLF 风格） */
function upsertEnv(key: string, value: string): void {
  const raw = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : ''
  const lines = raw.split(/\r?\n/)
  let found = false
  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true
      return `${key}=${value}`
    }
    return line
  })
  if (!found) out.push(`${key}=${value}`)
  fs.writeFileSync(ENV_PATH, out.join('\r\n'), 'utf8')
}

const SYSTEM_PROMPT =
  '你是「宇界工作台」的内置 AI 助手，帮助用户整理思路、规划任务、回答问题。' +
  '回答使用简体中文，简洁清晰，尽量结构化（分点、小标题）。'

/**
 * 读取当前 AI 配置（本地应用，完整 key 回显给前端）
 */
router.get('/config', (_req, res) => {
  const key = getKey()
  res.json({
    baseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com/v1',
    apiKey: key,
    hasKey: Boolean(key),
    model: getModel(),
  })
})

/**
 * 保存 AI 配置：写入 .env 并同步到当前进程（立即生效）
 * body: { baseUrl?, apiKey?, model? }（空字符串不更新）
 */
router.post('/config', (req, res) => {
  const { baseUrl, apiKey, model } = (req.body ?? {}) as {
    baseUrl?: string
    apiKey?: string
    model?: string
  }
  try {
    if (typeof baseUrl === 'string' && baseUrl.trim()) {
      upsertEnv('AI_BASE_URL', baseUrl.trim())
      process.env.AI_BASE_URL = baseUrl.trim()
    }
    if (typeof apiKey === 'string' && apiKey.trim()) {
      upsertEnv('AI_API_KEY', apiKey.trim())
      process.env.AI_API_KEY = apiKey.trim()
    }
    if (typeof model === 'string' && model.trim()) {
      upsertEnv('AI_MODEL', model.trim())
      process.env.AI_MODEL = model.trim()
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: '保存配置失败：' + String(err) })
  }
})

/**
 * 在线获取模型列表：GET /api/ai/models
 * 兼容 OpenAI 兼容协议（data[].id）与 Ollama（models[].name）
 */
router.get('/models', async (_req, res) => {
  if (!getKey()) {
    res.status(400).json({ error: '请先在「设置」中填写 API Key' })
    return
  }
  try {
    const upstream = await fetch(`${getBase()}/models`, {
      headers: { Authorization: `Bearer ${getKey()}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (!upstream.ok) {
      const t = await upstream.text().catch(() => '')
      res.status(502).json({ error: `获取模型失败（上游 ${upstream.status}）：${t.slice(0, 200)}` })
      return
    }
    const json = (await upstream.json()) as {
      data?: Array<{ id: string }>
      models?: Array<{ name: string }>
    }
    const ids = Array.isArray(json.data)
      ? json.data.map((m) => m.id)
      : Array.isArray(json.models)
        ? json.models.map((m) => m.name)
        : []
    res.json({ models: ids })
  } catch (err) {
    res.status(502).json({ error: '获取模型失败：' + String(err) })
  }
})

/**
 * 聊天流式代理：POST /api/ai/chat
 * body: { messages: [{ role, content }] }（不含 system，由后端注入）
 * 响应：SSE，每行 data: {content: 增量}，结束 data: [DONE]；出错 data: {error}
 */
router.post('/chat', async (req, res) => {
  const msgs = (req.body as { messages?: ChatMsg[] } | undefined)?.messages
  if (!getKey()) {
    res.status(400).json({ error: '未配置 AI_API_KEY，请点击「设置」填写 API Key' })
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
    const upstream = await fetch(`${getBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getKey()}`,
      },
      body: JSON.stringify({
        model: getModel(),
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
