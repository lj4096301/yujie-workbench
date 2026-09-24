import type React from 'react'

/**
 * 卡片键盘支持（设计规范 §6：所有可交互元素必须有 hover + focus-visible，
 * 桌面以键盘为主）。可点击卡片统一 tabIndex={0} + role="button" + 本处理器，
 * Enter / Space 触发 onClick，与鼠标行为完全一致。
 */
export function onCardKey(onClick: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }
}

/**
 * 卡片内嵌套控件（勾选框 / 移除按钮）的键盘支持：
 * Enter / Space 触发动作并 stopPropagation，避免冒泡触发外层卡片跳转。
 */
export function onInnerKey(onAction: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      onAction()
    }
  }
}
