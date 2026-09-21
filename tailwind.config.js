/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // tactile-weather 组件库（dist 内为构建产物，含 Tailwind 类名字面量）
    './node_modules/tactile-weather/dist/tactile-weather.es.js',
  ],
  theme: {
    extend: {
      colors: {
        // Mi Console 主色（功能色，仅用于链接/选中/CTA）
        primary: '#ff6700',
        'primary-hover': '#ff7a2e',
        sidebar: '#ffffff',
        panel: '#ffffff',
        'panel-hover': '#f5f5f5',
        // shadcn/ui Token（对齐 DESIGN-SPEC）
        'primary-foreground': '#ffffff',
        card: 'var(--bg-card, #ffffff)',
        'card-foreground': 'var(--text-primary, #1f2329)',
        border: 'var(--border, #e5e6eb)',
        input: 'var(--border, #e5e6eb)',
        muted: 'var(--bg-subtle, #f7f8fa)',
        'muted-foreground': 'var(--text-muted, #86909c)',
        destructive: '#f53f3f',
        'destructive-foreground': '#ffffff',
        secondary: 'var(--bg-subtle, #f7f8fa)',
        'secondary-foreground': 'var(--text-primary, #1f2329)',
        accent: 'var(--bg-hover, rgba(0, 0, 0, 0.04))',
        'accent-foreground': 'var(--primary-color, #ff6700)',
        background: 'var(--bg-card, #ffffff)',
        foreground: 'var(--text-primary, #1f2329)',
        popover: 'var(--bg-card, #ffffff)',
        'popover-foreground': 'var(--text-primary, #1f2329)',
        ring: 'var(--primary-color, #ff6700)',
      },
      borderRadius: {
        xl: 'var(--radius-lg, 12px)',
      },
      boxShadow: {
        // shadcn Card 默认 shadow-sm → Mi Console 极轻卡片阴影
        sm: 'var(--shadow-card, 0 1px 2px rgba(0, 0, 0, 0.04))',
      },
    },
  },
  plugins: [],
  // 避免和 Ant Design / Arco 冲突
  corePlugins: {
    preflight: false,
  },
}
