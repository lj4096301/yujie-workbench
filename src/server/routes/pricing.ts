import { Router } from 'express'
import fs from 'fs'
import { dataFile } from '../paths'

/**
 * 一条模型价格。
 *
 * 关于「缓存命中价」：主流平台对重复前缀（system prompt / few-shot 文档）会走上下文缓存，
 * 命中部分的输入价远低于未命中部分（DeepSeek 约 1/30、Kimi 约 1/10、GLM 约 1/5），
 * 所以只比「输入价」会严重高估成本 —— 缓存命中价必须单独列出来。
 */
export interface PricingEntry {
  id: string
  provider: string
  model: string
  /** 缓存未命中的输入价 */
  inputPrice: number
  /** 缓存命中的输入价；平台不支持缓存计费则为 null */
  cachePrice: number | null
  outputPrice: number
  unit: string
  currency: '¥' | '$'
  /** 数据抓取时间 */
  lastUpdated: string
  /** 数据来源（可追溯到官方文档 / 公开价格表） */
  source?: string
  /** 价格核实日期 */
  verifiedAt?: string
  note?: string
  changePercent?: number
  /** 用户自定义条目 */
  custom?: boolean
  /** 人民币折算价，用于跨币种排序与比较 */
  inputPriceCny?: number
  outputPriceCny?: number
  cachePriceCny?: number | null
}

/** 基准数据：内置参考价（可覆盖、可删除），价格单位为「每百万 token」 */
type SeedEntry = Omit<PricingEntry, 'id' | 'lastUpdated' | 'inputPriceCny' | 'outputPriceCny' | 'cachePriceCny'>

/**
 * 内置参考价。
 *
 * 价格随厂商调价变动频繁，这里记录的是**核实日期**当天的公开价格，
 * 每行都带 source 便于回溯；请以厂商官网为准，可直接在界面上新增/编辑覆盖。
 */
const SEED: SeedEntry[] = [
  // ---------- DeepSeek（2026-08-17 起实行峰谷定价，空闲时段为高峰价的一半）----------
  {
    provider: 'DeepSeek', model: 'deepseek-v4-pro（高峰）',
    inputPrice: 9, outputPrice: 27, cachePrice: 0.3,
    unit: '百万token', currency: '¥',
    source: 'DeepSeek 官方公告 / 中国经济网 2026-08-17 调价', verifiedAt: '2026-08-17',
    note: '高峰时段 09:00-12:00、14:00-18:00',
  },
  {
    provider: 'DeepSeek', model: 'deepseek-v4-pro（空闲）',
    inputPrice: 4.5, outputPrice: 13.5, cachePrice: 0.15,
    unit: '百万token', currency: '¥',
    source: 'DeepSeek 官方公告 / 中国经济网 2026-08-17 调价', verifiedAt: '2026-08-17',
    note: '空闲时段为高峰价的一半',
  },
  {
    provider: 'DeepSeek', model: 'deepseek-v4-flash（高峰）',
    inputPrice: 3, outputPrice: 9, cachePrice: 0.1,
    unit: '百万token', currency: '¥',
    source: 'DeepSeek 官方公告 / 中国经济网 2026-08-17 调价', verifiedAt: '2026-08-17',
    note: '高峰时段 09:00-12:00、14:00-18:00',
  },
  {
    provider: 'DeepSeek', model: 'deepseek-v4-flash（空闲）',
    inputPrice: 1.5, outputPrice: 4.5, cachePrice: 0.05,
    unit: '百万token', currency: '¥',
    source: 'DeepSeek 官方公告 / 中国经济网 2026-08-17 调价', verifiedAt: '2026-08-17',
    note: '空闲时段为高峰价的一半',
  },

  // ---------- 月之暗面 Kimi ----------
  {
    provider: 'Kimi', model: 'kimi-k2.6',
    inputPrice: 6.5, outputPrice: 27, cachePrice: 1.1,
    unit: '百万token', currency: '¥',
    source: '平台官方 API 文档（2026-07 价格表）', verifiedAt: '2026-07-31',
    note: '256K 上下文',
  },
  {
    provider: 'Kimi', model: 'kimi-k2.7-code',
    inputPrice: 6.5, outputPrice: 27, cachePrice: 1.1,
    unit: '百万token', currency: '¥',
    source: '平台官方 API 文档（2026-07 价格表）', verifiedAt: '2026-07-31',
    note: '代码专项优化版',
  },

  // ---------- 阿里云百炼 Qwen ----------
  {
    provider: '阿里百炼', model: 'qwen3.7-max',
    inputPrice: 12, outputPrice: 36, cachePrice: null,
    unit: '百万token', currency: '¥',
    source: '平台官方 API 文档（2026-07 价格表）', verifiedAt: '2026-07-31',
    note: '显式缓存按 125% 计费创建、命中按 10% 计费，未公布单一命中价',
  },
  {
    provider: '阿里百炼', model: 'qwen3.7-plus',
    inputPrice: 2, outputPrice: 8, cachePrice: null,
    unit: '百万token', currency: '¥',
    source: '平台官方 API 文档（2026-07 价格表）', verifiedAt: '2026-07-31',
    note: '支持缓存折扣（官方未公布单一命中价）',
  },
  {
    provider: '阿里百炼', model: 'qwen3.5-flash',
    inputPrice: 0.2, outputPrice: 2, cachePrice: null,
    unit: '百万token', currency: '¥',
    source: '平台官方 API 文档（2026-07 价格表）', verifiedAt: '2026-07-31',
    note: '轻量任务',
  },

  // ---------- 智谱 GLM ----------
  {
    provider: '智谱', model: 'glm-5.2',
    inputPrice: 8, outputPrice: 28, cachePrice: 2,
    unit: '百万token', currency: '¥',
    source: '平台官方 API 文档（2026-07 价格表）', verifiedAt: '2026-07-31',
    note: '自动识别重复前缀，无需手动配置',
  },
  {
    provider: '智谱', model: 'glm-4.7-flash',
    inputPrice: 0, outputPrice: 0, cachePrice: 0,
    unit: '百万token', currency: '¥',
    source: '平台官方 API 文档（2026-07 价格表）', verifiedAt: '2026-07-31',
    note: '免费模型',
  },

  // ---------- MiniMax ----------
  {
    provider: 'MiniMax', model: 'MiniMax M3（五折）',
    inputPrice: 2.1, outputPrice: 8.4, cachePrice: 0.42,
    unit: '百万token', currency: '¥',
    source: '平台官方 API 文档（2026-07 价格表）', verifiedAt: '2026-07-31',
    note: '折后价',
  },

  // ---------- 海外（USD）----------
  {
    provider: 'Anthropic', model: 'Claude Sonnet 5',
    inputPrice: 3, outputPrice: 15, cachePrice: 0.3,
    unit: '百万token', currency: '$',
    source: 'Anthropic 官方定价 / aiarch.dev 价格追踪', verifiedAt: '2026-08-21',
    note: '1M 上下文',
  },
  {
    provider: 'Anthropic', model: 'Claude Opus 4.8',
    inputPrice: 5, outputPrice: 25, cachePrice: 0.5,
    unit: '百万token', currency: '$',
    source: 'Anthropic 官方定价 / aiarch.dev 价格追踪', verifiedAt: '2026-08-21',
  },
  {
    provider: 'Anthropic', model: 'Claude Haiku 4.5',
    inputPrice: 1, outputPrice: 5, cachePrice: 0.1,
    unit: '百万token', currency: '$',
    source: 'Anthropic 官方定价 / aiarch.dev 价格追踪', verifiedAt: '2026-08-21',
  },
  {
    provider: 'OpenAI', model: 'GPT-5.4',
    inputPrice: 2.5, outputPrice: 15, cachePrice: 0.25,
    unit: '百万token', currency: '$',
    source: 'OpenRouter 透传价 / aiarch.dev 价格追踪', verifiedAt: '2026-08-21',
    note: '1.1M 上下文',
  },
  {
    provider: 'OpenAI', model: 'GPT-5.5',
    inputPrice: 5, outputPrice: 30, cachePrice: 0.5,
    unit: '百万token', currency: '$',
    source: 'OpenRouter 透传价 / aiarch.dev 价格追踪', verifiedAt: '2026-08-21',
  },
  {
    provider: 'Google', model: 'Gemini 3.5 Flash',
    inputPrice: 1.5, outputPrice: 9, cachePrice: 0.15,
    unit: '百万token', currency: '$',
    source: 'OpenRouter 透传价 / aiarch.dev 价格追踪', verifiedAt: '2026-08-21',
  },
  {
    provider: 'Google', model: 'Gemini 2.5 Flash Lite',
    inputPrice: 0.1, outputPrice: 0.4, cachePrice: 0.01,
    unit: '百万token', currency: '$',
    source: 'OpenRouter 透传价 / aiarch.dev 价格追踪', verifiedAt: '2026-08-21',
  },
]

const CUSTOM_FILE = () => dataFile('pricing-custom.json')
const DELETED_FILE = () => dataFile('pricing-deleted.json')

/** 美元兑人民币折算率（仅用于跨币种排序，可在 .env 用 USD_CNY_RATE 覆盖） */
function fxRate(): number {
  const raw = Number(process.env.USD_CNY_RATE)
  return Number.isFinite(raw) && raw > 0 ? raw : 7.1
}

function slug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')
}

function makeId(provider: string, model: string): string {
  return `${slug(provider) || 'provider'}__${slug(model) || 'model'}`
}

/** 补齐 id / 折算价 / 时间戳 */
function decorate(seed: SeedEntry, custom: boolean, fx: number): PricingEntry {
  const toCny = (v: number) => Math.round(v * (seed.currency === '$' ? fx : 1) * 10000) / 10000
  return {
    ...seed,
    id: makeId(seed.provider, seed.model),
    custom,
    lastUpdated: new Date().toISOString(),
    inputPriceCny: toCny(seed.inputPrice),
    outputPriceCny: toCny(seed.outputPrice),
    cachePriceCny: seed.cachePrice == null ? null : toCny(seed.cachePrice),
  }
}

function loadCustom(): SeedEntry[] {
  try {
    const file = CUSTOM_FILE()
    if (!fs.existsSync(file)) return []
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('[pricing] 自定义价格读取失败:', (err as Error).message)
    return []
  }
}

function saveCustom(entries: SeedEntry[]): void {
  fs.writeFileSync(CUSTOM_FILE(), JSON.stringify(entries, null, 2), 'utf-8')
}

/** 被删除的内置条目 id 列表（内置价硬编码在代码里，删除需持久化记录） */
function loadDeleted(): string[] {
  try {
    const file = DELETED_FILE()
    if (!fs.existsSync(file)) return []
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch (err) {
    console.warn('[pricing] 删除列表读取失败:', (err as Error).message)
    return []
  }
}

function saveDeleted(ids: string[]): void {
  fs.writeFileSync(DELETED_FILE(), JSON.stringify(ids, null, 2), 'utf-8')
}

function allEntries(fx: number, deleted: string[] = loadDeleted()): PricingEntry[] {
  const custom = loadCustom().map((e) => decorate(e, true, fx))
  const customIds = new Set(custom.map((c) => c.id))
  const deletedSet = new Set(deleted)
  // 自定义条目覆盖同名内置条目；被删除的内置条目不再输出
  const builtin = SEED.map((e) => decorate(e, false, fx)).filter(
    (e) => !customIds.has(e.id) && !deletedSet.has(e.id)
  )
  return [...builtin, ...custom]
}

interface CustomPayload {
  provider?: string
  model?: string
  currency?: string
  inputPrice?: number | string
  outputPrice?: number | string
  cachePrice?: number | string | null
  note?: string
}

/** 解析并校验新增/编辑的请求体 */
function parsePayload(body: CustomPayload): { ok: true; value: SeedEntry } | { ok: false; error: string } {
  const provider = String(body.provider ?? '').trim()
  const model = String(body.model ?? '').trim()
  if (!provider) return { ok: false, error: '平台名称不能为空' }
  if (!model) return { ok: false, error: '模型名称不能为空' }

  const currency = body.currency === '$' ? '$' : '¥'

  const num = (v: unknown, fallback: number | null): number | null => {
    if (v === null || v === undefined || v === '') return fallback
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : fallback
  }

  const inputPrice = num(body.inputPrice, null)
  const outputPrice = num(body.outputPrice, null)
  if (inputPrice === null) return { ok: false, error: '请输入有效的输入价格（≥0）' }
  if (outputPrice === null) return { ok: false, error: '请输入有效的输出价格（≥0）' }

  const cachePrice = num(body.cachePrice, null)
  if (cachePrice !== null && cachePrice > inputPrice) {
    return { ok: false, error: '缓存命中价通常不高于输入价，请检查' }
  }

  return {
    ok: true,
    value: {
      provider,
      model,
      currency,
      inputPrice,
      outputPrice,
      cachePrice,
      unit: '百万token',
      note: String(body.note ?? '').trim() || undefined,
      source: '手动添加',
      verifiedAt: new Date().toISOString().slice(0, 10),
    },
  }
}

export function createPricingRouter() {
  const router = Router()

  // 全量价格（内置参考价 + 自定义，含人民币折算价；已删除的内置条目不再输出）
  router.get('/', (_req, res) => {
    const fx = fxRate()
    res.json({
      fxRate: fx,
      updatedAt: new Date().toISOString(),
      items: allEntries(fx),
    })
  })

  // 新增自定义 API 价格
  router.post('/custom', (req, res) => {
    const parsed = parsePayload(req.body || {})
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })

    const custom = loadCustom()
    const id = makeId(parsed.value.provider, parsed.value.model)
    if (custom.some((e) => makeId(e.provider, e.model) === id)) {
      return res.status(409).json({ error: '已存在同名平台 + 模型，请直接编辑或用不同的模型名' })
    }

    custom.push(parsed.value)
    saveCustom(custom)
    res.json(decorate(parsed.value, true, fxRate()))
  })

  // 编辑自定义条目
  router.put('/custom/:id', (req, res) => {
    const custom = loadCustom()
    const index = custom.findIndex((e) => makeId(e.provider, e.model) === req.params.id)
    if (index < 0) return res.status(404).json({ error: '未找到该自定义条目' })

    const parsed = parsePayload({ ...custom[index], ...(req.body || {}) })
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })

    custom[index] = parsed.value
    saveCustom(custom)
    res.json(decorate(parsed.value, true, fxRate()))
  })

  // 删除自定义条目
  router.delete('/custom/:id', (req, res) => {
    const custom = loadCustom()
    const next = custom.filter((e) => makeId(e.provider, e.model) !== req.params.id)
    if (next.length === custom.length) return res.status(404).json({ error: '未找到该自定义条目' })
    saveCustom(next)
    res.json({ ok: true })
  })

  // 删除内置参考价（过期 / 不再关注的 API；删除记录持久化，重启后仍生效）
  router.delete('/builtin/:id', (req, res) => {
    const target = SEED.find((e) => makeId(e.provider, e.model) === req.params.id)
    if (!target) return res.status(404).json({ error: '未找到该内置条目' })

    const deleted = loadDeleted()
    if (!deleted.includes(req.params.id)) deleted.push(req.params.id)
    saveDeleted(deleted)
    res.json({ ok: true })
  })

  return router
}
