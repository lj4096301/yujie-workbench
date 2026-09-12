import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 项目根目录的 .env 路径
 */
export const ENV_PATH = path.resolve(__dirname, '../../.env')

/**
 * 加载 .env 到 process.env。
 *
 * 使用 Node 20.12+ 内置的 process.loadEnvFile()，不依赖 dotenv。
 * 注意：本模块必须被 server/index.ts 作为**第一个** import 引入，
 * 否则后续路由模块在顶层读取 process.env 时会拿到空值。
 */
export function loadEnv(): boolean {
  if (!fs.existsSync(ENV_PATH)) return false
  try {
    process.loadEnvFile(ENV_PATH)
    return true
  } catch (err) {
    console.warn('[env] 加载 .env 失败:', (err as Error).message)
    return false
  }
}

loadEnv()
