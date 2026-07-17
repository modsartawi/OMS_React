import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The action-button variants Screen 2 needs, mapped from the Angular
 * prototype's PrimeNG severities: primary (the default action), secondary (the
 * ordinary actions), danger (Force Close), outlined (Return Document, Refresh)
 * and text (Cancel in the dialog footers).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outlined' | 'text'

const BASE =
  'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/85 disabled:hover:bg-primary',
  secondary: 'border border-border bg-card hover:bg-accent disabled:hover:bg-card',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:hover:bg-red-700',
  outlined: 'border border-border bg-transparent hover:bg-accent disabled:hover:bg-transparent',
  text: 'bg-transparent text-muted-foreground hover:bg-accent disabled:hover:bg-transparent',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type="button" className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
