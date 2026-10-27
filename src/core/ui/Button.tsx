import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClass, type ButtonVariant } from './control-classes'

// The variants and their looks live in `./control-classes` (ticket 594), styled
// once from tokens beside IconButton and Chip. Re-exported so callers keep
// importing the type from here.
export type { ButtonVariant } from './control-classes'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

/**
 * The shared action button: a full pill at h-7 in one of ten variants (see
 * `ButtonVariant`). A command disabled *with a reason* takes `aria-disabled`
 * (styled like `disabled`, but it stays focusable) plus the reason as `title`,
 * and guards its own `onClick`.
 */
export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type="button" className={buttonClass(variant, className)} {...rest}>
      {children}
    </button>
  )
}
