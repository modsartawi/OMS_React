import { useId, useMemo, useState, type ReactNode } from 'react'
import { FieldContext, fieldControlId, fieldIds } from './field-control'

/** The label look of a Field — exported for a label-beside layout that keeps its own `<label htmlFor>`. */
export const FIELD_LABEL = 'text-xs font-medium text-muted-foreground'

export interface FieldProps {
  /** The visible label, from the caller's `t()` key. Linked to the control by `htmlFor` / `id`. */
  label: ReactNode
  /** An optional line under the control, linked through `aria-describedby`. */
  hint?: ReactNode
  /**
   * The error under the control, linked through `aria-describedby`; when present the control is
   * `aria-invalid` and wears the danger edge. Pass `invalid` instead for a state with no words.
   */
  error?: ReactNode
  /** Invalid without an error line (the control is still announced invalid). */
  invalid?: boolean
  /**
   * The control's id, when the caller needs to know it; otherwise one is made. An `id` stated on
   * the control inside wins over both, and the label follows it.
   */
  id?: string
  /** Hide the label visually; it still names the control. */
  hideLabel?: boolean
  /** Lays out the field box (`w-60`, `col-span-2`); never the control. */
  className?: string
  /** Exactly one `Input`, `Select` or `Textarea` — it takes this Field's id and description. */
  children: ReactNode
}

/**
 * A label over one control, with an optional hint and error under it (ticket 595, spec 590):
 * the one layout every form uses, so an operator always finds them in the same place.
 *
 * The wiring is by context: the shared control inside takes the Field's id (the label's
 * `htmlFor`) — or, when it states its own id, the Field adopts that one — its `aria-describedby`
 * (hint, then error) and its validity. A nested Field re-wires its own control, so a range is two
 * Fields side by side, each with its own label. A native control that is not one of the shared
 * three is not wired — use the shared ones.
 */
export default function Field({ label, hint, error, invalid = false, id, hideLabel, className = '', children }: FieldProps) {
  const made = useId()
  const [claimed, claimId] = useState<string | undefined>(undefined)
  const hasError = error !== undefined && error !== null && error !== false && error !== ''
  const ids = fieldIds(fieldControlId({ claimed, id, made }), {
    hint: hint !== undefined && hint !== null,
    error: hasError,
  })
  const wiring = useMemo(
    () => ({ controlId: ids.controlId, describedBy: ids.describedBy, invalid: invalid || hasError, claimId }),
    [ids.controlId, ids.describedBy, invalid, hasError],
  )
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={ids.controlId} className={hideLabel ? 'sr-only' : FIELD_LABEL}>
        {label}
      </label>
      <FieldContext.Provider value={wiring}>{children}</FieldContext.Provider>
      {ids.hintId && (
        <p id={ids.hintId} className="text-[11px] leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
      {ids.errorId && (
        <p id={ids.errorId} className="text-[11px] leading-snug text-danger-800">
          {error}
        </p>
      )}
    </div>
  )
}
