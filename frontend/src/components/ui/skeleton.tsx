import { cn } from '@/utils/cn'
import type { HTMLAttributes } from 'react'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn('relative overflow-hidden rounded-lg bg-muted shadow-neo-inset', className)} 
      {...props}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  )
}


