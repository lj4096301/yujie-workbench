import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { message } from 'antd'
import { RefreshCw, Plus, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface PricingEntry {
  id: string
  provider: string
  model: string
  /** 缓存未命中的输入价（原币种） */
  inputPrice: number
  /** 缓存命中价（原币种）；平台不支持则为 null */
  cachePrice: number | null
  outputPrice: number
  unit: string
  currency: '¥' | '$'
  /** 折算人民币，用于跨币种比较 */
  inputPriceCny: number
  outputPriceCny: number
  cachePriceCny: number | null
  lastUpdated: string
  source?: string
  verifiedAt?: string
  note?: string
  changePercent?: number
  custom?: boolean
}

interface PricingResponse {
  fxRate: number
  updatedAt: string
  items: PricingEntry[]
}

type SortKey = 'costCny' | 'inputPriceCny' | 'cachePriceCny' | 'outputPriceCny'

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'costCny', label: '综合成本（按当前用量）' },
  { value: 'inputPriceCny', label: '输入价 · 缓存未命中' },
  { value: 'cachePriceCny', label: '缓存命中价' },
  { value: 'outputPriceCny', label: '输出价' },
]

const SORT_KEY_LABEL: Record<SortKey, string> = {
  costCny: '综合成本',
  inputPriceCny: '输入价',
  cachePriceCny: '缓存命中价',
  outputPriceCny: '输出价',
}

const APIMonitorModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [items, setItems] = useState<PricingEntry[]>([])
  const [fxRate, setFxRate] = useState(7.1)
  const [loading, setLoading] = useState(false)

  // 排序 / 筛选
  const [sortKey, setSortKey] = useState<SortKey>('costCny')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [providerFilter, setProviderFilter] = useState<string[]>([])
  const [platformOpen, setPlatformOpen] = useState(false)

  // 成本计算器（缓存命中率单列，否则会严重高估成本）
  const [showCalc, setShowCalc] = useState(true)
  const [inputTokens, setInputTokens] = useState(1000000)
  const [cacheRate, setCacheRate] = useState(60)
  const [outputTokens, setOutputTokens] = useState(500000)

  // 新增 / 编辑
  const [editing, setEditing] = useState<PricingEntry | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState<PricingEntry | null>(null)
  const [formData, setFormData] = useState({
    provider: '', model: '', currency: '¥' as '¥' | '$',
    inputPrice: 0, cachePrice: 0, outputPrice: 0, note: '',
  })
  const resetForm = () => setFormData({
    provider: '', model: '', currency: '¥' as '¥' | '$',
    inputPrice: 0, cachePrice: 0, outputPrice: 0, note: '',
  })

  const fetchPricings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pricing')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PricingResponse = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      if (data.fxRate) setFxRate(data.fxRate)
    } catch (err) {
      message.error('价格数据获取失败：' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPricings()
  }, [])

  /** 按当前 token 用量估算人民币成本（含缓存命中折扣） */
  const calcCostCny = (p: PricingEntry) => {
    const hit = inputTokens * (cacheRate / 100)
    const miss = Math.max(0, inputTokens - hit)
    const cacheUnit = p.cachePriceCny ?? p.inputPriceCny
    return (miss / 1e6) * p.inputPriceCny + (hit / 1e6) * cacheUnit + (outputTokens / 1e6) * p.outputPriceCny
  }

  const metricOf = (p: PricingEntry, key: SortKey): number | null => {
    if (key === 'costCny') return calcCostCny(p)
    const v = p[key]
    return v === null || v === undefined ? null : v
  }

  const providers = useMemo(
    () => Array.from(new Set(items.map((i) => i.provider))).sort(),
    [items]
  )

  const filtered = useMemo(
    () => (providerFilter.length ? items.filter((i) => providerFilter.includes(i.provider)) : items),
    [items, providerFilter]
  )

  const sorted = useMemo(() => {
    const withValue: Array<{ item: PricingEntry; value: number }> = []
    const withoutValue: PricingEntry[] = []
    filtered.forEach((item) => {
      const value = metricOf(item, sortKey)
      if (value === null || !Number.isFinite(value)) withoutValue.push(item)
      else withValue.push({ item, value })
    })
    withValue.sort((a, b) => (sortOrder === 'asc' ? a.value - b.value : b.value - a.value))
    return [...withValue.map((x) => x.item), ...withoutValue]
  }, [filtered, sortKey, sortOrder, inputTokens, cacheRate, outputTokens])

  /** 当前维度下最便宜的一条 —— 用来打「最优」标记 */
  const best = useMemo(() => {
    let bestItem: PricingEntry | null = null
    let bestValue = Infinity
    filtered.forEach((item) => {
      const value = metricOf(item, sortKey)
      if (value !== null && Number.isFinite(value) && value < bestValue) {
        bestValue = value
        bestItem = item
      }
    })
    return bestItem as PricingEntry | null
  }, [filtered, sortKey, inputTokens, cacheRate, outputTokens])

  const openCreate = () => {
    setEditing(null)
    resetForm()
    setModalOpen(true)
  }

  const openAdjust = (record: PricingEntry) => {
    setEditing(record)
    setFormData({
      provider: record.provider,
      model: record.model,
      currency: record.currency,
      inputPrice: record.inputPrice,
      cachePrice: record.cachePrice || 0,
      outputPrice: record.outputPrice,
      note: record.note || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = {
      provider: formData.provider.trim(),
      model: formData.model.trim(),
      currency: formData.currency,
      inputPrice: formData.inputPrice,
      cachePrice: formData.cachePrice || null,
      outputPrice: formData.outputPrice,
      note: formData.note.trim(),
    }
    if (!values.provider || !values.model) { message.warning('请填写平台与模型名称'); return }
    setSaving(true)
    try {
      const isEdit = !!editing?.custom
      const url = isEdit ? `/api/pricing/custom/${encodeURIComponent(editing!.id)}` : '/api/pricing/custom'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      message.success(isEdit ? '已更新价格' : '已新增价格条目')
      setModalOpen(false)
      setEditing(null)
      resetForm()
      await fetchPricings()
    } catch (err) {
      message.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /** 删除：自定义条目删数据文件记录；内置参考价删持久化清单，重启仍生效 */
  const handleDelete = async (record: PricingEntry) => {
    const url = record.custom
      ? `/api/pricing/custom/${encodeURIComponent(record.id)}`
      : `/api/pricing/builtin/${encodeURIComponent(record.id)}`
    try {
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      message.success('已删除')
      await fetchPricings()
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const priceCell = (value: number | null, currency: string, extra?: React.ReactNode) => {
    if (value === null || value === undefined) return <span style={{ color: 'var(--text-disabled, #c9cdd4)' }}>—</span>
    return (
      <span>
        {currency} {value}
        {extra}
      </span>
    )
  }

  const headerActions = actionsHost
    ? createPortal(
        <div className="am-header-actions">
          <Button size="sm" variant="outline" onClick={fetchPricings} title="刷新价格">
            <RefreshCw className="h-3.5 w-3.5" /> 刷新
          </Button>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} title="切换升序 / 降序">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
          <Button size="sm" variant={providerFilter.length ? 'default' : 'outline'} onClick={() => setPlatformOpen(true)}>
            平台{providerFilter.length ? ' (' + providerFilter.length + ')' : ''}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> 新增
          </Button>
          <Button size="sm" variant={showCalc ? 'default' : 'outline'} onClick={() => setShowCalc(!showCalc)}>
            <Calculator className="h-3.5 w-3.5" /> 计算器
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div>
      {headerActions}

      {/* 成本计算器 */}
      {showCalc && (
        <div
          style={{
            padding: 12,
            background: 'var(--bg-subtle, #f7f8fa)',
            borderRadius: 8,
            marginBottom: 10,
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary, #4e5969)' }}>输入 Token：</span>
            <Input
              type="number"
              min={0}
              step={100000}
              value={String(inputTokens)}
              onChange={(e) => setInputTokens(Number(e.target.value) || 0)}
              className="h-8 w-[116px]"
            />
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary, #4e5969)' }}>缓存命中率：</span>
            <Input
              type="number"
              min={0}
              max={100}
              step={5}
              value={String(cacheRate)}
              onChange={(e) => setCacheRate(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="h-8 w-[90px]"
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted, #86909c)' }}>%</span>
          </div>
          <div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary, #4e5969)' }}>输出 Token：</span>
            <Input
              type="number"
              min={0}
              step={100000}
              value={String(outputTokens)}
              onChange={(e) => setOutputTokens(Number(e.target.value) || 0)}
              className="h-8 w-[116px]"
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #86909c)' }}>
            命中部分按「缓存命中价」计，未命中按输入价——命中率越高，实际成本越低
          </div>
        </div>
      )}

      {/* 概览 */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #4e5969)', marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>
          共 <b>{filtered.length}</b> 个模型（<b>{filtered.filter((i) => i.custom).length}</b> 个自定义）
        </span>
        {best && (
          <span>
            {SORT_KEY_LABEL[sortKey]}最优：<b style={{ color: 'var(--primary-color, #ff6700)' }}>{best.provider} · {best.model}</b>
            {sortKey === 'costCny' && <> ≈ ¥{calcCostCny(best).toFixed(3)}</>}
          </span>
        )}
        <span style={{ color: 'var(--text-disabled, #c9cdd4)' }}>美元按 1$ ≈ ¥{fxRate} 折算</span>
      </div>

      {/* 价格表格 */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : sorted.length > 0 ? (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border, #e5e6eb)', borderRadius: 8 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[92px]">平台</TableHead>
                <TableHead>模型</TableHead>
                <TableHead className="w-[132px]">输入价（未命中）</TableHead>
                <TableHead className="w-[118px]">缓存命中价</TableHead>
                <TableHead className="w-[118px]">输出价</TableHead>
                <TableHead className="w-[128px]">综合成本（折算）</TableHead>
                <TableHead className="w-[86px]">变动</TableHead>
                <TableHead className="w-[150px]">来源</TableHead>
                <TableHead className="w-[116px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((record) => {
                const isBest = !!(best && best.id === record.id)
                const change = record.changePercent
                return (
                  <TableRow key={record.id} className={isBest ? 'pricing-best-row' : ''}>
                    <TableCell>
                      <span style={{ fontWeight: 600 }}>
                        {record.provider}
                        {record.custom && (
                          <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--warning, #ff7d00)' }}>自定义</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{record.model}</span>
                          {isBest && (
                            <span style={{ fontSize: 12, color: 'var(--primary-color, #ff6700)' }}>最优</span>
                          )}
                        </div>
                        {record.note && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted, #86909c)', lineHeight: 1.5 }}>{record.note}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {priceCell(record.inputPrice, record.currency, (
                        <span style={{ fontSize: 12, color: 'var(--text-disabled, #c9cdd4)' }}> /{record.unit}</span>
                      ))}
                    </TableCell>
                    <TableCell>
                      {record.cachePrice === null || record.cachePrice === undefined ? (
                        <span title="该平台未公布单一缓存命中价（或按比例折扣计费）" style={{ color: 'var(--text-disabled, #c9cdd4)', cursor: 'help' }}>
                          不支持
                        </span>
                      ) : (
                        <span style={{ color: 'var(--success, #00b42a)', fontWeight: 600 }}>
                          {record.currency} {record.cachePrice}
                          <span style={{ fontSize: 12, color: 'var(--text-disabled, #c9cdd4)', fontWeight: 400 }}> /{record.unit}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {priceCell(record.outputPrice, record.currency, (
                        <span style={{ fontSize: 12, color: 'var(--text-disabled, #c9cdd4)' }}> /{record.unit}</span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <span style={{ fontWeight: 600, color: 'var(--primary-color, #ff6700)' }}>¥{calcCostCny(record).toFixed(3)}</span>
                    </TableCell>
                    <TableCell>
                      {change === undefined || change === 0 ? (
                        <span style={{ color: 'var(--text-disabled, #c9cdd4)' }}>—</span>
                      ) : change > 0 ? (
                        <span style={{ color: 'var(--danger, #f53f3f)' }}>↑ +{change}%</span>
                      ) : (
                        <span style={{ color: 'var(--success, #00b42a)' }}>↓ {change}%</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.source ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #4e5969)' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }} title={record.source}>
                            {record.source}
                          </div>
                          {record.verifiedAt && (
                            <div style={{ color: 'var(--text-disabled, #c9cdd4)' }}>核实 {record.verifiedAt}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-disabled, #c9cdd4)' }}>—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button variant="link" className="h-6 px-0 text-xs text-[#ff6700]" onClick={() => openAdjust(record)}>
                          {record.custom ? '编辑' : '校正'}
                        </Button>
                        <Button variant="link" className="h-6 px-0 text-xs text-[#F53F3F]" onClick={() => setDelTarget(record)}>
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="mod-empty">暂无价格数据</div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-disabled, #c9cdd4)', lineHeight: 1.7 }}>
        内置价格为公开渠道核实的参考价（见「来源」列），厂商调价频繁，请以官网为准；
        点「校正」可用你的实际价格覆盖内置条目；过期 / 不再关注的 API 直接点「删除」，删除后重启应用也不会恢复。
      </div>

      {/* 平台多选 */}
      <Dialog open={platformOpen} onOpenChange={setPlatformOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>筛选平台</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4, maxHeight: 320, overflowY: 'auto' }}>
            {providers.map((p) => {
              const checked = providerFilter.includes(p)
              return (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#F7F8FA]"
                  style={{ color: 'var(--text-primary, #1d2129)' }}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setProviderFilter((prev) => (v ? [...prev, p] : prev.filter((x) => x !== p)))
                    }}
                  />
                  <span>{p}</span>
                </label>
              )
            })}
            {providers.length === 0 && (
              <div className="mod-empty" style={{ padding: 24 }}>暂无平台数据</div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setProviderFilter([])}>清空</Button>
            <Button onClick={() => setPlatformOpen(false)}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除二次确认 */}
      <ConfirmDialog
        open={!!delTarget}
        title="删除价格条目"
        content={delTarget ? '删除「' + delTarget.provider + ' · ' + delTarget.model + '」？' + (delTarget.custom ? '' : '内置参考价删除后不再显示') : ''}
        danger
        okText="删除"
        onOk={async () => { if (delTarget) await handleDelete(delTarget) }}
        onOpenChange={(o) => { if (!o) setDelTarget(null) }}
      />

      {/* 新增 / 编辑弹窗 */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { setModalOpen(false); setEditing(null) } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? (editing.custom ? '编辑价格 · ' + editing.model : '校正内置价 · ' + editing.model) : '新增 API 价格'}
            </DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">平台名称</Label>
              <Input value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} placeholder="例如：DeepSeek / 阿里百炼 / 自建 vLLM" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">模型名称</Label>
              <Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="例如：deepseek-v4-pro" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">计价币种</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as '¥' | '$' })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="¥">¥ 人民币</SelectItem>
                  <SelectItem value="$">$ 美元</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Label className="mb-1 block text-xs font-medium text-[#4E5969]">输入价 / 百万token（未命中）</Label>
                <Input type="number" min={0} step={0.01} value={String(formData.inputPrice)} onChange={(e) => setFormData({ ...formData, inputPrice: Number(e.target.value) || 0 })} placeholder="0.00" />
              </div>
              <div style={{ flex: 1 }}>
                <Label className="mb-1 block text-xs font-medium text-[#4E5969]">缓存命中价（可留空）</Label>
                <Input type="number" min={0} step={0.01} value={String(formData.cachePrice || '')} onChange={(e) => setFormData({ ...formData, cachePrice: Number(e.target.value) || 0 })} placeholder="留空表示不支持" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">输出价 / 百万token</Label>
              <Input type="number" min={0} step={0.01} value={String(formData.outputPrice)} onChange={(e) => setFormData({ ...formData, outputPrice: Number(e.target.value) || 0 })} placeholder="0.00" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-[#4E5969]">备注（可选）</Label>
              <Input value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} placeholder="例如：高峰时段价格 / 上下文长度 / 渠道折扣" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #86909c)' }}>
              保存后该条目会以「自定义」身份参与排序与最优比价；同名平台 + 模型会覆盖内置参考价。
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setModalOpen(false); setEditing(null) }}>取消</Button>
            <Button onClick={handleSubmit} disabled={saving}>{editing ? '保存' : '新增'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default APIMonitorModule
