import type { SettlementFleetRow, SettlementScope } from '@/core/models/settlement'

/**
 * The scope control's rules — **the pure module the door's one asymmetry lives in**
 * (ticket 270, spec 267 D2).
 *
 * Three states over the assignment the four collection inquiries already read:
 * **mine** (the default), **unassigned**, **all**. Everything about them that can
 * be got wrong is decided here rather than in a component, because two of the three
 * rules regress silently:
 *
 * 1. 🔑 **The scope ranks and counts; it NEVER refuses.** A branch outside it is
 *    still findable by search, still openable, and its wrong money is still on the
 *    screen. Widening is one click and is never locked — the scope is a convenience
 *    and never a permission (D2, user story 7).
 * 2. 🔑 **An accountant with no staff row opens UNFILTERED** — and it is a normal
 *    state, not an error. `resolveScope` degrades *mine* to the whole estate and
 *    says so through `unfiltered`, which the screen uses to keep quiet rather than
 *    to draw a banner. A missing seed row must never block a screen (user story 6).
 * 3. 🔑 **The two estate-wide lanes are not this module's business at all.** Wrong
 *    money and cash waiting ignore the scope entirely (`worklist.ts`); only the
 *    **ageing count and the search ranking** pass through here. 1255 of 1394
 *    branches are unassigned, so a naive "mine" over the lanes would put their
 *    money on nobody's screen.
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
 */
export function readScope(raw: string | null | undefined): SettlementScope {
  const value = (raw ?? '').trim().toLowerCase()
  return (SCOPES as readonly string[]).includes(value) ? (value as SettlementScope) : DEFAULT_SCOPE
}

/**
 * Does this session have an assignment at all?
 *
 * Read off the fleet answer rather than asked for separately: the server already
 * resolved `assignment` per row for this session (own branches ∪ one-level
 * reports), so *"do I have a staff row"* is *"did any row come back as mine"* — one
 * fact from one call, and no second probe that could disagree with the first.
 */
export function hasAssignment(rows: readonly SettlementFleetRow[] | null | undefined): boolean {
  return (rows ?? []).some((r) => r.assignment === 'mine')
}

/**
 * What the scope control says, and what actually filters.
 *
 * The two differ in exactly one case — rule 2 above — and keeping them apart is
 * what lets the control go on showing *my branches* (which is what the accountant
 * chose, and what they will hold again the moment finance seeds their row) while
 * the screen behaves as though they had chosen *all*.
 */
export type ScopeResolution = {
  /** What the control shows as pressed. */
  scope: SettlementScope
  /** What `isInScope` actually applies. Differs from `scope` only when unfiltered. */
  effective: SettlementScope
  /** 🔑 *mine* asked for, nothing assigned, so the estate is shown. Not an error. */
  unfiltered: boolean
  hasAssignment: boolean
}

export function resolveScope(
  scope: SettlementScope,
  rows: readonly SettlementFleetRow[] | null | undefined,
): ScopeResolution {
  const assigned = hasAssignment(rows)
  // ⚠️ Only *mine* degrades. Choosing **unassigned** with no staff row is a
  // deliberate act with a well-defined answer (the 1255), and widening it to the
  // estate would be the screen overruling a choice the accountant just made.
  const unfiltered = scope === 'mine' && !assigned
  return {
    scope,
    effective: unfiltered ? 'all' : scope,
    unfiltered,
    hasAssignment: assigned,
  }
}

/** Is this branch inside the resolved scope? `all` is every branch, including the
 *  ones assigned to a colleague — the estate is the estate. */
export function isInScope(row: SettlementFleetRow, resolution: ScopeResolution): boolean {
  switch (resolution.effective) {
    case 'all':
      return true
    case 'mine':
      return row.assignment === 'mine'
    case 'unassigned':
      return row.assignment === 'unassigned'
  }
}

/**
 * The branches the scope counts — **used for the ageing count and for ranking, and
 * for nothing else**.
 *
 * ⚠️ It is deliberately NOT the search's filter. `search.ts` ranks in-scope hits
 * above out-of-scope ones and shows both, because *"the scope ranks results, it
 * never refuses one"* is the ticket's own wording and a search that hid a branch
 * would be the scope acting as a permission.
 */
export function branchesInScope(
  rows: readonly SettlementFleetRow[] | null | undefined,
  resolution: ScopeResolution,
): SettlementFleetRow[] {
  return (rows ?? []).filter((r) => isInScope(r, resolution))
}
