/**
 * The pure half of the **member commands** (ticket 303, spec 301) — what the
 * Status control offers, which blocked reasons an analyst may pick, and how a
 * refusal is named.
 *
 * Pure by construction: no React, no `t`, no network. It returns **keys**, never
 * sentences, so the words stay in `src/locales/en/loy.json`
 * ([i18n-zero-literal](../../../../.claude/rules/i18n-zero-literal.md)).
 *
 * Three rules live here because all three are decisions rather than plumbing,
 * and a decision inside JSX is a decision no test can reach while React Testing
 * Library is unbootstrapped (spec 231's testing decisions).
 */
import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import type { LoyBlockedReasonPayload, LoyMember } from '@/core/models/loy'

/**
 * Which of the two status commands applies to the member in front of the
 * analyst. Never both, and never neither.
 *
 * Named for the *kind* rather than for the command, because `StatusCommand` is
 * already the component that draws it — a file importing both would have one
 * name meaning two things.
 */
export type MemberStatusCommand = 'block' | 'unblock'

/**
 * The command this member's state calls for.
 *
 * 🚩 **A blocked member is offered Unblock and an unblocked one Block** — one
 * control, because offering both would ask the analyst to read the member's
 * state off a pair of buttons, one of which is always wrong.
 *
 * The blank test is `.trim()`, not truthiness alone: `blockedReasonCode` is a
 * `char`-backed column on the way here, and a padded `'  '` is a member who is
 * **not** blocked. Reading it as blocked would offer Unblock to a member with
 * nothing to unblock, and the command would be refused by a server that agrees
 * with the string and not with us.
 */
export function statusCommand(
  member: Pick<LoyMember, 'blockedReasonCode'>,
): MemberStatusCommand {
  return member.blockedReasonCode?.trim() ? 'unblock' : 'block'
}

/** One reason an analyst may choose, as the picker draws it. */
export interface SelectableReason {
  code: string
  /** The server's own words for the code, or null when the row carried none —
   *  the picker then shows the bare code rather than inventing a description. */
  description: string | null
}

/**
 * The blocked reasons an agent may pick, projected from the door's answer.
 *
 * 🚩 **A system reason can never reach this list.** The removal reason exists as
 * a *state* a member is put into by removing their mobile (307) and must be
 * unofferable by hand: an analyst who could mark a member "removed at customer
 * request" without removing anything would leave a trail that lies in the
 * direction that matters most (spec 301 → Implementation Decisions; ADR 0002's
 * neighbourhood). This is the **first reader anywhere** of a flag that has sat
 * in the table unread.
 *
 * 🚩 **The looseness is inverted from ticket 302's, deliberately.** There the
 * rule was `=== true` and nothing looser, because being wrong failed *open* on a
 * PII surface. Here the safe error is dropping too much — a reason wrongly
 * withheld is a visibly short picker, a system reason wrongly offered is a false
 * audit trail — so **anything truthy is a system reason**: `1`, `'Y'`, and even
 * the string `'false'` a careless projection might emit all drop the row.
 *
 * The door is designed to filter server-side as well (spec 301, "The wire").
 * This is the second line, not the first, which is why an **absent** flag keeps
 * the row: a door that filtered and did not project the flag would otherwise
 * leave the analyst with an empty picker and no way to block anyone.
 *
 * A row with no code is dropped whatever its flag says — a picker option that
 * would send `''` is not an option.
 *
 * An empty answer is an empty list. It is a fact about the seed data, never a
 * failure, and the caller renders it as one.
 */
export function selectableBlockedReasons(
  rows: LoyBlockedReasonPayload[] | null | undefined,
): SelectableReason[] {
  if (!rows) return []
  return rows
    .filter((row) => !row.systemReason && !!row.code?.trim())
    .map((row) => ({ code: row.code!.trim(), description: row.description?.trim() || null }))
}

/**
 * The refusal codes this screen recognises **by name**, and the key each earns.
 *
 * 🚩 `LOY-00100` is observed — it is the miss the resolution cascade already
 * branches on. **`LOY-00105` is design intent**: the backend half of spec 301 is
 * unwritten and unnumbered, so no code for an invalid blocked reason has been
 * minted yet. This map is the single line to reconcile when it is.
 *
 * Module-private: the one legal way to read it is `commandRefusalKey` below, so
 * a call site cannot start indexing it with a code the function would have
 * degraded safely.
 *
 * A wrong guess is cheap by construction: an unrecognised code still surfaces
 * the **server's own sentence** (the api-envelope rule), so the only thing at
 * stake is the screen's extra wording — never whether the analyst is told what
 * happened.
 */
const REFUSAL_KEYS: Record<string, string> = {
  'LOY-00100': 'command.refusal.noSuchMember',
  'LOY-00105': 'command.refusal.invalidBlockedReason',
  // The profile command's three (ticket 304), design intent on the same terms.
  // 🚩 `LOY-00108` is the **stale-write** refusal, and it is the one the screen
  // treats as a fact rather than a failure: the caller pairs its wording with a
  // reload rather than a retry (`isStaleProfileRefusal`).
  'LOY-00106': 'command.refusal.invalidNationality',
  'LOY-00107': 'command.refusal.invalidCity',
  'LOY-00108': 'command.refusal.memberChanged',
  // The mobile command's three (ticket 305), design intent on the same terms.
  // 🚩 **Three codes, three keys, and never one shared "it failed".** A number
  // held by another member is a COLLISION, not a format problem; the number the
  // member already has is a no-op that must not write a **member update
  // snapshot**; an unparseable one is a typo caught before anything is written.
  // An analyst who cannot tell the three apart cannot act on any of them.
  'LOY-00109': 'command.refusal.mobileAlreadyUsed',
  'LOY-00110': 'command.refusal.sameMobile',
  'LOY-00111': 'command.refusal.invalidMobile',
}

/**
 * The screen's own wording for a refusal it recognises, or null for one it does
 * not. Null is not a gap: the caller pairs this with `apiErrorMessage`, so an
 * unrecognised refusal is still explained in the server's words.
 */
export const commandRefusalKey = (err: unknown): string | null => {
  const code = apiErrorCode(err) ?? ''
  // `Object.hasOwn` rather than a bare index: a server `errorCode` of
  // `constructor` or `toString` would otherwise reach through to
  // `Object.prototype`, survive the `?? null`, and be handed to `t()` as a key.
  return Object.hasOwn(REFUSAL_KEYS, code) ? REFUSAL_KEYS[code] : null
}

/**
 * How **every** member command says a refusal: the **server's own sentence**,
 * with the screen's wording in front for a code it knows by name — both, in
 * that order, and never one flattened into the other
 * (`.claude/rules/api-envelope.md`). The pair is joined through a KEY rather
 * than by concatenation, so a locale can reorder or repunctuate it.
 *
 * 🚩 **A 403 is a grant refusal, not an outage**, and the only arm that offers
 * nothing to try again: it is a fact about the session, and nothing the analyst
 * does on this screen will change it. A **bare** 403 carries no sentence worth
 * reading — it is what a route without the grant answers, and `apiErrorMessage`
 * would offer only "unexpected (403)" — while a **coded** one has been refused
 * for a named reason, and that reason is the whole content of the refusal.
 *
 * It lives here, taking `t` as an argument, rather than being copied into each
 * command's component: the two on the tab sit inches apart, and one copy each
 * would look identical today and drift the first time a refusal arm is added.
 * 401 is untouched — `core/api.ts` owns it.
 */
export function commandRefusalText(
  err: unknown,
  fallback: string,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const said = apiErrorMessage(err, fallback)
  if (err instanceof ApiError && err.statusCode === 403)
    return apiErrorCode(err)
      ? t('command.refusal.pair', { named: t('command.refusal.grant'), said })
      : t('command.refusal.grant')
  const named = commandRefusalKey(err)
  return named ? t('command.refusal.pair', { named: t(named), said }) : said
}
