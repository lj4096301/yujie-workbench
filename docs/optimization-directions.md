# 宇界工作台 · 优化方向梳理

> 2026-09-15 · 基于对代码库的完整盘点

## 一、现状画像

| 维度 | 现状 |
|---|---|
| 技术栈 | Electron 30 + React 18 + Vite 5 + Express + pnpm，antd 5 |
| 模块数 | 11 个（knowledge / novel / calendar / weather / epic / news / tv / api-monitor / bookmarks / tasks / clipboard） |
| 架构 | 模块注册表（`src/modules/registry.ts`）单一事实源 → Sidebar / Layout / layoutStore 自动同步；模块组件 + 服务端路由一一对应 |
| 数据层 | 服务端路由读写 `data/*.json`（`paths.ts` 已支持便携版 `WORKBENCH_DATA_DIR`），tasks 用 localStorage |
| 持久化 | JSON 文件为主，`better-sqlite3` 已安装但未启用 |
| 代码质量 | `tsc -p tsconfig.json` 通过；近期已清理依赖与僵尸进程 |

## 二、今日已完成（整理 + 修复）

- 根目录临时文件、重复截图、脚手架残留、零引用孤儿文件清理
- `release/win-unpacked`（346MB）清理，node_modules 1,038MB → 583MB
- 实验残留依赖（react-kanban-kit / @atlaskit / ag-grid / xlsx）清除
- 修复 `server/index.ts` 缺失 `import fs` 的潜在运行时 bug
- 移除表格页（spreadsheet）模块及其 5 处引用，WIP 备份至 `.backup/spreadsheet-module-20260915/`
- README 过时标题说明更新

## 三、优化方向路线图

### P0 · 功能增强（本期）
- **项目看板（新模块）**：记录 2 个项目的优化方向与内容，三态流转（待推进 → 进行中 → 已完成），拖拽改状态
- **轻待办**：沿用现有 tasks 模块（勾选完成、优先级、截止日期），做存储键迁移与一致性微调

### P1 · 架构一致性
- **路由统一走 `paths.ts`**：tv / news / weather / epic 等路由仍用硬编码 `__dirname/../../../data/`，打包后路径不可靠，应全部迁移到 `dataFile()`
- **news/legacy.tsx 清理**：历史遗留页面，确认无引用后移除
- **存储键去 MiMo 化**：tasks 的 `mimo-tasks` 键迁移为 `yujie-tasks`（带数据迁移）
- **数据层决策**：JSON 文件适合当前规模，若模块增多建议评估统一迁到 SQLite（原子写、可查询、防并发），或至少引入原子写（写临时文件 + rename）

### P2 · 体验与发布
- 全局搜索（GlobalSearch）覆盖新模块（看板卡片、待办）
- README 模块表与 registry 自动对齐（防止再次漂移）
- 打包链路：`dist:nsis` 安装包、图标、发布说明流程化
- 数据备份：一键导出 `data/` 或定时快照

### 运维
- `scripts/dev.ps1` 启动前先清理同端口旧进程，防止重复启动堆僵尸（本次已清 20 个）
- 依赖纪律：新增依赖必须写入 package.json，勿临时安装后忘记声明（本次清理的 ag-grid / kanban-kit 即为此类）

## 四、看板 + 待办模块设计（本期实现）

### 4.1 数据模型（data/kanban.json）

```json
{
  "projects": [
    { "id": "p1", "name": "项目A" },
    { "id": "p2", "name": "项目B" }
  ],
  "cards": [
    {
      "id": "kb-xxx",
      "projectId": "p1",
      "title": "优化方向标题",
      "content": "优化内容说明",
      "status": "todo | doing | done",
      "priority": "low | mid | high",
      "createdAt": 0,
      "updatedAt": 0
    }
  ]
}
```

状态：`todo`（待推进）/ `doing`（进行中）/ `done`（已完成），三列固定。

### 4.2 服务端接口（/api/kanban）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/kanban` | 读取全量状态（首次自动建默认文件） |
| POST | `/api/kanban/state` | 全量保存（单用户本地应用，全量写最不易出错） |

### 4.3 前端结构（src/modules/kanban/）

- 顶部：项目筛选（全部 / 项目A / 项目B）+ 项目改名入口 + 新建卡片
- 看板：三列（待推进 / 进行中 / 已完成），卡片拖拽换列即改状态
- 卡片：标题 + 内容预览 + 优先级标签 + 项目标签 + 更新时间；点击编辑，支持删除
- 拖拽：原生 HTML5 DnD（零新依赖，Electron 内 Chromium 原生支持）

### 4.4 待办（tasks）

保留现有 localStorage + 勾选完成模型；仅迁移存储键 `mimo-tasks → yujie-tasks`（自动搬移旧数据），不做结构性改动。
