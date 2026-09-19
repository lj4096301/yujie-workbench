# 宇界拆书工具 - 技术规范 + 前端设计规范

**版本**: v1.0-draft  
**创建日期**: 2026-09-18  
**基于**: 宇界工作台现有规范  

---

## 一、技术架构规范

### 1.1 项目结构（独立版）

```
bookbreaker/
├── electron/                  # Electron主进程
│   ├── main.ts               # 入口
│   ├── db.ts                 # SQLite初始化
│   └── ipc-handlers.ts       # IPC通信处理
├── src/                       # React渲染进程
│   ├── main.tsx              # 入口组件
│   ├── App.tsx               # 根组件
│   ├── styles/
│   │   ├── design-tokens.css # 设计令牌（扩展自宇界）
│   │   ├── components.css    # 组件样式
│   │   └── index.css         # 全局样式
│   ├── components/
│   │   ├── BookImport/       # 书籍导入组件
│   │   ├── Preview/          # 预览确认组件
│   │   ├── Config/           # 分析配置组件
│   │   ├── Progress/         # 进度显示组件
│   │   ├── Result/           # 结果展示组件
│   │   ├── NoteEditor/       # 笔记编辑器
│   │   └── ThemeToggle/      # 主题切换
│   ├── hooks/
│   │   ├── useBookAnalysis.ts
│   │   ├── useLocalStorage.ts
│   │   └── useTheme.ts
│   ├── stores/
│   │   ├── bookStore.ts      # 书籍状态
│   │   ├── analysisStore.ts  # 分析状态
│   │   └── noteStore.ts      # 笔记状态
│   ├── services/
│   │   ├── parser.ts         # 文件解析服务
│   │   ├── ai.ts             # AI调用服务
│   │   └── exporter.ts       # 导出服务
│   └── types/
│       └── index.ts          # TypeScript类型定义
├── data/                      # 本地数据
│   └── books.db             # SQLite数据库
├── exports/                   # 导出文件存放
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### 1.2 技术栈

| 层 | 技术 | 版本要求 |
|----|------|---------|
| 框架 | Electron | >= 28.x |
| 前端 | React + TypeScript | >= 18.x |
| 构建 | Vite | >= 5.x |
| 样式 | Tailwind CSS + CSS Variables | - |
| UI库 | Ant Design | >= 5.15.x |
| 状态 | Zustand | >= 4.x |
| 数据库 | better-sqlite3 | >= 9.x |
| 解析 | ebooklib (EPUB) / pdf-parse (PDF) | - |
| AI | OpenAI SDK / Anthropic SDK | - |
| 渲染 | react-markdown + remark-gfm | - |
| 图表 | @xyflow/react (流程图) | - |

### 1.3 与宇界工作台的兼容规范

#### 1.3.1 设计令牌复用
```css
/* bookbreaker/src/styles/design-tokens.css */
:root {
  /* 复用宇界基础色 */
  --primary-color: #ff6700;  /* 小米橙 */
  --success: #00b42a;
  --warning: #ff7d00;
  --error: #f53f3f;
  
  /* 新增拆书工具专用色 */
  --book-accent: #5b8def;    /* 阅读蓝 */
  --book-muted: #86909c;
  
  /* 浅色主题变量 */
  --bg-card: #ffffff;
  --bg-subtle: #f7f8fa;
  --bg-hover: rgba(0, 0, 0, 0.04);
  --text-primary: #1f2329;
  --text-secondary: #4e5969;
  --text-muted: #86909c;
  --border: #e5e6eb;
  
  /* 深色主题变量 */
  [data-theme="dark"] {
    --bg-card: #1a1a1a;
    --bg-subtle: #252525;
    --bg-hover: rgba(255, 255, 255, 0.04);
    --text-primary: #e5e6eb;
    --text-secondary: #c9cdd4;
    --text-muted: #6b778c;
    --border: #3a3a3a;
  }
}
```

#### 1.3.2 间距系统
```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --space-10: 64px;
  --space-12: 96px;
}
```

#### 1.3.3 圆角规范
```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

---

## 二、前端设计规范

### 2.1 色彩规范

#### 2.1.1 语义色
```css
/* 成功/通过 */
--color-success: #00b42a;
--color-success-bg: rgba(0, 180, 42, 0.08);

/* 警告/需确认 */
--color-warning: #ff7d00;
--color-warning-bg: rgba(255, 125, 0, 0.08);

/* 错误/问题 */
--color-error: #f53f3f;
--color-error-bg: rgba(245, 63, 63, 0.08);

/* 信息/提示 */
--color-info: #165dff;
--color-info-bg: rgba(22, 93, 255, 0.08);

/* Grade评级色 */
--color-grade-a: #00b42a;  /* 优秀 */
--color-grade-b: #5b8def;  /* 良好 */
--color-grade-c: #ff7d00;  /* 需确认 */
--color-grade-d: #f53f3f;  /* 停止 */
```

#### 2.1.2 功能色使用规则
1. **主色 #ff6700**：仅用于CTA按钮、选中态、链接
2. **强调色 #5b8def**：用于阅读相关功能（书籍封面、进度条）
3. **状态色**：用 5px 圆点 + 文字，不用色块 chip
4. **灰度层级**：
   - 标题：#1f2329
   - 正文：#4e5969
   - 次要：#86909c
   - 边框：#e5e6eb
   - 背景：#f7f8fa

### 2.2 排版规范

#### 2.2.1 字体栈
```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
               "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  --font-serif: "Noto Serif SC", "Source Han Serif SC", "SimSun", serif;
}
```

#### 2.2.2 字号层级
```css
:root {
  --text-xs: 12px;    /* 辅助文字、标签 */
  --text-sm: 13px;    /* 次要文字、说明 */
  --text-base: 14px;  /* 正文 */
  --text-lg: 16px;    /* 小标题 */
  --text-xl: 18px;    /* 标题 */
  --text-2xl: 24px;   /* 大标题 */
  --text-3xl: 32px;   /* 页面标题 */
}
```

#### 2.2.3 字重层级
```css
:root {
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

### 2.3 组件规范

#### 2.3.1 书籍卡片
```tsx
// 规范：4:5 比例封面 + 书名 + 作者 + Grade + 状态
interface BookCardProps {
  title: string;
  author: string;
  grade?: 'A' | 'B' | 'C' | 'D';
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  progress?: number;  // 0-100
  thumbnail?: string;
  onClick: () => void;
}
```

**设计要点**：
- 封面圆角：8px
- 阴影：`0 1px 2px rgba(0,0,0,0.04)`
- Grade徽章：右上角，5px圆点+文字
- 状态指示：底部进度条或圆点

#### 2.3.2 进度展示
```tsx
// 规范：分阶段进度 + 当前章节 + 预计剩余时间
interface AnalysisProgressProps {
  currentStage: 'parsing' | 'preview' | 'config' | 'analyzing' | 'exporting';
  stageName: string;
  currentChapter?: number;
  totalChapters?: number;
  progress: number;  // 0-100
  eta?: string;      // 预计剩余时间
}
```

**设计要点**：
- 阶段指示器：顶部横向步骤条
- 当前章节：大字体显示
- 进度条：渐变填充，主色 #ff6700
- 实时日志：可折叠的文本区域

#### 2.3.3 Markdown渲染
```tsx
// 规范：类 GitHub 阅读体验
interface MarkdownViewerProps {
  content: string;
  editable?: boolean;
  onSave?: (content: string) => void;
}
```

**设计要点**：
- 最大宽度：720px（阅读舒适区）
- 行高：1.75
- 代码块：深色背景，圆角 8px
- 引用块：左侧 4px 色条 + 浅灰背景
- 表格：斑马纹，hover高亮

### 2.4 布局规范

#### 2.4.1 主界面布局
```
+-------------------------------------------------------------+
|  [Logo]  [导入书籍]  [历史记录]  [设置]          [主题切换] |
+-------------------------------+-----------------------------+
|                               |                             |
|   书籍列表                    |         分析结果/笔记       |
|   +-------------------------+ |   +-----------------------+ |
|   | 📘 货币战争             | |   |                       | |
|   |    Grade A              | |   |  [Markdown渲染区域]   | |
|   |    [导入时间]           | |   |                       | |
|   +-------------------------+ |   |  [工具栏: 导出|编辑]  | |
|   | 📗 xxx 书               | |   |                       | |
|   |    Grade B              | |   +-----------------------+ |
|   |    [待分析]             | |                             |
|   +-------------------------+ |   [侧边栏: 目录树|笔记|设置] |
|                               |                             |
+-------------------------------+-----------------------------+
|  [状态栏: 已导入X本 | 已完成Y本 | 存储空间Z MB]            |
+-------------------------------------------------------------+
```

#### 2.4.2 响应式断点
```css
/* 与宇界保持一致 */
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

---

## 三、交互规范

### 3.1 书籍导入流程
```
1. 用户点击"导入书籍"
   ↓
2. 显示拖拽区域（虚线边框，hover效果）
   ↓
3. 用户拖入文件或点击选择
   ↓
4. 显示解析中状态（旋转图标 + 进度）
   ↓
5. 解析完成后显示预览确认界面
```

### 3.2 维度选择交互
```
1. AI识别书籍类型（显示加载动画）
   ↓
2. 展示类型标签（可点击切换）
   ↓
3. 显示该类型的预置维度（checkbox列表）
   ↓
4. 用户勾选需要的维度
   ↓
5. 点击"开始分析"
```

### 3.3 分析过程反馈
```
实时显示：
- 当前处理的章节
- 已完成/总章节数
- 当前AI输出片段（流式显示）
- 预计剩余时间
- 取消按钮（可随时中断）
```

---

## 四、状态管理规范

### 4.1 Zustand Store 结构
```typescript
// stores/bookStore.ts
interface BookState {
  books: Book[];
  currentBook: Book | null;
  importBook: (file: File) => Promise<void>;
  deleteBook: (id: string) => void;
}

// stores/analysisStore.ts
interface AnalysisState {
  isAnalyzing: boolean;
  currentStage: AnalysisStage;
  progress: number;
  currentChapter: number;
  aiMessages: AIMessage[];
  startAnalysis: (bookId: string, options: AnalysisOptions) => Promise<void>;
  cancelAnalysis: () => void;
}

// stores/noteStore.ts
interface NoteState {
  notes: Note[];
  addNote: (bookId: string, content: string) => void;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;
}
```

### 4.2 持久化策略
- **书籍列表**：localStorage
- **分析历史**：SQLite
- **笔记内容**：SQLite + 本地Markdown文件备份
- **主题设置**：localStorage

---

## 五、API调用规范

### 5.1 AI服务抽象
```typescript
// services/ai.ts
interface AIProvider {
  name: string;
  analyzeBook(book: BookData, options: AnalysisOptions): AsyncGenerator<AIEvent>;
}

// 实现
class OpenAIProvider implements AIProvider { ... }
class ClaudeProvider implements AIProvider { ... }
class AgnesProvider implements AIProvider { ... }  // Hermes内置
```

### 5.2 错误处理
```typescript
// 网络错误
if (error instanceof NetworkError) {
  showNotification('网络连接失败，请检查网络', 'error');
}

// API限流
if (error instanceof RateLimitError) {
  showNotification('请求过于频繁，请稍后重试', 'warning');
  setCooldown(60);  // 60秒冷却
}

// 内容过长
if (error instanceof ContentTooLongError) {
  showNotification('书籍内容过长，请分章分析', 'warning');
}
```

---

## 六、性能规范

### 6.1 解析性能
- EPUB解析：< 5秒（18MB文件）
- 文本提取：< 10秒（50万字）
- AI分析：流式输出，首屏 < 3秒

### 6.2 内存管理
- 大文件分块处理
- Web Worker离线解析
- 图片懒加载
- 虚拟列表长列表

### 6.3 存储优化
- SQLite压缩存储
- 定期清理临时文件
- 数据库自动备份

---

## 七、安全规范

### 7.1 文件安全
- 只读模式打开用户文件
- 不修改原始文件
- 解析后及时释放文件句柄

### 7.2 数据安全
- 本地存储不加密（用户可控）
- 云端同步可选加密
- API密钥不硬编码

### 7.3 隐私保护
- 书籍内容本地处理优先
- 上传前明确提示用户
- 提供离线模式选项

---

## 八、测试规范

### 8.1 单元测试
- 解析逻辑：EPUB/TXT/PDF解析正确性
- 维度识别：书籍分类准确率
- 导出格式：Markdown/PDF生成正确性

### 8.2 集成测试
- 端到端流程：导入→分析→导出
- 错误恢复：中断后继续分析
- 并发处理：多本书同时处理

### 8.3 性能测试
- 大文件处理（100MB+）
- 长时间运行稳定性
- 内存泄漏检测

---

**文档结束**
