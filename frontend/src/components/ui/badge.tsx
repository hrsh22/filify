import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'
import type { HTMLAttributes } from 'react'

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-transparent bg-secondary text-secondary-foreground',
      success: 'border-transparent bg-emerald-500/15 text-emerald-500',
      warning: 'border-transparent bg-amber-500/15 text-amber-600',
      destructive: 'border-transparent bg-destructive/15 text-destructive',
      outline: 'border-border text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}


