// The BBY Inquiry value → `Severity` maps (ticket 086). One module, because the
// grid columns and the Details modal both badge the same header status and had
// drifted into two identical copies of a class-string map — precisely the drift
// the core severity vocabulary exists to stop.
//
// Pure: no React, no i18n. The label beside the badge is always resolved through
// `codeLabels` + `t()`, so colour is never the only channel (WCAG).

import type { Severity } from '@/core/ui/severity'
import type { ValidityState } from './detail-view'

/**
 * BBY header status → severity, preserving the hues the two class-string copies
 * already carried. `A` Activated is complete and in force (`ok`); `D` Draft is
 * unfinished and needs a human before it can price anything (`warn`); `X` Deleted
 * ended terminally (`bad`); `I` Inactive is a neutral resting state (`mute`). An
 * unknown SAP code degrades to `mute` — the same fall-through `codeLabelKey`
 * gives its label.
 */
export function statusSeverity(code: string): Severity {
  if (code === 'A') return 'ok'
  if (code === 'D') return 'warn'
  if (code === 'X') return 'bad'
  return 'mute'
}

/**
 * Validity marker → severity. Classified as **severity, not categorical** (ticket
 * 086's open question): a live window is the state an operator acts on, and it is
 * exactly D-5's `go` — "actively in motion". Note it is `go`, not `ok`: the window
 * being open is motion, not a good outcome, and `ok` is already spent on the
 * Activated status badge sitting next to it. Ended / not-yet-started are positions
 * on a timeline with no severity, so they take the one neutral spelling.
 */
export function validitySeverity(validity: Exclude<ValidityState, null>): Severity {
  return validity === 'live' ? 'go' : 'mute'
}
