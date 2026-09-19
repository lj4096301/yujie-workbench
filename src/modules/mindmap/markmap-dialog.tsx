import React, { useEffect, useRef, useState } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import { message } from 'antd'
import { Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const DEMO_MD = [
  '# 宇界工作台',
  '## 首页工作台',
  '### 欢迎横幅',
  '### KPI 统计',
  '### 更多模块',
  '## 核心模块',
  '### 项目看板',
  '### 待办任务',
  '### 操作日志',
  '## 工具模块',
  '### 流程图',
  '### 思维导图',
  '### 知识库',
].join('\n')

export interface MarkdownMindmapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Markdown → 脑图（markmap 内核，自动生成，仅查看 / 导出，不写入编辑区） */
export function MarkdownMindmapDialog({ open, onOpenChange }: MarkdownMindmapDialogProps) {
  const [md, setMd] = useState(DEMO_MD)
  const svgRef = useRef<SVGSVGElement>(null)
  const mmRef = useRef<Markmap | null>(null)

  useEffect(() => {
    if (!open) return
    const el = svgRef.current
    if (!el) return
    el.innerHTML = ''
    let mm: Markmap | null = null
    try {
      const transformer = new Transformer()
      const { root } = transformer.transform(md)
      mm = Markmap.create(el, { autoFit: true, duration: 300 }, root)
      mmRef.current = mm
    } catch (err) {
      message.error('Markdown 解析失败：' + String(err))
    }
    return () => {
      mm?.destroy()
      mmRef.current = null
    }
  }, [open, md])

  const zoomIn = () => mmRef.current?.rescale(1.2)
  const zoomOut = () => mmRef.current?.rescale(0.8)
  const fit = () => mmRef.current?.fit()

  const saveFile = async (payload: {
    defaultName: string
    content: string
    encoding?: 'utf8' | 'base64'
  }) => {
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
    link.href =
      payload.encoding === 'base64'
        ? `data:application/octet-stream;base64,${payload.content}`
        : `data:text/plain;charset=utf-8,${encodeURIComponent(payload.content)}`
    link.download = payload.defaultName
    link.click()
    message.success('已下载文件')
    return true
  }

  const svgToPngDataUrl = async (svgEl: SVGSVGElement): Promise<string> => {
    const svgData = new XMLSerializer().serializeToString(svgEl)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('SVG 图片加载失败'))
        img.src = url
      })
      const rect = svgEl.getBoundingClientRect()
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(rect.width))
      canvas.height = Math.max(1, Math.round(rect.height))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建画布')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/png')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const exportPng = async () => {
    const el = svgRef.current
    if (!el) return
    try {
      const dataUrl = await svgToPngDataUrl(el)
      const base64 = dataUrl.split(',')[1]
      await saveFile({ defaultName: '脑图.png', content: base64, encoding: 'base64' })
    } catch (err) {
      message.error('导出失败：' + String(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px]">
        <DialogHeader>
          <DialogTitle>Markdown 自动生成脑图</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4" style={{ height: 440 }}>
          <div className="flex w-[300px] shrink-0 flex-col gap-2">
            <Label htmlFor="mmd-input">Markdown 源文本</Label>
            <Textarea
              id="mmd-input"
              className="min-h-0 flex-1 font-mono text-xs"
              value={md}
              onChange={(e) => setMd(e.target.value)}
              placeholder={'# 标题\n## 二级标题\n### 三级标题'}
            />
            <div className="text-[11px] leading-4 text-[#86909C]">
              使用 Markdown 标题层级（# / ## / ###…）自动生成脑图，支持列表、链接与强调语法。
            </div>
          </div>
          <div className="relative min-w-0 flex-1 rounded-lg border border-[#E5E6EB] bg-white">
            <svg ref={svgRef} className="mmd-svg" />
            <div className="absolute right-2 top-2 flex gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={zoomIn} title="放大">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={zoomOut} title="缩小">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={fit} title="适应画布">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setMd(DEMO_MD)}>
            恢复示例
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportPng()}>
            <Download className="h-4 w-4" /> 导出 PNG
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
