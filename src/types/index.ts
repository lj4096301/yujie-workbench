export interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export interface PanelState {
  id: string
  moduleId: string
  title: string
  isMaximized: boolean
  isFloating: boolean
  isVisible: boolean
  zIndex: number
  width?: number
  height?: number
  x?: number
  y?: number
  /**
   * 首页网格坐标（react-grid-layout）：x/y 单位为列/行，w/h 为占格数。
   * 首页由 RGL 接管拖拽/缩放/防重叠，像素坐标 x/y/width/height 仅独占模式兼容保留。
   */
  grid?: { x: number; y: number; w: number; h: number }
  /** 递增即触发模块组件重建（重新拉取数据） */
  refreshKey?: number
}

/** 预加载脚本注入的 Electron 能力（浏览器模式下为 undefined） */
declare global {
  interface Window {
    electronAPI?: {
      getAppInfo: () => Promise<{ version: string; platform: string; webServerPort: number }>
      platform: string
      /** 订阅主进程菜单命令，返回取消订阅函数 */
      onMenuCommand?: (cb: (command: string) => void) => () => void
      /** 订阅主进程推送的系统剪贴板变化（桌面端全局复制），返回取消订阅函数 */
      onClipboardChange?: (cb: (text: string) => void) => () => void
      /** 从本机浏览器（Edge/Chrome/Brave）导入书签 */
      importBookmarks?: () => Promise<Array<{ id: string; title: string; url: string; icon: string; group: string }>>
    }
  }
}
