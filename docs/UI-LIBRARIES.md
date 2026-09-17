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

- 组件：`Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter`（`src/components/ui/card.tsx`，MIT，纯 Tailwind 类，零额外依赖）
- 工具：`cn()`（`src/lib/utils.ts`，clsx + tailwind-merge）
- 配置：`tailwind.config.js` 已映射 card/border/input/muted/rounded-xl/shadow-sm 到 DESIGN-SPEC Token（白底 / #E5E6EB 边框 / 12px 圆角 / 极轻阴影）；primary 收敛为 #ff6700
- 试水：首页 KPI 行（`kpiRow.tsx`）4 张卡改用 shadcn Card，CDP 实测通过（12px 圆角、等宽 26px 数字、真实数据渲染）
- 扩展：需要 Button/Badge/Dialog 等再按 shadcn 源码手动复制进 `src/components/ui/`（不跑 CLI，避免生成式污染）；交互组件（Popover/Select 等）再按需引入对应 Radix 原语
- ⚠️ 工程坑：装/卸 npm 包后必须重启 vite dev server（依赖预构建失效会导致 Electron 白屏，无报错）

## 已尝试弃用：Tremor

- 包：`@tremor/react` 3.18.7（Apache 2.0）+ recharts
- **弃用原因（技术硬伤，非偏好）**：官方安装文档明确 Tremor Raw 3.x 要求 Tailwind CSS v4.0+（https://www.tremor.so/docs/getting-started/installation）；项目为 Tailwind v3.4（antd/Arco 共存、preflight 关闭），升级 v4 属破坏性变更 → 放弃
- 附带教训：`better-sqlite3` 为无引用遗留 devDep，其原生构建在本机必失败（prebuild 下载失败 + 缺 VS Build Tools），阻塞一切 pnpm 变更 → 已从 devDependencies 移除

## 集成/使用纪律

1. 新组件库引入前：确认许可证（MIT/Apache 优先）→ 记录到本清单 → 小范围试用 → 验收后才铺开
2. 使用新库的组件必须过三端（桌面 1440 / 平板 768 / 手机 480）+ tsc
3. 不引入与现有 antd/Arco 功能重复且无增量价值的库（控制体积）
4. 视觉一律收敛到 `DESIGN-SPEC.md` Token（橙色主色/等宽数字/圆点状态/白底）
