// Pure, framework-free helpers for the Send Broadcast compose screen (spec 031).
// Validation mirrors the server's ValidateCreateRequest (024 §Create): title
// 1–200, body 1–1000, a future expiry, and a store required when targeting one
// store. Returns a valid flag + a hint KEY (not text) so the component owns the
// wording (zero-literal rule). The highest, cheapest test seam.

import type { CreateNotificationRequest } from '@/core/models/notifications'

export const TITLE_MAX = 200
export const BODY_MAX = 1000

export type BroadcastChannel = 'all' | 'store'

/** The compose form's editable state. */
export interface ComposeForm {
  title: string
  body: string
  channel: BroadcastChannel
  storeCode: string
  /** A `<input type="date">` value ('YYYY-MM-DD') or '' for the server default. */
  expires: string
}

/** Which inline hint to show; `ready` means the form is valid. */
export type ComposeHint = 'required' | 'tooLong' | 'pickStore' | 'expiryFuture' | 'ready'

export interface ComposeValidation {
  valid: boolean
  hint: ComposeHint
}

/**
 * Validate the compose form against the server's rules. `now` is injected (epoch
 * ms) so the future-expiry check stays pure. Emptiness is checked on trimmed
 * text; the length cap matches the live counter (raw length).
 */
export function validateCompose(form: ComposeForm, now: number): ComposeValidation {
  const titleLen = form.title.length
  const bodyLen = form.body.length
  if (form.title.trim().length === 0 || form.body.trim().length === 0)
    return { valid: false, hint: 'required' }
  if (titleLen > TITLE_MAX || bodyLen > BODY_MAX) return { valid: false, hint: 'tooLong' }
  if (form.channel === 'store' && form.storeCode === '') return { valid: false, hint: 'pickStore' }
  if (form.expires !== '' && !expiryIsFuture(form.expires, now))
    return { valid: false, hint: 'expiryFuture' }
  return { valid: true, hint: 'ready' }
}

/**
 * Whether a chosen expiry date is strictly in the future. A date input is a local
 * calendar day; treat it as end-of-day so "tomorrow" is unambiguously future and
 * a stale/today value that the server would reject (NC_BAD_EXPIRY) is caught here.
 */
function expiryIsFuture(dateStr: string, now: number): boolean {
  const t = Date.parse(`${dateStr}T23:59:59`)
  if (Number.isNaN(t)) return false
  return t > now
}

/**
 * Build the POST Notifications body from the validated form. All ⇒ empty
 * audience key; Store ⇒ the storecode. A blank expiry is OMITTED (server applies
 * its 30-day default); a set expiry is sent as end-of-day ISO so it lands in the
 * future.
 */
export function toCreateRequest(form: ComposeForm): CreateNotificationRequest {
  const req: CreateNotificationRequest = {
    typeCode: 'BROADCAST',
    audienceKind: form.channel === 'all' ? 'All' : 'Store',
    audienceKey: form.channel === 'all' ? '' : form.storeCode,
    title: form.title.trim(),
    body: form.body.trim(),
  }
  if (form.expires !== '') req.expiresAt = new Date(`${form.expires}T23:59:59`).toISOString()
  return req
}

/** The empty compose form (also the post-send reset state). */
export const EMPTY_FORM: ComposeForm = {
  title: '',
  body: '',
  channel: 'all',
  storeCode: '',
  expires: '',
}
