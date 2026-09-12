import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, session, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { spawn, ChildProcess } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let serverProcess: ChildProcess | null = null

// 便携版可能在老机器/远程桌面/虚拟机等 GPU 异常环境运行，
// 禁用硬件加速避免 Chromium 因 GPU 进程不可用而 FATAL 退出（软件渲染对本工具足够）
app.disableHardwareAcceleration()

const WEB_SERVER_PORT = Number(process.env.WEB_SERVER_PORT) || 3001
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
const isDev = !app.isPackaged

// 项目根目录：开发时为仓库根目录，打包后为 app 目录（app.asar）
const APP_ROOT = isDev ? path.resolve(__dirname, '../..') : app.getAppPath()

/**
 * 数据目录解析：
 * - 打包态：exe 同目录下的 data/（绿色便携，数据随文件夹走）；
 *   exe 旁不可写时回退到系统 userData/data。
 * - 开发态：项目根 data/（行为不变）。
 */
function resolveDataDir(): string {
  if (isDev) return path.join(APP_ROOT, 'data')
  const exeDir = path.dirname(app.getPath('exe'))
  const candidate = path.join(exeDir, 'data')
  try {
    fs.mkdirSync(candidate, { recursive: true })
    const probe = path.join(candidate, '.write-test')
    fs.writeFileSync(probe, 'ok')
    fs.unlinkSync(probe)
    return candidate
  } catch {
    const fallback = path.join(app.getPath('userData'), 'data')
    fs.mkdirSync(fallback, { recursive: true })
    console.warn(`[data] exe 旁目录不可写，数据目录回退到: ${fallback}`)
    return fallback
  }
}

/** 首启把 asar 内置的 data/ 拷贝出来作为种子数据（不覆盖已有文件） */
function seedDataDir(dataDir: string) {
  if (isDev) return
  const bundled = path.join(APP_ROOT, 'data')
  try {
    if (!fs.existsSync(bundled)) return
    copyTreeMissingOnly(bundled, dataDir)
  } catch (err) {
    console.warn('[data] 种子数据拷贝失败（不影响启动）:', (err as Error).message)
  }
}

function copyTreeMissingOnly(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyTreeMissingOnly(s, d)
    } else if (!fs.existsSync(d)) {
      fs.copyFileSync(s, d)
    }
  }
}

/** 返回第一个存在的文件路径，都不存在则返回 undefined */
function firstExisting(candidates: string[]): string | undefined {
  return candidates.find((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })
}

function resolveIcon(): string | undefined {
  return firstExisting([
    path.join(APP_ROOT, 'public/icon.png'),
    path.join(APP_ROOT, 'build/icon.png'),
    path.join(__dirname, '../public/icon.png'),
  ])
}

/**
 * 最后的兜底图标：不依赖任何图片文件，直接生成 16x16 的纯色位图。
 * 避免「图标文件缺失 -> 托盘初始化失败 -> 关掉窗口后无法找回」的连锁问题。
 */
function createFallbackIcon() {
  const size = 16
  const buffer = Buffer.alloc(size * size * 4) // BGRA
  for (let i = 0; i < size * size; i++) {
    buffer[i * 4] = 0xff // B
    buffer[i * 4 + 1] = 0x77 // G
    buffer[i * 4 + 2] = 0x16 // R
    buffer[i * 4 + 3] = 0xff // A
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size })
}

function resolvePreload(): string | undefined {
  // preload 必须以 CommonJS 提供，因此编译产物为 .cjs
  return firstExisting([
    path.join(__dirname, 'preload.cjs'),
    path.join(__dirname, 'preload.js'),
  ])
}

function showWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/**
 * 主进程菜单 → 渲染进程。
 *
 * 菜单项刻意不注册 accelerator：键盘快捷键统一由渲染进程的 keydown 处理
 * （浏览器模式 dev:web 下也能用）。否则菜单拦截按键 + 渲染进程监听会双重触发。
 * 快捷键只写在 label 里做提示。
 */
function sendMenuCommand(command: string) {
  mainWindow?.webContents.send('menu:command', command)
}

/**
 * 应用菜单。
 *
 * 不设置的话 Electron 会用内置默认菜单 —— 也就是英文的
 * File / Edit / View / Window / Help，中文界面里非常突兀。
 */
function buildAppMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([{ role: 'appMenu', label: app.name }] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: '文件',
      submenu: [
        { label: '新建灵感速记（Ctrl + N）', click: () => sendMenuCommand('new-note') },
        { label: '重置布局（Ctrl + L）', click: () => sendMenuCommand('reset-layout') },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '回到首页（Ctrl + 0）', click: () => sendMenuCommand('home') },
        { type: 'separator' },
        { label: '放大界面（Ctrl + =）', click: () => sendMenuCommand('zoom-in') },
        { label: '缩小界面（Ctrl + -）', click: () => sendMenuCommand('zoom-out') },
        { label: '还原 100%（Ctrl + Shift + 0）', click: () => sendMenuCommand('zoom-reset') },
        { type: 'separator' },
        { label: '刷新当前模块', click: () => sendMenuCommand('refresh') },
        { label: '重新加载窗口', role: 'forceReload' },
        { type: 'separator' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { label: '全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        ...(isMac ? [] : [{ label: '关闭', role: 'close' as const }]),
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 宇界工作台', click: () => sendMenuCommand('about') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  // 资讯模块 iframe 白名单：这些站点的 X-Frame-Options / CSP 反嵌头由本进程移除，
  // 仅限应用内嵌（不影响系统浏览器直接访问的行为）。
  const EMBED_ALLOWED_HOSTS = ['newsnow.busiyi.world', 'hackernews.betacat.io', 'readhub.cn', 'www.aibase.com']
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    try {
      const host = new URL(details.url).host
      if (EMBED_ALLOWED_HOSTS.includes(host)) {
        const headers = { ...details.responseHeaders }
        for (const key of Object.keys(headers)) {
          const lower = key.toLowerCase()
          if (lower === 'x-frame-options' || lower === 'content-security-policy') {
            delete headers[key]
          }
        }
        callback({ responseHeaders: headers })
        return
      }
    } catch {
      /* URL 解析失败按原样放行 */
    }
    callback({})
  })

  const preload = resolvePreload()
  const icon = resolveIcon()

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: '宇界工作台',
    ...(icon ? { icon } : {}),
    webPreferences: {
      ...(preload ? { preload } : {}),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    frame: true,
    backgroundColor: '#f0f2f5',
  })

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL)
    // 不自动打开 DevTools：它会引发无害但刺眼的 "Autofill.enable wasn't found" 报错。
    // 需要调试时按 Ctrl+Shift+I 手动打开即可。
  } else {
    mainWindow.loadURL(`http://localhost:${WEB_SERVER_PORT}`)
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    console.error(`[window] 页面加载失败 (${errorCode} ${errorDescription}): ${url}`)
  })

  // 所有「新窗口」请求（iframe 里点 target=_blank 链接、面板内 ↗ 按钮、window.open）
  // 统一转交系统默认浏览器打开，不在应用内弹出二级窗口。
  // 纯浏览器模式（dev:web）天然就是浏览器开新标签，无需处理。
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 仅在托盘可用时才「关闭即最小化到托盘」，否则窗口一旦隐藏就无法找回
  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting && tray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
}

function createTray() {
  try {
    const iconPath = resolveIcon()
    const icon = iconPath ? nativeImage.createFromPath(iconPath) : createFallbackIcon()

    if (icon.isEmpty()) {
      console.warn('[tray] 图标无效，使用内置兜底图标')
    }

    tray = new Tray(icon.isEmpty() ? createFallbackIcon() : icon)

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示 宇界工作台',
        click: () => showWindow(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          ;(app as any).isQuitting = true
          app.quit()
        },
      },
    ])

    tray.setToolTip('宇界工作台')
    tray.setContextMenu(contextMenu)

    tray.on('click', () => showWindow())
    tray.on('double-click', () => showWindow())

    if (iconPath) {
      console.log(`[tray] 已启用系统托盘，图标: ${iconPath}`)
    } else {
      console.warn('[tray] 未找到图标文件，使用内置兜底图标')
    }
  } catch (err) {
    console.error('[tray] 初始化失败:', err)
    tray = null
  }
}

function startWebServer() {
  if (isDev) return

  const dataDir = resolveDataDir()
  seedDataDir(dataDir)

  const serverEntry = path.join(APP_ROOT, 'dist', 'server', 'index.js')
  if (!fs.existsSync(serverEntry)) {
    console.error(`[server] 未找到服务端入口: ${serverEntry}，请先执行 npm run build`)
    return
  }

  // 复用 Electron 自带的 Node 运行时，避免依赖系统 node
  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      WEB_SERVER_PORT: String(WEB_SERVER_PORT),
      WORKBENCH_DATA_DIR: dataDir,
    },
    stdio: 'pipe',
  })

  serverProcess.stdout?.on('data', (data) => {
    console.log(`[server] ${String(data).trim()}`)
  })

  serverProcess.stderr?.on('data', (data) => {
    console.error(`[server] ${String(data).trim()}`)
  })

  serverProcess.on('error', (err) => {
    console.error('[server] 启动失败:', err)
  })
}

/**
 * 改名（MiMo Desktop → 宇界工作台）后应用名变化，Electron 的 userData 目录随之改变，
 * 旧目录里的 localStorage（面板布局、缩放倍数等）会读不到。
 * 首次启动时把旧目录的 Local Storage / Session Storage 拷到新目录，之后不再执行。
 */
function migrateLegacyUserData() {
  try {
    const newDir = app.getPath('userData')
    // 开发模式（electron .）旧目录名取 package.json name="mimo-desktop"；
    // 打包后取 productName="MiMo Desktop"，两个都查一遍。
    const legacyNames = ['mimo-desktop', 'MiMo Desktop']
    for (const legacy of legacyNames) {
      const oldDir = path.join(path.dirname(newDir), legacy)
      if (path.resolve(oldDir) === path.resolve(newDir)) continue
      if (!fs.existsSync(oldDir)) continue
      for (const sub of ['Local Storage', 'Session Storage']) {
        const src = path.join(oldDir, sub)
        const dest = path.join(newDir, sub)
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          fs.cpSync(src, dest, { recursive: true })
          console.log(`[migrate] 已迁移 ${sub}: ${oldDir} -> ${newDir}`)
        }
      }
    }
  } catch (err) {
    console.warn('[migrate] 旧用户数据迁移失败（不影响启动）:', err)
  }
}

// 必须在 app ready 之前调用：ready 之后 Electron 已按新应用名建好目录，迁移会被跳过
migrateLegacyUserData()

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  webServerPort: WEB_SERVER_PORT,
}))

app.whenReady().then(() => {
  buildAppMenu()
  startWebServer()
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      showWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill()
  }
})
