import { contextBridge, ipcRenderer } from 'electron'

// 注意：本文件为 .cts，编译后产出 preload.cjs（CommonJS）。
// Electron 的 preload 脚本默认不支持 ESM，因此不能使用 .ts。
contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  platform: process.platform,
  /**
   * 订阅主进程菜单命令。
   * @param cb 收到命令时调用（new-note / reset-layout / home / zoom-in / zoom-out / zoom-reset / refresh / about）
   * @returns 取消订阅函数
   */
  onMenuCommand: (cb: (command: string) => void) => {
    const handler = (_event: unknown, command: string) => cb(command)
    ipcRenderer.on('menu:command', handler)
    return () => ipcRenderer.removeListener('menu:command', handler)
  },
  /**
   * 订阅主进程推送的系统剪贴板变化（桌面端全局复制）。
   * @param cb 收到变化时调用，参数为剪贴板文本
   * @returns 取消订阅函数
   */
  onClipboardChange: (cb: (text: string) => void) => {
    const handler = (_event: unknown, text: string) => cb(text)
    ipcRenderer.on('clipboard:change', handler)
    return () => ipcRenderer.removeListener('clipboard:change', handler)
  },
  /**
   * 从本机已安装浏览器（Edge / Chrome / Brave）导入书签。
   * @returns 扁平化的书签数组，每个元素含 title / url / group（浏览器名）
   */
  importBookmarks: (): Promise<Array<{ id: string; title: string; url: string; icon: string; group: string }>> =>
    ipcRenderer.invoke('bookmarks:import'),
})
