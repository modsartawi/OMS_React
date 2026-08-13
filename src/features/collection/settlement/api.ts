/**
 * The Settlement Account feature's server calls (spec 267).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular is
 * never caught here.
 *
 * **Ticket 268 is the surface, so this file holds exactly one thing: the screen's
 * reading of its grant.** The fleet, account, post, cancel, close-out, repair and
 * the two bulk doors (spec 267 D8) arrive with 269–273; the joining ticket 274
 * settles their exact route strings against a live SIS.Api. Nothing here reads the
 * ledger yet, which is 268's Boundaries in one sentence.
 *
 * ⚠️ **There is no `Settlement/Access` probe and there must not be one.** The
 * settlement account is a **fifth grant on the Collections probe** (spec 267 D1),
 * not an area of its own — same nav group, same `/collection/*` prefix, same one
 * `CollectionWeb/Access` call. The key, the options and the call live in
 * `@/core/collection/api`, where ticket 268 graduated them the moment this feature
 * became their second consumer: a feature may not import another feature's api
 * (`.claude/rules/feature-structure.md`).
 */
import type { CollectionAccessResult } from '@/core/models/collection'

/**
 * The settlement account's predicate — this screen's own reading of the fifth flag.
 *
 * `=== true` and nothing looser, so a malformed answer (`{}`, `null`, a string
 * `"true"`) is a denial and not an accident of truthiness. That strictness is doing
 * real work today rather than guarding a hypothetical: the server does not answer
 * `canOpenSettlement` yet (BackOffice spec 1173), so every live probe currently
 * arrives with the field **absent** — and absent must read as no.
 *
 * Exported because the nav leaf and the screen's own gate must read the SAME
 * predicate rather than two spellings of it, which is what stops the menu and the
 * screen disagreeing about whether the session is allowed in.
 */
export const canOpenSettlement = (r: CollectionAccessResult | null | undefined): boolean =>
  r?.canOpenSettlement === true
