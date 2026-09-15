import { create } from 'zustand'
import { THEMES, DEFAULT_THEME_ID, THEME_STORAGE_KEY, getTheme } from '@/themes'

/**
 * 界面缩放（缩放整个界面：字体、图标、间距、antd 组件一起等比放大）。
 *
 * 为什么用缩放而不是单独改字号：全项目字号是硬编码 px（11~44px 混用），
 * 单改某一处字号会出现「字大了但行高/图标没跟上」的挤压感。
 * 等比缩放等于把整套视觉一起放大，观感最一致。
 */
const ZOOM_STORAGE_KEY = 'mimo-ui-zoom'

/**
 * 缩放档位。用离散档位而不是连续滑块：
 * 一是每档都便于记忆，二是避免非整数倍缩放让 antd 边框出现半像素毛边。
 */
export const ZOOM_STEPS: number[] = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6]
export const ZOOM_MIN = ZOOM_STEPS[0]
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1]

const clampZoom = (value: number) => Math.min(Math.max(value, ZOOM_MIN), ZOOM_MAX)

function readStoredTheme(): string {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw && THEMES.some((t) => t.id === raw)) return raw
  } catch {
    /* */
  }
  return DEFAULT_THEME_ID
}

/** 将主题 CSS 变量注入 document.documentElement */
function applyThemeCss(themeId: string) {
  const theme = getTheme(themeId)
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.colors)) {
    root.style.setProperty(k, v)
  }
}

function readStoredZoom(): number {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
    if (!raw) return 1
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? clampZoom(value) : 1
  } catch {
    return 1
  }
}

/** 找到最接近当前缩放值的档位下标（兼容历史遗留的非档位值） */
function nearestStepIndex(zoom: number): number {
  let best = 0
  let bestDiff = Infinity
  ZOOM_STEPS.forEach((step, index) => {
    const diff = Math.abs(step - zoom)
    if (diff < bestDiff) {
      bestDiff = diff
      best = index
    }
  })
  return best
}

interface UIStore {
  /** 当前缩放倍数，1 = 100% */
  zoom: number
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  /** 当前主题 id */
  themeId: string
  /** 切换主题 */
  setTheme: (id: string) => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  zoom: readStoredZoom(),
  themeId: readStoredTheme(),

  setTheme: (id) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id)
    } catch {
      /* */
    }
    applyThemeCss(id)
    set({ themeId: id })
  },

  setZoom: (zoom) => {
    const next = clampZoom(Number.isFinite(zoom) ? zoom : 1)
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(next))
    } catch {
      /* localStorage 不可用时静默降级 */
    }
    set({ zoom: next })
  },

  zoomIn: () => {
    const index = nearestStepIndex(get().zoom)
    get().setZoom(ZOOM_STEPS[Math.min(index + 1, ZOOM_STEPS.length - 1)])
  },

  zoomOut: () => {
    const index = nearestStepIndex(get().zoom)
    get().setZoom(ZOOM_STEPS[Math.max(index - 1, 0)])
  },

  resetZoom: () => get().setZoom(1),
}))

// 初始化时注入主题 CSS（store 创建时页面可能还未挂载，延迟到 DOM ready）
if (typeof document !== 'undefined') {
  const stored = readStoredTheme()
  applyThemeCss(stored)
  // 同步 store
  useUIStore.setState({ themeId: stored })
}
