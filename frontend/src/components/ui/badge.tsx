import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'
import type { HTMLAttributes } from 'react'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold shadow-neo-sm transition-neo', {
  variants: {
    variant: {
      default: 'bg-secondary text-secondary-foreground',
      success: 'bg-emerald-500/20 text-emerald-400',
      warning: 'bg-amber-500/20 text-amber-400',
      destructive: 'bg-destructive/20 text-red-400',
      outline: 'border border-border bg-card/50 text-foreground',
      primary: 'bg-primary/20 text-primary',
      accent: 'bg-cyan/20 text-cyan border border-cyan/30',
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


