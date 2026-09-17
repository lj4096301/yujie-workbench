import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn/ui 风格 class 合并工具（Tailwind 类冲突自动去重） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
