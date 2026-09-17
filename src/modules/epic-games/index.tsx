import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Spin, Empty, Tag, Button, message } from 'antd'

interface GameItem {
  id: string
  title: string
  description: string
  coverImage: string
  originalPrice: number
  currentPrice: number
  currency: string
  startDate: string
  endDate: string
  url: string
  status: 'free' | 'upcoming' | 'expired'
}

type StoreTab = 'epic' | 'steam'
type FilterKey = 'all' | 'free' | 'upcoming'

const FreeGamesModule: React.FC<{ panelId?: string }> = ({ panelId }) => {
  // 标题栏操作挂载点（Panel 的 panel-actions）
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!panelId) return
    setActionsHost(document.getElementById(`panel-actions-${panelId}`))
  }, [panelId])

  const [store, setStore] = useState<StoreTab>('epic')
  const [epicGames, setEpicGames] = useState<GameItem[]>([])
  const [steamGames, setSteamGames] = useState<GameItem[]>([])
  const [epicLoaded, setEpicLoaded] = useState(false)
  const [steamLoaded, setSteamLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')

  useEffect(() => {
    if (store === 'epic' && !epicLoaded) fetchEpic()
    if (store === 'steam' && !steamLoaded) fetchSteam()
  }, [store])

  const fetchList = async (tab: StoreTab) => {
    setLoading(true)
    try {
      const url = tab === 'epic' ? '/api/epic/games' : '/api/epic/steam'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (tab === 'epic') {
          setEpicGames(data)
          setEpicLoaded(true)
        } else {
          setSteamGames(data)
          setSteamLoaded(true)
        }
      }
    } catch (err) {
      console.error(`获取${tab === 'epic' ? 'Epic' : 'Steam'}游戏失败:`, err)
    } finally {
      setLoading(false)
    }
  }

  const fetchEpic = () => fetchList('epic')
  const fetchSteam = () => fetchList('steam')

  const refresh = () => {
    if (store === 'epic') {
      setEpicLoaded(false)
      fetchEpic()
    } else {
      setSteamLoaded(false)
      fetchSteam()
    }
  }

  const games = store === 'epic' ? epicGames : steamGames
  const filteredGames = games.filter((g) => {
    if (filter === 'free') return g.status === 'free'
    if (filter === 'upcoming') return g.status === 'upcoming'
    return true
  })

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'free':
        return <Tag color="green">免费领取</Tag>
      case 'upcoming':
        return <Tag color="blue">即将免费</Tag>
      default:
        return <Tag color="default">已结束</Tag>
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getRemainingTime = (endDate: string) => {
    if (!endDate) return ''
    const diff = new Date(endDate).getTime() - Date.now()
    if (diff <= 0) return '已结束'
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) return `剩余 ${days} 天 ${hours} 小时`
    return `剩余 ${hours} 小时`
  }

  const storeLinkLabel = store === 'epic' ? '🔗 前往 Epic 商店' : '🔗 前往领取页面'
  const emptyText = store === 'epic' ? '当前没有 Epic 限免信息' : '当前没有 Steam 限免信息'

  const headerActions = actionsHost
    ? createPortal(
        <div className="fg-header-actions">
          <Button size="small" type={store === 'epic' ? 'primary' : 'default'} onClick={() => setStore('epic')}>
            Epic
          </Button>
          <Button size="small" type={store === 'steam' ? 'primary' : 'default'} onClick={() => setStore('steam')}>
            Steam
          </Button>
          <Button size="small" type={filter === 'all' ? 'primary' : 'default'} onClick={() => setFilter('all')}>
            全部
          </Button>
          <Button size="small" type={filter === 'free' ? 'primary' : 'default'} onClick={() => setFilter('free')}>
            🎮 免费领
          </Button>
          {store === 'epic' && (
            <Button size="small" type={filter === 'upcoming' ? 'primary' : 'default'} onClick={() => setFilter('upcoming')}>
              ⏰ 即将免费
            </Button>
          )}
          <Button size="small" icon="🔄" onClick={refresh} title="刷新（服务端缓存 30 分钟）">
            刷新
          </Button>
        </div>,
        actionsHost
      )
    : null

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {headerActions}

      {/* 游戏列表 */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60%' }}>
          <Spin />
        </div>
      ) : filteredGames.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredGames.map((game) => (
            <div key={game.id} className="epic-game-card" onClick={() => window.open(game.url, '_blank')}>
              {game.coverImage ? (
                <img src={game.coverImage} alt={game.title} className="game-cover" loading="lazy" />
              ) : (
                <div className="game-cover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  🎮
                </div>
              )}
              <div className="game-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="game-title">{game.title}</span>
                  {getStatusTag(game.status)}
                </div>
                <div className="game-price">
                  {game.status === 'free' ? (
                    <span style={{ color: '#52c41a' }}>
                      免费
                      {game.originalPrice > 0 && (
                        <span style={{ textDecoration: 'line-through', color: '#999', fontSize: 11, marginLeft: 6 }}>
                          ${game.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>原价 ${game.originalPrice.toFixed(2)}</span>
                  )}
                </div>
                <div className="game-dates">
                  {game.status === 'free' ? (
                    game.endDate ? (
                      <>
                        截止 {formatDate(game.endDate)}
                        <span style={{ marginLeft: 8, color: '#ff7a45' }}>{getRemainingTime(game.endDate)}</span>
                      </>
                    ) : (
                      <span style={{ color: '#ff7a45' }}>不限时，先到先得</span>
                    )
                  ) : (
                    <>{formatDate(game.startDate)} 开始免费</>
                  )}
                </div>
                {game.description && (
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4, lineHeight: 1.4 }}>
                    {game.description.length > 80 ? game.description.slice(0, 80) + '...' : game.description}
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  <a
                    href={game.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#1677ff' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {storeLinkLabel}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty description={emptyText} />
      )}
    </div>
  )
}

export default FreeGamesModule
