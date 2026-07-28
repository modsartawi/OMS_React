/**
 * What a dead *Place order* is waiting for — the server's own list, turned into
 * words and into the chip that owns each one.
 *
 * 🚩 **The console does not re-implement "is this order complete".** That
 * predicate is the door's (§2 — `capabilities` is advisory-but-authoritative,
 * derived from the same rules the verbs enforce), and `submitBlockers` is its
 * answer. This module renders that answer; it never adds a reason of its own, and
 * it never removes one it does not recognise.
 *
 * Two properties it exists to hold, both of which a `t(code, { defaultValue:
 * code })` at a call site quietly loses:
 *
 * 1. 🚩 **A code this client has never heard of still produces WORDS.** An
 *    additive server change ships server-first (§9), so `MISSING_PAYMENT_TYPE`
 *    arriving tomorrow is an ordinary wire state — and an agent reading a raw
 *    machine code out to a caller is not. The unknown case has a phrase of its
 *    own, and the code rides along for the console log rather than for the eye.
 * 2. **Two codes that say one sentence say it once.** `MISSING_SOURCE_REFERENCE`
 *    and `SOURCE_REFERENCE_REQUIRED` are the same fact on two paths (the
 *    projection's and the verb's, CONTRACT.md §7), and a receipt naming both
 *    would read as two separate things to fix.
 *
 *    🚩 This is deduplication by SENTENCE, not by code — several unrecognised
 *    codes therefore collapse into the single unknown phrase. That is the
 *    honest rendering rather than a dropped reason: by construction they would
 *    each print the same words, and *"something else this order needs ·
 *    something else this order needs"* tells the agent strictly less than one
 *    of them. Nothing recognised is ever collapsed away, and the moment such a
 *    code earns a phrase of its own it stops sharing one.
 */
import type { HeaderChip } from './header-chips'

/**
 * Every blocker code the contract names — the phrase that answers it and the
 * chip that owns it. The chip is `null` where the fix is somewhere other than
 * the chip row (the basket, the rail, or nowhere at all).
 *
 * 🚩 `phrase` is an i18n key suffix: `blockers.<phrase>` must exist for each
 * entry, which the pure test asserts against the locale file rather than by eye.
 * Two codes may share one — one fact, one sentence.
 */
const BLOCKERS: Record<string, { phrase: string; chip: HeaderChip['id'] | null }> = {
  // The basket's, not a chip's.
  NO_LINES: { phrase: 'NO_LINES', chip: null },
  // The rail's — the caller and their address are captured there (165, 166).
  NO_CUSTOMER: { phrase: 'NO_CUSTOMER', chip: null },
  NO_ADDRESS: { phrase: 'NO_ADDRESS', chip: null },
  // v1.3 (§2.3) — the plant is the one the agent was SEEDED with and nobody has
  // chosen it. The chip says so through this table like every other, never
  // through a client-side read of `plantSource`.
  STORE_NOT_CHOSEN: { phrase: 'STORE_NOT_CHOSEN', chip: 'store' },
  // The chip row's own three sections (173).
  MISSING_SLOT: { phrase: 'MISSING_SLOT', chip: 'slot' },
  MISSING_SOURCE: { phrase: 'MISSING_SOURCE', chip: 'source' },
  MISSING_SOURCE_REFERENCE: { phrase: 'MISSING_SOURCE_REFERENCE', chip: 'reference' },
  // 🚩 The same fact on the verb's path rather than the projection's (§7 lists
  // it as `SetDocumentSource`'s refusal), so it shares the phrase: a receipt
  // naming both would read as two separate things to fix.
  SOURCE_REFERENCE_REQUIRED: { phrase: 'MISSING_SOURCE_REFERENCE', chip: 'reference' },
  // Nothing to fix: the order is already placed (fixture 07). It names itself
  // rather than leaving submit dead and silent.
  ALREADY_SUBMITTED: { phrase: 'ALREADY_SUBMITTED', chip: null },
}

/** The phrase an unrecognised code falls back to. Words, never the code. */
export const UNKNOWN_BLOCKER_KEY = 'blockers.unknown'

export interface SubmitBlocker {
  /** The wire code. Not for display — a drive's handle, and the log's. */
  code: string
  /** The i18n key, always resolvable: no call site needs a `defaultValue`. */
  key: string
  /** The chip whose section fixes it, or `null` where that is somewhere else. */
  chip: HeaderChip['id'] | null
}

/**
 * The blockers, worded and deduplicated, in the server's own order.
 *
 * Order is the server's on purpose: it lists what it lists, and re-sorting would
 * be this console asserting a priority the door did not state. Duplicates
 * collapse onto the FIRST occurrence, so the position is the first one's.
 */
export function submitBlockers(codes: readonly string[] | null | undefined): SubmitBlocker[] {
  const seen = new Set<string>()
  const out: SubmitBlocker[] = []
  for (const code of codes ?? []) {
    const known = BLOCKERS[code]
    const key = known ? `blockers.${known.phrase}` : UNKNOWN_BLOCKER_KEY
    // By KEY, not by code: two codes for one fact are one sentence.
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ code, key, chip: known?.chip ?? null })
  }
  return out
}

/**
 * The chips the server says are blocking submit. 🚩 The chip row and the
 * receipt read the SAME table through this: a chip that looks settled while the
 * receipt names its section is the disagreement US22 exists to prevent.
 */
export function blockedChips(codes: readonly string[] | null | undefined): Set<HeaderChip['id']> {
  const blocked = new Set<HeaderChip['id']>()
  for (const blocker of submitBlockers(codes)) if (blocker.chip) blocked.add(blocker.chip)
  return blocked
}
