import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 定位项目根目录。
 *
 * 开发态：src/server/paths.ts → 向上 3 层到项目根
 * 生产态：vite --ssr 会把后端打成 dist/server/index.js → 向上 1 层到项目根
 *
 * 所以不能写死相对层级，改为向上查找「同时存在 package.json 与 data 目录」的那一层。
 */
function findProjectRoot(start: string): string {
  let dir = start
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'data'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // 回退：沿用历史约定（src/server/xxx → 项目根）
  return path.resolve(start, '../../../')
}

export const PROJECT_ROOT = findProjectRoot(__dirname)

/**
 * 数据目录解析优先级：
 * 1. WORKBENCH_DATA_DIR 环境变量（打包态由 Electron 主进程传入，指向 exe 同目录的 data/，实现绿色便携）
 * 2. 开发态：项目根 data/
 */
export const DATA_DIR = process.env.WORKBENCH_DATA_DIR
  ? path.resolve(process.env.WORKBENCH_DATA_DIR)
  : path.join(PROJECT_ROOT, 'data')

/** 确保 data 目录存在并返回其路径 */
export function ensureDataDir(): string {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  return DATA_DIR
}

/** data 目录下的文件绝对路径 */
export function dataFile(name: string): string {
  return path.join(ensureDataDir(), name)
}
