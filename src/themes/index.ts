/**
 * 主题定义 · 宇界工作台
 *
 * 每个主题定义完整的 CSS 变量集（覆盖 :root）和 Ant Design ConfigProvider token。
 * 切换时 ThemeProvider 将变量注入 document.documentElement，ConfigProvider 同步 token。
 *
 * 结构：
 *   id          唯一标识（localStorage 存储用）
 *   label       用户可见名称
 *   colors      CSS 变量（:root）
 *   antToken    Ant Design ConfigProvider theme token
 *   preview     预览用小色块（用于切换器 UI）
 */
export interface Theme {
  id: string
  label: string
  colors: {
    /** 主色调（按钮/高亮/链接/选中态） */
    '--primary-color': string
    /** 侧栏背景 */
    '--sidebar-bg': string
    /** 侧栏文字色 */
    '--sidebar-text': string
    /** 侧栏激活项背景 */
    '--sidebar-active': string
    /** 侧栏 hover 背景 */
    '--sidebar-hover': string
    /** 面板背景 */
    '--panel-bg': string
    /** 面板边框 */
    '--panel-border': string
    /** 主内容区背景 */
    '--content-bg': string
    /** 工具条背景 */
    '--toolbar-bg': string
    /** 全局文字主色 */
    '--text-primary': string
    /** 全局文字次要 */
    '--text-secondary': string
    /** 全局文字禁用 */
    '--text-muted': string
  }
  antToken: {
    /** ConfigProvider colorPrimary */
    colorPrimary: string
    colorBgContainer: string
    colorBorder: string
    colorText: string
    colorTextSecondary: string
    /** Arco 规范：文本占位色 #86909C */
    colorTextTertiary?: string
    /** Arco 规范：分割线 #E5E6EB */
    colorSplit?: string
    /** Arco 规范：按钮/输入框圆角 6px */
    borderRadius?: number
    /** Arco 规范：正文 14px */
    fontSize?: number
  }
  preview: {
    sidebar: string
    primary: string
    content: string
  }
}

// ── 主题列表 ─────────────────────────────────────────────────────────────

export const THEMES: Theme[] = [
  {
    id: 'default',
    label: 'Arco 蓝',
    colors: {
      '--primary-color': '#165dff',
      '--sidebar-bg': '#ffffff',
      '--sidebar-text': '#4e5969',
      '--sidebar-active': '#f2f3f5',
      '--sidebar-hover': '#f2f3f5',
      '--panel-bg': '#ffffff',
      '--panel-border': '#e5e6eb',
      '--content-bg': '#f2f3f5',
      '--toolbar-bg': '#ffffff',
      '--text-primary': '#1d2129',
      '--text-secondary': '#4e5969',
      '--text-muted': '#86909c',
    },
    antToken: {
      colorPrimary: '#165dff',
      colorBgContainer: '#ffffff',
      colorBorder: '#e5e6eb',
      colorText: '#1d2129',
      colorTextSecondary: '#4e5969',
      colorTextTertiary: '#86909c',
      colorSplit: '#e5e6eb',
      borderRadius: 6,
      fontSize: 14,
    },
    preview: { sidebar: '#ffffff', primary: '#165dff', content: '#f2f3f5' },
  },
  {
    id: 'mint',
    label: '薄荷绿',
    colors: {
      '--primary-color': '#10b981',
      '--sidebar-bg': '#022c22',
      '--sidebar-text': 'rgba(255, 255, 255, 0.75)',
      '--sidebar-active': '#10b981',
      '--sidebar-hover': 'rgba(255, 255, 255, 0.08)',
      '--panel-bg': '#ffffff',
      '--panel-border': '#d1fae5',
      '--content-bg': '#f0fdf4',
      '--toolbar-bg': '#ffffff',
      '--text-primary': '#14532d',
      '--text-secondary': '#166534',
      '--text-muted': '#6b7280',
    },
    antToken: {
      colorPrimary: '#10b981',
      colorBgContainer: '#ffffff',
      colorBorder: '#d1fae5',
      colorText: '#14532d',
      colorTextSecondary: '#166534',
    },
    preview: { sidebar: '#022c22', primary: '#10b981', content: '#f0fdf4' },
  },
  {
    id: 'violet',
    label: '暮光紫',
    colors: {
      '--primary-color': '#7c3aed',
      '--sidebar-bg': '#1e1b4b',
      '--sidebar-text': 'rgba(255, 255, 255, 0.75)',
      '--sidebar-active': '#7c3aed',
      '--sidebar-hover': 'rgba(255, 255, 255, 0.08)',
      '--panel-bg': '#ffffff',
      '--panel-border': '#ede9fe',
      '--content-bg': '#f5f3ff',
      '--toolbar-bg': '#ffffff',
      '--text-primary': '#3b0764',
      '--text-secondary': '#5b21b6',
      '--text-muted': '#9ca3af',
    },
    antToken: {
      colorPrimary: '#7c3aed',
      colorBgContainer: '#ffffff',
      colorBorder: '#ede9fe',
      colorText: '#3b0764',
      colorTextSecondary: '#5b21b6',
    },
    preview: { sidebar: '#1e1b4b', primary: '#7c3aed', content: '#f5f3ff' },
  },
  {
    id: 'sunset',
    label: '暖阳橙',
    colors: {
      '--primary-color': '#f97316',
      '--sidebar-bg': '#431407',
      '--sidebar-text': 'rgba(255, 255, 255, 0.75)',
      '--sidebar-active': '#f97316',
      '--sidebar-hover': 'rgba(255, 255, 255, 0.08)',
      '--panel-bg': '#ffffff',
      '--panel-border': '#fed7aa',
      '--content-bg': '#fff7ed',
      '--toolbar-bg': '#ffffff',
      '--text-primary': '#7c2d12',
      '--text-secondary': '#9a3412',
      '--text-muted': '#9ca3af',
    },
    antToken: {
      colorPrimary: '#f97316',
      colorBgContainer: '#ffffff',
      colorBorder: '#fed7aa',
      colorText: '#7c2d12',
      colorTextSecondary: '#9a3412',
    },
    preview: { sidebar: '#431407', primary: '#f97316', content: '#fff7ed' },
  },
  {
    id: 'slate',
    label: '极客灰',
    colors: {
      '--primary-color': '#94a3b8',
      '--sidebar-bg': '#0f172a',
      '--sidebar-text': 'rgba(255, 255, 255, 0.6)',
      '--sidebar-active': '#475569',
      '--sidebar-hover': 'rgba(255, 255, 255, 0.06)',
      '--panel-bg': '#1e293b',
      '--panel-border': '#334155',
      '--content-bg': '#0f172a',
      '--toolbar-bg': '#1e293b',
      '--text-primary': '#e2e8f0',
      '--text-secondary': '#94a3b8',
      '--text-muted': '#64748b',
    },
    antToken: {
      colorPrimary: '#94a3b8',
      colorBgContainer: '#1e293b',
      colorBorder: '#334155',
      colorText: '#e2e8f0',
      colorTextSecondary: '#94a3b8',
    },
    preview: { sidebar: '#0f172a', primary: '#94a3b8', content: '#0f172a' },
  },
]

export const DEFAULT_THEME_ID = 'default'
export const THEME_STORAGE_KEY = 'mimo-ui-theme'

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
