import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 标签（shadcn 风格，纯 HTML label，零 Radix 依赖）
 */
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      {...props}
    />
  )
)
Label.displayName = 'Label'

export { Label }
