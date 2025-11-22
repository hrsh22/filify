import { cn } from '@/utils/cn'
import type { HTMLAttributes } from 'react'

export function Spinner({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary shadow-neo-sm', className)}
      {...props}
    />
  )
}


