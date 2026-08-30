/**
 * The **mobile member command**'s pure half (ticket 305, spec 301) — what the
 * confirmation will let an analyst send, and in what form it leaves the browser.
 *
 * 🚩 **The mobile is not a profile field and never becomes one.** It is the
 * programme's login credential and one of only **two** ways a member can be
 * found at all — the other is the loyalty id; email and national id are fields
 * *on* a member, never ways *to* one. So it changes through its own control,
 * behind its own confirmation, and never as a side effect of fixing a name
 * (spec 301 #22). The three ways a change can be refused are named individually
 * in `member-commands.ts`, because that map is the wave's ONE refusal reader.
 *
 * Pure by construction: no React, no `t`, no network. It returns **keys**, never
 * sentences ([i18n-zero-literal](../../../../.claude/rules/i18n-zero-literal.md)).
 */
import { compact } from './resolve-member'

/**
 * What the confirmation makes of the number an analyst has typed.
 *
 * 🚩 Only `writable` may be sent, and it carries the exact string that will go
 * on the wire — the verdict IS the request, so a call site cannot arm the
 * confirm off one value and send another.
 */
export type MobileChangeVerdict =
  /** Nothing typed yet. Not a complaint — the confirm is simply unarmed. */
  | { state: 'empty' }
  /** The number the member already has, as far as this screen can tell. */
  | { state: 'unchanged' }
  /** Something no dialling rule could turn into a number. */
  | { state: 'notANumber' }
  | { state: 'writable'; mobile: string }

/**
 * The verdict on a typed number against the one the member currently has.
 *
 * 🚩 **Compaction is not normalisation.** The number leaves the browser exactly
 * as the two member reads already send one — whitespace, dashes, parens and a
 * leading `+` removed, and nothing else. The rule that builds the loyalty base's
 * key is the door's (`LoyMobileNumbers.NormaliseTyped`), and a second spelling
 * of it here is how the two start to disagree (decision 225 ruling 4).
 *
 * 🚩 **The unchanged check is a courtesy, never the authority.** The stored
 * number is normalised server-side and the typed one is not, so `0555000111`
 * and `966555000111` may well be the same number and this cannot tell — which
 * is exactly why *same mobile as now* also exists as a **named refusal** from
 * the door. This one arrives earlier and costs no round trip; the door decides.
 *
 * 🚩 **Shape, never a value.** No length rule and no country rule: the column
 * width and the mobile ranges live in the database and not in this repo, so a
 * cap invented here would refuse a change the door would have accepted. The one
 * thing checked is that what is typed is digits — a letter is not a phone
 * number under any dialling rule, and a typo must not become a member's
 * credential (spec 301 #27).
 */
export function mobileChangeVerdict(
  typed: string,
  current: string | null | undefined,
): MobileChangeVerdict {
  const key = compact(typed)
  if (!key) return { state: 'empty' }
  // Before the sameness test on purpose: a typo containing a letter is a typo
  // whatever it happens to equal.
  if (!/^\d+$/.test(key)) return { state: 'notANumber' }
  const held = compact(current ?? '')
  if (held && key === held) return { state: 'unchanged' }
  return { state: 'writable', mobile: key }
}

/**
 * The wording a verdict earns, or null for one that needs none.
 *
 * An empty field says nothing: an analyst who has not typed anything is not
 * being told off. The other two say what is wrong with the number in front of
 * them — each as itself, so the analyst knows which problem they have.
 */
export function mobileProblemKey(verdict: MobileChangeVerdict): string | null {
  if (verdict.state === 'unchanged') return 'profile.mobile.problem.unchanged'
  if (verdict.state === 'notANumber') return 'profile.mobile.problem.notANumber'
  return null
}
