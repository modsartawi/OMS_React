import { createContext, useContext } from 'react'

/**
 * The shared field look and wiring (ticket 595, spec 590 §Shared controls, map 580's 588).
 *
 * `Input`, `Select` and `Textarea` paint from these strings, and `Field` links its label, hint and
 * error to the one control inside it through {@link FieldContext}. Colour comes only from tokens,
 * so the next theme change is the token table, never this file.
 */

/**
 * What every field shares: the `--input` edge on `--card`, 12px text, the `--ring` focus outline,
 * the disabled look, and the invalid edge. Invalid is read off `aria-invalid` (a variant, so it
 * wins over the resting edge whatever order Tailwind emits), which keeps the look and what a
 * screen reader hears the same fact.
 */
const SHARED =
  'border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground ' +
  'transition-colors outline-none focus:outline-2 focus:outline-offset-1 focus:outline-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-invalid:border-danger'

/**
 * A one-line control (input, select): 28px, the full pill. `rounded-md` is `--radius` less 2px,
 * which at h-7 is half the height — the pill follows the token, not a hard-coded `rounded-full`,
 * so a caller that grows the control (`h-auto`) gets a rounded rectangle, not a capsule.
 */
export const LINE_CONTROL = `h-7 rounded-md ${SHARED}`

/**
 * A one-line control's inline padding: room for the pill's curve, less for a date or time, whose
 * native picker already fills a narrow field. Kept apart from {@link LINE_CONTROL} so a caller's
 * padding never has to win a Tailwind ordering contest against it.
 */
export const linePadding = (type: string | undefined) =>
  type === 'date' || type === 'time' || type === 'datetime-local' || type === 'month' ? 'px-2' : 'px-3'

/** The multi-line control: a rounded rectangle, never a pill (590). */
export const TEXTAREA_CONTROL = `min-h-16 rounded-lg px-3 py-1.5 ${SHARED}`

/** What a Field hands the control inside it. */
export interface FieldWiring {
  controlId: string
  describedBy: string | undefined
  invalid: boolean
}

/** Set by `Field`, read by `Input` / `Select` / `Textarea`. A nested Field overrides its parent. */
export const FieldContext = createContext<FieldWiring | null>(null)

export const useFieldWiring = () => useContext(FieldContext)

/** An `aria-describedby` from the ids present, in order; absent rather than `""` when none. */
export function describedBy(...ids: (string | undefined | null | false)[]): string | undefined {
  const present = ids.filter((id): id is string => typeof id === 'string' && id !== '')
  return present.length ? present.join(' ') : undefined
}

/** The ids a Field gives its hint and error, named after the control's id. */
export function fieldIds(controlId: string, has: { hint: boolean; error: boolean }) {
  const hintId = has.hint ? `${controlId}-hint` : undefined
  const errorId = has.error ? `${controlId}-error` : undefined
  return { controlId, hintId, errorId, describedBy: describedBy(hintId, errorId) }
}

type Aria = boolean | 'true' | 'false' | 'grammar' | 'spelling' | undefined

/**
 * The control's id / description / validity: its own where it states them, else its Field's.
 * The control's own description is kept beside the Field's, never dropped.
 */
export function controlWiring(
  field: FieldWiring | null,
  own: { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: Aria },
): { id: string | undefined; 'aria-describedby': string | undefined; 'aria-invalid': true | 'grammar' | 'spelling' | undefined } {
  const ownInvalid = own['aria-invalid']
  const invalid =
    ownInvalid === true || ownInvalid === 'true' ? true
    : ownInvalid === 'grammar' || ownInvalid === 'spelling' ? ownInvalid
    : field?.invalid ? true
    : undefined
  return {
    id: own.id ?? field?.controlId,
    'aria-describedby': describedBy(field?.describedBy, own['aria-describedby']),
    'aria-invalid': invalid,
  }
}
