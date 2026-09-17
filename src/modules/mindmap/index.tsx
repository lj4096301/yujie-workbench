import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MindElixir, { type MindElixirData } from 'mind-elixir'
import 'mind-elixir/style.css'
import { zh_CN } from 'mind-elixir/i18n'
import { message } from 'antd'
import { Undo2, Redo2, Maximize2, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import './mindmap.css'

const STORAGE_KEY = 'yujie-mindmap'

/** 首次进入的示例思维导图 */
function demoData(): MindElixirData {
  return {
    nodeData: {
      id: 'root-1',
      topic: '宇界工作台',
      children: [
        {
          id: 'n1',
          topic: '首页工作台',
          children: [
            { id: 'n1a', topic: '欢迎横幅', children: [] },
            { id: 'n1b', topic: 'KPI 统计', children: [] },
            { id: 'n1c', topic: '更多模块', children: [] },
          ],
        },
        {
          id: 'n2',
          topic: '核心模块',
          children: [
            { id: 'n2a', topic: '项目看板', children: [] },
            { id: 'n2b', topic: '待办任务', children: [] },
          ],
        },
        {
          id: 'n3',
          topic: '工具模块',
          children: [
            { id: 'n3a', topic: '流程图', children: [] },
            { id: 'n3b', topic: '思维导图', children: [] },
            { id: 'n3c', topic: '知识库', children: [] },
          ],
        },
      ],
    },
    arrows: [],
    summaries: [],
  }
}

function loadData(): MindElixirData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      if (d?.nodeData?.topic) return d as MindElixirData
    }
  } catch {
    // 忽略损坏缓存
  }
  return demoData()
}

function MindmapEditor({ panelId }: { panelId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mindRef = useRef<MindElixir | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const mind = new MindElixir({
      el,
      direction: MindElixir.SIDE,
      editable: true,
      contextMenu: { locale: zh_CN },
      toolBar: false,
      keypress: true,
      allowUndo: true,
      theme: MindElixir.THEME,
    })
    mindRef.current = mind
    mind.init(loadData())

    const onOperation = () => {
      try {
        localStorage.setItem(STORAGE_KEY, mind.getDataString())
        setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      } catch {
        // 存储失败静默
      }
    }
    mind.bus.addListener('operation', onOperation)

    // 右键菜单定位校正：内置菜单按窗口高度判断，容器内存在 transform 祖先时
    // fixed 会退化为 absolute 导致菜单位置偏下被裁剪，这里按容器可视区重算位置。
    const fixContextMenu = () => {
      requestAnimationFrame(() => {
        const menu = el.querySelector<HTMLElement>('.menu-list')
        if (!menu) return
        const mRect = menu.getBoundingClientRect()
        const cRect = el.getBoundingClientRect()
        if (mRect.height === 0 || cRect.height === 0) return
        const pad = 6
        const overBottom = mRect.bottom - cRect.bottom + pad
        const overRight = mRect.right - cRect.right + pad
        const overTop = cRect.top + pad - mRect.top
        const overLeft = cRect.left + pad - mRect.left
        if (overBottom <= 0 && overRight <= 0 && overTop <= 0 && overLeft <= 0) return

        const targetTop = Math.max(cRect.top + pad, mRect.top - Math.max(overBottom, 0) + Math.max(overTop, 0))
        const targetLeft = Math.max(cRect.left + pad, mRect.left - Math.max(overRight, 0) + Math.max(overLeft, 0))
        // offsetParent 为实际定位祖先（transform 祖先也算），换算成相对坐标
        const parent = menu.offsetParent as HTMLElement | null
        let baseTop = 0
        let baseLeft = 0
        if (parent && parent !== document.body) {
          const pRect = parent.getBoundingClientRect()
          baseTop = pRect.top
          baseLeft = pRect.left
        }
        menu.style.top = `${targetTop - baseTop}px`
        menu.style.bottom = ''
        menu.style.left = `${targetLeft - baseLeft}px`
        menu.style.right = ''
      })
    }
    mind.bus.addListener('showContextMenu', fixContextMenu)

    return () => {
      mind.bus.removeListener('operation', onOperation)
      mind.bus.removeListener('showContextMenu', fixContextMenu)
      mind.destroy()
      mindRef.current = null
    }
  }, [])

  // 标题栏操作按钮挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const saveFile = async (payload: { defaultName: string; content: string; encoding?: 'utf8' | 'base64' }) => {
    const api = window.electronAPI
    if (api?.saveFile) {
      const res = await api.saveFile(payload)
      if (res?.canceled) return false
      if (res?.path) {
        message.success(`已保存到 ${res.path}`)
        return true
      }
    }
    const link = document.createElement('a')
    link.href = payload.encoding === 'base64'
      ? `data:application/octet-stream;base64,${payload.content}`
      : `data:application/json;charset=utf-8,${encodeURIComponent(payload.content)}`
    link.download = payload.defaultName
    link.click()
    message.success('已下载文件')
    return true
  }

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new Error('读取文件失败'))
      r.readAsDataURL(blob)
    })

  const exportPng = async () => {
    const mind = mindRef.current
    if (!mind) return
    try {
      const blob = await mind.exportPng()
      if (!blob) {
        message.error('导出失败：无法生成图片')
        return
      }
      const dataUrl = await blobToDataUrl(blob)
      const base64 = dataUrl.split(',')[1]
      await saveFile({ defaultName: '思维导图.png', content: base64, encoding: 'base64' })
    } catch (err) {
      message.error(`导出失败：${String(err)}`)
    }
  }

  const exportSvg = async () => {
    const mind = mindRef.current
    if (!mind) return
    try {
      const blob = await mind.exportSvg()
      const text = await blob.text()
      await saveFile({ defaultName: '思维导图.svg', content: text, encoding: 'utf8' })
    } catch (err) {
      message.error(`导出失败：${String(err)}`)
    }
  }

  const exportJson = async () => {
    const mind = mindRef.current
    if (!mind) return
    await saveFile({ defaultName: '思维导图.json', content: mind.getDataString(), encoding: 'utf8' })
  }

  const toggleTheme = () => {
    const mind = mindRef.current
    if (!mind) return
    const next = !dark
    mind.changeTheme(next ? MindElixir.DARK_THEME : MindElixir.THEME, true)
    setDark(next)
  }

  const [clearOpen, setClearOpen] = useState(false)
  const clearAll = () => {
    const mind = mindRef.current
    if (!mind) return
    mind.refresh(MindElixir.new('中心主题'))
    message.success('已重置')
  }

  const headerActions = actionsHost
    ? createPortal(
        <div className="mind-header-actions">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mindRef.current?.undo()} title="撤销">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mindRef.current?.redo()} title="重做">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mindRef.current?.scaleFit()} title="适应画布">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={toggleTheme} title="切换明暗主题">
            {dark ? '☀ 亮色' : '🌙 暗色'}
          </Button>
          <Select
            value=""
            onValueChange={(key) => {
              if (key === 'png') void exportPng()
              else if (key === 'svg') void exportSvg()
              else void exportJson()
            }}
          >
            <SelectTrigger className="h-8 w-[92px] text-xs">
              <Download className="h-3.5 w-3.5" /> 导出
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png" className="text-xs">导出 PNG</SelectItem>
              <SelectItem value="svg" className="text-xs">导出 SVG</SelectItem>
              <SelectItem value="json" className="text-xs">导出 JSON</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="text-[#F53F3F]" onClick={() => setClearOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" /> 清空
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div className="mind-mod">
      <div className="mind-canvas" ref={containerRef}>
        {savedAt && <span className="mind-saved-float">已自动保存 {savedAt}</span>}
      </div>
      {headerActions}

      <ConfirmDialog
        open={clearOpen}
        title="清空思维导图"
        content="将重置为空白导图，当前内容会丢失。确定继续吗？"
        danger
        okText="清空"
        onOk={clearAll}
        onOpenChange={(o) => { if (!o) setClearOpen(false) }}
      />
    </div>
  )
}

const MindmapModule: React.FC<{ panelId?: string }> = ({ panelId }) => (
  <MindmapEditor panelId={panelId} />
)

export default MindmapModule
