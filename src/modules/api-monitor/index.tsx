import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Spin,
  Empty,
  Tag,
  Button,
  Table,
  InputNumber,
  Select,
  Modal,
  Form,
  Input,
  Tooltip,
  Popconfirm,
  message,
} from 'antd'

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

  // 成本计算器（缓存命中率单列，否则会严重高估成本）
  const [showCalc, setShowCalc] = useState(true)
  const [inputTokens, setInputTokens] = useState(1000000)
  const [cacheRate, setCacheRate] = useState(60)
  const [outputTokens, setOutputTokens] = useState(500000)

  // 新增 / 编辑
  const [editing, setEditing] = useState<PricingEntry | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

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
    form.resetFields()
    form.setFieldsValue({ currency: '¥', provider: '', model: '', note: '' })
    setModalOpen(true)
  }

  const openAdjust = (record: PricingEntry) => {
    setEditing(record)
    form.setFieldsValue({
      provider: record.provider,
      model: record.model,
      currency: record.currency,
      inputPrice: record.inputPrice,
      cachePrice: record.cachePrice,
      outputPrice: record.outputPrice,
      note: record.note || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
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
    if (value === null || value === undefined) return <span style={{ color: '#bbb' }}>—</span>
    return (
      <span>
        {currency} {value}
        {extra}
      </span>
    )
  }

  const columns = [
    {
      title: '平台',
      dataIndex: 'provider',
      key: 'provider',
      width: 92,
      fixed: 'left' as const,
      render: (text: string, record: PricingEntry) => (
        <span style={{ fontWeight: 600 }}>
          {text}
          {record.custom && (
            <Tag color="orange" style={{ marginLeft: 4, transform: 'scale(0.85)' }}>
              自定义
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      width: 190,
      render: (text: string, record: PricingEntry) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{text}</span>
            {best && best.id === record.id && <Tag color="gold">最优</Tag>}
          </div>
          {record.note && (
            <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5 }}>{record.note}</div>
          )}
        </div>
      ),
    },
    {
      title: '输入价（未命中）',
      dataIndex: 'inputPrice',
      key: 'inputPrice',
      width: 132,
      render: (price: number, record: PricingEntry) =>
        priceCell(price, record.currency, (
          <span style={{ fontSize: 10, color: '#aaa' }}> /{record.unit}</span>
        )),
    },
    {
      title: '缓存命中价',
      dataIndex: 'cachePrice',
      key: 'cachePrice',
      width: 118,
      render: (price: number | null, record: PricingEntry) =>
        price === null ? (
          <Tooltip title="该平台未公布单一缓存命中价（或按比例折扣计费）">
            <span style={{ color: '#bbb' }}>不支持</span>
          </Tooltip>
        ) : (
          <span style={{ color: '#52c41a', fontWeight: 600 }}>
            {record.currency} {price}
            <span style={{ fontSize: 10, color: '#aaa', fontWeight: 400 }}> /{record.unit}</span>
          </span>
        ),
    },
    {
      title: '输出价',
      dataIndex: 'outputPrice',
      key: 'outputPrice',
      width: 118,
      render: (price: number, record: PricingEntry) =>
        priceCell(price, record.currency, (
          <span style={{ fontSize: 10, color: '#aaa' }}> /{record.unit}</span>
        )),
    },
    {
      title: '综合成本（折算）',
      key: 'cost',
      width: 128,
      render: (_: unknown, record: PricingEntry) => (
        <span style={{ fontWeight: 600, color: '#1677ff' }}>¥{calcCostCny(record).toFixed(3)}</span>
      ),
    },
    {
      title: '变动',
      dataIndex: 'changePercent',
      key: 'changePercent',
      width: 86,
      render: (percent?: number) => {
        if (percent === undefined || percent === 0) return <Tag>—</Tag>
        // 国内惯例：涨红跌绿
        if (percent > 0) return <Tag color="red">↑ +{percent}%</Tag>
        return <Tag color="green">↓ {percent}%</Tag>
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 150,
      render: (text: string | undefined, record: PricingEntry) =>
        text ? (
          <Tooltip title={text}>
            <div style={{ fontSize: 11, color: '#666' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {text}
              </div>
              {record.verifiedAt && <div style={{ color: '#aaa' }}>核实 {record.verifiedAt}</div>}
            </div>
          </Tooltip>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 116,
      fixed: 'right' as const,
      render: (_: unknown, record: PricingEntry) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" type="link" style={{ padding: 0 }} onClick={() => openAdjust(record)}>
            {record.custom ? '编辑' : '校正'}
          </Button>
          <Popconfirm
            title={`删除「${record.provider} · ${record.model}」？`}
            description={record.custom ? undefined : '内置参考价删除后不再显示'}
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" type="link" danger style={{ padding: 0 }}>
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  const headerActions = actionsHost
    ? createPortal(
        <div className="am-header-actions">
          <Button size="small" icon="🔄" onClick={fetchPricings} title="刷新价格">
            刷新
          </Button>
          <Select
            size="small"
            value={sortKey}
            onChange={(v) => setSortKey(v)}
            options={SORT_OPTIONS}
            style={{ width: 140 }}
            suffixIcon={null}
          />
          <Button
            size="small"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title="切换升序 / 降序"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
          <Select
            size="small"
            mode="multiple"
            allowClear
            maxTagCount={1}
            placeholder="平台"
            value={providerFilter}
            onChange={setProviderFilter}
            options={providers.map((p) => ({ value: p, label: p }))}
            style={{ width: 140 }}
          />
          <Button size="small" icon="＋" type="primary" onClick={openCreate}>
            新增
          </Button>
          <Button
            size="small"
            icon="🧮"
            type={showCalc ? 'primary' : 'default'}
            onClick={() => setShowCalc(!showCalc)}
          >
            计算器
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
            background: '#f0f5ff',
            borderRadius: 8,
            marginBottom: 10,
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: '#666' }}>输入 Token：</span>
            <InputNumber
              size="small"
              value={inputTokens}
              onChange={(v) => setInputTokens(v || 0)}
              min={0}
              step={100000}
              style={{ width: 116 }}
            />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#666' }}>缓存命中率：</span>
            <InputNumber
              size="small"
              value={cacheRate}
              onChange={(v) => setCacheRate(Math.min(100, Math.max(0, v || 0)))}
              min={0}
              max={100}
              step={5}
              style={{ width: 90 }}
              addonAfter="%"
            />
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#666' }}>输出 Token：</span>
            <InputNumber
              size="small"
              value={outputTokens}
              onChange={(v) => setOutputTokens(v || 0)}
              min={0}
              step={100000}
              style={{ width: 116 }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            命中部分按「缓存命中价」计，未命中按输入价——命中率越高，实际成本越低
          </div>
        </div>
      )}

      {/* 概览 */}
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>
          共 <b>{filtered.length}</b> 个模型（<b>{filtered.filter((i) => i.custom).length}</b> 个自定义）
        </span>
        {best && (
          <span>
            {SORT_KEY_LABEL[sortKey]}最优：<b style={{ color: '#1677ff' }}>{best.provider} · {best.model}</b>
            {sortKey === 'costCny' && <> ≈ ¥{calcCostCny(best).toFixed(3)}</>}
          </span>
        )}
        <span style={{ color: '#aaa' }}>美元按 1$ ≈ ¥{fxRate} 折算</span>
      </div>

      {/* 价格表格 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : sorted.length > 0 ? (
        <Table
          dataSource={sorted}
          columns={columns}
          rowKey={(r) => r.id}
          size="small"
          pagination={false}
          scroll={{ x: 1160 }}
          rowClassName={(r) => (best && best.id === r.id ? 'pricing-best-row' : '')}
        />
      ) : (
        <Empty description="暂无价格数据" />
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: '#aaa', lineHeight: 1.7 }}>
        内置价格为公开渠道核实的参考价（见「来源」列），厂商调价频繁，请以官网为准；
        点「校正」可用你的实际价格覆盖内置条目；过期 / 不再关注的 API 直接点「删除」，删除后重启应用也不会恢复。
      </div>

      {/* 新增 / 编辑弹窗 */}
      <Modal
        title={editing ? (editing.custom ? `编辑价格 · ${editing.model}` : `校正内置价 · ${editing.model}`) : '新增 API 价格'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onOk={handleSubmit}
        confirmLoading={saving}
        okText={editing ? '保存' : '新增'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="provider" label="平台名称" rules={[{ required: true, message: '请输入平台名称' }]}>
            <Input placeholder="例如：DeepSeek / 阿里百炼 / 自建 vLLM" />
          </Form.Item>
          <Form.Item name="model" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="例如：deepseek-v4-pro" />
          </Form.Item>
          <Form.Item name="currency" label="计价币种" initialValue="¥">
            <Select
              options={[
                { value: '¥', label: '¥ 人民币' },
                { value: '$', label: '$ 美元' },
              ]}
            />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              name="inputPrice"
              label="输入价 / 百万token（缓存未命中）"
              rules={[{ required: true, message: '请输入输入价' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
            </Form.Item>
            <Form.Item name="cachePrice" label="缓存命中价（可留空）" style={{ flex: 1 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="留空表示不支持缓存计费" />
            </Form.Item>
          </div>
          <Form.Item
            name="outputPrice"
            label="输出价 / 百万token"
            rules={[{ required: true, message: '请输入输出价' }]}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="note" label="备注（可选）">
            <Input placeholder="例如：高峰时段价格 / 上下文长度 / 渠道折扣" />
          </Form.Item>
        </Form>
        <div style={{ fontSize: 11, color: '#999' }}>
          保存后该条目会以「自定义」身份参与排序与最优比价；同名平台 + 模型会覆盖内置参考价。
        </div>
      </Modal>
    </div>
  )
}

export default APIMonitorModule
