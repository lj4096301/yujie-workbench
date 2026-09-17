# 页面改造计划（Phase Plan）

> 目标：全部页面统一收敛到 `DESIGN-SPEC.md`（Mi Console v3 风格：白底 / 主色 #ff6700 功能色 / 等宽数字 / 圆点状态 / 卡片 12px 圆角 / 间距 16px）+ `src/components/ui/` shadcn 组件库。
> 现状盘点（2026-09-18）：首页已完成主体改造；看板部分 shadcn 化；其余 13 个模块仍为 antd 旧样式；布局层为 Arco 通用组件。
> 记录：每次改造提交时在本文件对应项打 ✅，附提交号。

---

## 分层改造顺序

| 优先级 | 层 | 范围 | 状态 |
|---|---|---|---|
| **P0** | 布局壳 | Panel 窗口容器、TopBar 细节、Sidebar 徽标、TabBar 手机端 | ✅ 完成（247dfb4） |
| **P1** | 高频核心模块 | 看板 / 待办 / 日程 / 天气 / 日志 | ✅ 完成（54c4bf1 / 852fc93 / acf6926 / f343cdb / 822ce1b） |
| **P2** | 内容知识模块 | 知识库 / 剪贴板 / 书签 / 新闻 / 小说 | ✅ 完成（4aae4b0 / 7e3cb46 / cdbe2f7 / 77f9e15） |
| **P3** | 娱乐工具模块 | 免费游戏 / 追剧 / API 价格 / 流程图 / 思维导图 / 登录 | ✅ 完成（ddffdbf / 6d367f6 / c91f614 / d3c5ddc / a3c7280） |

---

## P0 布局壳

### 1. Panel 窗口容器（`src/components/Panel/`）
- [ ] 标题栏统一：白底、12px 圆角、浅灰分割线、标题 14px/600
- [ ] 关闭/折叠按钮统一为文字图标按钮（hover 浅灰底）
- [ ] 阴影收敛 `--shadow-card`，禁止多重厚重阴影
- [ ] 空态/加载态：骨架屏（Skeleton）优先，空态用图标 + 灰字

### 2. TopBar（`src/components/TopBar/`）
- [ ] 已验证：面包屑 + 搜索/通知/头像 + 侧栏展开按钮 ✅（`9382877`）
- [ ] 头像菜单、通知面板样式微调（圆角/阴影/间距）

### 3. Sidebar（`src/components/Sidebar/`）
- [ ] 已验证：Arco 通用组件 + 完全收入侧面 ✅（`9382877`）
- [ ] 低频模块徽标、hover 反馈检查

### 4. TabBar（`src/components/TabBar/`，手机端）
- [ ] 底部导航样式与 Mi Console 对齐；热区 ≥48vp

---

## P1 高频核心模块（优先）

### 5. 项目看板 `kanban`（720 行，已部分 shadcn）
- [x] 已完成：shadcn Dialog（操作记录）、Badge（计数）✅（`54c4bf1`）
- [x] 三列（待推进 / 进行中 / 待完成）卡片样式统一：白底、圆角、状态圆点 ✅（`54c4bf1`）
- [x] 列底固定投放区（完成 / 删除）→ 与卡片同视觉体系 ✅
- [x] 操作记录页 → **shadcn Table** + Tabs（切换全部/完成/删除）+ 圆点状态 + 等宽时间 ✅（`54c4bf1`）
- [x] 卡片创建/编辑表单 → shadcn Input / Textarea / Select / Button / Dialog（手写 state）✅
- [x] 剩余 antd 组件替换（Modal.confirm → 自制 ConfirmDialog；Tag → 圆点+文字）✅

### 6. 待办任务 `tasks`（197 行）
- [x] 新增/编辑表单 → shadcn Input + Select（优先级）+ 日期输入 + Button ✅（`852fc93`）
- [x] 列表项：shadcn Checkbox（新增组件）+ 完成划线 + 优先级圆点 ✅
- [x] 筛选（全部/进行中/已完成）→ shadcn Tabs ✅
- [x] 新增 `src/components/ui/checkbox.tsx`（Radix Checkbox）✅

### 7. 日程管理 `calendar`（384 行）
- [x] 事件列表/周视图卡片化（白底、12px 圆角、浅灰分割线）✅（`acf6926`）
- [x] 新增/编辑日程 → shadcn Dialog + Input/Textarea/Label + 颜色选择（RangePicker 内核保留）✅
- [x] 月历/周历控件保留成熟实现，只统一外壳 ✅
- [x] 工具栏按钮 → shadcn Button（outline 导航 / default 当前视图）✅

### 8. 天气预报 `weather`（591 行）
- [x] 大卡（温度/指标/逐时）统一：白底卡片、等宽数字、AQI 圆点 ✅（`f343cdb`）
- [x] 城市标签 → 主色橙（active #fff3e8 底 + 主色字）；搜索 Select 保留成熟内核 ✅
- [x] 24小时/7天/生活指数 → 白底卡片 + 首项主色描边；出行建议主色左条 ✅
- [x] 加载 → Skeleton 骨架屏；错误条自绘 ✅

### 9. 日志管理 `logs`（198 行，新模块）
- [x] 操作记录表格 → **shadcn Table**（表头浅灰、hover 高亮、无斑马纹）✅（`822ce1b`）
- [x] 来源筛选 → shadcn Tabs（全部操作 / 项目完成）✅
- [x] 分页手写（右下角、共 N 条、切换筛选重置页码）✅

---

## P2 内容知识模块

### 10. 知识库 `knowledge`（861 行）
- [x] 列表/目录卡片化；标签 Tag → Badge outline（主色文字）✅（`4aae4b0`）
- [x] 编辑器保留 CodeMirror；外壳（工具栏/保存）→ shadcn Button ✅
- [x] 新建/重命名/Quick Switcher Modal → shadcn Dialog；删除 Modal.confirm → 通用 ConfirmDialog ✅
- [x] 全局搜索入口样式统一（左栏工具条 h-8）✅

### 11. 剪贴板 `clipboard`（119 行）
- [x] 列表项卡片化；来源 Tag → 5px 圆点+光环 ✅（`7e3cb46`）
- [x] 复制反馈 message；清空确认 → 通用 ConfirmDialog ✅
- [x] 工具条（搜索限宽 320 / 捕获 / 清空）入面板顶部 ✅

### 12. 书签启动 `bookmarks`（430 行）
- [x] 新增/编辑表单 Modal → shadcn Dialog + Label + Input ✅（`cdbe2f7`）
- [x] 书签卡片统一（mod-row，图标/标题/描述，hover 反馈）✅
- [x] 删除 Popconfirm → 通用 ConfirmDialog；导入弹窗 Dialog + antd Tree 内核保留 ✅

### 13. 新闻聚合 `news`（157 行）
- [x] RSS 源切换 Dropdown → shadcn Tabs（横向滚动）✅（`7e3cb46`）
- [x] 内嵌 iframe 保留（成熟站点嵌入），外壳统一（加载态/打开按钮）✅

### 14. 小说创作 `novel`（868 行）
- [x] 章节树 + 编辑器（Textarea 化）；工具栏 → shadcn Button/Input ✅（`77f9e15`）
- [x] 新建/导入表单 → Dialog（手写 state + 校验）✅
- [x] 4 处 Popconfirm → 统一 ConfirmDialog；状态 Tag → 圆点；进度条自绘 ✅

---

## P3 娱乐工具模块

### 15. 免费游戏 `epic-games`（228 行）
- [x] 卡片网格统一（白底、圆角 12、hover 抬起）；状态 Tag → 圆点+光环；骨架屏 ✅（`ddffdbf`）

### 16. 追剧管理 `tv-tracker`（387 行）
- [x] 剧集卡片 + 自绘进度条 + 圆点状态；Modal 表单 → Dialog；Popconfirm → ConfirmDialog ✅（`6d367f6`）

### 17. API 价格 `api-monitor`（578 行）
- [x] 价格表格 → **shadcn Table**（保留排序/最优/变动逻辑）；平台多选 → Dialog+Checkbox；Modal → Dialog ✅（`c91f614`）

### 18. 流程图 `flowchart` / 思维导图 `mindmap`
- [x] 画布内核保留 ReactFlow / MindElixir 成熟库；外壳（导出菜单/导入/清空/撤销重做）统一为 shadcn ✅（`d3c5ddc`）
- [x] 右键菜单（mindmap 定位修正已保留）、导出下拉 → shadcn Select ✅

### 19. 登录页 `login`（120 行）
- [x] 表单 → shadcn Input + Button + Label；卡片居中白底圆角；错误提示自绘 ✅（`a3c7280`）

---

## 存量 antd 清理（P0–P3 完成后逐模块收尾）

> 目标：全站 UI 外壳收敛到 shadcn + Mi Console Token；**合理保留**——`message` 轻提示（16 模块）、`Rate` 评分内核（tv-tracker）、`Tree` 文件树内核（bookmarks/knowledge 导入）、`Dropdown` 右键菜单（knowledge）、`DatePicker.RangePicker`（calendar 日期选择，宽已修）。

| 模块 | 清理内容 | 提交 |
|---|---|---|
| kanban | Segmented→Tabs；Tooltip→title；Popconfirm×3→ConfirmDialog；ConfigProvider 移除；根节点 Fragment 化 | `09a926f` |
| logs | 清空/删单条 Popconfirm→ConfirmDialog（delRec state） | `aee7ffb` |
| weather | 可搜索 Select（城市）→ Button+Dialog+Input 防抖搜索+结果列表；添加后自动关弹窗 | `2eae8d1` |
| news/RssPanel | Select→shadcn；Spin→列表骨架；按钮 Token 化；错误/空态用规范色 | `7c3bc8f` |
| news/legacy | Input/Select/Button→shadcn；Tag→文字小标；未读点→5px 圆点+光环；Star→lucide；Popconfirm→ConfirmDialog；Empty→.mod-empty | `7c3bc8f` |
| knowledge/GraphView | Empty→.mod-empty；Spin→骨架屏；AimOutlined→Maximize2 | `e09e78f` |

> 换行符经验：kanban/logs/legacy 为 CRLF 文件，patch 脚本须用 `NL()` 转换；RssPanel/GraphView/weather 为 LF，用原串。动手前先 diag（`s.includes('\r\n')`）。

---

## 组件库补充（按需，`src/components/ui/`）

| 组件 | 依赖 | 用于 |
|---|---|---|
| Checkbox | Radix | 待办/清单勾选；api-monitor 平台多选（已用） |
| ConfirmDialog | 纯 HTML + Dialog | 全局删除/清空二次确认（已用，420px，danger 红色） |
| Switch | Radix | 设置开关 |
| Tooltip | Radix | 图标按钮提示 |
| Popover | Radix | 轻量浮层 |
| Separator | 纯 HTML | 分组分割 |
| Avatar | 纯 HTML | 用户头像（TopBar） |
| Calendar（日期选择） | Radix | 日程表单 |
| DropdownMenu | Radix | 右键菜单/更多操作 |
| Toast/Sonner | 独立 | 复制/保存反馈 |

> 约定：按 shadcn 源码手动复制进 `src/components/ui/`；交互组件按需引入 Radix 原语；装依赖后必须重启 vite dev server。

---

## 每轮验收标准

1. `tsc -p tsconfig.json` 零错误
2. CDP 9222 DOM 断言（关键布局/组件渲染/交互）
3. 三端视口：桌面 1440 / 平板 768 / 手机 480（Emulation.setDeviceMetricsOverride）
4. 视觉对齐 DESIGN-SPEC Token（白底/主色功能色/等宽数字/圆点状态/圆角/阴影/动画 150–200ms）
5. git 提交（中文分点信息），不删历史

## 已知风险

- 改依赖后白屏 → 重启 vite（已入 DESIGN-SPEC）
- 部分文件 CRLF / LF 混合 → 补丁脚本先检测换行符
- 成熟库内核（CodeMirror / 画布）只改外壳不动内核
- 每模块改造独立提交，便于回滚
