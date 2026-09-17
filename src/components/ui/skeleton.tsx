import { cn } from '@/lib/utils'

/**
 * shadcn/ui 风格骨架屏（MIT）
 * 用于加载态占位，符合规范「加载优先骨架屏」
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

export { Skeleton }
