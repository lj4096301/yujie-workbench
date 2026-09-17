import React from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { Button } from '@/components/ui/button'
import HomeBanner from './banner'
import HomeKpiRow from './kpiRow'
import HomeMainArea from './mainArea'
import HomeToolGrid from './toolGrid'
import HomeMoreGrid from './moreGrid'
import './home.css'

/**
 * 宇界工作台首页（全新工作台布局）
 *
 * ① 欢迎横幅（问候 + 时间日期 + 简天气）
 * ② KPI 摘要行（项目 / 进行中 / 待办 / 今日日程）—— 关注的数据最前
 * ③ 主工作区 2:1（看板总览 + 今日待办）—— 视觉重心（脚重）
 * ④ 效率工具（天气 + 日程，1:1）
 * ⑤ 更多功能卡（低频图标网格：知识/书签/流程图/思维导图等，点击跳转）
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
      <HomeBanner />
      <HomeKpiRow onOpen={onOpen} />
      <HomeMainArea onOpen={onOpen} />
      <HomeToolGrid onOpen={onOpen} />
      <HomeMoreGrid onOpen={onOpen} onClose={onClose} />
    </div>
  )
}

export default HomeWorkbench
