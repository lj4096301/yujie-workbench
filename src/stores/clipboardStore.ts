import { create } from 'zustand'

/**
 * 剪贴板历史（全局单例 store）。
 *
 * 为什么放全局而不是放在模块组件里：
 * 面板隐藏时组件会被卸载，若监听写在模块内，隐藏期间发生的复制就抓不到。
 * 这里在 App 顶层统一监听（应用内 copy 事件 + Electron 主进程推送的系统剪贴板变化），
 * 模块只负责渲染，保证任何时刻的复制都被记录。
 */
const STORAGE_KEY = 'mimo-clipboard-history'
const MAX_ITEMS = 200

export interface ClipboardItem {
  id: string
  text: string
  ts: number
  source: 'global' | 'copy' | 'manual'
}

function loadItems(): ClipboardItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(items: ClipboardItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* 隐私模式等存储失败时静默降级 */
  }
}

interface ClipboardStore {
  items: ClipboardItem[]
  /** 新增一条；连续相同文本自动去重（避免系统轮询与应用内 copy 重复记） */
  add: (text: string, source?: ClipboardItem['source']) => void
  remove: (id: string) => void
  clear: () => void
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  items: loadItems(),

  add: (text, source = 'global') => {
    const value = (text || '').trim()
    if (!value) return
    const items = get().items
    if (items[0]?.text === value) return
    const next: ClipboardItem[] = [
      {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: value,
        ts: Date.now(),
        source,
      },
      ...items,
    ].slice(0, MAX_ITEMS)
    persist(next)
    set({ items: next })
  },

  remove: (id) => {
    const next = get().items.filter((i) => i.id !== id)
    persist(next)
    set({ items: next })
  },

  clear: () => {
    persist([])
    set({ items: [] })
  },
}))
