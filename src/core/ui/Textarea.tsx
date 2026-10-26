import type { ComponentProps } from 'react'
import { TEXTAREA_CONTROL, controlWiring, useFieldWiring } from './field-control'

export type TextareaProps = ComponentProps<'textarea'>

/**
 * The shared multi-line field (ticket 595, spec 590): the field look as a rounded rectangle,
 * never a pill. Size it with `rows` or `className` (`min-h-24`, `w-full`).
 *
 * Inside a `Field` it takes the Field's id, description and validity, as `Input` does.
 * `className` lands on the `<textarea>`; a `ref` reaches it.
 */
export default function Textarea({ className = '', id, ...rest }: TextareaProps) {
  const wiring = controlWiring(useFieldWiring(), {
    id,
    'aria-describedby': rest['aria-describedby'],
    'aria-invalid': rest['aria-invalid'],
  })
  return <textarea className={`${TEXTAREA_CONTROL} ${className}`} {...rest} {...wiring} />
}
