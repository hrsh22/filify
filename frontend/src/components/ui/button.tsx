import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'
import type { ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed ring-offset-background active-press border',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-primary shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 hover:glow-primary',
        secondary: 'bg-card text-foreground border-border shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 hover:border-primary',
        outline: 'border-primary/50 bg-transparent text-primary hover:bg-primary/10 hover:shadow-neo-sm hover:-translate-y-0.5 hover:border-primary',
        ghost: 'border-transparent hover:bg-muted/50 text-foreground hover:border-border',
        destructive: 'bg-destructive text-white border-destructive shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 hover:brightness-110',
        accent: 'bg-cyan text-cyan-foreground border-cyan shadow-neo-sm hover:shadow-neo hover:-translate-y-0.5 hover:glow-cyan',
      },
      size: {
        default: 'px-5 py-2.5',
        sm: 'px-3 py-2 text-xs',
        lg: 'px-8 py-4 text-base',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = ({ className, variant, size, asChild = false, ...props }: ButtonProps) => {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size, className }))} {...props} />
}


