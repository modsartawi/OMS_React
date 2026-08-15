/**
 * The account grid's page size and its cap (ticket 269).
 *
 * 🚩 **Copied from `features/collection/inquiry/cap.ts`, not imported and not
 * graduated** — and the copy is ticket 268's own rubric applied, not a lapse.
 * `tools/check-boundaries.mjs` reads `collection/inquiry` and `collection/settlement`
 * as two features, and a feature may not import a feature; 268 ruled that *copying
 * is the cheaper default and matches the neighbours, and graduating is right only if
 * the copy would be the second one and the component is genuinely identical*. This
 * is the second copy and it is **not** identical:
 *
 * - the limit differs — **500** here, the `TOP` the account door applies (spec 267
 *   D3), against the inquiries' 2,000;
 * - the neighbour's docblock argues at length about a WPF `Limit = 200` box that
 *   truncated an HQ-wide day in silence. This screen never had that box, and
 *   inheriting the argument would be inheriting a history that is not ours.
 *
 * The three lines below are all that is shared, and they are three lines.
 */

/**
 * How many entries a page of the account grid holds.
 *
 * 50, matching the four collection inquiries, the Ua Users grid and the Loy Actions
 * grid — the repo's other paged lists. **The browser pages, not the server**, so
 * sort and the per-column filter row operate over the whole account rather than over
 * the visible page.
 */
export const GRID_PAGE_SIZE = 50

/**
 * The `TOP` the account door applies (spec 267 D3 — *"50 per page inside the
 * server's 500-row `TOP` cap, with the banner when it bites"*).
 *
 * 🚩 One constant, asked for by the query **and** measured against the answer. Two
 * numbers here would mean the banner measuring one cap while the door applied
 * another, at which point it either cries wolf or stays silent on a truncated
 * branch — and a branch whose history is silently cut in half is a phone call the
 * accountant loses.
 */
export const ACCOUNT_LIMIT = 500

/**
 * The branch picker's cap — every **open** branch off the `Store` master
 * (`Settlement/Branches`).
 *
 * 🔑 **The same 2,000 as the fleet, and for the same reason it must not be the
 * server's 500.** This door answers the estate, not a filtered slice of it: at 1394
 * open branches a 500-row `TOP` would leave 894 of them un-typeable in a form whose
 * *"no such branch"* is a legitimate answer — so the truncation would read as a
 * typo. `isCapReached` watches it here too.
 *
 */
export const BRANCH_LIMIT = 2000

/**
 * The ledger's cap (`Settlement/Ledger`) — ✅ **the door came back, and so did this**.
 *
 * 500, the server's own default named rather than inherited (`ACCOUNT_LIMIT`'s rule).
 * 🔑 **Deliberately NOT raised to the branch and fleet doors' 2,000**, and the
 * difference is the point: those two answer a *population* — the estate — where a cap
 * below it truncates a complete answer. This one answers a *question*, and the
 * question is always filtered (the door refuses an unfiltered call outright). A
 * ledger result that reaches 500 is a question too broad to read, not an estate too
 * big to fit — and the honest response is the banner telling the accountant to narrow
 * it, not a number quietly chosen so the banner never fires.
 */
export const LEDGER_LIMIT = 500

/**
 * The **open settlements lane**'s cap (spec 282 D9, ticket 285) — one call at
 * `Settlement/Ledger?status=OPEN&sort=age`, feeding both entry tabs.
 *
 * 🔑 **2,000, and `LEDGER_LIMIT` stays 500 — the difference is this docblock's own
 * rule applied rather than a second opinion about the same door.** The two callers
 * ask different *kinds* of question of one endpoint:
 *
 * | caller | question | what reaching the cap means |
 * |---|---|---|
 * | the Ledger view | a **question** — always filtered, often to one row | it was too broad to read; narrow it |
 * | this lane | a **population** — the estate's open entries, 1394 at 274's seeded scale | a complete answer was truncated |
 *
 * A 500 here would answer *"the 500 oldest open entries"* while looking like the
 * estate's position — and because the order is oldest-first, the rows it dropped
 * would be the newest ones, so nothing on screen would look wrong. Same reasoning as
 * `BRANCH_LIMIT` and `FLEET_LIMIT`, which answer the estate for the same reason and
 * carry the same number.
 *
 * 🚩 **One call, one cap, one banner.** Both tabs are split out of this single
 * answer, so `isCapReached` is measured against the whole of it — which is what stops
 * *Owing* claiming completeness while *Owed* was the half that got cut.
 */
export const OPEN_LANE_LIMIT = 2000

/**
 * The fleet door's cap — ✅ **found live by 274, and it is the one number on this
 * screen that had to change.**
 *
 * 🔑 **The door's own default `TOP` is 500, and the estate is 1394 branches.** A
 * fleet call that named no limit would have returned 500 rows of 1394 and rendered
 * them as *the estate* — 894 branches, and every figure on the front page, silently
 * missing. Nothing in the answer says it was cut: the door returns rows, not a
 * total. It was invisible until it was measured.
 *
 * 2,000 clears today's 1394 with room for the estate to grow, and sits far under
 * the server's own `MaxLimit` of 20,000 — which is where a genuinely runaway ask
 * would be refused. `isCapReached` still watches it: if this ever bites, the estate
 * has outgrown the number and the banner says so rather than the screen lying.
 */
export const FLEET_LIMIT = 2000

/**
 * The wrong-money lane's cap (`Settlement/Orphans`).
 *
 * The server's own default, named rather than inherited — the same rule
 * `ACCOUNT_LIMIT` follows. 🚩 An orphan is a rare event (a till whose close timed
 * out), so 500 is a ceiling this lane should never approach; if it does, the sweep
 * behind it has stopped running and the banner is the first place that shows.
 */
export const WORKLIST_LIMIT = 500

/**
 * Did this account actually **reach** the cap?
 *
 * **Reached, not merely large** — a banner that fired at "nearly 500" would be a
 * guess, and a reader who learns the warning is usually wrong stops reading it.
 * `>=` rather than `===` because a door that over-served has still truncated
 * *something*.
 *
 * ⚠️ It is a client-side inference: the door returns rows, not a total, so an exact
 * fit is indistinguishable from a truncation. The sentence it fires is worded as a
 * possibility for exactly that reason, and erring towards saying so beats erring
 * towards silence.
 */
export function isCapReached(rowCount: number, limit: number): boolean {
  if (!Number.isFinite(rowCount) || !Number.isFinite(limit) || limit <= 0) return false
  return rowCount >= limit
}
