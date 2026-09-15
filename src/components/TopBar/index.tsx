import React from 'react'
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Dropdown,
  Layout,
  Menu,
  Tooltip,
} from '@arco-design/web-react'
import { IconNotification, IconSearch } from '@arco-design/web-react/icon'
import { useLayoutStore, HOME_ID } from '@/stores/layoutStore'
import { MODULE_META } from '@/modules/registry'

const { Header } = Layout
const MenuItem = Menu.Item

/**
 * 顶部操作栏（Arco 中后台布局规范）：
 * 左侧面包屑定位层级，右侧全局搜索 / 消息通知 / 用户头像
 */
const TopBar: React.FC = () => {
  const activeModule = useLayoutStore((s) => s.activeModule)
  const setSearchVisible = useLayoutStore((s) => s.setSearchVisible)

  const currentTitle =
    activeModule === HOME_ID ? '首页' : MODULE_META.find((m) => m.id === activeModule)?.title

  const notifPanel = (
    <div className="topbar-notif">
      <div className="topbar-notif-head">通知中心</div>
      <div className="topbar-notif-empty">暂无新通知</div>
    </div>
  )

  const userMenu = (
    <Menu
      style={{ borderRadius: 8, width: 160 }}
      onClickMenuItem={() => window.dispatchEvent(new CustomEvent('mimo:show-about'))}
    >
      <MenuItem key="about">关于 宇界工作台</MenuItem>
    </Menu>
  )

  return (
    <Header className="topbar">
      <div className="topbar-left">
        <Breadcrumb>
          <Breadcrumb.Item>首页</Breadcrumb.Item>
          {currentTitle && currentTitle !== '首页' && (
            <Breadcrumb.Item>{currentTitle}</Breadcrumb.Item>
          )}
        </Breadcrumb>
      </div>
      <div className="topbar-right">
        <Tooltip content="全局搜索 (Ctrl+K)">
          <Button
            shape="circle"
            type="text"
            icon={<IconSearch />}
            onClick={() => setSearchVisible(true)}
            aria-label="全局搜索"
          />
        </Tooltip>
        <Dropdown droplist={notifPanel} position="br" trigger="click">
          <Button
            shape="circle"
            type="text"
            icon={
              <Badge dot offset={[-2, 2]}>
                <IconNotification />
              </Badge>
            }
            aria-label="消息通知"
          />
        </Dropdown>
        <Dropdown droplist={userMenu} position="br" trigger="click">
          <div className="topbar-user" title="用户">
            <Avatar size={28} style={{ background: '#165dff' }}>
              宇
            </Avatar>
          </div>
        </Dropdown>
      </div>
    </Header>
  )
}

export default TopBar
