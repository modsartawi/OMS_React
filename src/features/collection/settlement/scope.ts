import type { SettlementScope } from '@/core/models/settlement'

/**
 * The scope control's rules (ticket 270, spec 267 D2) — **and after ticket 274,
 * almost all of them belong to the server.**
 *
 * 270 built this module to rank and count on the client: the fleet door was called
 * once with `scope=all`, every row arrived carrying how the server had resolved it
 * (`assignment`), and this module decided what was in scope, what the ageing lane
 * counted, and whether an unassigned accountant should silently see the estate.
 *
 * 🔑 **274 found that the live door does all of that itself, and does it better.**
 * `Settlement/Fleet?scope=mine|unassigned|all` resolves *mine* from the **session**
 * against map 1153's assignment tables — own branches ∪ one-level reports, a union
 * over an org chart no client can see. And the reason 270 kept the scope on the
 * client at all turns out not to hold: the carve-out is inside the server's own
 * predicate,
 *
 * ```sql
 * AlwaysVisible = "f.OrphanCount > 0 OR f.UncollectedCount > 0"   -- OR'd into every scope
 * ```
 *
 * so a branch carrying wrong money rows **whatever the scope says**, in one query.
 * The two rules that survive are the two the control still owns:
 *
 * 1. 🔑 **The scope ranks and counts; it NEVER refuses.** Widening is one click and
 *    is never locked — a convenience, never a permission (D2, user story 7).
 * 2. 🔑 **An accountant with no staff row opens UNFILTERED**, and it is a normal
 *    state rather than an error (user story 6). ⚠️ That degradation is now the
 *    server's (`1 = 1`) and is **silent** — the client can no longer detect it and
 *    so can no longer explain it. See `.afk/FINDINGS-274.md` §B4.
 *
 * ⚠️ **What went with `assignment`:** the screen can filter but not **label**. Under
 * `scope=mine` the answer holds the accountant's own branches *and* the carved-in
 * estate-wide rows, indistinguishable — so nothing can say *"3 of these 47 are
 * yours; the rest are here because they carry wrong money"*. One field is the
 * difference, and it is recorded rather than guessed at.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock. The words are the component's.
 */

/** The URL parameter the scope rides in — 269's `?store=` idiom, one screen over. */
export const SCOPE_PARAM = 'scope'

/** What the screen opens on when nothing says otherwise (D2). */
export const DEFAULT_SCOPE: SettlementScope = 'mine'

const SCOPES: readonly SettlementScope[] = ['mine', 'unassigned', 'all']

/**
 * The scope in a URL, or the default.
 *
 * An unknown value reads as the **default** rather than as an error: `?scope=xyz`
 * is a hand-edited address, and the honest response to one is the screen the
 * accountant would have got anyway. There is nothing here a bad value could
 * unlock, because the scope is not a permission.
 *
 * ⚠️ It is now also what goes **on the wire**, so this is the one place a scope
 * string is normalised before the server sees it. The door itself is forgiving —
 * an unrecognised value there means *the estate*, deliberately, because widening is
 * never locked — but a client that sent `xyz` would be relying on that mercy.
 */
export function readScope(raw: string | null | undefined): SettlementScope {
  const value = (raw ?? '').trim().toLowerCase()
  return (SCOPES as readonly string[]).includes(value) ? (value as SettlementScope) : DEFAULT_SCOPE
}
