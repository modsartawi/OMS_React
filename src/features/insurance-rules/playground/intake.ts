import type { PlaygroundIntake } from '@/core/insurance-rules/playground'

// A Raw experiment's intake (BackOffice 3246; oms ticket 684) → the intake report on Outcome tab A. Pure, defensive
// like `outcomeView`: an absent section reads as empty, an entry without a path is dropped. A data experiment's intake
// is empty, and an empty intake is null: the report is not drawn at all.

export interface IntakeView {
  /** The paths the engine read (`lines[0].quantity`). */
  read: string[]
  /** The keys it ignored, each with its near-miss (`quantity`), or null when it has none. */
  ignored: { path: string; hint: string | null }[]
  /** The values it refused for the wrong type, each with the type it expected (`number`). */
  refused: { path: string; expected: string }[]
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const field = (o: unknown, k: string): unknown => (typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[k] : undefined)

export function intakeView(intake: PlaygroundIntake | null | undefined): IntakeView | null {
  const read = arr(intake?.read).map(text).filter((p): p is string => p !== null)
  const ignored = arr(intake?.ignored).flatMap((e) => {
    const path = text(field(e, 'path'))
    return path ? [{ path, hint: text(field(e, 'hint')) }] : []
  })
  const refused = arr(intake?.refused).flatMap((e) => {
    const path = text(field(e, 'path'))
    return path ? [{ path, expected: text(field(e, 'expected')) ?? '' }] : []
  })
  return read.length || ignored.length || refused.length ? { read, ignored, refused } : null
}
