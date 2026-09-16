/**
 * Electron 二进制完整性自检修复
 * 背景：pnpm store 中 electron 包的 dist 快照不完整（缺 chrome_*.pak / checksums.json），
 * 每次 pnpm install/add relink 后这些文件会被覆盖回残缺状态，导致启动报 resource_bundle 错误。
 * 本脚本在 dev / build 前运行：检测缺失文件，从 scripts/electron-fix/ 备份补全。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const BACKUP = path.join(__dirname, 'electron-fix')
const NEEDED = ['dist/chrome_100_percent.pak', 'dist/chrome_200_percent.pak', 'checksums.json']

// 定位 electron 包目录（pnpm 虚拟 store）
function findElectronPkg() {
  const pnpmDir = path.join(ROOT, 'node_modules', '.pnpm')
  if (!fs.existsSync(pnpmDir)) return null
  for (const entry of fs.readdirSync(pnpmDir)) {
    if (entry.startsWith('electron@')) {
      const pkg = path.join(pnpmDir, entry, 'node_modules', 'electron')
      if (fs.existsSync(path.join(pkg, 'package.json'))) return pkg
    }
  }
  return null
}

const pkg = findElectronPkg()
if (!pkg) {
  console.log('[electron-fix] electron 包未找到，跳过')
  process.exit(0)
}

let fixed = 0
for (const rel of NEEDED) {
  const target = path.join(pkg, rel)
  if (fs.existsSync(target) && fs.statSync(target).size > 0) continue
  const source = path.join(BACKUP, path.basename(rel))
  if (!fs.existsSync(source)) {
    console.log(`[electron-fix] 备份缺失 ${rel}（${source}），跳过`)
    continue
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
  fixed++
  console.log(`[electron-fix] 已补全 ${rel}`)
}

if (fixed > 0) {
  console.log(`[electron-fix] 补全 ${fixed} 个缺失文件`)
} else {
  console.log('[electron-fix] Electron 资源完整')
}
