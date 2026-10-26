import type { ComponentProps } from 'react'
import { Search } from 'lucide-react'
import { LINE_CONTROL, controlWiring, linePadding, useFieldWiring } from './field-control'

export type InputProps = ComponentProps<'input'>

/**
 * The shared one-line field (ticket 595, spec 590): text, number, date, search — the native
 * `type` picks which. Every other prop is the native input's, and a `ref` reaches the `<input>`.
 *
 * - **Inside a `Field`** it takes the Field's id, description and validity, unless it states
 *   its own (`id`, `aria-describedby`, `aria-invalid`).
 * - **Invalid** is `aria-invalid`: the edge turns `--danger` and a screen reader announces it.
 * - **`type="search"`** carries its own leading icon. The input then sits in a wrapper, and
 *   `className` lands on that wrapper (size it like any input: `w-64`, `w-full`).
 *   For every other type `className` lands on the `<input>`.
 *
 * No value is formatted here: isolating a machine value (`dir="ltr"`, `font-mono`) is the
 * caller's, through `className` / `dir` (`.claude/rules/bidi.md`).
 */
export default function Input({ className = '', type = 'text', id, ...rest }: InputProps) {
  const wiring = controlWiring(useFieldWiring(), {
    id,
    'aria-describedby': rest['aria-describedby'],
    'aria-invalid': rest['aria-invalid'],
  })
  if (type !== 'search') {
    return <input type={type} className={`${LINE_CONTROL} ${linePadding(type)} ${className}`} {...rest} {...wiring} />
  }
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <Search
        className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground"
        aria-hidden
      />
      <input type="search" className={`${LINE_CONTROL} w-full ps-7 pe-3`} {...rest} {...wiring} />
    </span>
  )
}
