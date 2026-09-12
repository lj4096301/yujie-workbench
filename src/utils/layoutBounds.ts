/**
 * 主内容区（.main-container）的实际可用尺寸。
 *
 * 面板坐标是相对 .main-container 的绝对定位，所以「铺满」时必须以容器实测尺寸为准，
 * 不能用 window.innerWidth 估算 —— 侧栏宽度、外层 padding、滚动条都会造成偏差。
 */
export function getMainAreaBounds(): { width: number; height: number } {
  const container = document.querySelector('.main-container') as HTMLElement | null
  if (container && container.clientWidth > 0 && container.clientHeight > 0) {
    return { width: container.clientWidth, height: container.clientHeight }
  }

  // 容器尚未挂载（首次渲染前）时的回退估算
  const sidebar = document.querySelector('.sidebar') as HTMLElement | null
  const sidebarWidth = sidebar?.clientWidth || 200
  return {
    width: Math.max(320, window.innerWidth - sidebarWidth - 24),
    height: Math.max(240, window.innerHeight - 24),
  }
}
