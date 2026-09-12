/**
 * 窗口自适应吸附（对齐辅助线）。
 *
 * 拖动或缩放窗口时，把「正在移动的边/中线」去和「其他窗口的边/中线 + 画布边界」比对，
 * 偏差在阈值内就吸附过去，避免手工拖出 3px 的错位。
 */

export const SNAP_THRESHOLD = 14

/** 防重叠安全间隙：面板之间至少留 2px，避免像素级贴死 */
export const NO_OVERLAP_GAP = 2

export interface SnapRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SnapOutcome {
  /** 吸附后的坐标；未触发吸附时即原值 */
  value: number
  /** 触发吸附的参考线坐标（用于绘制对齐线）；未吸附为 null */
  guide: number | null
}

/** 静态参考锚点：画布两端 + 每个其他窗口的起始边、结束边、中线 */
function anchorsFor(others: SnapRect[], axis: 'x' | 'y', canvasSize: number): number[] {
  const list: number[] = [0, canvasSize]
  for (const o of others) {
    const start = axis === 'x' ? o.x : o.y
    const size = axis === 'x' ? o.width : o.height
    list.push(start, start + size, start + size / 2)
  }
  return list
}

function pickNearest(candidates: number[], target: number, threshold: number) {
  let best: { delta: number; guide: number } | null = null
  for (const anchor of candidates) {
    const delta = anchor - target
    if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
      best = { delta, guide: anchor }
    }
  }
  return best
}

/**
 * 拖动吸附：窗口的「起始边 / 中线 / 结束边」三条线都参与对齐，取偏差最小的一条生效。
 */
export function snapMove(
  pos: number,
  size: number,
  others: SnapRect[],
  axis: 'x' | 'y',
  canvasSize: number,
  threshold: number = SNAP_THRESHOLD
): SnapOutcome {
  const anchors = anchorsFor(others, axis, canvasSize)
  const movingAnchors = [0, size / 2, size]

  let best: { delta: number; guide: number } | null = null
  for (const offset of movingAnchors) {
    const hit = pickNearest(anchors, pos + offset, threshold)
    if (hit && (!best || Math.abs(hit.delta) < Math.abs(best.delta))) best = hit
  }

  return best ? { value: pos + best.delta, guide: best.guide } : { value: pos, guide: null }
}

/**
 * 缩放吸附：只有正在被拖动的那条边参与对齐。
 */
export function snapEdge(
  edge: number,
  others: SnapRect[],
  axis: 'x' | 'y',
  canvasSize: number,
  threshold: number = SNAP_THRESHOLD
): SnapOutcome {
  const anchors = anchorsFor(others, axis, canvasSize)
  const hit = pickNearest(anchors, edge, threshold)
  return hit ? { value: edge + hit.delta, guide: hit.guide } : { value: edge, guide: null }
}
