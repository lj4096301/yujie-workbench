import { Router } from 'express'
import fs from 'fs'
import { dataFile } from '../paths'

export interface LogEntry {
  id: string
  action: string
  title: string
  content?: string
  projectName?: string
  priority?: string
  at: number
  module: string
  moduleTitle: string
  actionLabel: string
}

/**
 * 重点操作日志：聚合各模块写入的操作记录。
 * 目前来源为项目看板的完成/删除记录，后续模块可按同结构上报。
 */
export function createLogsRouter() {
  const router = Router()

  router.get('/', (_req, res) => {
    try {
      const records: LogEntry[] = []

      // 来源一：项目看板（完成 / 删除归档）
      try {
        const file = dataFile('kanban.json')
        if (fs.existsSync(file)) {
          const kb = JSON.parse(fs.readFileSync(file, 'utf-8'))
          if (kb && Array.isArray(kb.records)) {
            for (const r of kb.records) {
              records.push({
                id: String(r?.id ?? ''),
                action: r?.action === 'deleted' ? 'deleted' : 'done',
                title: String(r?.title ?? ''),
                content: r?.content ? String(r.content) : undefined,
                projectName: r?.projectName ? String(r.projectName) : undefined,
                priority: r?.priority ? String(r.priority) : undefined,
                at: Number(r?.at ?? Date.now()),
                module: 'kanban',
                moduleTitle: '项目看板',
                actionLabel: r?.action === 'deleted' ? '卡片删除' : '项目完成',
              })
            }
          }
        }
      } catch {
        /* 看板数据缺失/损坏时跳过 */
      }

      records.sort((a, b) => b.at - a.at)
      res.json({ records })
    } catch {
      res.status(500).json({ error: '读取日志失败' })
    }
  })

  return router
}
