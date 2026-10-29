import type { TFunction } from 'i18next'
import type { HungerStationPromotionJobStatus, HungerStationPromotionStatus } from '@/core/models/hungerstation'
import type { Severity } from '@/core/ui/severity'

// The words and tones of a HungerStation promotion (BackOffice spec 3201 § Status, ticket 665): its
// status and each part's job status. Pure apart from the `t` a caller passes — each label hands
// back a KEY in `hungerstation-promotions`, and a value the contract does not name comes back as
// itself, so a status is never blank.

/** The statuses, in their life order. `scheduled` and `ended` are derived from the window by the
 *  server, never stored. */
export const PROMOTION_STATUSES: readonly HungerStationPromotionStatus[] = [
  'draft',
  'sending',
  'live',
  'livePartlyRefused',
  'failed',
  'switchedOff',
  'replaced',
  'scheduled',
  'ended',
]

const STATUS_SEV: Record<HungerStationPromotionStatus, Severity> = {
  draft: 'mute',
  // HungerStation has not answered every part yet: in motion.
  sending: 'go',
  live: 'ok',
  // Live, but HungerStation refused some stores or SKUs: a person should look.
  livePartlyRefused: 'warn',
  failed: 'bad',
  switchedOff: 'mute',
  replaced: 'mute',
  // Sent; its start is still ahead.
  scheduled: 'go',
  ended: 'mute',
}

/** A promotion status's key and tone; one the contract does not name has no key (shown raw). */
export function promotionStatusLabel(status: string): { key: string | null; sev: Severity } {
  return Object.hasOwn(STATUS_SEV, status)
    ? { key: `statuses.${status}`, sev: STATUS_SEV[status as HungerStationPromotionStatus] }
    : { key: null, sev: 'mute' }
}

/** A status in words — its own, or the value as sent; a blank one as a dash. */
export function promotionStatusText(t: TFunction, status: string): string {
  const { key } = promotionStatusLabel(status)
  return key ? t(key) : status || '—'
}

const JOB_SEV: Record<HungerStationPromotionJobStatus, Severity> = {
  QUEUED: 'go',
  COMPLETED: 'ok',
  FAILED: 'bad',
  // HungerStation already had exactly this request: nothing changed there.
  DUPLICATE: 'mute',
}

/**
 * A part's (or a send's) job status. `null` = never sent. A job still QUEUED after 24 hours is
 * `unanswered` — left for a manual Refresh — and reads so, on the attention tone. A status the
 * contract does not name is shown raw, neutral.
 */
export function jobStatusLabel(status: string | null, unanswered = false): { key: string | null; sev: Severity; raw: string | null } {
  if (status === null) return { key: 'jobStatuses.none', sev: 'mute', raw: null }
  if (status === 'QUEUED' && unanswered) return { key: 'jobStatuses.unanswered', sev: 'warn', raw: null }
  return Object.hasOwn(JOB_SEV, status)
    ? { key: `jobStatuses.${status}`, sev: JOB_SEV[status as HungerStationPromotionJobStatus], raw: null }
    : { key: null, sev: 'mute', raw: status }
}
