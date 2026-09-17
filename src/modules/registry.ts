export interface ModuleMeta {
  id: string
  title: string
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
