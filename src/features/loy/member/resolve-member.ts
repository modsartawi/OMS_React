/**
 * One field resolves a member (ticket 233, spec 231 §3, decision 225).
 *
 * The agent types a mobile number **or** a Loy ID and the field classifies
 * neither: `resolveMember` asks `MemberByMobile` first — a call centre takes
 * phone calls — and only on a genuine `LOY-00100` miss asks the same text as a
 * Loy ID. There is no shape rule anywhere in this feature, because a
 * length/prefix classifier is a guess about a key whose shape the client is not
 * supposed to know, and it goes stale the day the number range rolls over.
 *
 * 🚩 **Only `LOY-00100` cascades, and that is the whole module.** An ungranted
 * portal call gets a **bare 403** (224); a cascade-on-anything rule would render
 * the shut door — and every outage — as *"no member matches"*, doubling load on
 * a dead API while telling the agent to re-read a number that was correct.
 * `auth`, `server` and `network` show themselves and stop.
 *
 * Pure by construction: the two reads arrive as an argument, so the decision is
 * provable with SIS.Api down and with the `LoyWeb` door unbuilt — which, per
 * spec 231's standing verification rule, is the only proof this wave has.
 */
import { apiErrorCode, apiErrorKind } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'

/** The two member reads the cascade composes. Injected rather than imported so
 *  the rule is testable without a network, a fetch stub or a module mock. */
export interface MemberReads {
  byMobile(key: string): Promise<LoyMember>
  byLoyId(key: string): Promise<LoyMember>
}

export type Resolution =
  /** A blank submit. No call was made and there is nothing to say. */
  | { kind: 'noop' }
  | { kind: 'member'; member: LoyMember }
  /** Neither key matched — a fact, not a failure, and a CLIENT sentence naming
   *  what was typed rather than either server sentence naming one of the two. */
  | { kind: 'noMatch'; typed: string }
  /** Defensive: expected unreachable once the door drops the archived refusal
   *  (230). Kept because it costs one branch and it is exactly what protects the
   *  screen if the door ships before that amendment does. */
  | { kind: 'archivedRefusal'; key: string }

/** `LoyaltyErrorCodes.CustomerNotExists` — the ONLY code that cascades. */
const NOT_FOUND = 'LOY-00100'
/** `LoyaltyErrorCodes.CustomerArchived`. */
const ARCHIVED = 'LOY-00101'

/**
 * 🚩 Compaction is **not** normalisation: whitespace, dashes, parens and a
 * leading `+`, and nothing else. No dialling code, no `PadLeft`, no country
 * rule — the rule that builds the loyalty base's key is server-side
 * (`LoyMobileNumbers.NormaliseTyped`), and a second spelling of it here is how
 * the two start to disagree.
 *
 * It exists because `LoyMobileNumbers.Parse` does `.Trim().TrimStart('+')` and
 * nothing else, so a pasted `+966 55 500 0111` matches no dialling code, falls
 * through to the SA branch and misses (225 ruling 4).
 */
export const compact = (typed: string): string =>
  typed.replace(/[\s()\-]/g, '').replace(/^\+/, '')

/** Whether a failure is the one refusal that means "no such member". */
const isMiss = (err: unknown): boolean =>
  apiErrorKind(err) === 'business' && apiErrorCode(err) === NOT_FOUND

export async function resolveMember(typed: string, reads: MemberReads): Promise<Resolution> {
  const key = compact(typed)
  if (!key) return { kind: 'noop' } // blank submit is silent

  try {
    return { kind: 'member', member: await reads.byMobile(key) }
  } catch (err) {
    // Everything that is not a genuine miss is the answer, and it is final.
    if (!isMiss(err)) throw err
  }

  try {
    return { kind: 'member', member: await reads.byLoyId(key) }
  } catch (err) {
    // The typed text, not the compacted key: the sentence names what the agent
    // is looking at, because the box is never rewritten (225 ruling 5).
    if (isMiss(err)) return { kind: 'noMatch', typed }
    if (apiErrorCode(err) === ARCHIVED) return { kind: 'archivedRefusal', key }
    throw err
  }
}
