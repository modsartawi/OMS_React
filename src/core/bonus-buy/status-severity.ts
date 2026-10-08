// The BBY Inquiry value → `Severity` maps (ticket 086). The header status's own map
// moved to `./status` with the status reading (ticket 442); the validity marker's
// stays here.
//
// Pure: no React, no i18n. The label beside the badge is always resolved through
// `t()`, so colour is never the only channel (WCAG).

import type { Severity } from '@/core/ui/severity'
import type { ValidityState } from './detail-view'

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
