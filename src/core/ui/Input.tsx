import type { ComponentProps } from 'react'
import { Search } from 'lucide-react'
import { LINE_CONTROL, linePadding, useControlWiring } from './field-control'

export interface InputProps extends ComponentProps<'input'> {
  /**
   * Draw the leading search icon. On by default for `type="search"`; a combobox that must stay
   * `type="text"` (no native clear button, no Esc-clears) sets it to show the same icon.
   */
  searchIcon?: boolean
  /**
   * With the search icon, the input sits in a wrapper: this lays that wrapper out (size it like
   * any input: `w-64`, `w-full`, `flex-1`). Ignored without the icon.
   */
  wrapperClassName?: string
}

/**
 * The shared one-line field (ticket 595, spec 590): text, number, date, search — the native
 * `type` picks which. Every other prop is the native input's, and a `ref` reaches the `<input>`.
 *
 * - **Inside a `Field`** it takes the Field's id, description and validity, unless it states
 *   its own (`id`, `aria-describedby`, `aria-invalid` — an explicit `false` included); a stated
 *   `id` becomes the Field's, so the label still points at it.
 * - **Invalid** is `aria-invalid`: the edge turns `--danger` and a screen reader announces it.
 * - **`className` always lands on the `<input>`.** With the search icon (`type="search"`, or
 *   `searchIcon`) the input fills a wrapper that `wrapperClassName` sizes.
 *
 * No value is formatted here: isolating a machine value (`dir="ltr"`, `font-mono`) is the
 * caller's, through `className` / `dir` (`.claude/rules/bidi.md`).
 */
export default function Input({
  className = '',
  wrapperClassName = '',
  type = 'text',
  searchIcon = type === 'search',
  id,
  ...rest
}: InputProps) {
  const wiring = useControlWiring({ id, 'aria-describedby': rest['aria-describedby'], 'aria-invalid': rest['aria-invalid'] })
  if (!searchIcon) {
    return <input type={type} className={`${LINE_CONTROL} ${linePadding(type)} ${className}`} {...rest} {...wiring} />
  }
  return (
    <span className={`relative inline-flex items-center ${wrapperClassName}`}>
      <Search className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground" aria-hidden />
      <input type={type} className={`${LINE_CONTROL} w-full ps-7 pe-3 ${className}`} {...rest} {...wiring} />
    </span>
  )
}
