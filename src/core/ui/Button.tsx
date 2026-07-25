import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The action-button variants the app needs.
 *
 * The first five map from the Angular prototype's PrimeNG severities: primary
 * (the default action), secondary (the ordinary actions), danger (the terminal
 * cancel), outlined (Refresh) and text (Cancel in the dialog footers).
 *
 * The last three are ticket 072's command-family taxonomy, which colours a
 * command button by the FUNCTION it performs rather than by its stakes:
 * `fulfilment` and `cancel-request` are the two families, and `ghost` is the
 * quiet tier that carries no family colour at all. `danger-outlined` is the
 * terminal tier's override — red, but separated from the sanctioned cancel by
 * WEIGHT rather than by a second, louder red.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'danger-outlined'
  | 'outlined'
  | 'text'
  | 'fulfilment'
  | 'cancel-request'
  | 'ghost'

/**
 * `aria-disabled` is styled alongside `disabled` because a command that is
 * disabled *with a reason* must stay focusable to be able to state it — a real
 * `disabled` attribute takes the button out of the tab order and out of the
 * accessibility tree's reach, which is exactly how an operator fails to
 * discover why a command is unavailable.
 */
const BASE =
  'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

/**
 * Every filled chromatic ground carries `--primary-foreground`, never white:
 * under 082's R2 each dark chromatic fill is a LIGHT tonal fill, and
 * `--primary-foreground` is the token that flips with it. Ground and ink are a
 * pair and must move together.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/85 ' +
    'disabled:hover:bg-primary aria-disabled:hover:bg-primary',
  secondary:
    'border border-border bg-card hover:bg-accent ' +
    'disabled:hover:bg-card aria-disabled:hover:bg-card',
  danger:
    'bg-danger text-primary-foreground hover:bg-danger-800 ' +
    'disabled:hover:bg-danger aria-disabled:hover:bg-danger',
  'danger-outlined':
    'border border-danger-border bg-transparent text-danger-800 hover:bg-danger-050 ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  outlined:
    'border border-border bg-transparent hover:bg-accent ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  text:
    'bg-transparent text-muted-foreground hover:bg-accent ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  fulfilment:
    'bg-fam-fulfilment text-primary-foreground hover:bg-fam-fulfilment/85 ' +
    'disabled:hover:bg-fam-fulfilment aria-disabled:hover:bg-fam-fulfilment',
  'cancel-request':
    'bg-fam-cancel-request text-primary-foreground hover:bg-fam-cancel-request/85 ' +
    'disabled:hover:bg-fam-cancel-request aria-disabled:hover:bg-fam-cancel-request',
  ghost:
    'border border-border-strong bg-transparent text-muted-foreground hover:bg-accent ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
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
