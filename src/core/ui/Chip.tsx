import type { ComponentProps, ReactNode } from 'react'
import { chipClass, chipState, type ChipVariant } from './control-classes'

export type { ChipVariant } from './control-classes'

export interface ChipProps
  extends Omit<ComponentProps<'button'>, 'aria-pressed' | 'aria-selected' | 'role' | 'children'> {
  /** Whether the chip is on: pressed (`toggle`) or selected (`tab`). */
  on: boolean
  /** `toggle` (default) exposes `aria-pressed`; `tab` is `role="tab"` with `aria-selected`, inside a `role="tablist"`. */
  variant?: ChipVariant
  children: ReactNode
}

/**
 * The shared chip (ticket 594): a pill at h-7 that is on or off. Off is the card
 * ground with the border; on is the `--primary-050` ground with `--primary-800`
 * ink and the primary border. The look is keyed off the state attribute the
 * variant exposes, so what an operator sees and what a screen reader hears
 * cannot disagree. A tab bar's roving `tabIndex` and arrow keys stay with the
 * tab bar that owns them.
 */
export default function Chip({ on, variant = 'toggle', className = '', children, ...rest }: ChipProps) {
  return (
    <button type="button" className={chipClass(variant, className)} {...chipState(variant, on)} {...rest}>
      {children}
    </button>
  )
}
