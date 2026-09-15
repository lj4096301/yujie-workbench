# 宇界工作台 - 模块化改造方案

> 目标：每个 Tab 功能独立，与主程序解耦，支持版本回退
> 创建日期：2026-09-15
> 状态：待执行

---

## 一、现状分析

### 1.1 模块独立性检查

| 模块 | 大小 | 内部依赖 | 状态 |
|------|------|----------|------|
| api-monitor | 18.9 KB | 无 | ✅ 完全独立 |
| bookmarks | 14.6 KB | 无 | ✅ 完全独立 |
| calendar | 21.1 KB | 无 | ✅ 完全独立 |
| clipboard | 3.4 KB | clipboardStore | ⚠️ 轻度耦合 |
| epic-games | 7.6 KB | 无 | ✅ 完全独立 |
| knowledge | 49.7 KB | SplitPane | ⚠️ 轻度耦合 |
| news | 18.8 KB | 无 | ✅ 完全独立 |
| novel | 32.1 KB | SplitPane | ⚠️ 轻度耦合 |
| tasks | 5.6 KB | 无 | ✅ 完全独立 |
| tv-tracker | 15.6 KB | 无 | ✅ 完全独立 |
| weather | 20.9 KB | 无 | ✅ 完全独立 |

**结论**: 11个模块中 8个已完全独立，3个有轻度耦合（共享组件）

### 1.2 耦合点分析

```
src/modules/
├── knowledge/ ────┐
├── novel/    ─────┼── → src/components/SplitPane.tsx
└── clipboard/ ────┘

src/stores/
├── clipboardStore.ts ──→ used by clipboard module
├── layoutStore.ts  ──→ 全局布局管理
└── uiStore.ts      ──→ 全局UI状态
```

---

## 二、解耦方案

### 2.1 模块自包含化

**目标**: 每个模块成为独立的 npm 包，可单独开发和测试

```
src/modules/
├── api-monitor/
│   ├── index.tsx          # 主组件
│   ├── types.ts           # 类型定义
│   ├── hooks/             # 自定义 hooks
│   │   └── useApiPrice.ts
│   └── utils/             # 工具函数
│       └── formatPrice.ts
│
├── knowledge/
│   ├── index.tsx
│   ├── types.ts
│   ├── hooks/
│   │   ├── useKnowledge.ts
│   │   └── useGraphView.ts
│   ├── components/        # 模块内部组件
│   │   ├── GraphView.tsx
│   │   ├── MarkdownView.tsx
│   │   └── SplitPane.tsx  # 复制 SplitPane，不再依赖全局
│   └── utils/
│       └── ...
│
└── ... (其他模块类似)
```

### 2.2 共享组件提取

将 `SplitPane` 等共享组件提升到独立包：

```
src/shared/
├── split-pane/
│   ├── index.tsx
│   ├── types.ts
│   └── styles.css
└── hooks/
    ├── useResize.ts
    └── useBreakpoint.ts
```

### 2.3 Store 模块化

将全局 store 拆分为模块级 store：

```typescript
// 模块级 store（每个模块独立）
src/modules/knowledge/store.ts
src/modules/novel/store.ts
src/modules/calendar/store.ts

// 全局 store（仅保留核心）
src/stores/
├── layoutStore.ts    # 只保留布局管理
└── uiStore.ts        # 只保留主题/缩放
```

---

## 三、Git 版本管理策略

### 3.1 分支策略

```
main                # 生产版本
├── feature/calendar-ui    # 日历模块 UI 优化
├── feature/knowledge-refactor  # 知识库解耦
└── refactor/all-modules   # 全模块解耦

tag: v1.0.0          # 当前稳定版本
tag: v1.1.0          # 本次 UI 优化
tag: v2.0.0          # 模块化改造完成
```

### 3.2 提交规范

```bash
# 模块变更
git commit -m "feat(knowledge): 重构知识库模块，分离 SplitPane 组件"

# 样式变更
git commit -m "style: 更新设计规范 v1.1，添加色彩系统"

# 修复
git commit -m "fix(calendar): 修复日历组件日期选择器样式"
```

### 3.3 回退机制

```bash
# 查看提交历史
git log --oneline

# 回退到指定版本
git checkout v1.0.0 -- .
git commit -m "revert: 回退到 v1.0.0 版本"

# 创建回退分支
git branch backup-before-refactor HEAD
```

---

## 四、实施计划

### 阶段一：建立基础（已完成）
- [x] 创建设计规范文档
- [x] 添加设计令牌系统
- [x] 优化 Panel 组件
- [x] Git 提交当前状态

### 阶段二：模块自包含（进行中）
- [ ] 提取 SplitPane 到 shared 目录
- [ ] knowledge 模块内部化 SplitPane 引用
- [ ] novel 模块内部化 SplitPane 引用
- [ ] clipboard 模块内部化 clipboardStore

### 阶段三：Store 拆分
- [ ] 将 clipboardStore 移入 clipboard 模块
- [ ] 评估 layoutStore 是否需要拆分
- [ ] 创建模块级 state 管理

### 阶段四：测试与验证
- [ ] 各模块独立测试
- [ ] 集成测试
- [ ] 性能测试

---

## 五、解耦标准

每个模块必须满足以下条件才算"独立"：

1. **自包含**: 模块内部包含所有必要代码，不依赖其他模块
2. **独立测试**: 可以单独运行单元测试
3. **独立发布**: 可以作为独立 npm 包发布
4. **配置隔离**: 模块配置不与全局配置混用
5. **错误隔离**: 模块崩溃不影响其他模块

---

## 六、回退预案

如果遇到重大问题，可按以下步骤回退：

```bash
# 1. 创建安全分支
git branch backup-$(date +%Y%m%d)

# 2. 回退到上一稳定版本
git checkout v1.0.0 -- .

# 3. 提交回退
git commit -m "revert: 回退到 v1.0.0（解决解耦过程中的问题）"

# 4. 分析问题的根因
# 5. 从备份分支重新实施
```

---

**文档版本**: v1.0  
**最后更新**: 2026-09-15  
**维护者**: Agnes/QClaw
