import type { ImgHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {}

export function Avatar({ className, alt = 'avatar', ...props }: AvatarProps) {
  return (
    <div className={cn('inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-card border border-border text-sm font-semibold shadow-neo-sm transition-neo hover:shadow-neo hover:border-primary', className)}>
      {props.src ? <img alt={alt} className="h-full w-full object-cover" {...props} /> : <span>{alt.slice(0, 1).toUpperCase()}</span>}
    </div>
  )
}


