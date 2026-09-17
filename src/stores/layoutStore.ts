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
export const LAYOUT_VERSION = 9

/** 首页视图的伪模块 id */
export const HOME_ID = 'home'

// ===================== 首页网格常量（RGL） =====================
export const GRID_COLS = 24
export const GRID_ROW_H = 8
/** 首页模块默认占格：半宽 × 18 行（≈ 348px 高），一行两块 */
export const HOME_ITEM_W = 12
export const HOME_ITEM_H = 18
/** 首页分区标题占格高度（static grid item，不可拖拽） */
export const SECTION_HEAD_H = 3
/** 首页分区标题（static 元素，占满整行） */
export const SECTION_HEADS: Array<{ id: string; title: string; y: number }> = [
  { id: 'sec-project', title: '🎯 我的项目', y: 0 },
  { id: 'sec-tools', title: '🧰 效率工具', y: 28 },
  { id: 'sec-more', title: '📦 更多模块', y: 52 },
]
/** 低频模块：默认不上首页，点「更多模块」展开 */
export const EXTRA_MODULE_IDS = ['novel', 'epic', 'news', 'tv', 'api-monitor', 'clipboard', 'flowchart', 'mindmap', 'logs']

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
  isLoggedIn: boolean
  setLoggedIn: (value: boolean) => void
  searchVisible: boolean
  setSearchVisible: (visible: boolean) => void

  /** 展开/收起「更多模块」低频区 */
  toggleExtraModules: () => void
  /** 恢复默认首页布局（精选模块 + 分区） */
  resetHomeLayout: () => void

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

/** 各模块的初始网格排布（分区化：精选模块默认可见，低频模块默认隐藏） */
/* 固定尺寸卡片：每个模块按内容形态设定默认占格（宽×高，ROW_H=8px） */
const DEFAULT_GRIDS: Record<string, { x: number; y: number; w: number; h: number }> = {
  /* 我的项目：看板大卡 + 待办清单 */
  kanban: { x: 0, y: 3, w: 16, h: 22 },
  tasks: { x: 16, y: 3, w: 8, h: 22 },
  /* 效率工具：一行四卡（天气/日程/知识/书签） */
  weather: { x: 0, y: 31, w: 6, h: 18 },
  calendar: { x: 6, y: 31, w: 6, h: 18 },
  knowledge: { x: 12, y: 31, w: 6, h: 18 },
  bookmarks: { x: 18, y: 31, w: 6, h: 18 },
  /* 更多模块：低频入口卡，一行三个 */
  novel: { x: 0, y: 55, w: 8, h: 14 },
  epic: { x: 8, y: 55, w: 8, h: 14 },
  news: { x: 16, y: 55, w: 8, h: 14 },
  tv: { x: 0, y: 72, w: 8, h: 14 },
  'api-monitor': { x: 8, y: 72, w: 8, h: 14 },
  clipboard: { x: 16, y: 72, w: 8, h: 14 },
}

/** 精选模块：默认在首页展示 */
const HOME_PINNED = new Set(['kanban', 'tasks', 'weather', 'calendar', 'bookmarks', 'knowledge'])

/** 首次启动：默认进首页，精选模块可见，低频模块从「更多模块」展开 */
const DEFAULT_PANELS: PanelState[] = MODULE_DEFS.map(({ id, title }, index) => {
  const g = DEFAULT_GRIDS[id] ?? {
    x: (index % 2) * HOME_ITEM_W,
    y: Math.floor(index / 2) * HOME_ITEM_H,
    w: HOME_ITEM_W,
    h: HOME_ITEM_H,
  }
  return {
    id,
    moduleId: id,
    title,
    isMaximized: false,
    isFloating: false,
    isVisible: HOME_PINNED.has(id),
    zIndex: index + 1,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    x: 0,
    y: 0,
    grid: g,
  }
})

/** 模块的固定顺序（网格排布按此顺序，保证多次排布结果一致） */
export const MODULE_ORDER: string[] = MODULE_DEFS.map((m) => m.id)

/**
 * 在现有网格中找第一个放得下 w×h 的空位（按行扫描）。
 * 避免新打开的模块与手动摆放过的窗口重叠（RGL 的 allowOverlap 只约束拖动，不约束初始放置）。
 */
function findFreeGridSlot(panels: PanelState[], w: number, h: number): { x: number; y: number } {
  const placed = panels.filter((p) => p.isVisible && !p.isMaximized && p.grid)
  const blockers: Array<{ x: number; y: number; w: number; h: number }> = [
    ...placed.map((p) => p.grid!),
    ...SECTION_HEADS.map((s) => ({ x: 0, y: s.y, w: GRID_COLS, h: SECTION_HEAD_H })),
  ]
  for (let row = 0; row < 120; row++) {
    for (let col = 0; col + w <= GRID_COLS; col += w) {
      const x = col
      const y = row * h
      const overlap = blockers.some(
        (b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y
      )
      if (!overlap) return { x, y }
    }
  }
  return { x: 0, y: 120 * h }
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

  /** 进入首页：只切换视图，保留用户当前的首页模块集合与位置 */
  activateHome: () => set({ activeModule: HOME_ID }),

  togglePanelAt: (id) => {
    const state = get()
    const panel = state.panels.find((p) => p.id === id)
    if (!panel) return false

    // 首页为 CSS Grid 固定布局，打开/关闭仅切换可见性，位置自动排布
    state.updatePanel(id, {
      isVisible: !panel.isVisible,
      isMaximized: false,
    })
    state.saveLayout()
    return !panel.isVisible
  },

  /** 展开/收起「更多模块」低频区 */
  toggleExtraModules: () => {
    const s = get()
    const anyOn = s.panels.some((p) => EXTRA_MODULE_IDS.includes(p.id) && p.isVisible)
    set({
      panels: s.panels.map((p) => {
        if (!EXTRA_MODULE_IDS.includes(p.id)) return p
        if (anyOn) return { ...p, isVisible: false, isMaximized: false }
        return { ...p, isVisible: true, isMaximized: false }
      }),
    })
    get().saveLayout()
  },

  /** 恢复默认首页布局（精选模块 + 分区） */
  resetHomeLayout: () => {
    set({
      activeModule: HOME_ID,
      panels: DEFAULT_PANELS.map((p) => ({ ...p, grid: p.grid ? { ...p.grid } : undefined })),
    })
    get().saveLayout()
  },

  isLoggedIn: localStorage.getItem("yujie-auth-logged") === "1",
  setLoggedIn: (value) => {
    if (value) {
      localStorage.setItem("yujie-auth-logged", "1")
    } else {
      localStorage.removeItem("yujie-auth-logged")
    }
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
