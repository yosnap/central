import Link from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from './cn'

const VARIANTS = {
  primary: 'bg-accent text-on-accent shadow-sm hover:bg-accent-strong',
  secondary: 'border border-line bg-panel text-ink hover:border-accent/50 hover:bg-accent-soft',
  ghost: 'text-ink hover:bg-accent-soft',
  danger: 'bg-bad text-white shadow-sm hover:bg-bad/90',
  'danger-ghost': 'text-bad hover:bg-bad/10',
} as const
const SIZES = {
  sm: 'h-10 gap-1.5 rounded-lg px-3.5 text-sm',
  md: 'h-12 gap-2 rounded-xl px-5 text-base',
  lg: 'h-14 gap-2.5 rounded-xl px-7 text-lg',
  icon: 'size-11 rounded-xl',
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) =>
  cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55',
    VARIANTS[variant], SIZES[size], className,
  )

type Style = { variant?: ButtonVariant; size?: ButtonSize }

export function Button({ variant, size, className, type = 'button', ...props }: ComponentProps<'button'> & Style) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({ variant = 'secondary', size, className, ...props }: ComponentProps<typeof Link> & Style) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
