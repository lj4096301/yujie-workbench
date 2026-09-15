import React from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import HomeBanner from './banner'
import HomeKpiRow from './kpiRow'
import HomeMainArea from './mainArea'
import HomeToolGrid from './toolGrid'
import HomeMoreGrid from './moreGrid'
import './home.css'

/**
 * 宇界工作台首页（全新工作台布局）
 *
 * ① 欢迎横幅（问候 + 时间日期 + 天气 hero + 模块管理）
 * ② KPI 摘要行（项目 / 进行中 / 今日日程 / 知识条目）
 * ③ 主工作区 2:1（看板总览 + 今日待办）
 * ④ 效率工具（天气 2 : 日程 2 : 知识 1 : 书签 1）
 * ⑤ 更多模块宫格（一行 6 个低频入口）
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
        <button type="button" className="hw-empty-btn" onClick={resetHomeLayout}>
          恢复默认布局
        </button>
      </div>
    )
  }

  return (
    <div className="hw">
      <HomeBanner />
      <HomeKpiRow onOpen={onOpen} />
      <HomeMainArea onOpen={onOpen} />
      <HomeToolGrid onOpen={onOpen} />
      <HomeMoreGrid onOpen={onOpen} onClose={onClose} />
    </div>
  )
}

export default HomeWorkbench
