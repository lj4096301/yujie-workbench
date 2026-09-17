/**
 * 登录模块
 * 防止未授权用户误操作
 */
import React, { useState, useEffect } from 'react'
import { Input, Button, Form, Alert, Card, message } from 'antd'
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons'
import { useLayoutStore } from '@/stores/layoutStore'

const LOGIN_STORAGE_KEY = 'yujie-auth-logged'
const USER_1_USERNAME = 'admin'
const USER_1_PASSWORD = 'yujie2024'

interface LoginFormValues {
  username: string
  password: string
}

const LoginModule: React.FC = () => {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setLoggedIn = useLayoutStore((s) => s.setLoggedIn)
  const isLoggedIn = useLayoutStore((s) => s.isLoggedIn)

  const handleLogin = async (values: LoginFormValues) => {
    setError('')
    setLoading(true)

    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 500))

    if (values.username === USER_1_USERNAME && values.password === USER_1_PASSWORD) {
      localStorage.setItem(LOGIN_STORAGE_KEY, '1')
      setLoggedIn(true)
      message.success('登录成功，正在跳转...')
      // 延迟一下让用户看到成功提示，然后跳转
      setTimeout(() => {
        window.location.reload()
      }, 800)
    } else {
      setError('用户名或密码错误')
      message.error('登录失败')
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-page)' }}>
      <Card 
        style={{ width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}
        bodyStyle={{ padding: '32px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>宇界工作台</h2>
          <p style={{ color: '#999', fontSize: 13, marginTop: 8 }}>请输入账号登录</p>
        </div>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form onFinish={handleLogin} layout="vertical">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bbb' }} />}
              placeholder="用户名"
              size="large"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bbb' }} />}
              placeholder="密码"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              icon={<LoginOutlined />}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#999' }}>
          默认账号：admin / yujie2024
        </div>
      </Card>
    </div>
  )
}

export default LoginModule
