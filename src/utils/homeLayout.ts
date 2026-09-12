/**
 * 首页（模块总览）的网格排布计算。
 *
 * 首页把所有模块以「窗口」形式平铺在画布上，每个窗口都可以自由拖拽 / 拖边界改大小 / 关闭。
 * 这里只负责给出初始的网格坐标（相对 .panels-canvas），用户后续的手动摆放不会被覆盖。
 */

export const HOME_GAP = 12
/** 单列最小可用宽度，低于此值就减一列 */
export const HOME_CARD_MIN_W = 320
/** 首页卡片的固定高度（画布可纵向滚动，所以不必压缩到一屏内） */
export const HOME_CARD_H = 360
export const HOME_MAX_COLS = 4

/** 根据容器宽度决定列数（1~4 列） */
export function homeColumns(width: number): number {
  const usable = Math.max(1, width)
  const cols = Math.floor((usable + HOME_GAP) / (HOME_CARD_MIN_W + HOME_GAP))
  return Math.min(HOME_MAX_COLS, Math.max(1, cols))
}

export interface HomeCell {
  x: number
  y: number
  width: number
  height: number
  cols: number
  rows: number
}

/** 第 index 个模块在网格中的位置（index 按模块固定顺序，保证多次排布结果一致） */
export function homeGridCell(index: number, width: number, total: number): HomeCell {
  const cols = homeColumns(width)
  const rows = Math.max(1, Math.ceil(Math.max(1, total) / cols))
  const cellW = Math.max(HOME_CARD_MIN_W, Math.floor((Math.max(1, width) - HOME_GAP * (cols - 1)) / cols))
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    x: col * (cellW + HOME_GAP),
    y: row * (HOME_CARD_H + HOME_GAP),
    width: cellW,
    height: HOME_CARD_H,
    cols,
    rows,
  }
}

/** 画布高度：至少铺满可视区，不够则纵向滚动 */
export function homeCanvasHeight(total: number, width: number, viewportHeight: number): number {
  const cols = homeColumns(width)
  const rows = Math.max(1, Math.ceil(Math.max(1, total) / cols))
  const needed = rows * HOME_CARD_H + (rows - 1) * HOME_GAP
  return Math.max(Math.round(viewportHeight), needed)
}
