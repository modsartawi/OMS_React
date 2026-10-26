import type { ComponentProps, ReactNode } from 'react'
import { iconButtonClass, type IconButtonSize, type IconButtonVariant } from './control-classes'

export type { IconButtonSize, IconButtonVariant } from './control-classes'

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label' | 'children'> {
  /**
   * The accessible name — required, because an icon is no name. Already
   * translated (`t('ns:key')`). It also becomes the tooltip unless `title` is given.
   */
  label: string
  /** The icon, `aria-hidden` (e.g. `<X className="size-3.5" aria-hidden />`). */
  children: ReactNode
  variant?: IconButtonVariant
  size?: IconButtonSize
}

/**
 * The shared icon-only button (ticket 594): a square at h-7 with the Button's
 * hover, focus and disabled treatment. Disabled-with-a-reason works as on
 * `Button`: pass `aria-disabled` (it stays focusable) and the reason as `title`,
 * and guard `onClick`. A pressed icon toggle passes `aria-pressed` and its glyph
 * lights in primary ink.
 */
export default function IconButton({
  label,
  title,
  variant = 'ghost',
  size = 'default',
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      className={iconButtonClass(variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  )
}
