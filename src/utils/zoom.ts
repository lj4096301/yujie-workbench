import { useUIStore } from '@/stores/uiStore'

/**
 * 当前界面缩放倍数（安全读取，异常时回退 1）。
 *
 * 为什么拖拽必须用到它：
 *   - 鼠标事件里的 clientX/clientY 是「视口像素」（已被 zoom 放大过）
 *   - 面板的 x/y/width/height 是「画布 CSS 像素」（zoom 空间内的坐标）
 * 缩放不为 1 时两者相差 zoom 倍，直接把鼠标增量叠到面板坐标上，
 * 就会出现「放大后拖动跟手偏移、缩放尺寸飘」的问题。
 */
export function getZoomFactor(): number {
  const zoom = useUIStore.getState().zoom
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

/** 把视口像素增量换算成画布 CSS 像素增量 */
export function toCanvasDelta(viewportDelta: number): number {
  return viewportDelta / getZoomFactor()
}
