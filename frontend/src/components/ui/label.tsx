import { cn } from '@/utils/cn'
import type { LabelHTMLAttributes } from 'react'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-muted-foreground', className)} {...props} />
}


