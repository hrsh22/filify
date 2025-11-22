import { cn } from '@/utils/cn'
import type { InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = ({ className, ...props }: InputProps) => {
  return (
    <input
      className={cn(
        'flex h-11 w-full rounded-lg bg-input px-4 py-2.5 text-sm font-medium shadow-neo-inset transition-neo placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:glow-primary disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}


