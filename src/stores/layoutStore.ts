import { create } from 'zustand'
import { LayoutItem, PanelState } from '@/types'
import { MODULE_META } from '@/modules/registry'

const LAYOUT_STORAGE_KEY = 'mimo-panels'
const LAYOUT_VERSION_KEY = 'mimo-panels-version'

/**
 * 布局数据结构版本。
 * 与本地缓存不一致时直接丢弃旧数据 —— 历史版本里存在跑出屏幕的坐标，
 * 恢复回来会出现「点了侧栏面板却看不见」的现象。
 * v3：新增首页（多窗口画布），默认视图与坐标体系变化，旧数据不再兼容。
 * v4：模块标题去掉内嵌 emoji（图标由 Panel 的 icon 单独渲染，避免重复）。
 * v5：首页迁移到 react-grid-layout（网格坐标 grid），旧像素缓存不再兼容。
 */
export const LAYOUT_VERSION = 5

/** 首页视图的伪模块 id */
export const HOME_ID = 'home'

// ===================== 首页网格常量（RGL） =====================
export const GRID_COLS = 12
export const GRID_ROW_H = 8
/** 首页模块默认占格：半宽 × 18 行（≈ 348px 高），一行两块 */
export const HOME_ITEM_W = 6
export const HOME_ITEM_H = 18

interface LayoutStore {
  // 侧栏
  activeModule: string
  setActiveModule: (id: string) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // 布局
  layouts: LayoutItem[]
  setLayouts: (layouts: LayoutItem[]) => void

  // 面板状态
  panels: PanelState[]
  setPanels: (panels: PanelState[]) => void
  /** 局部更新单个面板（拖拽/缩放高频调用，避免整数组替换） */
  updatePanel: (id: string, patch: Partial<PanelState>) => void
  togglePanel: (id: string) => void
  maximizePanel: (id: string) => void
  restorePanel: (id: string) => void
  refreshPanel: (id: string) => void
  bringToFront: (id: string) => void

  /**
   * 侧栏切换模块：只显示该模块（其他全部隐藏），
   * 并按 bounds 铺满主内容区。
   */
  activateModule: (id: string, bounds: { width: number; height: number }) => void

  /**
   * 进入首页：所有模块可见，按网格平铺到画布上（画布可纵向滚动）。
   * bounds 参数已废弃（网格布局不再依赖像素尺寸），保留仅为调用方兼容。
   */
  activateHome: (bounds?: { width: number; height: number }) => void

  /**
   * 首页里打开某个模块：自动放到第一个不重叠的网格位；已可见则关闭。
   * @returns 操作后该模块是否可见
   */
  togglePanelAt: (id: string, bounds?: { width: number; height: number }) => boolean

  // 搜索
  searchVisible: boolean
  setSearchVisible: (visible: boolean) => void

  // 持久化
  saveLayout: () => void
  /** @returns 是否从本地缓存恢复成功 */
  loadLayout: () => boolean
}

const DEFAULT_LAYOUTS: LayoutItem[] = [
  { i: '1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 6 },
  { i: '2', x: 12, y: 0, w: 12, h: 12, minW: 6, minH: 6 },
  { i: '3', x: 0, y: 12, w: 12, h: 12, minW: 6, minH: 6 },
  { i: '4', x: 12, y: 12, w: 12, h: 12, minW: 6, minH: 6 },
]

/** 模块定义：单一来源见 @/modules/registry（title/icon/顺序在 registry 改一处即可） */
const MODULE_DEFS: Array<{ id: string; title: string }> = MODULE_META.map(({ id, title }) => ({ id, title }))

const DEFAULT_WIDTH = 420
const DEFAULT_HEIGHT = 560

/** 首次启动：默认进首页，所有模块可见（挂载后由 activateHome 排布网格） */
const DEFAULT_PANELS: PanelState[] = MODULE_DEFS.map(({ id, title }, index) => ({
  id,
  moduleId: id,
  title,
  isMaximized: false,
  isFloating: false,
  isVisible: true,
  zIndex: index + 1,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  x: 0,
  y: 0,
  grid: {
    x: (index % 2) * HOME_ITEM_W,
    y: Math.floor(index / 2) * HOME_ITEM_H,
    w: HOME_ITEM_W,
    h: HOME_ITEM_H,
  },
}))

/** 模块的固定顺序（网格排布按此顺序，保证多次排布结果一致） */
export const MODULE_ORDER: string[] = MODULE_DEFS.map((m) => m.id)

/**
 * 在现有网格中找第一个放得下 w×h 的空位（按行扫描）。
 * 避免新打开的模块与手动摆放过的窗口重叠（RGL 的 allowOverlap 只约束拖动，不约束初始放置）。
 */
function findFreeGridSlot(panels: PanelState[], w: number, h: number): { x: number; y: number } {
  const placed = panels.filter((p) => p.isVisible && !p.isMaximized && p.grid)
  for (let row = 0; row < 60; row++) {
    for (let col = 0; col + w <= GRID_COLS; col += w) {
      const x = col
      const y = row * h
      const overlap = placed.some(
        (p) =>
          x < p.grid!.x + p.grid!.w &&
          x + w > p.grid!.x &&
          y < p.grid!.y + p.grid!.h &&
          y + h > p.grid!.y
      )
      if (!overlap) return { x, y }
    }
  }
  return { x: 0, y: 60 * h }
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  activeModule: HOME_ID,
  setActiveModule: (id) => set({ activeModule: id }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  layouts: DEFAULT_LAYOUTS,
  setLayouts: (layouts) => set({ layouts }),

  panels: DEFAULT_PANELS,
  setPanels: (panels) => set({ panels }),

  updatePanel: (id, patch) => set((s) => ({
    panels: s.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  })),

  togglePanel: (id) => set((s) => ({
    panels: s.panels.map((p) => (p.id === id ? { ...p, isVisible: !p.isVisible } : p)),
  })),

  maximizePanel: (id) => set((s) => ({
    panels: s.panels.map((p) => (p.id === id ? { ...p, isMaximized: true } : p)),
  })),

  restorePanel: (id) => set((s) => ({
    panels: s.panels.map((p) => (p.id === id ? { ...p, isMaximized: false } : p)),
  })),

  refreshPanel: (id) => set((s) => ({
    panels: s.panels.map((p) => (p.id === id ? { ...p, refreshKey: (p.refreshKey || 0) + 1 } : p)),
  })),

  bringToFront: (id) => set((s) => {
    const maxZ = Math.max(0, ...s.panels.map((p) => p.zIndex))
    const target = s.panels.find((p) => p.id === id)
    // 已经在最上层就不动，避免无意义的数组重建
    if (target && target.zIndex === maxZ) return s
    return {
      panels: s.panels.map((p) => (p.id === id ? { ...p, zIndex: maxZ + 1 } : p)),
    }
  }),

  activateModule: (id, bounds) => set((s) => {
    const maxZ = Math.max(0, ...s.panels.map((p) => p.zIndex))
    const width = Math.max(240, Math.round(bounds.width))
    const height = Math.max(180, Math.round(bounds.height))

    return {
      activeModule: id,
      panels: s.panels.map((p) =>
        p.id === id
          ? {
              ...p,
              isVisible: true,
              isFloating: false,
              isMaximized: false,
              zIndex: maxZ + 1,
              x: 0,
              y: 0,
              width,
              height,
            }
          : { ...p, isVisible: false, isMaximized: false }
      ),
    }
  }),

  activateHome: () => set((s) => {
    // 按固定模块顺序重排网格：一行两块，保证「重排」结果稳定
    return {
      activeModule: HOME_ID,
      panels: s.panels.map((p) => {
        const index = MODULE_ORDER.indexOf(p.id)
        return {
          ...p,
          isVisible: true,
          isFloating: false,
          isMaximized: false,
          zIndex: index + 1,
          grid: {
            x: (index % 2) * HOME_ITEM_W,
            y: Math.floor(index / 2) * HOME_ITEM_H,
            w: HOME_ITEM_W,
            h: HOME_ITEM_H,
          },
        }
      }),
    }
  }),

  togglePanelAt: (id) => {
    const state = get()
    const panel = state.panels.find((p) => p.id === id)
    if (!panel) return false

    if (panel.isVisible) {
      state.updatePanel(id, { isVisible: false })
      state.saveLayout()
      return false
    }

    // 找第一个不与现有窗口重叠的网格位
    const slot = findFreeGridSlot(state.panels, HOME_ITEM_W, HOME_ITEM_H)
    state.updatePanel(id, {
      isVisible: true,
      isMaximized: false,
      grid: { x: slot.x, y: slot.y, w: HOME_ITEM_W, h: HOME_ITEM_H },
      zIndex: Math.max(0, ...state.panels.map((p) => p.zIndex)) + 1,
    })
    state.saveLayout()
    return true
  },

  searchVisible: false,
  setSearchVisible: (visible) => set({ searchVisible: visible }),

  saveLayout: () => {
    try {
      const { panels, layouts, activeModule } = get()
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(panels))
      localStorage.setItem('mimo-layouts', JSON.stringify(layouts))
      localStorage.setItem('mimo-active-module', activeModule)
      localStorage.setItem(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION))
    } catch {
      /* localStorage 不可用时静默降级 */
    }
  },

  loadLayout: () => {
    try {
      if (localStorage.getItem(LAYOUT_VERSION_KEY) !== String(LAYOUT_VERSION)) {
        localStorage.removeItem(LAYOUT_STORAGE_KEY)
        localStorage.removeItem('mimo-layouts')
        localStorage.removeItem('mimo-active-module')
        localStorage.setItem(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION))
        return false
      }

      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (!raw) return false

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) return false

      // 与默认面板合并：保证新增模块也能出现，且字段完整。
      // title 强制以最新定义为准 —— 历史缓存里存过「📚 知识库」这类内嵌 emoji 的标题，
      // 恢复后和 Panel 的 icon 属性一起渲染就成了「图标重复」。
      const merged: PanelState[] = DEFAULT_PANELS.map((def) => {
        const saved = parsed.find((p: PanelState) => p?.id === def.id)
        return saved ? { ...def, ...saved, title: def.title } : def
      })

      set({ panels: merged })

      const active = localStorage.getItem('mimo-active-module')
      if (active && (active === HOME_ID || merged.some((p) => p.id === active))) {
        set({ activeModule: active })
      }

      const layouts = localStorage.getItem('mimo-layouts')
      if (layouts) set({ layouts: JSON.parse(layouts) })

      return true
    } catch {
      localStorage.removeItem(LAYOUT_STORAGE_KEY)
      return false
    }
  },
}))
