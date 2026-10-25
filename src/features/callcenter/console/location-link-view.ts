/**
 * The location link's reading on the console (574, BackOffice spec 2482, contract v1.12
 * §2/§4/§5) — pure, so the strip's every state and the send dialog's two rules are proved
 * without a browser.
 *
 * - **The strip** (`stripView`): the server's latest status plus the console's own clock →
 *   waiting (with mm:ss) / unreachable / expired / replaced / received. 575 turns *received*
 *   into the card; 576 adds discarded.
 * - **The send** (`sendBody`, `mobileWasTyped`, `sendRefusal`): the body field for field, and
 *   where each `CCL-` refusal is drawn.
 *
 * 🚩 **The server is the clock that matters.** `secondsLeft` is the server's, re-read every
 * poll; between reads the console only counts it down. It never decides a link has lapsed by
 * its own arithmetic — at 00:00 it keeps waiting until the server says `Lapsed`.
 */
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import {
  CCL,
  type LocationLinkSendRequest,
  type LocationLinkStatusValue,
  type SessionCapabilities,
} from '@/core/models/callcenter'

/** The Resend cooldown (§5): 30 s, counted from the console's own last send. */
export const RESEND_COOLDOWN_MS = 30_000
/** Continuous poll failure before the strip says it cannot reach the server (§5). */
export const UNREACHABLE_AFTER_MS = 30_000
/** The status poll's pace (§5). Failed polls retry at the same pace. */
export const LOCATION_POLL_MS = 3_000

/** `seconds` as `mm:ss` — whole seconds, never below zero. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const mm = String(Math.floor(whole / 60)).padStart(2, '0')
  const ss = String(whole % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** Seconds until Resend may be pressed again, rounded up — `0` once it may. */
export function resendCooldownSeconds(lastSentAt: number, now: number): number {
  const left = RESEND_COOLDOWN_MS - (now - lastSentAt)
  return left <= 0 ? 0 : Math.ceil(left / 1000)
}

/** `gone` (the link is no longer the agent's) and `discarded` are the panel's own facts, never
 *  `stripView`'s: they come from a refusal or a stamp, not from the clock or the status. */
export type StripKind = 'waiting' | 'unreachable' | 'expired' | 'replaced' | 'received' | 'gone' | 'discarded'

export interface StripInput {
  /** The console's clock at the Send answer (the latest send, Resend included). */
  sentAt: number
  /** `secondsLeft` on that Send answer. */
  sentSecondsLeft: number
  /** The latest SUCCESSFUL status read for the latest token, or `null` before one lands. */
  read: { status: LocationLinkStatusValue; secondsLeft: number; at: number } | null
  /** When the current run of failed polls began, `null` while the last poll succeeded. */
  failingSince: number | null
  now: number
}

export interface StripView {
  kind: StripKind
  /** The countdown, `mm:ss`, on `waiting` only. */
  clock: string | null
  /** Seconds left on the Resend cooldown. */
  resendIn: number
  /** Whether the status poll should still run — until Captured, Lapsed or Superseded. */
  polling: boolean
}

const DECIDED: Partial<Record<LocationLinkStatusValue, StripKind>> = {
  Captured: 'received',
  Lapsed: 'expired',
  Superseded: 'replaced',
}

/** The strip's one state, from the latest status and the clock. */
export function stripView({ sentAt, sentSecondsLeft, read, failingSince, now }: StripInput): StripView {
  const resendIn = resendCooldownSeconds(sentAt, now)
  const decided = read ? DECIDED[read.status] : undefined
  if (decided) return { kind: decided, clock: null, resendIn, polling: false }
  if (failingSince !== null && now - failingSince >= UNREACHABLE_AFTER_MS)
    return { kind: 'unreachable', clock: null, resendIn, polling: true }
  // The newest of the two server clocks: a poll after the send, else the send itself.
  const basis = read && read.at >= sentAt ? { left: read.secondsLeft, at: read.at } : { left: sentSecondsLeft, at: sentAt }
  // Elapsed never negative: the shared 1 s clock may have last ticked before the answer landed.
  const left = basis.left - Math.floor(Math.max(0, now - basis.at) / 1000)
  return { kind: 'waiting', clock: formatClock(left), resendIn, polling: true }
}

/** Arabic-Indic and Eastern Arabic-Indic digits → ASCII, so a number typed on an Arabic
 *  keyboard compares as the same number. */
function asciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf))
}

/**
 * One Saudi mobile in one spelling (`05…`), **for comparison only** — never sent. The
 * server owns normalisation (`MobileNumberValidator`); this only stops the customer's own
 * number, re-typed as `9665…`, `+966 5…` or with spaces, from being recorded as an override.
 */
function comparableMobile(text: string): string {
  let digits = asciiDigits(text).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('966')) digits = digits.slice(3)
  if (digits.length === 9 && digits.startsWith('5')) digits = `0${digits}`
  return digits
}

/** `mobileWasTyped` (§2): true when the number is not the attached customer's, in any
 *  spelling of it — and for any number when the order has no customer mobile. */
export function mobileWasTyped(customerMobile: string | null | undefined, mobile: string): boolean {
  if (!customerMobile) return true
  return comparableMobile(customerMobile) !== comparableMobile(mobile)
}

/** `POST CallCenterWeb/LocationLinks/Send`'s body, field for field. The number goes as the
 *  agent left it (trimmed): the server validates and normalises it. */
export function sendBody(
  transactionId: string,
  customerMobile: string | null | undefined,
  mobile: string,
): LocationLinkSendRequest {
  const typed = mobile.trim()
  return {
    seatKind: 'OMSWEB',
    orderContextId: transactionId,
    mobile: typed,
    mobileWasTyped: mobileWasTyped(customerMobile, typed),
  }
}

/** Whether *Send location link* is drawn at all. **Hidden, never disabled** (§1): `false`
 *  means not an open delivery, or not configured on this SIS.Api — and absent (a pre-1.12
 *  server) reads as `false`. */
export function showsSendAction(capabilities: SessionCapabilities): boolean {
  return capabilities.canSendLocationLink === true
}

/**
 * Where a Send refusal is drawn (§4).
 * - `mobile`: inline at the number (an invalid mobile, in the validator's words);
 * - `dialog`: in the dialog, the server's sentence (`text`) or the console's own (`key`);
 * - `hide`: not configured — the action goes and the dialog closes.
 */
export type SendRefusal =
  | { at: 'mobile'; text: string }
  | { at: 'dialog'; text: string }
  | { at: 'dialog'; key: string }
  | { at: 'hide' }

export function sendRefusal(err: unknown): SendRefusal {
  const code = apiErrorCode(err)
  const text = apiErrorMessage(err, '')
  switch (code) {
    case CCL.notConfigured:
      return { at: 'hide' }
    case CCL.mobileInvalid:
      return { at: 'mobile', text }
    case CCL.orderLimit:
      return { at: 'dialog', key: 'location.refused.orderLimit' }
    case CCL.mobileDailyLimit:
      return { at: 'dialog', key: 'location.refused.mobileDailyLimit' }
  }
  // The cooldown (its message holds the seconds left), an unknown caller, and anything
  // else coded keep the server's own sentence (api-envelope rule).
  return text ? { at: 'dialog', text } : { at: 'dialog', key: 'location.send.failed' }
}

/**
 * Whether ending this order (submit, abandon, start fresh) owes the server a `Retire` (§2).
 * 🚩 **The server does not retire for us.** So the console retires any order that could have
 * sent a link, any order this tab DID send one on (it may have flipped to collection since),
 * and any order it never read (another tab may have sent one). Only an order known never to
 * have been able to send one is skipped, so an unconfigured SIS.Api is not asked on every
 * submit.
 */
export function shouldRetire(
  state: { capabilities: SessionCapabilities } | undefined,
  sentHere: boolean,
): boolean {
  return sentHere || state === undefined || state.capabilities.canSendLocationLink === true
}

/**
 * What a status poll's REFUSAL means (§4) — as against a poll that never answered.
 * - `gone`: `CCL-00006`, no such link for this agent (or not theirs). The server has answered
 *   and will answer the same again, so it is not a failed poll: the link is dropped and the
 *   strip offers Send again (574 counted it toward "can't reach the server");
 * - `hide`: `CCL-00001`, not configured — the action goes for the rest of the order;
 * - `failed`: anything else, retried quietly at the same pace.
 */
export function pollRefusal(err: unknown): 'gone' | 'hide' | 'failed' {
  const code = apiErrorCode(err)
  if (code === CCL.noSuchLink) return 'gone'
  if (code === CCL.notConfigured) return 'hide'
  return 'failed'
}
