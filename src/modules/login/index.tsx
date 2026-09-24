/**
 * 登录模块
 * 防止未授权用户误操作
 */
import React, { useState } from 'react'
import { message } from 'antd'
import { User, Lock, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLayoutStore } from '@/stores/layoutStore'

const LOGIN_STORAGE_KEY = 'yujie-auth-logged'
const USER_1_USERNAME = 'admin'
const USER_1_PASSWORD = 'yujie2024'

const LoginModule: React.FC = () => {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const setLoggedIn = useLayoutStore((s) => s.setLoggedIn)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) { setError('请输入用户名'); return }
    if (!password) { setError('请输入密码'); return }
    setLoading(true)

    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 500))

    if (username === USER_1_USERNAME && password === USER_1_PASSWORD) {
      localStorage.setItem(LOGIN_STORAGE_KEY, '1')
      setLoggedIn(true)
      message.success('登录成功，正在跳转...')
      // 清除布局缓存后跳转回首页（不依赖 reload，直接导航）
      setTimeout(() => {
        window.localStorage.removeItem('mimo-active-module')
        window.localStorage.removeItem('mimo-panels')
        window.localStorage.removeItem('mimo-layouts')
        window.location.href = '/'
      }, 800)
    } else {
      setError('用户名或密码错误')
      message.error('登录失败')
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-page)' }}>
      <div
        style={{
          width: 380,
          background: 'var(--bg-card, #ffffff)',
          borderRadius: 8,
          border: '1px solid var(--border, #e5e6eb)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          padding: 32,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary, #1d2129)' }}>宇界工作台</h2>
          <p style={{ color: 'var(--text-muted, #86909c)', fontSize: 14, marginTop: 8 }}>请输入账号登录</p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 14,
              background: 'rgba(245, 63, 63, 0.06)',
              border: '1px solid rgba(245, 63, 63, 0.25)',
              color: 'var(--danger, #f53f3f)',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label className="mb-1 block text-xs font-medium text-[#4E5969]">用户名</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909C]" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                autoComplete="username"
                className="h-9 pl-9"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-[#4E5969]">密码</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909C]" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete="current-password"
                className="h-9 pl-9"
              />
            </div>
          </div>

          <Button type="submit" className="h-9 w-full" disabled={loading}>
            <LogIn className="h-4 w-4" /> {loading ? '登录中...' : '登录'}
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted, #86909c)' }}>
          默认账号：admin / yujie2024
        </div>
      </div>
    </div>
  )
}

export default LoginModule
