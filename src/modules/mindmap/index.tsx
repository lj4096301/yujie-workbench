import React, { useEffect, useRef, useState } from 'react'
import MindElixir, { type MindElixirData } from 'mind-elixir'
import 'mind-elixir/style.css'
import { zh_CN } from 'mind-elixir/i18n'
import { Modal, message } from 'antd'
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

function MindmapEditor() {
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

    return () => {
      mind.bus.removeListener('operation', onOperation)
      mind.destroy()
      mindRef.current = null
    }
  }, [])

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

  const clearAll = () => {
    const mind = mindRef.current
    if (!mind) return
    Modal.confirm({
      title: '清空思维导图',
      content: '将重置为空白导图，当前内容会丢失。确定继续吗？',
      okText: '清空',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        mind.refresh(MindElixir.new('中心主题'))
        message.success('已重置')
      },
    })
  }

  return (
    <div className="mind-mod">
      <div className="mind-toolbar">
        <div className="mind-toolbar-left">
          <span className="mind-title">🧠 思维导图</span>
        </div>
        <div className="mind-toolbar-right">
          {savedAt && <span className="mind-saved">已自动保存 {savedAt}</span>}
          <button type="button" className="mind-btn" onClick={() => mindRef.current?.undo()} title="撤销">
            ↩ 撤销
          </button>
          <button type="button" className="mind-btn" onClick={() => mindRef.current?.redo()} title="重做">
            ↪ 重做
          </button>
          <button type="button" className="mind-btn" onClick={() => mindRef.current?.scaleFit()} title="适应画布">
            ⤢ 适应
          </button>
          <button type="button" className="mind-btn" onClick={toggleTheme} title="切换明暗主题">
            {dark ? '☀ 亮色' : '🌙 暗色'}
          </button>
          <button type="button" className="mind-btn" onClick={() => void exportPng()} title="导出 PNG 图片">
            🖼 导出 PNG
          </button>
          <button type="button" className="mind-btn" onClick={() => void exportSvg()} title="导出 SVG 矢量图">
            🧾 导出 SVG
          </button>
          <button type="button" className="mind-btn" onClick={() => void exportJson()} title="导出思维导图数据 JSON">
            💾 导出 JSON
          </button>
          <button type="button" className="mind-btn mind-btn-danger" onClick={clearAll} title="清空重置">
            🗑 清空
          </button>
        </div>
      </div>
      <div className="mind-canvas" ref={containerRef} />
    </div>
  )
}

const MindmapModule: React.FC = () => <MindmapEditor />

export default MindmapModule
