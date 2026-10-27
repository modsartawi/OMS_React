import type { ComponentProps } from 'react'
import { LINE_CONTROL, useControlWiring } from './field-control'

export type SelectProps = ComponentProps<'select'>

/**
 * The shared dropdown (ticket 595, spec 590): the native `<select>` in the field look, so the
 * browser keeps its own keyboard and picker. Children are native `<option>`s — a string-only
 * sink, so a data value in one goes through `fsi()` (`.claude/rules/bidi.md`).
 *
 * Inside a `Field` it takes the Field's id, description and validity, as `Input` does.
 * `className` lands on the `<select>`; a `ref` reaches it.
 */
export default function Select({ className = '', id, children, ...rest }: SelectProps) {
  const wiring = useControlWiring({ id, 'aria-describedby': rest['aria-describedby'], 'aria-invalid': rest['aria-invalid'] })
  return (
    <select className={`${LINE_CONTROL} ps-2.5 pe-1.5 ${className}`} {...rest} {...wiring}>
      {children}
    </select>
  )
}
