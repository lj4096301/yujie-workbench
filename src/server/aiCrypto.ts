import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * API Key 加密存储：
 * - 密文写入 .env 的 AI_API_KEY_ENC（AES-256-GCM，iv+tag+ciphertext 打包 base64）
 * - 主密钥随机生成，存于系统用户目录（Windows: %APPDATA%/yujie-workbench，
 *   macOS/Linux: ~/.yujie-workbench），不进入项目与 git
 */

const SECRET_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'yujie-workbench')
  : path.join(os.homedir(), '.yujie-workbench')
const SECRET_FILE = path.join(SECRET_DIR, 'ai-secret.key')

function ensureSecret(): Buffer {
  try {
    const existing = fs.readFileSync(SECRET_FILE)
    if (existing.length === 32) return existing
  } catch {
    // 文件不存在，继续生成
  }
  fs.mkdirSync(SECRET_DIR, { recursive: true })
  const key = crypto.randomBytes(32)
  fs.writeFileSync(SECRET_FILE, key, { mode: 0o600 })
  return key
}

/** 加密明文 → base64(iv + tag + ciphertext) */
export function encryptKey(plain: string): string {
  const key = ensureSecret()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

/** 解密 → 明文；失败（密钥丢失/密文损坏）抛错 */
export function decryptKey(enc: string): string {
  const key = ensureSecret()
  const buf = Buffer.from(enc, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
