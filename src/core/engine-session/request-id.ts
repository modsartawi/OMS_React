/**
 * One user action's id, for an engine session verb.
 *
 * Both engine contracts put `{ transactionId, requestId }` on **every** verb —
 * the call centre's §4 and the Nphies one's §1.2, word for word — because the
 * server keeps a ledger of the last actions and a retried verb must be absorbed
 * rather than double-applied (the Nphies projection says so out loud in
 * `replayed`). The rule is therefore *one action, one id, reused verbatim across
 * every retry of that action* — and it is one rule, so it is one module.
 *
 * 🚩 It lives in `core/` for the same reason the latest-state guard and the
 * session-fault reader do (ticket 210): the Nphies authorization form is a second
 * engine session, features may not import features, and the boundary rule's own
 * remedy for logic shared by two of them is to lift it here. Nothing about the
 * rule changed in the move — the call centre still mints ids with this exact
 * function, re-exported from its own `api.ts` so its call sites did not move.
 */

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32

/**
 * A client-minted ULID. Timestamp-prefixed so ids sort by mint order, which is
 * what makes a server-side ledger of the last N legible when something goes
 * wrong.
 *
 * **One action = one id.** A retry of that action — including a two-phase confirm
 * — re-sends the same id; a genuinely new action mints a new one. Calling this
 * function per retry is the defect the ledger cannot see through.
 */
export function newRequestId(): string {
  let time = Date.now()
  const chars: string[] = new Array(26)
  for (let i = 9; i >= 0; i--) {
    chars[i] = ULID_ALPHABET[time % 32]
    time = Math.floor(time / 32)
  }
  const random = crypto.getRandomValues(new Uint8Array(16))
  for (let i = 0; i < 16; i++) chars[10 + i] = ULID_ALPHABET[random[i] % 32]
  return chars.join('')
}
