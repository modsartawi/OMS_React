import type { ReactNode } from 'react'
import { SEVERITY_BADGE, type Severity } from './severity'

/**
 * The one status badge in the app (spec 082 D-10, ticket 086). Takes a
 * **severity**, never a class string — so a caller cannot invent a sixth colour
 * and no site has to choose between the two idioms that had drifted apart.
 *
 * The label is a **child, never a key**: this component adds no `t()` call and so
 * needs no i18n namespace, which keeps zero-literal a caller concern.
 *
 * There is deliberately **no `className` escape hatch**. It would be the one seam
 * through which a caller could re-add the per-site flourish — or a sixth colour —
 * that this component exists to remove.
 *
 * One shape, deliberately: the same pill renders in a grid cell, a definition
 * list and a modal recap. Sites that used to add their own dot or bump the
 * weight to `font-semibold` lose that flourish — the sameness IS the idiom.
 */
export default function StatusBadge({ sev, children }: { sev: Severity; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[sev]}`}
    >
      {children}
    </span>
  )
}
