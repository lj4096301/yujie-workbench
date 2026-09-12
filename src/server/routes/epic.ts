import { Router } from 'express'
import axios from 'axios'

/** 上游数据缓存时长：30 分钟（限免信息变化低频，没必要每次请求都打上游） */
const CACHE_TTL = 30 * 60 * 1000

interface CachedData {
  ts: number
  data: unknown[]
}

export function createEpicRouter() {
  const router = Router()

  let epicCache: CachedData | null = null
  let steamCache: CachedData | null = null

  // Epic 本周/下周限免（Epic 官方商店 API，免认证）
  router.get('/games', async (req, res) => {
    if (epicCache && Date.now() - epicCache.ts < CACHE_TTL) {
      return res.json(epicCache.data)
    }

    try {
      // 用 IPv4 直连域名，规避部分地区 DNS 解析到不可达 IPv6 的问题
      const response = await axios.get(
        'https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions',
        {
          params: {
            locale: 'zh-CN',
            country: 'CN',
            allowCountries: 'CN',
          },
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
          timeout: 15000,
        }
      )

      const elements = response.data?.data?.Catalog?.searchStore?.elements || []

      const games = elements
        .filter((el: any) => el.promotions)
        .map((el: any) => {
          const promo = el.promotions
          const currentPromo = promo.promotionalOffers?.[0]?.promotionalOffers?.[0]
          const upcomingPromo = promo.upcomingPromotionalOffers?.[0]?.promotionalOffers?.[0]

          let status: 'free' | 'upcoming' | 'expired' = 'expired'
          let startDate = ''
          let endDate = ''

          if (currentPromo && currentPromo.discountSetting?.discountPercentage === 0) {
            status = 'free'
            startDate = currentPromo.startDate
            endDate = currentPromo.endDate
          } else if (upcomingPromo && upcomingPromo.discountSetting?.discountPercentage === 0) {
            status = 'upcoming'
            startDate = upcomingPromo.startDate
            endDate = upcomingPromo.endDate
          }

          const price = el.price?.totalPrice
          const originalPrice = price?.originalPrice ? price.originalPrice / 100 : 0
          const currentPrice = price?.discountPrice ? price.discountPrice / 100 : 0

          return {
            id: el.id,
            title: el.title,
            description: el.description || '',
            coverImage: el.keyImages?.find((img: any) => img.type === 'OfferImageWide')?.url || '',
            originalPrice,
            currentPrice,
            currency: price?.currencyCode || 'CNY',
            startDate,
            endDate,
            url: `https://store.epicgames.com/zh-CN/p/${el.offerMappings?.[0]?.pageSlug || el.catalogNs?.mappings?.[0]?.pageSlug || el.id}`,
            status,
          }
        })
        .filter((g: any) => g.status !== 'expired')

      epicCache = { ts: Date.now(), data: games }
      res.json(games)
    } catch (err) {
      console.error('Epic API 错误:', err)
      // 上游挂了就用过期缓存兜底，没有缓存才返回空（不再返回 mock 假数据误导用户）
      if (epicCache) return res.json(epicCache.data)
      res.json([])
    }
  })

  // Steam 限免（GamerPower 聚合 API，免认证；Steam 官方没有限免接口）
  router.get('/steam', async (req, res) => {
    if (steamCache && Date.now() - steamCache.ts < CACHE_TTL) {
      return res.json(steamCache.data)
    }

    try {
      const response = await axios.get('https://www.gamerpower.com/api/giveaways', {
        params: {
          platform: 'steam',
          type: 'game',
          'sort-by': 'value',
        },
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
        timeout: 15000,
      })

      const giveaways: any[] = Array.isArray(response.data) ? response.data : []

      // 只保留当前有效的游戏限免（status=Active；排除 loot/DLC 类）
      const games = giveaways
        .filter((g) => g && g.status === 'Active' && g.type === 'Game')
        .map((g) => {
          // end_date 可能是 null 或 1970 占位值，统一归一化
          const rawEnd = g.end_date ? new Date(g.end_date).getTime() : 0
          const hasEnd = rawEnd > Date.now()
          const worth = typeof g.worth === 'string' ? parseFloat(g.worth.replace(/[^0-9.]/g, '')) : 0

          return {
            id: `steam-gp-${g.id}`,
            title: g.title,
            description: g.description || '',
            coverImage: g.image || g.thumbnail || '',
            originalPrice: Number.isFinite(worth) ? worth : 0,
            currentPrice: 0,
            currency: 'USD',
            startDate: g.published_date || '',
            endDate: hasEnd ? g.end_date : '',
            url: g.open_giveaway_url || g.gamerpower_url || 'https://www.gamerpower.com/',
            status: 'free' as const,
          }
        })

      steamCache = { ts: Date.now(), data: games }
      res.json(games)
    } catch (err) {
      console.error('GamerPower(Steam) API 错误:', err)
      if (steamCache) return res.json(steamCache.data)
      res.json([])
    }
  })

  return router
}
