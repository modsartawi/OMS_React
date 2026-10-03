import type { TimelineStepKey } from '@/core/oms/timeline'

/**
 * The dot and the word's ink per state (368 §3), shared by the Status column and the
 * inspector's header. *Cancellation requested* is 082's `--fam-cancel-request` indigo, the
 * Request cancellation command's own colour, because asking is not doing; amber stays reserved
 * for attention. *Cancelled* is danger red. Every word's ink is one the contrast gate measures
 * as text on `--card` (Delivered and Cancelled take the `-800` inks for that); the dots are 3:1
 * graphics.
 */
export const STATUS_TONE: Record<TimelineStepKey, { ink: string; dot: string }> = {
  created: { ink: 'text-muted-foreground', dot: 'bg-ink-3' },
  ready: { ink: 'text-muted-foreground', dot: 'bg-ink-3' },
  out: { ink: 'text-primary', dot: 'bg-primary' },
  delivered: { ink: 'text-success-800', dot: 'bg-success' },
  requested: { ink: 'text-fam-cancel-request', dot: 'bg-fam-cancel-request' },
  cancelled: { ink: 'text-danger-800', dot: 'bg-danger' },
}
