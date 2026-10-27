import { SEVERITY_BADGE, type Severity } from '@/core/ui/severity'
import type { OrderGuardState } from './guard-check'
import { GUARD_SEVERITIES, type GuardSeverity } from './model'

// The insurance rules area's colour words, one map per meaning (review 3126 S6).

/** An order's guard state, as the order list's cell and the order's guard panel draw it (oms 616). */
export const ORDER_GUARD_STATE_SEV: Record<OrderGuardState, Severity> = { none: 'mute', actionNeeded: 'warn', pending: 'go', unchecked: 'mute' }

/**
 * A guard's severity, REFUSE > OVERRIDE > WARN: danger, violet (`post`), attention. OVERRIDE takes the `post`
 * family (the prototype's violet; `StatusBadge` has no violet severity). `badge` is the pill, `text` a figure
 * in that tone, `fill` a bar segment.
 */
export interface SeverityTone {
  badge: string
  text: string
  fill: string
}

export const GUARD_SEVERITY_TONE: Record<GuardSeverity, SeverityTone> = {
  REFUSE: { badge: SEVERITY_BADGE.bad, text: 'text-danger-800', fill: 'bg-danger' },
  OVERRIDE: { badge: 'bg-post-050 text-post-800', text: 'text-post-800', fill: 'bg-post' },
  WARN: { badge: SEVERITY_BADGE.warn, text: 'text-attention-800', fill: 'bg-attention' },
}

const MUTE: SeverityTone = { badge: SEVERITY_BADGE.mute, text: 'text-muted-foreground', fill: 'bg-muted-foreground' }

/** The tone of a severity in any casing (`REFUSE`, `refuse`); an unknown one is muted. */
export function guardSeverityTone(severity: string): SeverityTone {
  const s = severity.toUpperCase() as GuardSeverity
  return (GUARD_SEVERITIES as readonly string[]).includes(s) ? GUARD_SEVERITY_TONE[s] : MUTE
}
