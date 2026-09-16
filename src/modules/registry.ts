/**
 * 模块元数据单一来源（Single Source of Truth）。
 *
 * 新增/改名/调整顺序只改这里，以下位置自动同步：
 * - Sidebar 左侧导航（icon + label）
 * - layoutStore 面板定义与 MODULE_ORDER（首页 chips / 网格排布顺序）
 * - Layout MODULE_MAP（面板标题 + 图标渲染）
 *
 * 注意：本文件只放纯数据，禁止 import 组件或 store，避免循环依赖。
 */
export interface ModuleMeta {
  /** 面板 id（同时是 moduleId / panel id） */
  id: string
  /** 模块标题（纯文字，图标由 icon 字段单独渲染） */
  title: string
  /** 模块图标（emoji） */
  icon: string
}

export const MODULE_META: ModuleMeta[] = [
  { id: 'knowledge', title: '知识库', icon: '📚' },
  { id: 'novel', title: '小说创作', icon: '✍️' },
  { id: 'calendar', title: '日程管理', icon: '📅' },
  { id: 'weather', title: '天气预报', icon: '🌤️' },
  { id: 'epic', title: '免费游戏', icon: '🎮' },
  { id: 'news', title: '新闻聚合', icon: '📰' },
  { id: 'tv', title: '追剧管理', icon: '📺' },
  { id: 'api-monitor', title: 'API 价格', icon: '📊' },
  { id: 'bookmarks', title: '书签启动', icon: '🔖' },
  { id: 'kanban', title: '项目看板', icon: '🎯' },
  { id: 'tasks', title: '待办任务', icon: '✅' },
  { id: 'clipboard', title: '剪贴板', icon: '📋' },
  { id: 'flowchart', title: '流程图', icon: '📐' },
  { id: 'mindmap', title: '思维导图', icon: '🧠' },

]
