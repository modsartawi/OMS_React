import type { SettlementEntryKind, SettlementOpenLaneRow } from '@/core/models/settlement'
import { TAB_PARAM, openSearch } from './addresses'
import { OPEN_LANE_LIMIT, isCapReached } from './cap'

/**
 * **The open settlements lane's projection** — everything the screen at
 * `/collection/settlement/open` decides, in one module with no React in it
 * (ticket 285, spec 282 D8).
 *
 * 🚩 **Pure, and deliberately shaped like `worklist.ts`: no React, no `t()`, no
 * network, no clock.** The last one is the load-bearing absence. The age, the sort
 * and the ranking are all the SERVER's — `ageDays` is its subtraction, the order is
 * its `PostedAt ASC, EntryNumber ASC`, and `isMine` is a union over an org chart no
 * browser can see. A module that reached for `Date.now()` would let a page left open
 * overnight show a number its own sort no longer agreed with.
 *
 * 🔑 **Sorting is not re-done here, and that is a rule rather than an omission.** The
 * answer is capped at 2,000 (`OPEN_LANE_LIMIT`): re-sorting a capped page changes
 * which rows the cap kept, so the arrangement would quietly disagree with the
 * question. Both sections are already oldest-first because `Array.filter` is stable
 * and the server's order was total.
 *
 * What it owns, and why each one is here rather than in the renderer:
 *
 * | decision | why it is not a component's |
 * |---|---|
 * | the split by `entryKind` | the two tab counts and the cap banner must come out of ONE answer, or they can disagree |
 * | the `mine` / `theirs` partition | ranking without hiding — the estate is never narrowed away |
 * | the signpost | the comparison is claimed **only when true**, which is a decision and not a format |
 * | *mine only* | the filter that empties a tab must be distinguishable from a tab that is empty |
 * | **empty ≠ emptied-by-filter ≠ failed** | three sentences a reader acts on differently, and the one place a refused door can start reading as good news |
 *
 * 🔑 **The whole reason the signpost exists**, from the 281 prototype: ranking your
 * own branches first pushed the estate's oldest entry **176 rows down the page**. The
 * carve-out kept unassigned money *in* the answer, and the arrangement was about to
 * hide it anyway. That line looks decorative to a later reader; it is the only thing
 * on the screen that says the estate holds something worse than anything of yours.
 */

/* ── which tab, as an address ─────────────────────────────────────────────────── */

/**
 * The lane's tabs — *Owing* (SHORTAGE) and *Owed* (SURPLUS).
 *
 * 🚩 **Two tabs rather than a kind column**, because they are the same age fact
 * pointing in opposite directions: *the branch owes head office* is one list an
 * accountant works top to bottom, and money the estate owes outward is a different
 * phone call to a different person. `cash` — 286's prepared-but-uncollected receipts,
 * over a door that is not built — joins them here when it has something to answer.
 */
export const OPEN_LANE_TABS = ['owing', 'owed'] as const
export type OpenLaneTab = (typeof OPEN_LANE_TABS)[number]

/** Owing first: it is the larger job and the one the estate loses money on. */
export const DEFAULT_OPEN_TAB: OpenLaneTab = 'owing'

/** Which kind each tab is asking about. The direction lives on `entryKind`, never on
 *  a sign — `amount` is always a positive magnitude (the contract's own rule). */
const TAB_KIND: Record<OpenLaneTab, SettlementEntryKind> = {
  owing: 'SHORTAGE',
  owed: 'SURPLUS',
}

/**
 * Which tab the URL is asking for.
 *
 * ⚠️ **An unreadable value lands on Owing rather than on an error** — the rule
 * `readCriteria` and `readEntryNumber` both follow one module over: *a hand-edited
 * address should land on a screen, not on a broken one*. Which also covers
 * `?tab=cash` today: it is a value this build has no view for, so it reads as
 * unknown and the reader gets the default rather than a blank tab.
 */
export function readOpenTab(params: URLSearchParams): OpenLaneTab {
  const raw = (params.get(TAB_PARAM) ?? '').trim().toLowerCase()
  return OPEN_LANE_TABS.find((tab) => tab === raw) ?? DEFAULT_OPEN_TAB
}

/**
 * This lane, on another tab — what the tab strip navigates to.
 *
 * 🚩 **The default is the ABSENCE of the parameter** (`scopeSearch`'s rule), so the
 * plain address and *Owing* are one address rather than two spellings of one. Written
 * through `addresses.ts`'s own builder rather than re-spelled here: that module's
 * claim is that this screen's URL grammar is spelled once.
 */
export function openTabSearch(params: URLSearchParams, tab: OpenLaneTab): string {
  return openSearch(params, tab === DEFAULT_OPEN_TAB ? undefined : tab)
}

/* ── what the view draws ──────────────────────────────────────────────────────── */

/**
 * The sentence under *Everyone else's*.
 *
 * 🔑 **`olderThanYours` is claimed only when it is true**, and `silent` is a real
 * answer rather than a fallback: with no section of yours there is nothing to compare
 * against, and with no `ageDays` on the wire there is nothing to compare **with**.
 * A screen that always printed the clause would be asserting a comparison it had not
 * made.
 */
export type OpenLaneSignpost =
  | { kind: 'silent' }
  | { kind: 'oldest'; oldestAgeDays: number }
  | { kind: 'olderThanYours'; oldestAgeDays: number; yoursOldestAgeDays: number }

/**
 * Which section this is.
 *
 * ⚠️ **`all` is the degraded rendering**, not a third arrangement: without `isMine`
 * on the wire (server dependency §6) the screen cannot say which branches are the
 * reader's, so it draws one list and says so. Labelling that list *Everyone else's*
 * would assert the estate holds nothing of yours.
 */
export type OpenLaneSectionWhich = 'mine' | 'theirs' | 'all'

export type OpenLaneSection = {
  which: OpenLaneSectionWhich
  /** In the server's order, untouched. See the module docblock. */
  rows: SettlementOpenLaneRow[]
  /** 🚩 Read off the FIRST row rather than folded over the section — the server
   *  ordered it oldest-first, so a `Math.max` here would be a second opinion about
   *  the same fact, and the two could disagree on a row the cap truncated. `null`
   *  when the wire carries no age. */
  oldestAgeDays: number | null
  /** Only ever spoken by the second section. `{ kind: 'silent' }` elsewhere. */
  signpost: OpenLaneSignpost
}

/**
 * The five states the ticket enumerates, as four view cases plus the cap banner
 * (which rides beside rows rather than replacing them).
 *
 * 🚩 **`empty`, `filtered` and `failed` are three types and not one boolean**, which
 * is the whole point: *nothing owing* is good news, *nothing matches these filters*
 * is the reader's own doing, and *this could not be read* is neither. Collapsing any
 * two of them draws a server refusal as an estate with nothing outstanding.
 */
export type OpenLaneView =
  | { kind: 'failed' }
  | { kind: 'empty' }
  | { kind: 'filtered' }
  | { kind: 'rows'; sections: OpenLaneSection[] }

export type OpenLane = {
  /**
   * How big each job is — **from the whole answer, before any filter**, so a tab
   * narrowed to nothing still says how much is out there.
   *
   * ⚠️ `null` means *not known*, and the renderer draws an em-dash. A `0` on a failed
   * read is the screen fabricating a number, and it reads as *nothing needs you*.
   */
  counts: Record<OpenLaneTab, number | null>
  /** Measured against the ONE answer both tabs came out of (`OPEN_LANE_LIMIT`). */
  capReached: boolean
  /**
   * Did the wire say who serves these branches?
   *
   * Drives two things and no more: the sections' shape, and whether the *mine only*
   * chip is offered at all — a filter over a field nobody sent could only ever empty
   * the list.
   */
  ranked: boolean
  /**
   * Did the wire say **who serves** these branches?
   *
   * 🚩 Separate from `ranked` for the reason D7 gives about the chase column: with no
   * `servedBy` on the answer, a *Served by* column could only draw *nobody assigned*
   * on all 1,394 rows — which is a confident false statement about the estate's
   * pairing, where drawing no column at all is merely silence. The renderer omits it.
   */
  named: boolean
  view: OpenLaneView
}

export type OpenLaneInput = {
  /** The one `Settlement/Ledger?status=OPEN&sort=age` answer. */
  rows: readonly SettlementOpenLaneRow[] | null | undefined
  /** The door refused or could not be reached. ⚠️ Distinct from an empty answer. */
  failed: boolean
  tab: OpenLaneTab
  mineOnly: boolean
}

export function buildOpenLane({ rows, failed, tab, mineOnly }: OpenLaneInput): OpenLane {
  // ⚠️ First, and before anything is counted. A failed read has no rows to be honest
  // about, and every number it could report would be invented.
  if (failed) {
    return {
      counts: { owing: null, owed: null },
      capReached: false,
      ranked: false,
      named: false,
      view: { kind: 'failed' },
    }
  }

  const answer = rows ?? []

  // 🔑 One answer, split — never two calls. See `settlementApi.openLane`.
  const byTab = {
    owing: answer.filter((r) => r.entryKind === TAB_KIND.owing),
    owed: answer.filter((r) => r.entryKind === TAB_KIND.owed),
  }
  const counts = { owing: byTab.owing.length, owed: byTab.owed.length }
  // Measured on the WHOLE answer: a per-tab measurement would never fire, because
  // the cap truncated the answer the two tabs share.
  const capReached = isCapReached(answer.length, OPEN_LANE_LIMIT)
  // Asked of the answer rather than of the tab, so the chip does not appear and
  // disappear as the reader switches between two halves of one read.
  const ranked = answer.some((r) => r.isMine !== undefined)
  const named = answer.some((r) => r.servedBy !== undefined)

  const base = { counts, capReached, ranked, named }
  const laneRows = byTab[tab]

  if (laneRows.length === 0) return { ...base, view: { kind: 'empty' } }

  // 🚩 `=== true` and nothing looser: `undefined` is *not said*, and a filter that
  // treated it as a denial would be indistinguishable from one that treated it as a
  // claim. When nothing was said the chip is not offered (`ranked`), so this only
  // narrows a list the server actually labelled.
  const kept = mineOnly ? laneRows.filter((r) => r.isMine === true) : laneRows

  // ⚠️ **Before the sections, and it is not the same answer as `empty`.** The reader
  // narrowed this themselves and the way out is the chip they pressed.
  if (kept.length === 0) return { ...base, view: { kind: 'filtered' } }

  if (!ranked) {
    return { ...base, view: { kind: 'rows', sections: [section('all', kept, { kind: 'silent' })] } }
  }

  const mine = kept.filter((r) => r.isMine === true)
  const theirs = kept.filter((r) => r.isMine !== true)

  const sections: OpenLaneSection[] = []
  // An empty section is drawn as nothing at all rather than as a header over a void —
  // *"Yours · 0"* above the estate's list is a sentence about the reader that the
  // estate's own list already tells.
  if (mine.length) sections.push(section('mine', mine, { kind: 'silent' }))
  if (theirs.length) sections.push(section('theirs', theirs, signpost(mine, theirs)))

  return { ...base, view: { kind: 'rows', sections } }
}

function section(
  which: OpenLaneSectionWhich,
  rows: SettlementOpenLaneRow[],
  signpost: OpenLaneSignpost,
): OpenLaneSection {
  return { which, rows, oldestAgeDays: rows[0]?.ageDays ?? null, signpost }
}

/**
 * What the second section's header says about what is inside it.
 *
 * ⚠️ **Strictly greater than**, so a tie drops the clause: an entry of the estate's
 * that is exactly as old as your worst one is not *older than anything of yours*, and
 * a comparison that rounded in its own favour is the kind a reader stops trusting.
 */
function signpost(
  mine: readonly SettlementOpenLaneRow[],
  theirs: readonly SettlementOpenLaneRow[],
): OpenLaneSignpost {
  const oldest = theirs[0]?.ageDays
  // No age on the wire, or no section of yours to compare against — either way there
  // is no true sentence to say, so nothing is said.
  if (oldest === undefined || mine.length === 0) return { kind: 'silent' }

  const yours = mine[0]?.ageDays
  return yours !== undefined && oldest > yours
    ? { kind: 'olderThanYours', oldestAgeDays: oldest, yoursOldestAgeDays: yours }
    : { kind: 'oldest', oldestAgeDays: oldest }
}
