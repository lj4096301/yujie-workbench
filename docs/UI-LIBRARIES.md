# 开源 UI 组件库候选清单（想用就用）

> 集成原则：**大厂界面只抄设计思路；开源库代码可以合法复用**（MIT/Apache 协议）。
> 本清单为候选池，使用时**优先与 Mi Console 橙 Token 体系对齐**（见 `DESIGN-SPEC.md`）。
> 记录时间：2026-09-17

## 候选库总览

| 库 | 风格 | 许可证 | 依赖 | 适用场景 | 评估 |
|---|---|---|---|---|---|
| ~~**Tremor**~~ | dashboard 专用（Card/Metric/Badge/Chart） | Apache 2.0 | **要求 Tailwind v4** | 首页 KPI/指标/图表卡片 | ❌ 弃用：Tailwind v4 硬门槛，项目 v3.4 不兼容 |
| **shadcn/ui** | 现代简约（Vercel/Linear 风） | MIT | Tailwind v3/v4 + Radix + CVA | 通用组件、可复制进项目、完全可控 | ✅ 已集成（见下） |
| **CoreUI React** | 中后台模板 | MIT | 独立 | 后台管理页 | 备选 |
| **MUI (Material)** | Material Design | MIT | 独立 | 企业级表单/表格 | 备选，体积大 |
| **TailAdmin** | 后台模板（500+ 组件） | MIT | Tailwind | 后台完整模板 | 备选，模板型 |
| **HeroUI (NextUI)** | 现代漂亮 | MIT | Tailwind + React Aria | 通用组件 | 备选 |
| **Mantine** | 组件全、hooks 多 | MIT | 独立 | 通用组件/表单 | 备选 |
| **React Suite** | 中后台 | MIT | 独立 | 后台 | 备选 |
| **PrimeReact** | 老牌全面 | MIT | 独立 | 企业应用 | 备选 |
| **Flowbite React** | Tailwind 组件 | MIT | Tailwind | 通用组件 | 备选 |
| **Novix UI** | Vercel/Linear/Stripe 风 | MIT | Tailwind v4 + Radix + Motion | 新潮仪表盘 | 备选（较新） |

> 已在使用：antd 5（内容层）、Arco Design（布局层）——继续保留，新库做补充。

## 已集成：shadcn/ui（Card 试水 ✅）

- 组件（`src/components/ui/`，MIT，Tailwind 类）：
  - `card.tsx`：Card 系列（纯 Tailwind）
  - `button.tsx`：Button（5 variant × 4 size；CVA + Radix Slot）
  - `badge.tsx`：Badge（4 variant；CVA）
  - `input.tsx` / `textarea.tsx`：输入框 / 多行文本域（纯 Tailwind，圆角 6px、focus 主色环）
  - `label.tsx`：表单标签（纯 HTML label）
  - `skeleton.tsx`：骨架屏（加载占位）
  - `dialog.tsx`：弹窗（Radix Dialog，圆角 8px、z-[60]、浮层阴影；需 @radix-ui/react-dialog）
  - `select.tsx`：下拉选择（Radix Select，浮层 z-[60]、选中主色勾选；需 @radix-ui/react-select）
  - `table.tsx`：表格（纯 HTML，表头浅灰 bg-muted、hover 行高亮、隔行无斑马纹、分页放右下角）
  - `tabs.tsx`：标签页（Radix Tabs，选中态主色下划线 + 白底、圆角 6px；需 @radix-ui/react-tabs）
  - `checkbox.tsx`：勾选（Radix Checkbox；待办勾选、api-monitor 平台多选）
  - `confirm-dialog.tsx`：删除/清空二次确认（420px Dialog 封装；okText/danger 红色、取消 outline；onOk 先关后执行；覆盖看板/日志/小说/知识库/追剧/API 监控/流程图/思维导图）
- 工具：`cn()`（clsx + tailwind-merge）；图标：lucide-react 已装（按需引入）
- 配置：`tailwind.config.js` 已映射 card/border/input/muted/rounded-xl/shadow-sm 到 DESIGN-SPEC Token（白底 / #E5E6EB 边框 / 12px 圆角 / 极轻阴影）；primary 收敛为 #ff6700
- 试水（已实测通过）：首页 KPI 行 4 张 shadcn Card；banner「模块管理」与空态「恢复默认布局」按钮用 shadcn Button；看板「记录」计数用 shadcn Badge；首页 KPI 加载骨架屏（Skeleton）；看板「操作记录」弹窗用 shadcn Dialog
- 约定：按 shadcn 源码手动复制进 `src/components/ui/`（不跑 CLI，避免生成式污染）；交互组件（Popover/Select 等）按需引入对应 Radix 原语；所有组件视觉必须收敛 DESIGN-SPEC Token
- ⚠️ 工程坑：装/卸 npm 包后必须重启 vite dev server（依赖预构建失效会导致 Electron 白屏，无报错）

## 已尝试弃用：Tremor

- 包：`@tremor/react` 3.18.7（Apache 2.0）+ recharts
- **弃用原因（技术硬伤，非偏好）**：官方安装文档明确 Tremor Raw 3.x 要求 Tailwind CSS v4.0+（https://www.tremor.so/docs/getting-started/installation）；项目为 Tailwind v3.4（antd/Arco 共存、preflight 关闭），升级 v4 属破坏性变更 → 放弃
- 附带教训：`better-sqlite3` 为无引用遗留 devDep，其原生构建在本机必失败（prebuild 下载失败 + 缺 VS Build Tools），阻塞一切 pnpm 变更 → 已从 devDependencies 移除

## 已评估弃用：CopilotKit（AI 助手）

- 仓库：https://github.com/CopilotKit/CopilotKit（MIT，React AI 助手组件套件）
- **决策：❌ 不引入全套运行时，UI 能力由自研实现（`src/modules/ai-assistant/`）覆盖**
- 评估理由：
  1. CopilotKit 是框架级运行时（hooks/上下文/状态机深度绑定），"剥离对话渲染组件"实际需连带整套运行时，成本高于自研
  2. 其核心价值在**工具调用编排**（对接 OpenClaw Agent），当前工作台无此后端；纯对话场景与自研流式实现能力重合
  3. 自研方案已覆盖清单中可复用的 UI 面：流式打字（SSE 增量渲染）、对话气泡（用户/助手）、消息历史（localStorage 最近 40 条）、停止生成（AbortController）、清空二次确认（ConfirmDialog）
- 后端：`src/server/routes/ai.ts`（POST /api/ai/chat，OpenAI 兼容 SSE 代理，system prompt 后端注入，120s 超时）；凭据 `.env` 三件套 `AI_BASE_URL / AI_API_KEY / AI_MODEL`
- 若未来接入工具调用（Agent 模式），再评估 CopilotKit 或自研工具调用 UI，届时单独记录


## 集成/使用纪律

1. 新组件库引入前：确认许可证（MIT/Apache 优先）→ 记录到本清单 → 小范围试用 → 验收后才铺开
2. 使用新库的组件必须过三端（桌面 1440 / 平板 768 / 手机 480）+ tsc
3. 不引入与现有 antd/Arco 功能重复且无增量价值的库（控制体积）
4. 视觉一律收敛到 `DESIGN-SPEC.md` Token（橙色主色/等宽数字/圆点状态/白底）
