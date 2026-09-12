import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

/** 标题文本 -> 锚点 id（大纲与正文共用同一函数） */
export function headingSlug(text: string): string {
  return text.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
}

export interface OutlineItem {
  level: number
  text: string
  id: string
}

/** 从 markdown 源码解析标题大纲 */
export function parseOutline(content: string): OutlineItem[] {
  const items: OutlineItem[] = []
  const re = /^(#{1,4})\s+(.+?)\s*$/gm
  const used = new Map<string, number>()
  let m
  while ((m = re.exec(content)) !== null) {
    const text = m[2].replace(/[#*`~\[\]]/g, '').trim()
    if (!text) continue
    let id = headingSlug(text)
    const n = used.get(id) ?? 0
    used.set(id, n + 1)
    if (n > 0) id = `${id}-${n}`
    items.push({ level: m[1].length, text, id })
  }
  return items
}

/** 把 wikilink 转成内部锚点链接，交给 react-markdown 渲染 */
function preprocess(content: string): string {
  return content.replace(/\[\[(.*?)\]\]/g, (_all, inner: string) => {
    const [target, alias] = inner.split('|')
    const label = (alias ?? target).trim()
    return `[${label}](#wiki:${encodeURIComponent(target.trim())})`
  })
}

interface Props {
  content: string
  onWikiLink: (name: string) => void
}

/** 标准 GFM Markdown 渲染（表格 / 任务清单 / 删除线 / 代码高亮 / wikilink） */
const MarkdownView: React.FC<Props> = ({ content, onWikiLink }) => {
  const processed = useMemo(() => preprocess(content), [content])
  const outline = useMemo(() => parseOutline(content), [content])

  const heading =
    (Tag: 'h1' | 'h2' | 'h3' | 'h4') =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children }: any) => {
      const text = String(
        React.Children.map(children, (c) => (typeof c === 'string' || typeof c === 'number' ? c : ''))
          ?.join('') ?? ''
      )
      return <Tag id={headingSlug(text)}>{children}</Tag>
    }

  return (
    <div className="kb-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          h1: heading('h1'),
          h2: heading('h2'),
          h3: heading('h3'),
          h4: heading('h4'),
          a: ({ href, children, ...rest }) => {
            if (href?.startsWith('#wiki:')) {
              const target = decodeURIComponent(href.slice(6))
              return (
                <a
                  className="wikilink"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onWikiLink(target)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" {...rest}>
                {children}
              </a>
            )
          },
        }}
      >
        {processed}
      </ReactMarkdown>
      {outline.length > 0 && (
        <details className="kb-outline" open>
          <summary>大纲（{outline.length}）</summary>
          <ul>
            {outline.map((h, i) => (
              <li key={i} style={{ paddingLeft: (h.level - 1) * 14 }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export default MarkdownView
