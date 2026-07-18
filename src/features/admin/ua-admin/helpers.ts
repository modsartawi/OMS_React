// Pure, framework-free helpers for the Ua Admin screen: the client-side status
// derivation the mock computes, zone-safe stamp formatting, and the temp-password
// generator. i18n text lives in the ua-admin namespace; these return keys/tones.

export type StatusTone = 'ok' | 'warn' | 'bad' | 'muted'

/** Status key (→ i18n `status.<key>`) + a tone for the pill colour. */
export interface DerivedStatus {
  key: string
  tone: StatusTone
}

interface StatusInputs {
  isSeeded: boolean
  isActive: boolean
  credentialState: string
  phoneClass: string
}

/**
 * The single tri-/multi-state a person is in, derived client-side from the raw
 * codes (contract 414 §5) exactly as the confirmed 390 mock does: not-seeded →
 * disabled → (no credential ? awaiting-activation | blocked-no-phone) →
 * must-change → active.
 */
export function deriveStatus(p: StatusInputs): DerivedStatus {
  if (!p.isSeeded) return { key: 'notSeeded', tone: 'bad' }
  if (!p.isActive) return { key: 'disabled', tone: 'muted' }
  if (p.credentialState === 'none') {
    return p.phoneClass === 'usable'
      ? { key: 'awaitingActivation', tone: 'warn' }
      : { key: 'blockedNoPhone', tone: 'bad' }
  }
  if (p.credentialState === 'temporary-must-change') return { key: 'mustChange', tone: 'warn' }
  return { key: 'active', tone: 'ok' }
}

/** raw credentialState code → i18n key under `credential.*`. */
export function credentialKey(state: string): string {
  if (state === 'temporary-must-change') return 'mustChange'
  if (state === 'active') return 'active'
  return 'none'
}

/** Tailwind classes per pill tone (light + dark). */
export const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  bad: 'bg-red-500/15 text-red-700 dark:text-red-300',
  muted: 'border border-border bg-muted text-muted-foreground',
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
