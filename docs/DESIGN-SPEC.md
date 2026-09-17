# 宇界工作台 · 设计规范（Mi Console v3 基调）

> 本文件是**全项目唯一设计权威**。任何界面改动、新模块开发必须遵循本规范；
> 与旧代码冲突时，**以本规范为准**，旧代码应向本规范收敛。
> 版本：v1（2026-09-17 三端骨架落地后固化）· 对应 commit `81b48cb`

---

## 1. 设计基调

| 原则 | 说明 |
|---|---|
| 主色 = 功能色 | 小米橙 `#FF6700` 仅用于链接/选中态/CTA/激活 Tab，**禁止大面积铺色** |
| 白底主线 | 页面背景白，次级容器 `#F7F8FA`，禁止高饱和彩色背景 |
| 系统字体 | MiSans / HarmonyOS Sans 优先，fallback 系统无衬线 |
| 等宽数字 | **所有数字与 ID 强制等宽**（时间/计数/温度/进度/ID），`font-variant-numeric: tabular-nums` |
| 状态 = 圆点 | 状态一律用 **5px 圆点 + 4px 光环**，**禁止色块 chip** |
| 极简阴影 | 卡片 `0 1px 2px`，浮层 `0 8px 24px`，禁止多重厚重阴影 |
| 安静动效 | 过渡 150–200ms，禁止花哨动画 |

---

## 2. Design Tokens

### 2.1 色彩（`src/styles/design-tokens.css` 为唯一来源）

| Token | 值 | 用途 |
|---|---|---|
| `--primary-color` | `#FF6700` | 主色（功能色） |
| `--primary-hover` | `#FF7A2E` | hover |
| `--primary-active` | `#E85C00` | 按下 |
| `--primary-subtle` | `rgba(255,103,0,0.08)` | 选中背景/光环底 |
| `--success` | `#00B42A` | 状态·成功 |
| `--warning` | `#FF7D00` | 状态·警告 |
| `--error` | `#F53F3F` | 状态·危险/删除 |
| `--text-primary` | `#1F2329` | 主文本 |
| `--text-secondary` | `#4E5969` | 次级文本 |
| `--text-muted` | `#86909C` | 占位/辅助 |
| `--border` | `#E5E6EB` | 分割线 |
| `--bg-page` | `#FFFFFF` | 页面背景（白底主线） |
| `--bg-subtle` | `#F7F8FA` | 次级容器 |
| `--bg-hover` | `rgba(0,0,0,0.04)` | hover 底 |
| `--sidebar-active-text` | `#FF6700` | 侧栏选中文字 |

**规则**：禁止硬编码 `#165dff`（旧蓝）与新色混用；发现即替换为 Token。

### 2.2 字体

| Token | 值 |
|---|---|
| `--font-ui` | `MiSans, "HarmonyOS Sans SC", system 无衬线栈` |
| `--font-num` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`（**数字/ID 专用**） |
| 字号 | 12（辅助）/ 14（正文）/ 16 / 18（标题）/ 20 / 24 |

### 2.3 间距 / 圆角 / 阴影

| Token | 值 |
|---|---|
| 间距 | 4 / 8 / 12 / 16 / 24 |
| 卡片圆角 | `12px`（`--radius-lg`） |
| 控件圆角 | `8px`（`--radius-md`） |
| 胶囊 | `999px`（搜索框/Tag） |
| 卡片阴影 | `0 1px 2px rgba(0,0,0,0.04)` |
| 浮层阴影 | `0 8px 24px rgba(0,0,0,0.10)` |

### 2.4 z-index 七档

| 档 | 值 | 归属 |
|---|---|---|
| base | 0 | 页面内容 |
| sticky | 10 | 顶栏/底部 Tab/吸顶 |
| dropdown | 20 | 菜单/Tooltip/右键菜单 |
| panel | 30 | 侧滑面板 |
| overlay | 40 | 遮罩 |
| **dialog** | **60** | 居中 Modal/命令面板 |
| **toast** | **100** | Toast |

### 2.5 热区

| 端 | 最小热区 |
|---|---|
| 触控（手机/平板） | **48vp × 48vp**（按钮/Tab/列表项/圆点开关） |
| 桌面 | 32px；列表行高 40–44px |

### 2.6 栅格

| 端 | 栅格 | 主内容 |
|---|---|---|
| 桌面 ≥840dp | 12/16 栅格 | ≤1440px 居中，卡片间距 12px |
| 平板 600–840dp | 两栏（侧栏+内容） | 内容流自适应 |
| 手机 <600dp | 单栏 | 满宽 + 16px 页边距 |

---

## 3. 断点体系（禁止发明新值）

| 类型 | 断点 | 作用 |
|---|---|---|
| **结构断点** | `600px` / `840px` | 决定布局骨架（单栏/两栏/展开） |
| **密度断点** | `768px` / `1024px` / `1280px` | **只调间距、字号、卡片密度**，不动骨架 |

---

## 4. 三端布局

| 宽度 | 骨架 | 导航 | 首页网格 |
|---|---|---|---|
| ≥840dp | 侧栏 240px 常驻 + 主内容 ≤1440px 居中（可三栏） | 左侧栏 | KPI 4列 / 工具 2:2:1:1 / 更多 6列 |
| 600–839px | 侧栏 240–280px（可折叠 56px 图标条）+ 两栏 | 左侧栏 | KPI 2列 / 工具 2列 / 更多 3列 |
| <600px | 单栏 + 底部留白 56px | **底部 Tab**（首页/模块/搜索/通知/我的） | KPI 2列 / 工具 1列 / 更多 2列 |

- 平板弹窗：居中 Modal 或推挤面板，**不用底部抽屉**
- 手机模块入口：Tab「模块」→ 宫格弹层（4 列）

---

## 5. 组件状态

| 状态 | 触控端 | 桌面端 |
|---|---|---|
| 默认 | ✅ | ✅ |
| hover | — | ✅ |
| focus-visible | ✅ | ✅ |
| 按下 | ✅ | ✅ |
| 禁用 | ✅ | ✅ |
| 右键菜单态 | 长按 | ✅（右键） |

---

## 6. 交互规范

### 桌面（键盘为主）
- `Ctrl/Cmd + K` 命令面板（z-60）、`/` 快速搜索、`Esc` 关闭、Tab 焦点循环
- 所有可交互元素必须有 hover + focus-visible
- 列表项/卡片支持右键菜单（z-20）

### 触控
- 全部热区 ≥48vp；组件状态只保留 默认/按下/禁用
- 拖拽类操作使用**长按拖动**（pointer events），禁止依赖 HTML5 drag（触摸不可用）

---

## 7. 组件库约定

- 现状：布局层用 Arco（Sidebar/TopBar/Menu/Modal），内容层混用 antd（Table/Form/Tag）
- **视觉统一到本规范 Token**：Arco 原生选中态已被 CSS 覆盖为橙色（`components.css` 中 `.sidebar-menu .arco-menu-selected` 等）
- 新代码：能用 Token 变量不用硬编码值；antd 主色经 `ConfigProvider`（`themes/index.ts` default 主题 = 小米橙）
- **UI 原语默认 shadcn/ui**（`src/components/ui/`，MIT，Tailwind v3 兼容）：已集成 Card 系列并用于首页 KPI 卡；Button/Badge 等按需从 shadcn 源码手动复制，交互组件按需引入 Radix 原语。候选池见 `UI-LIBRARIES.md`
- **Tremor 已弃用**：v3 要求 Tailwind v4（官方文档确认），项目 v3.4 不兼容；不重装
- **工程坑（重要）**：装/卸 npm 包后必须重启 vite dev server，否则依赖预构建失效 → Electron 白屏且无报错；better-sqlite3 已移除（无引用遗留 devDep，原生构建必失败阻塞 pnpm）

---

## 8. 新模块开发 Checklist（必须全部满足）

- [ ] 注册链路完整：`src/modules/registry.ts`（MODULE_META）→ `Layout/index.tsx`（MODULE_COMPONENTS）→ 低频组加入 `layoutStore.ts` 的 `EXTRA_MODULE_IDS`
- [ ] 导航入口：低频模块进侧栏「更多功能」+ 手机 Tab「模块」宫格（自动继承）
- [ ] 标题栏一层结构（**所有模块统一一层标题，不要二级标题层**——用户多次强调）
- [ ] 用 Token：主色 `var(--primary-color)`、圆角/阴影/间距走变量，禁止 `#165dff`
- [ ] 数字与 ID 用 `.num-mono` / `var(--font-num)` + `tabular-nums`
- [ ] 状态用 5px 圆点 + 光环（参考 `.wo-status-*` / `.kb-dot`），禁止 chip
- [ ] 三端可用：桌面 1440 居中、平板两栏、手机底部 Tab 可到达、热区 ≥48vp（触控）
- [ ] 弹窗居中 Modal（触控端不用底部抽屉）
- [ ] 持久化走 `persist()` / 服务端路由；数据文件在 `data/`
- [ ] 验证：`tsc` + CDP 9222 DOM 断言通过后才能提交

---

## 9. 工程约定（Windows 环境）

| 项 | 约定 |
|---|---|
| 行尾 | 源码 CRLF，**禁止用 Edit 直改**；用 UTF-8 node `.cjs` 补丁（锚点含 `\r\n` 或单行锚点） |
| 补丁写法 | PowerShell `[IO.File]::WriteAllText(脚本路径, $script, UTF8无BOM)` + `& node 脚本` |
| 类型检查 | `node node_modules/typescript/bin/tsc -p tsconfig.json` |
| 运行时验证 | CDP `http://localhost:9222` 写 node 脚本驱动 DOM 断言（虚拟桌面截图不可用） |
| 端口 | 后端 3001 / vite 5173 / 调试 9222；多实例会 EADDRINUSE |
| git | 每完成一个需求即提交；**git 历史不删除**（用户要求）；否决方案用 `git revert` 保留记录 |
| node | `C:\nvm4w\nodejs\node.exe` |

---

## 10. 历史决策记录（防重蹈覆辙）

| 决策 | 结论 | 依据 |
|---|---|---|
| 平板适配 | **否决**"桌面压缩适配"（≤768px 隐藏侧栏+TabBar），已 revert `cf92288` | 用户："你理解错了，恢复一下" |
| 三端方案 | **采纳** Mi Console v3：结构断点 600/840、密度 768/1024/1280，骨架先行 | 用户确认三点 |
| 主色 | Arco 蓝 `#165dff` → 小米橙 `#FF6700`（default 主题 = 小米橙） | 用户："都按一个标准来" |
| 看板完成语义 | 拖入已完成区 = 标记完成 + **移出看板** + 归档（第三列名「待完成」） | 用户逻辑调整 |
| 看板投放区 | **三区**：无操作区 / 已完成 / 删除（拖入需二次确认） | 用户纠正"不是两个区，是3个" |
| 缩放上限 | 界面缩放限制 **125%**（曾误放大 160% 调不回） | 用户要求 |
| 模块标题 | 所有模块**一层标题**（曾多层被否） | 用户多次强调 |
| 流程图画布 | 当前保留自研方案；draw.io 嵌入式被否（"先保留"） | 用户 |
| 首页卡片 | 独立设计卡片，**不是窗口缩小化**；点击详情才进大窗口 | 用户 |
| 左侧栏 | 低频导航收进「更多功能」；删主题切换按钮、删搜索入口 | 用户 |
| 日志来源色 | Tag 用显式 inline 配色（橙 `#FF6700`/`#FFF3E8`/`#FFC8A8`） | antd 色名不识别修复 |
| Tremor | **弃用**：v3.18.7 要求 Tailwind v4，项目 v3.4 不兼容（官方文档确认） | 技术硬伤 |
| shadcn/ui | **采纳**为 UI 原语库：Card 系列入 `src/components/ui/`，首页 KPI 卡试用通过 | 用户："先集成一个试一试" |

---

## 11. Token 落地映射（改动时同步更新）

| 文件 | 承载 |
|---|---|
| `src/styles/design-tokens.css` | 全部 Token 变量（色彩/字体/间距/圆角/阴影/z-index/圆点） |
| `src/themes/index.ts` | default 主题 = 小米橙（antd ConfigProvider） |
| `src/styles/components.css` | Sidebar/TopBar/TabBar/Arco 选中态覆盖 |
| `src/styles/index.css` | 断点体系、`1440px 居中`、`<600px` 手机布局 |
| `src/components/home/home.css` | 首页三端网格 + 等宽数字 + 状态圆点 |
| `src/modules/kanban/kanban.css` | `.kb-dot` 5px+光环 |
| `src/components/TabBar/index.tsx` | 手机底部 Tab（首页/模块/搜索/通知/我的） |

---

## 12. 待实现（规范已定义，代码未做）

- [ ] 看板**长按拖动**（pointer events，触控可用）——用户已选
- [ ] 桌面**三栏**右侧辅助栏（≥1280px：天气/通知/属性）
- [ ] `Ctrl/Cmd+K` 命令面板 + `/` 快速搜索 + Esc + Tab 焦点循环
- [ ] 列表/卡片**右键菜单**（桌面）
- [ ] 首页各模块**固定尺寸卡片**设计（参考成熟工作台，非窗口缩小化）
- [x] 组件库试集成：shadcn/ui Card（首页 KPI 卡），候选池见 `UI-LIBRARIES.md`
- [ ] 组件库扩展：Button/Badge/统计卡等按需复制 shadcn 组件（Token 对齐）
