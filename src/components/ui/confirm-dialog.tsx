import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from './dialog'
import { Button } from './button'

/**
 * 通用二次确认弹窗（基于 shadcn Dialog）
 * 全项目统一使用：删除 / 完成 / 清空等危险或重要操作，宽度 420px。
 * 顶部不显示标题文本，直接内容 + 操作按钮（标题仅保留给无障碍）。
 * 用法：
 *   const [confirm, setConfirm] = useState<{ content?: string; onOk: () => void } | null>(null)
 *   <ConfirmDialog open={!!confirm} content={confirm?.content} danger
 *     onOk={confirm?.onOk} onOpenChange={(o) => !o && setConfirm(null)} />
 */
export interface ConfirmDialogProps {
  open: boolean
  title?: string
  content?: React.ReactNode
  okText?: string
  cancelText?: string
  danger?: boolean
  onOk?: () => void
  onOpenChange?: (open: boolean) => void
}

export function ConfirmDialog({
  open,
  title = '确认操作',
  content,
  okText = '确认',
  cancelText = '取消',
  danger,
  onOk,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
        </DialogHeader>
        {content != null && (
          <div className="py-1 text-sm leading-5 text-[#4E5969]">{content}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            onClick={() => {
              onOpenChange?.(false)
              onOk?.()
            }}
          >
            {okText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
