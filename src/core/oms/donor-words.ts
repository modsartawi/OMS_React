/**
 * A donor request's codes in words (ticket 672, BackOffice spec 3242). Pure: no React; the words live in the
 * `donor-words` namespace, which this core module owns (as `core/attachments` owns `attachments`), so the donor
 * request grid, its inspector, the Delivery activity spine and the Pick support timeline all say a code alike.
 *
 * - **Hook reasons** — the `outcomeReason` of a request CANCELLED by its host's own follow-up rather than by a
 *   person (BackOffice `DonorHookReasons`). The English is the till's (`DonorRequestWords.CancelReason`).
 * - **Trail events** — the two 3239 adds: `REKEY` (a donor request's event: the adoption moved it onto a session)
 *   and `DONOR_CARRIED` (the session's event for the same act). The English is the till's
 *   (`PrescriptionSessionWords.Event`).
 *
 * An unknown code is shown raw, exactly as before (`{ key: null, raw }`); a blank one is no words at all.
 */
import type { TFunction } from 'i18next'

export const DONOR_HOOK_REASONS = [
  'DELIVERY_CLOSED',
  'DELIVERY_FORCE_CLOSED',
  'DELIVERY_STORE_CHANGED',
  'HOST_CANCELLED',
  'HOST_STORE_CHANGED',
] as const
export type DonorHookReason = (typeof DONOR_HOOK_REASONS)[number]

export const DONOR_EVENT_TYPES = ['REKEY', 'DONOR_CARRIED'] as const
export type DonorEventType = (typeof DONOR_EVENT_TYPES)[number]

/** A code's words: the i18n key (namespace included) when the code is known, and the code as sent. */
export interface DonorWord {
  key: string | null
  raw: string
}

function word(list: readonly string[], group: string, code: string | null | undefined): DonorWord | null {
  const raw = (code ?? '').trim()
  if (!raw) return null
  const norm = raw.toUpperCase()
  return { key: list.includes(norm) ? `donor-words:${group}.${norm}` : null, raw }
}

export const donorReasonWord = (code: string | null | undefined) => word(DONOR_HOOK_REASONS, 'reason', code)
export const donorEventWord = (code: string | null | undefined) => word(DONOR_EVENT_TYPES, 'event', code)

/** A reason as text: its words when it is a hook reason, else the code as sent; `''` for none. Grid-safe (no isolates). */
export function donorReasonText(t: TFunction, code: string | null | undefined): string {
  const w = donorReasonWord(code)
  if (!w) return ''
  return w.key ? t(w.key) : w.raw
}
