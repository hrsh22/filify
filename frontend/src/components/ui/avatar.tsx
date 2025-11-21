import type { ImgHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {}

export function Avatar({ className, alt = 'avatar', ...props }: AvatarProps) {
  return (
    <div className={cn('inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium', className)}>
      {props.src ? <img alt={alt} className="h-full w-full object-cover" {...props} /> : <span>{alt.slice(0, 1).toUpperCase()}</span>}
    </div>
  )
}


