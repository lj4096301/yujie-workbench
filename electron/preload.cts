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
})
