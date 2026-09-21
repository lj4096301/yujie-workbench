import React from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { Button } from '@/components/ui/button'
import HomeKpiRow from './kpiRow'
import HomeMainArea from './mainArea'
import HomeMoreGrid from './moreGrid'
import { WeatherTool } from './toolGrid'
import './home.css'

/**
 * 宇界工作台首页（全新工作台布局）
 *
 * ① KPI 摘要行（项目 / 进行中 / 待办 / 今日日程）—— 关注的数据最前
 * ② 主工作区（看板总览 / 今日待办 / 日程 一行三列）—— 视觉重心
 * ③ 日期天气 + 更多功能 一行（日期与天气合一卡片，低频图标顺序排列，点击跳转）
 */
const HomeWorkbench: React.FC<{
  onOpen: (moduleId: string) => void
  onClose: (moduleId: string) => void
}> = ({ onOpen, onClose }) => {
  const panels = useLayoutStore((s) => s.panels)
  const resetHomeLayout = useLayoutStore((s) => s.resetHomeLayout)

  const visibleCount = panels.filter((p) => p.isVisible && !p.isFloating).length

  if (visibleCount === 0) {
    return (
      <div className="hw-card hw-empty">
        <div className="hw-empty-icon">🗂️</div>
        <div className="hw-empty-title">所有模块都已关闭</div>
        <div className="hw-empty-desc">用右上角「模块管理」打开，或一键恢复默认布局</div>
        <Button type="button" className="hw-empty-btn" onClick={resetHomeLayout}>
          恢复默认布局
        </Button>
      </div>
    )
  }

  return (
    <div className="hw">
      <HomeMainArea onOpen={onOpen} />
      <div className="hw-tools">
        <HomeKpiRow onOpen={onOpen} />
        <WeatherTool onOpen={onOpen} />
        <HomeMoreGrid onOpen={onOpen} onClose={onClose} />
      </div>
    </div>
  )
}

export default HomeWorkbench
