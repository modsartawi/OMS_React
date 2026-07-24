// Pure, framework-free helpers for the Ua Admin screen: the client-side status
// derivation the mock computes, zone-safe stamp formatting, and the temp-password
// generator. i18n text lives in the ua-admin namespace; these return keys/severities.

import type { Severity } from '@/core/ui/severity'

/** Status key (→ i18n `status.<key>`) + the severity the badge paints (ticket 086 —
 *  the tone map that used to live here graduated to `@/core/ui/severity`). */
export interface DerivedStatus {
  key: string
  sev: Severity
}

/** The two delivery channels (UaDeliveryChannels) — where one-time codes go. */
export type DeliveryChannel = 'sms' | 'email'
export const DELIVERY_CHANNELS: DeliveryChannel[] = ['sms', 'email']

/**
 * Mirror of the server's `UaDeliveryChannels.Normalize`: anything that is not the
 * word `email` — blank, whitespace, an unrecognised word — READS as `sms`. Both
 * read paths already normalize, so this is belt-and-braces for a legacy row that
 * reaches a pane by another route; it must never diverge from the server rule.
 */
export function normalizeChannel(raw: string | null | undefined): DeliveryChannel {
  return (raw ?? '').trim().toLowerCase() === 'email' ? 'email' : 'sms'
}

interface ContactInputs {
  phoneClass: string
  email?: string
  deliveryChannel?: string
}

/**
 * Can the CHOSEN channel actually reach this person? The server accepts an
 * identity marked `email` with no address — spec 718 makes that a deliberate,
 * visible state rather than a silent fallback to SMS — so the screen is what
 * has to show it (ticket 722).
 */
export function hasDestination(p: ContactInputs): boolean {
  return normalizeChannel(p.deliveryChannel) === 'email'
    ? (p.email ?? '').trim() !== ''
    : p.phoneClass === 'usable'
}

/**
 * The class a phone BOX's current text stands for, while it is being edited.
 * Unchanged text keeps the server's classification — only the server knows a
 * placeholder number from a real one — but text the administrator has just
 * changed can honestly only be judged blank-or-not until it is saved and read
 * back. `stored` omitted (the create modal) means there is nothing to compare to.
 */
export function typedPhoneClass(typed: string, stored?: string, storedClass?: string): string {
  if (stored !== undefined && typed.trim() === stored.trim()) return storedClass ?? 'missing'
  return typed.trim() === '' ? 'missing' : 'usable'
}

/** Channel badge (→ i18n `delivery.<key>`) + the severity it paints. A channel
 *  with no destination is `bad`, not `warn`: that person cannot be reached at
 *  all. A reachable channel is neutral — it is a fact, not a state. */
export function channelMark(p: ContactInputs): DerivedStatus {
  const channel = normalizeChannel(p.deliveryChannel)
  return hasDestination(p)
    ? { key: channel, sev: 'mute' }
    : { key: channel === 'email' ? 'emailNoDestination' : 'smsNoDestination', sev: 'bad' }
}

interface StatusInputs extends ContactInputs {
  isSeeded: boolean
  isActive: boolean
  credentialState: string
}

/**
 * The single tri-/multi-state a person is in, derived client-side from the raw
 * codes (contract 414 §5) exactly as the confirmed 390 mock does: not-seeded →
 * disabled → (no credential ? awaiting-activation | blocked-no-destination) →
 * must-change → active.
 *
 * The blocked branch asks the CHOSEN channel, not the phone (ticket 722): an
 * Egypt collector on the email channel self-activates by email, so reading their
 * (rightly) empty phone as "blocked" would flag a person who is fine — and a
 * phone-owning person marked `email` with no address would read as ready when
 * nothing can reach them.
 */
export function deriveStatus(p: StatusInputs): DerivedStatus {
  if (!p.isSeeded) return { key: 'notSeeded', sev: 'bad' }
  if (!p.isActive) return { key: 'disabled', sev: 'mute' }
  if (p.credentialState === 'none') {
    if (hasDestination(p)) return { key: 'awaitingActivation', sev: 'warn' }
    return normalizeChannel(p.deliveryChannel) === 'email'
      ? { key: 'blockedNoEmail', sev: 'bad' }
      : { key: 'blockedNoPhone', sev: 'bad' }
  }
  if (p.credentialState === 'temporary-must-change') return { key: 'mustChange', sev: 'warn' }
  return { key: 'active', sev: 'ok' }
}

/** raw credentialState code → i18n key under `credential.*`. */
export function credentialKey(state: string): string {
  if (state === 'temporary-must-change') return 'mustChange'
  if (state === 'active') return 'active'
  return 'none'
}

/**
 * Render a server DateTime EXACTLY as stored, with no timezone math — the audit
 * column mixes Ua-local and legacy-UTC rows with no per-row zone indicator, so
 * any `new Date()` round-trip would silently shift the legacy rows (contract §5,
 * no-utc-time rule). Pure string slice: "2026-07-14T11:03:22" → "2026-07-14 11:03".
 */
export function formatStamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  return iso.replace('T', ' ').slice(0, 16)
}

// An unambiguous alphabet (no O/0/I/l/1) for a password read aloud over the phone.
const PWD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/**
 * A one-time temporary password generated CLIENT-side and shown once (contract
 * §4). Fixed affixes guarantee upper+lower+digit+symbol; 10 random core chars via
 * crypto make it unguessable. Length 14 clears the server's min-8 policy with room
 * to spare, and being random it always differs from the current password.
 */
export function generateTempPassword(): string {
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  let core = ''
  for (let i = 0; i < bytes.length; i++) core += PWD_CHARS[bytes[i] % PWD_CHARS.length]
  return `Dm$${core}9k` // Dm$ + 10 core + 9k → upper/lower/digit/symbol, len 15
}
