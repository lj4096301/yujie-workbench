/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1677ff',
        sidebar: '#001529',
        panel: '#ffffff',
        'panel-hover': '#f5f5f5',
      },
    },
  },
  plugins: [],
  // 避免和 Ant Design 冲突
  corePlugins: {
    preflight: false,
  },
}
