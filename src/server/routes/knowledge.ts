import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const DEFAULT_VAULT_PATH = 'D:\\docker-ai\\workspace-shared\\knowledge-base'

/**
 * 运行时读取 vault 路径，避免模块顶层求值时 .env 尚未加载。
 */
function getVaultPath(): string {
  return process.env.OBSIDIAN_VAULT_PATH || DEFAULT_VAULT_PATH
}

export function createKnowledgeRouter() {
  const router = Router()

  /** 解析相对路径并做安全校验，返回 { ok, fullPath, rel } 或 { ok: false, error } */
  function resolveSafePath(vaultPath: string, rawPath: string, requireMd = true) {
    const rel = rawPath.trim().replace(/\\/g, '/')
    if (!rel) return { ok: false as const, error: '缺少文件路径' }
    if (requireMd && !rel.toLowerCase().endsWith('.md')) {
      return { ok: false as const, error: '文件名需以 .md 结尾' }
    }
    if (rel.split('/').some((s) => !s || s === '.' || s === '..')) {
      return { ok: false as const, error: '路径不合法' }
    }
    const fullPath = path.resolve(vaultPath, rel)
    const vaultResolved = path.resolve(vaultPath)
    if (fullPath !== vaultResolved && !fullPath.toLowerCase().startsWith(vaultResolved.toLowerCase() + path.sep)) {
      return { ok: false as const, error: '路径超出知识库范围' }
    }
    return { ok: true as const, fullPath, rel }
  }

  // 获取文件树
  router.get('/tree', (req, res) => {
    try {
      const tree = buildFileTree(getVaultPath())
      res.json(tree)
    } catch (err) {
      res.status(500).json({ error: '读取知识库失败' })
    }
  })

  // 获取文件内容（含 frontmatter / 双链 / 反链 / 未链接提及）
  router.get('/file', (req, res) => {
    try {
      const vaultPath = getVaultPath()
      const filePath = req.query.path as string
      if (!filePath) return res.status(400).json({ error: '缺少 path 参数' })

      // 统一使用正斜杠路径
      const normalizedPath = filePath.replace(/\\/g, '/')
      const fullPath = path.join(vaultPath, normalizedPath)
      if (!fs.existsSync(fullPath)) return res.status(404).json({ error: '文件不存在' })

      const fileContent = fs.readFileSync(fullPath, 'utf-8')
      const { data: frontmatter, content: markdown } = matter(fileContent)

      // 提取 wikilinks（去重，保留顺序）
      const links: string[] = []
      const linkSeen = new Set<string>()
      const wikilinkRegex = /\[\[([^\][]+?)\]\]/g
      let match
      while ((match = wikilinkRegex.exec(markdown)) !== null) {
        const target = match[1].split('|')[0].split('#')[0].trim()
        if (target && !linkSeen.has(target)) {
          linkSeen.add(target)
          links.push(target)
        }
      }

      // 提取标签（frontmatter tags + 正文 #标签，正文需剔除代码块）
      const tags = extractTags(markdown, frontmatter)

      // 反向链接（支持 [[名]] [[名|别名]] [[名#锚]] [[路径/名]]）
      const backlinks = findBacklinks(normalizedPath, vaultPath)

      // 未链接提及（正文中出现笔记名但没写成 [[链接]] 的地方）
      const unlinkedMentions = findUnlinkedMentions(normalizedPath, vaultPath)

      res.json({
        name: path.basename(filePath, '.md'),
        path: filePath,
        content: markdown,
        frontmatter,
        links,
        backlinks,
        unlinkedMentions,
        tags,
      })
    } catch (err) {
      res.status(500).json({ error: '读取文件失败' })
    }
  })

  // 搜索
  router.get('/search', (req, res) => {
    try {
      const query = (req.query.q as string || '').toLowerCase()
      if (query.length < 2) return res.json([])

      const results = searchFiles(getVaultPath(), query)
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: '搜索失败' })
    }
  })

  // 图谱数据：笔记节点 + wikilink 边（内存缓存 60s）
  let graphCache: { at: number; data: unknown } | null = null
  router.get('/graph', (_req, res) => {
    try {
      if (graphCache && Date.now() - graphCache.at < 60_000) {
        return res.json(graphCache.data)
      }
      const vaultPath = getVaultPath()
      const data = buildGraph(vaultPath)
      graphCache = { at: Date.now(), data }
      res.json(data)
    } catch (err) {
      res.status(500).json({ error: '图谱构建失败' })
    }
  })

  // 全库标签聚合（Obsidian 标签面板思路）
  router.get('/tags', (_req, res) => {
    try {
      res.json(aggregateTags(getVaultPath()))
    } catch (err) {
      res.status(500).json({ error: '标签统计失败' })
    }
  })

  // 新建笔记（可带子文件夹路径，自动创建目录）
  router.post('/file', (req, res) => {
    try {
      const vaultPath = getVaultPath()
      const parsed = resolveSafePath(vaultPath, String(req.body?.path ?? ''))
      if (!parsed.ok) return res.status(400).json({ error: parsed.error })

      if (fs.existsSync(parsed.fullPath)) {
        return res.status(409).json({ error: '文件已存在' })
      }
      fs.mkdirSync(path.dirname(parsed.fullPath), { recursive: true })
      const title = path.basename(parsed.rel, '.md')
      const content = String(req.body?.content ?? `# ${title}\n\n`)
      fs.writeFileSync(parsed.fullPath, content, 'utf-8')
      res.json({ ok: true, path: parsed.rel })
    } catch (err) {
      res.status(500).json({ error: '创建文件失败' })
    }
  })

  // 保存笔记编辑（保留原 frontmatter）
  router.put('/file', (req, res) => {
    try {
      const vaultPath = getVaultPath()
      const parsed = resolveSafePath(vaultPath, String(req.body?.path ?? ''))
      if (!parsed.ok) return res.status(400).json({ error: parsed.error })

      if (!fs.existsSync(parsed.fullPath)) {
        return res.status(404).json({ error: '文件不存在' })
      }
      const newContent = String(req.body?.content ?? '')
      const raw = fs.readFileSync(parsed.fullPath, 'utf-8')
      // 原文件带 frontmatter 时用 gray-matter 回写，避免编辑把元数据弄丢
      let output = newContent
      if (raw.startsWith('---')) {
        try {
          const parsedMatter = matter(raw)
          output = matter.stringify(newContent, parsedMatter.data)
        } catch {
          // frontmatter 解析失败则原样保存正文
        }
      }
      fs.writeFileSync(parsed.fullPath, output, 'utf-8')
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: '保存失败' })
    }
  })

  // 移动文件 / 文件夹（拖拽改名换目录）
  router.post('/move', (req, res) => {
    try {
      const vaultPath = getVaultPath()
      const fromRaw = String(req.body?.from ?? '')
      const toRaw = String(req.body?.to ?? '')

      const isFile = fromRaw.toLowerCase().endsWith('.md')
      const from = resolveSafePath(vaultPath, fromRaw, false)
      if (!from.ok) return res.status(400).json({ error: from.error })
      if (isFile) {
        const check = resolveSafePath(vaultPath, fromRaw, true)
        if (!check.ok) return res.status(400).json({ error: check.error })
      }
      if (!fs.existsSync(from.fullPath)) return res.status(404).json({ error: '源不存在' })

      const to = resolveSafePath(vaultPath, toRaw, isFile)
      if (!to.ok) return res.status(400).json({ error: to.error })
      // 目标与源相同 → 无操作
      if (path.resolve(from.fullPath).toLowerCase() === path.resolve(to.fullPath).toLowerCase()) {
        return res.json({ ok: true })
      }
      if (fs.existsSync(to.fullPath)) return res.status(409).json({ error: '目标位置已存在同名文件' })
      // 防止把文件夹拖进自己内部（from 是 to 的祖先）
      if (path.resolve(to.fullPath).toLowerCase().startsWith(path.resolve(from.fullPath).toLowerCase() + path.sep)) {
        return res.status(400).json({ error: '不能移动到自身内部' })
      }

      fs.mkdirSync(path.dirname(to.fullPath), { recursive: true })
      fs.renameSync(from.fullPath, to.fullPath)
      res.json({ ok: true, path: to.rel })
    } catch (err) {
      res.status(500).json({ error: '移动失败' })
    }
  })

  // 重命名 / 移动 + 自动更新全库内部链接（Obsidian "自动更新内部链接" 能力）
  router.post('/rename', (req, res) => {
    try {
      const vaultPath = getVaultPath()
      const fromRaw = String(req.body?.from ?? '')
      const toRaw = String(req.body?.to ?? '')
      if (fromRaw === toRaw) return res.json({ ok: true })

      const isFile = fromRaw.toLowerCase().endsWith('.md')
      const from = resolveSafePath(vaultPath, fromRaw, false)
      if (!from.ok) return res.status(400).json({ error: from.error })
      const to = resolveSafePath(vaultPath, toRaw, isFile)
      if (!to.ok) return res.status(400).json({ error: to.error })
      if (!fs.existsSync(from.fullPath)) return res.status(404).json({ error: '源不存在' })
      if (fs.existsSync(to.fullPath)) return res.status(409).json({ error: '目标位置已存在同名文件' })
      if (path.resolve(to.fullPath).toLowerCase().startsWith(path.resolve(from.fullPath).toLowerCase() + path.sep)) {
        return res.status(400).json({ error: '不能移动到自身内部' })
      }

      fs.mkdirSync(path.dirname(to.fullPath), { recursive: true })
      fs.renameSync(from.fullPath, to.fullPath)

      // 更新全库 wikilink 引用（文件按名匹配，文件夹按路径前缀匹配）
      const updated = updateLinksAfterRename(vaultPath, from.rel, to.rel)
      res.json({ ok: true, path: to.rel, updatedLinks: updated })
    } catch (err) {
      res.status(500).json({ error: '重命名失败' })
    }
  })

  // 删除（移入知识库 .trash，Obsidian 同款策略，可在文件管理器找回）
  router.delete('/file', (req, res) => {
    try {
      const vaultPath = getVaultPath()
      const raw = String(req.query.path ?? '')
      const isFile = raw.toLowerCase().endsWith('.md')
      const parsed = resolveSafePath(vaultPath, raw, false)
      if (!parsed.ok) return res.status(400).json({ error: parsed.error })
      if (isFile) {
        const check = resolveSafePath(vaultPath, raw, true)
        if (!check.ok) return res.status(400).json({ error: check.error })
      }
      if (!fs.existsSync(parsed.fullPath)) return res.status(404).json({ error: '文件不存在' })
      // 不允许删除 vault 根目录本身
      if (path.resolve(parsed.fullPath).toLowerCase() === path.resolve(vaultPath).toLowerCase()) {
        return res.status(400).json({ error: '不能删除知识库根目录' })
      }

      const trashDir = path.join(vaultPath, '.trash')
      fs.mkdirSync(trashDir, { recursive: true })
      const base = path.basename(parsed.fullPath)
      let dest = path.join(trashDir, `${Date.now()}-${base}`)
      let n = 0
      while (fs.existsSync(dest) && n < 100) dest = path.join(trashDir, `${Date.now()}-${++n}-${base}`)
      fs.renameSync(parsed.fullPath, dest)
      res.json({ ok: true, trash: path.basename(dest) })
    } catch (err) {
      res.status(500).json({ error: '删除失败' })
    }
  })

  return router
}

/* ===================== 链接 / 标签 / 反链分析 ===================== */

interface MdDoc {
  path: string // 相对路径（正斜杠）
  content: string
}

/** 遍历 vault 收集所有 md 文档 */
function collectDocs(vaultPath: string): MdDoc[] {
  const docs: MdDoc[] = []
  const walk = (dir: string, rel: string) => {
    if (!fs.existsSync(dir)) return
    for (const item of fs.readdirSync(dir)) {
      if (item.startsWith('.') || item === 'node_modules') continue
      const full = path.join(dir, item)
      const relPath = rel ? `${rel}/${item}` : item
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full, relPath)
      else if (item.toLowerCase().endsWith('.md')) {
        try {
          docs.push({ path: relPath, content: fs.readFileSync(full, 'utf-8') })
        } catch {}
      }
    }
  }
  walk(vaultPath, '')
  return docs
}

/** 解析 wikilink 目标：返回 target（去掉 |别名 #锚点） */
function wikilinkTargets(content: string): string[] {
  const out: string[] = []
  const re = /\[\[([^\][]+?)\]\]/g
  let m
  while ((m = re.exec(content)) !== null) {
    const t = m[1].split('|')[0].split('#')[0].trim()
    if (t) out.push(t)
  }
  return out
}

function basenameNoExt(p: string): string {
  const base = p.split('/').pop() ?? p
  return base.replace(/\.md$/i, '')
}

/**
 * 重命名后更新全库 wikilink：
 * - 文件：[[旧名]] [[旧名|别名]] [[旧名#锚]] [[路径/旧名]] → 全部改 basename
 * - 文件夹：[[旧目录/xxx]] → [[新目录/xxx]]
 */
function updateLinksAfterRename(vaultPath: string, oldRel: string, newRel: string): number {
  const isFolder = !oldRel.toLowerCase().endsWith('.md')
  const oldName = isFolder ? oldRel : basenameNoExt(oldRel)
  const newName = isFolder ? newRel : basenameNoExt(newRel)
  const oldLower = oldName.toLowerCase()
  let updatedCount = 0
  const re = /\[\[([^\][]+?)\]\]/g

  for (const doc of collectDocs(vaultPath)) {
    let changed = false
    const next = doc.content.replace(re, (all, inner: string) => {
      const [target, ...alias] = inner.split('|')
      const anchorIdx = target.indexOf('#')
      const mainPart = anchorIdx >= 0 ? target.slice(0, anchorIdx) : target
      const anchorPart = anchorIdx >= 0 ? target.slice(anchorIdx) : ''
      const t = mainPart.trim()
      let newTarget: string | null = null
      if (isFolder) {
        if (t.toLowerCase().startsWith(oldLower + '/')) {
          newTarget = newRel + t.slice(oldRel.length)
        }
      } else {
        const tNoExt = t.replace(/\.md$/i, '')
        const lower = tNoExt.toLowerCase()
        if (lower === oldLower || lower.endsWith('/' + oldLower)) {
          newTarget = tNoExt.slice(0, tNoExt.length - oldName.length) + newName
        }
      }
      if (newTarget === null || newTarget === t) return all
      changed = true
      updatedCount++
      const sep = alias.length > 0 ? '|' + alias.join('|') : ''
      return `[[${newTarget}${anchorPart}${sep}]]`
    })
    if (changed) {
      try {
        fs.writeFileSync(path.join(vaultPath, doc.path), next, 'utf-8')
      } catch {}
    }
  }
  return updatedCount
}

/** 反向链接：哪些笔记的 wikilink 指向目标笔记（支持别名/锚点/路径链接），带上下文摘要 */
interface Backlink {
  path: string
  name: string
  snippet: string
}

function findBacklinks(targetRel: string, vaultPath: string): Backlink[] {
  const targetName = basenameNoExt(targetRel).toLowerCase()
  const targetLower = targetRel.toLowerCase().replace(/\.md$/i, '')
  const results: Backlink[] = []

  for (const doc of collectDocs(vaultPath)) {
    if (doc.path.toLowerCase() === targetLower) continue
    const targets = wikilinkTargets(doc.content)
    const hit = targets.some((t) => {
      const tNoExt = t.replace(/\.md$/i, '').toLowerCase()
      return tNoExt === targetName || tNoExt.endsWith('/' + targetName) || tNoExt === targetLower
    })
    if (!hit) continue
    const raw = doc.content
    const idx = raw.toLowerCase().indexOf(targetName)
    const snippet =
      idx >= 0
        ? raw.slice(Math.max(0, idx - 40), Math.min(raw.length, idx + targetName.length + 60)).replace(/\s+/g, ' ')
        : ''
    results.push({ path: doc.path, name: basenameNoExt(doc.path), snippet })
  }
  return results
}

/** 未链接提及：正文中出现笔记名、但没有写成 [[链接]] 的位置 */
interface Mention {
  path: string
  name: string
  snippet: string
}

function findUnlinkedMentions(targetRel: string, vaultPath: string): Mention[] {
  const targetName = basenameNoExt(targetRel)
  if (!targetName || targetName.length < 2) return []
  const targetLower = targetRel.toLowerCase().replace(/\.md$/i, '')
  const results: Mention[] = []

  for (const doc of collectDocs(vaultPath)) {
    if (doc.path.toLowerCase() === targetLower) continue
    // 先去掉已成链接的部分，剩下的才算"未链接"
    const stripped = doc.content.replace(/\[\[([^\][]*?)\]\]/g, ' ')
    // 去掉代码块避免误报
    const noCode = stripped.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ')
    const lower = noCode.toLowerCase()
    const needle = targetName.toLowerCase()
    const idx = lower.indexOf(needle)
    if (idx === -1) continue
    const start = Math.max(0, idx - 40)
    const end = Math.min(noCode.length, idx + needle.length + 60)
    const snippet = (start > 0 ? '...' : '') + noCode.slice(start, end).replace(/\s+/g, ' ') + (end < noCode.length ? '...' : '')
    results.push({ path: doc.path, name: basenameNoExt(doc.path), snippet })
    if (results.length >= 20) break
  }
  return results
}

/** 提取标签：frontmatter tags + 正文 #标签（剔除代码块、wikilink 内部） */
function extractTags(markdown: string, frontmatter: Record<string, unknown>): string[] {
  const tags = new Set<string>()

  const fmTags = frontmatter?.tags
  if (Array.isArray(fmTags)) fmTags.forEach((t) => String(t).trim() && tags.add(String(t).trim().replace(/^#/, '')))
  else if (typeof fmTags === 'string')
    fmTags
      .split(/[,\s]+/)
      .forEach((t) => t.trim() && tags.add(t.trim().replace(/^#/, '')))

  const noCode = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ')
  const re = /(^|[\s(（>])#([\w\u4e00-\u9fff/-]+)/g
  let m
  while ((m = re.exec(noCode)) !== null) tags.add(m[2])

  return [...tags]
}

/** 全库标签聚合：[{ tag, count }] 按次数倒序 */
function aggregateTags(vaultPath: string): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>()
  for (const doc of collectDocs(vaultPath)) {
    try {
      const { data, content } = matter(doc.content)
      for (const t of extractTags(content, data)) {
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    } catch {}
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

/* ===================== 文件树 / 搜索 / 图谱 ===================== */

function buildFileTree(dirPath: string, relativePath: string = ''): any[] {
  if (!fs.existsSync(dirPath)) return []

  const items = fs.readdirSync(dirPath)
  const result: any[] = []

  for (const item of items) {
    if (item.startsWith('.') || item === 'node_modules') continue

    const fullPath = path.join(dirPath, item)
    // 使用正斜杠作为路径分隔符
    const relPath = relativePath ? relativePath + '/' + item : item

    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      result.push({
        name: item,
        path: relPath,
        type: 'folder',
        children: buildFileTree(fullPath, relPath),
      })
    } else if (item.endsWith('.md')) {
      result.push({
        name: item.replace('.md', ''),
        path: relPath,
        type: 'file',
      })
    }
  }

  return result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'folder' ? -1 : 1
  })
}

function searchFiles(dirPath: string, query: string, relativePath: string = ''): any[] {
  const results: any[] = []
  if (!fs.existsSync(dirPath)) return results

  const items = fs.readdirSync(dirPath)
  for (const item of items) {
    if (item.startsWith('.')) continue
    const fullPath = path.join(dirPath, item)
    // 使用正斜杠作为路径分隔符
    const relPath = relativePath ? relativePath + '/' + item : item
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      results.push(...searchFiles(fullPath, query, relPath))
    } else if (item.endsWith('.md')) {
      try {
        const fileContent = fs.readFileSync(fullPath, 'utf-8')
        const { content: markdown } = matter(fileContent)
        if (
          item.toLowerCase().includes(query) ||
          markdown.toLowerCase().includes(query)
        ) {
          const snippet = getSearchSnippet(markdown, query)
          results.push({
            name: item.replace('.md', ''),
            path: relPath,
            type: 'file',
            snippet,
          })
        }
      } catch {}
    }
  }

  return results
}

function getSearchSnippet(content: string, query: string): string {
  const lower = content.toLowerCase()
  const idx = lower.indexOf(query)
  if (idx === -1) return content.slice(0, 100)
  const start = Math.max(0, idx - 30)
  const end = Math.min(content.length, idx + query.length + 70)
  return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')
}

interface GraphNode {
  id: string // 相对路径
  name: string
  degree: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: Array<[string, string]> // [fromPath, toPath]
}

/** 扫描全库 wikilink，构建节点 + 边（只包含有链接关系的笔记） */
function buildGraph(vaultPath: string): GraphData {
  const files: Array<{ path: string; content: string }> = []
  const nameToPath = new Map<string, string>() // 文件名(无扩展名) -> relPath

  const walk = (dir: string, rel: string) => {
    if (!fs.existsSync(dir)) return
    for (const item of fs.readdirSync(dir)) {
      if (item.startsWith('.') || item === 'node_modules') continue
      const full = path.join(dir, item)
      const relPath = rel ? `${rel}/${item}` : item
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walk(full, relPath)
      else if (item.toLowerCase().endsWith('.md')) {
        try {
          const content = fs.readFileSync(full, 'utf-8')
          files.push({ path: relPath, content })
          const base = item.replace(/\.md$/i, '')
          if (!nameToPath.has(base)) nameToPath.set(base, relPath)
        } catch {}
      }
    }
  }
  walk(vaultPath, '')

  const degree = new Map<string, number>()
  const edgeSet = new Set<string>()
  const edges: Array<[string, string]> = []

  for (const file of files) {
    const links = wikilinkTargets(file.content)
    for (const raw of links) {
      // 优先按文件名精确匹配，其次按路径匹配
      const target = nameToPath.get(raw) ?? (files.some((f) => f.path === raw) ? raw : null)
      if (!target || target === file.path) continue
      const key = `${file.path}->${target}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push([file.path, target])
      degree.set(file.path, (degree.get(file.path) ?? 0) + 1)
      degree.set(target, (degree.get(target) ?? 0) + 1)
    }
  }

  const nodes: GraphNode[] = files
    .filter((f) => (degree.get(f.path) ?? 0) > 0)
    .map((f) => ({ id: f.path, name: path.basename(f.path, '.md'), degree: degree.get(f.path) ?? 0 }))
    .sort((a, b) => b.degree - a.degree)

  return { nodes, edges }
}
