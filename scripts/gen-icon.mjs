/**
 * 生成应用图标（纯 Node，无第三方依赖）。
 *
 * 输出：
 *   public/icon.png   256x256  —— dev 模式窗口图标 & 托盘
 *   build/icon.png    256x256  —— electron-builder 打包用
 *   stdout: DATAURL_32=<base64>  —— 供主进程内嵌兜底
 *
 * 用法：node scripts/gen-icon.mjs
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

/* ---------------- PNG 编码 ---------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePNG(size, pixels) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---------------- 绘制 ---------------- */

const distToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

const roundedRectSDF = (px, py, cx, cy, hw, hh, r) => {
  const qx = Math.abs(px - cx) - (hw - r)
  const qy = Math.abs(py - cy) - (hh - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** 距离 -> 覆盖率（简易抗锯齿） */
const coverage = (d, edge) => Math.max(0, Math.min(1, (edge - d) / (2 * edge)))

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const S = size
  const edge = S * 0.012

  const cx = S * 0.5
  const cy = S * 0.5
  const hw = S * 0.46
  const hh = S * 0.46
  const radius = S * 0.23

  // 白色 "M" 的四段折线
  const lineWidth = S * 0.088
  const top = S * 0.31
  const bottom = S * 0.70
  const left = S * 0.285
  const right = S * 0.715
  const midX = S * 0.5
  const midY = S * 0.565
  const segments = [
    [left, bottom, left, top],
    [left, top, midX, midY],
    [midX, midY, right, top],
    [right, top, right, bottom],
  ]

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const fx = x + 0.5
      const fy = y + 0.5

      const bgAlpha = coverage(roundedRectSDF(fx, fy, cx, cy, hw, hh, radius), edge)

      // 对角渐变 #1677ff -> #0a3f9e
      const t = Math.max(0, Math.min(1, fx / S * 0.45 + fy / S * 0.55))
      let r = Math.round(0x16 + (0x0a - 0x16) * t)
      let g = Math.round(0x77 + (0x3f - 0x77) * t)
      let b = Math.round(0xff + (0x9e - 0xff) * t)

      let markDist = Infinity
      for (const [x1, y1, x2, y2] of segments) {
        const d = distToSegment(fx, fy, x1, y1, x2, y2)
        if (d < markDist) markDist = d
      }
      const markAlpha = coverage(markDist - lineWidth / 2, edge)

      r = Math.round(r + (255 - r) * markAlpha)
      g = Math.round(g + (255 - g) * markAlpha)
      b = Math.round(b + (255 - b) * markAlpha)

      const offset = (y * S + x) * 4
      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = Math.round(bgAlpha * 255)
    }
  }

  return pixels
}

/* ---------------- 输出 ---------------- */

const png256 = encodePNG(256, drawIcon(256))
const png32 = encodePNG(32, drawIcon(32))

for (const dir of ['public', 'build']) {
  const target = path.join(ROOT, dir)
  fs.mkdirSync(target, { recursive: true })
  fs.writeFileSync(path.join(target, 'icon.png'), png256)
}

console.log(`[icon] public/icon.png  (${png256.length} bytes)`)
console.log(`[icon] build/icon.png   (${png256.length} bytes)`)
console.log(`DATAURL_32=${png32.toString('base64')}`)
