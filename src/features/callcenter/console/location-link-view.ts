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
import { apiErrorCode, apiErrorKind, apiErrorMessage } from '@/core/api'
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
 * What a `CCL-` code means for the HELD link, whichever link call answered it (§4) — the one
 * table the Send, poll, Discard and Apply placements share:
 * - `hide`: `CCL-00001`, not configured — the action (and any card) goes for the order;
 * - `gone`: `CCL-00006`, no such link for this agent — drop it, offer Send again;
 * - `refetch`: `CCL-00031`, already applied or discarded — re-read the order and the link;
 * - `retry`: `CCL-00030`, nothing captured yet — keep waiting.
 * Each caller takes the fates its call can meet; anything else is that call's own to word.
 */
export type LinkFate = 'hide' | 'gone' | 'refetch' | 'retry'

const LINK_FATE: Readonly<Record<string, LinkFate>> = {
  [CCL.notConfigured]: 'hide',
  [CCL.noSuchLink]: 'gone',
  [CCL.alreadyStamped]: 'refetch',
  [CCL.nothingCaptured]: 'retry',
}

export function linkFate(code: string | null): LinkFate | null {
  return (code && LINK_FATE[code]) || null
}

/**
 * Where a Send refusal is drawn (§4).
 * - `mobile`: inline at the number (an invalid mobile, in the validator's words);
 * - `dialog`: in the dialog, the server's sentence (`text`) or the console's own (`key`);
 *   `cooldown` when the text may already have gone (below);
 * - `hide`: not configured — the action goes and the dialog closes.
 */
export type SendRefusal =
  | { at: 'mobile'; text: string }
  | { at: 'dialog'; text: string }
  | { at: 'dialog'; key: string; cooldown?: true }
  | { at: 'hide' }

/** The send's own codes, worded by the console. An unknown caller (`CCL-00005`) is the
 *  generic line, never the server's sentence (§4). */
const SEND_KEYS: Readonly<Record<string, string>> = {
  [CCL.orderLimit]: 'location.refused.orderLimit',
  [CCL.mobileDailyLimit]: 'location.refused.mobileDailyLimit',
  [CCL.callerUnknown]: 'location.send.failed',
}

export function sendRefusal(err: unknown): SendRefusal {
  const code = apiErrorCode(err)
  const text = apiErrorMessage(err, '')
  if (linkFate(code) === 'hide') return { at: 'hide' }
  if (code === CCL.mobileInvalid) return { at: 'mobile', text }
  if (code && SEND_KEYS[code]) return { at: 'dialog', key: SEND_KEYS[code] }
  // 🚩 A server or network failure may land AFTER the server committed the link and queued the
  // text (spec 2482: "the seat sees the error; Resend then supersedes the orphan link"). An
  // immediate retry would meet the 30 s cooldown (`CCL-00008`), so the console words it as
  // "wait, then send again" and runs the same cooldown on its own clock.
  const kind = apiErrorKind(err)
  if (kind === 'server' || kind === 'network') return { at: 'dialog', key: 'location.send.mayHaveSent', cooldown: true }
  // The cooldown (its message holds the seconds left) and anything else coded keep the
  // server's own sentence (api-envelope rule).
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
  const fate = linkFate(apiErrorCode(err))
  return fate === 'gone' || fate === 'hide' ? fate : 'failed'
}

/**
 * The one act a strip offers (2468): **Resend** while the link is live, **Send again** once it
 * can no longer bring a location — lapsed, replaced, gone, or discarded (576) — and none on
 * `received`, which the card replaces.
 */
export function stripAct(kind: StripKind): 'resend' | 'sendAgain' | null {
  if (kind === 'waiting' || kind === 'unreachable') return 'resend'
  if (kind === 'received') return null
  return 'sendAgain'
}

/**
 * Where a **Discard** refusal is drawn (576; §2 — a link call, so a 400 whose
 * `errors[0].errorCode` is the `CCL-` code itself, not the verbs' `detail.code`).
 * - `refetch`: `CCL-00031`, already applied or discarded — re-read the order and the link;
 *   the capture's own stamp then draws the chip or the strip;
 * - `gone`: `CCL-00006`, no such link for this agent — drop the card, offer Send again;
 * - `hide`: `CCL-00001`, not configured;
 * - `card`: anything else, on the card, in the server's words where it gave any.
 */
export type DiscardRefusal =
  | { at: 'refetch' }
  | { at: 'gone' }
  | { at: 'hide' }
  | { at: 'card'; text: string }
  | { at: 'card'; key: string }

export function discardRefusal(err: unknown): DiscardRefusal {
  const fate = linkFate(apiErrorCode(err))
  if (fate === 'refetch' || fate === 'gone' || fate === 'hide') return { at: fate }
  const text = apiErrorMessage(err, '')
  return text ? { at: 'card', text } : { at: 'card', key: 'location.card.discardFailed' }
}

/** What the panel is showing for the held link: the strip, the card (an unapplied capture), or
 *  the chip (applied). */
export type LocationFace = 'strip' | 'card' | 'chip'
export type ResendStep = 'confirm' | 'discard' | 'send'

/**
 * Resend's steps from each face (2468: **there is never more than one card**). Over an unapplied
 * card it asks *"Discard the received location and send a new link?"*; yes stamps the discard,
 * then sends — the send only after the discard lands. Over the chip it is free: the new
 * capture's card compares against the order's current values, which already hold the first.
 */
export function resendSteps(face: LocationFace): ResendStep[] {
  return face === 'card' ? ['confirm', 'discard', 'send'] : ['send']
}

/** The applied chip's memory: the order's `addressNumber` when the chip was first shown, and
 *  whether the order has since left it. */
export interface AppliedChip {
  addressNumber: string | null
  cleared: boolean
}

/**
 * The chip, after the order's address reads `addressNumber` (576). On this seat `setAddress`
 * refills the session's pin from the newly picked book row (BackOffice 861), so the applied pin
 * goes with the old address and the chip reads *"Location cleared - address changed"*.
 *
 * 🚩 **Detected by the `addressNumber`, never by the pin**: the new book row may carry a pin
 * of its own. Once cleared it stays cleared — going back to the first address refills THAT
 * row's own pin, not the capture (unless it was saved to the customer, which the chip cannot
 * tell).
 */
export function chipAfter(chip: AppliedChip | null, addressNumber: string | null): AppliedChip {
  if (chip === null) return { addressNumber, cleared: false }
  return { addressNumber: chip.addressNumber, cleared: chip.cleared || chip.addressNumber !== addressNumber }
}
