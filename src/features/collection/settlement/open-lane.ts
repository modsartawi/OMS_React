import type {
  SettlementEntryKind,
  SettlementOpenLaneRow,
  SettlementUncollectedRow,
} from '@/core/models/settlement'
import { TAB_PARAM, openSearch } from './addresses'
import { CASH_LANE_LIMIT, OPEN_LANE_LIMIT, isCapReached } from './cap'

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
 * The lane's three tabs — *Owing* (SHORTAGE), *Owed* (SURPLUS) and *Cash waiting*
 * (286's prepared-but-uncollected receipts).
 *
 * 🚩 **Owing and Owed are two tabs rather than a kind column**, because they are the
 * same age fact pointing in opposite directions: *the branch owes head office* is one
 * list an accountant works top to bottom, and money the estate owes outward is a
 * different phone call to a different person.
 *
 * 🚩 **And Cash waiting is a third tab rather than a filter over them**, for a
 * stronger version of the same reason: a receipt nobody has collected is a **visit
 * that did not happen**, so the call goes to the collector rather than to the branch
 * manager. It also comes off a different door, which is why its count is not
 * `tallyOpenLane`'s to give.
 */
export const OPEN_LANE_TABS = ['owing', 'owed', 'cash'] as const
export type OpenLaneTab = (typeof OPEN_LANE_TABS)[number]

/**
 * The two tabs that are **entries** — the pair one `Settlement/Ledger` answer feeds.
 *
 * 🔑 Named separately from `OpenLaneTab` because the split is the whole reason the
 * two counts cannot disagree: they come out of ONE call, and a `Record<OpenLaneTab,…>`
 * over the tally would have invited a third count fabricated from the same answer —
 * which knows nothing at all about receipts.
 */
export const OPEN_LANE_ENTRY_TABS = ['owing', 'owed'] as const
export type OpenLaneEntryTab = (typeof OPEN_LANE_ENTRY_TABS)[number]

/** Owing first: it is the larger job and the one the estate loses money on. ⚠️ Typed
 *  as an ENTRY tab, so a screen falling back to it always has a kind to ask about. */
export const DEFAULT_OPEN_TAB: OpenLaneEntryTab = 'owing'

/** Which kind each entry tab is asking about. The direction lives on `entryKind`,
 *  never on a sign — `amount` is always a positive magnitude (the contract's own
 *  rule). ⚠️ *Cash waiting* has no entry kind of its own: a waiting receipt carries
 *  the kind of the entry it was prepared against, and the tab lists both. */
const TAB_KIND: Record<OpenLaneEntryTab, SettlementEntryKind> = {
  owing: 'SHORTAGE',
  owed: 'SURPLUS',
}

/** Is this tab one the ledger answer feeds? The screen asks before handing a tab to
 *  `buildOpenLane`, which has nothing to say about receipts. */
export function isEntryTab(tab: OpenLaneTab): tab is OpenLaneEntryTab {
  return tab !== 'cash'
}

/**
 * Which tab the URL is asking for.
 *
 * ⚠️ **An unreadable value lands on Owing rather than on an error** — the rule
 * `readCriteria` and `readEntryNumber` both follow one module over: *a hand-edited
 * address should land on a screen, not on a broken one*.
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

/**
 * The three facts the arrangement is made of, and the only ones it reads.
 *
 * 🔑 **This is what lets *Cash waiting* reuse the sectioning rather than copy it.** An
 * entry and a prepared receipt disagree about almost everything — what the money means,
 * what the date is counted from, who the name in the row belongs to — and agree about
 * exactly this: whether the reader serves the branch, whether anyone is named, and how
 * old it is. The substitutions the third tab makes are all in the columns (ticket
 * 286); the arrangement is one implementation, so the two tabs cannot drift into
 * sectioning the estate two different ways.
 */
export type OpenLaneRowFacts = {
  isMine?: boolean
  servedBy?: string
  ageDays?: number
}

export type OpenLaneSection<Row extends OpenLaneRowFacts = SettlementOpenLaneRow> = {
  which: OpenLaneSectionWhich
  /** In the server's order, untouched. See the module docblock. */
  rows: Row[]
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
export type OpenLaneView<Row extends OpenLaneRowFacts = SettlementOpenLaneRow> =
  | { kind: 'failed' }
  | { kind: 'empty' }
  | { kind: 'filtered' }
  | { kind: 'rows'; sections: OpenLaneSection<Row>[] }

/**
 * How big each job is — **from the whole answer, before any filter**, so a tab
 * narrowed to nothing still says how much is out there.
 *
 * ⚠️ `null` means *not known*, and every renderer draws an em-dash for it. A `0` on a
 * failed read is the screen fabricating a number, and it reads as *nothing needs you*.
 */
export type OpenLaneCounts = Record<OpenLaneEntryTab, number | null>

/**
 * What the tab strip draws — the two entry counts **and** the cash one, which comes
 * off a different door.
 *
 * 🔑 Assembled at the screen rather than by either builder, because that is what it
 * honestly is: two answers, each able to be unknown on its own. A single builder
 * returning all three would have to wait for both doors to say anything about either.
 */
export type OpenLaneTabCounts = Record<OpenLaneTab, number | null>

/**
 * **What the front page's signpost says** (ticket 288) — and what the lane's own tab
 * strip says, because it is the same function over the same answer.
 *
 * 🔑 **One call, one count, and therefore nothing to disagree about.** The signpost on
 * the door and the counts on the lane's tabs are two renderings of
 * `Settlement/Ledger?status=OPEN&sort=age` — the same TanStack key, the same
 * projection, the same numbers. Two counts of one estate, fetched a second apart, is
 * exactly the situation where an accountant has to work out which one is lying.
 *
 * 🚩 **Counts are ROWS.** Not money (`figures.ts` refuses to total across currencies
 * while `currencyKey` is missing from these reads — spec 282 D12) and not branches (a
 * branch with four shortages is four phone calls).
 *
 * ⚠️ **`capReached` is carried rather than folded into the numbers**, because at the
 * cap the count is a floor and not a total. Saying *2,000* flat would be the one thing
 * this screen is not allowed to do: state a number it cannot stand behind.
 *
 * ⚠️ **There is no *Cash waiting* count here, and 286 building that tab did not add
 * one.** This function counts ONE `Settlement/Ledger` answer; a receipt nobody has
 * collected is a row of `Settlement/Uncollected`, a different door with a different
 * cap and its own failure. A third number folded in here would either be fabricated
 * from an answer that knows nothing about receipts, or would quietly make every caller
 * of this tally — including the front page's signpost — wait on a second call. The
 * lane's tab strip composes the third count beside these two; see `tallyCashLane`.
 */
export type OpenLaneTally = {
  counts: OpenLaneCounts
  /** ⚠️ The read failed — the counts are unknown AND the reader is told why. Distinct
   *  from a read still in flight, which is also unknown but says nothing. */
  failed: boolean
  /** Measured against the ONE answer both tabs came out of (`OPEN_LANE_LIMIT`). */
  capReached: boolean
}

/**
 * The tally of one `Settlement/Ledger?status=OPEN` answer.
 *
 * 🚩 **The failed case is answered first and returns `null`s**, which is the whole
 * point of the function: a refused read has nothing to count, and every number it
 * could report would be invented. That exact mistake — a failed read drawn as `0` —
 * was one of ticket 270's own `/code-review` findings, on this very surface.
 */
export function tallyOpenLane({
  rows,
  failed,
}: Pick<OpenLaneInput, 'rows' | 'failed'>): OpenLaneTally {
  if (failed) return { counts: { owing: null, owed: null }, failed: true, capReached: false }

  const answer = rows ?? []
  return {
    // 🔑 One answer, split — never two calls. See `settlementApi.openLane`.
    counts: {
      owing: answer.filter((r) => r.entryKind === TAB_KIND.owing).length,
      owed: answer.filter((r) => r.entryKind === TAB_KIND.owed).length,
    },
    failed: false,
    // Measured on the WHOLE answer: a per-tab measurement would never fire, because
    // the cap truncated the answer the two tabs share.
    capReached: isCapReached(answer.length, OPEN_LANE_LIMIT),
  }
}

export type OpenLane = {
  /** The estate's position, before any filter — `tallyOpenLane`'s, so the lane's tabs
   *  and the door's signpost cannot say two different things. */
  counts: OpenLaneCounts
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
  /**
   * Did the wire carry **ages** — and therefore, is the answer actually in the order
   * this screen claims?
   *
   * 🚩 **The order and the age are one fact, not two.** `sort=age` is part of the same
   * unbuilt server dependency (§6): a door that sends no `ageDays` is also a door that
   * ignored the sort and answered its default `EntryNumber DESC`. So a screen saying
   * *oldest first* — in its subtitle, and above all in its cap banner's *"anything
   * missing is newer than what is here"* — would be asserting an arrangement the rows
   * do not have, and at 2,000 rows the cap would be dropping exactly the entries the
   * lane exists for while the banner said otherwise.
   *
   * ⚠️ The answer is still drawn in the order it arrived, because re-sorting a capped
   * page is the worse lie. What changes is the sentence beside it.
   */
  aged: boolean
  view: OpenLaneView
}

export type OpenLaneInput = {
  /** The one `Settlement/Ledger?status=OPEN&sort=age` answer. */
  rows: readonly SettlementOpenLaneRow[] | null | undefined
  /** The door refused or could not be reached. ⚠️ Distinct from an empty answer. */
  failed: boolean
  tab: OpenLaneEntryTab
  mineOnly: boolean
}

export function buildOpenLane({ rows, failed, tab, mineOnly }: OpenLaneInput): OpenLane {
  // ⚠️ First, and before anything is counted. A failed read has no rows to be honest
  // about, and every number it could report would be invented.
  const { counts, capReached } = tallyOpenLane({ rows, failed })
  if (failed) {
    return {
      counts,
      capReached,
      ranked: false,
      named: false,
      aged: false,
      view: { kind: 'failed' },
    }
  }

  const answer = rows ?? []
  // Asked of the answer rather than of the tab, so the chip does not appear and
  // disappear as the reader switches between two halves of one read.
  const said = whatTheWireSaid(answer)

  return {
    counts,
    capReached,
    ...said,
    view: arrange(
      answer.filter((r) => r.entryKind === TAB_KIND[tab]),
      mineOnly,
      said.ranked,
    ),
  }
}

/* ── cash waiting ─────────────────────────────────────────────────────────────── */

/**
 * **What the third tab is looking at** (ticket 286) — the estate's prepared receipts
 * nobody has collected, `Settlement/Uncollected`.
 *
 * 🔑 **One count, its own door, its own cap, its own failure.** It is deliberately not
 * folded into `OpenLaneTally`: the two entry tabs are two readings of ONE ledger
 * answer and must agree, while this is a second answer that can fail on its own — and
 * when it does, its tab shows an em-dash while the other two still count.
 *
 * ⚠️ **No `ranked` / `named` / `aged` flags.** They exist above because §6 extends a
 * door that already ships, so its three fields are absent today and the screen must
 * degrade around them. §2 is a whole door: there is no half-answer to degrade into —
 * either the receipts arrive with everything on them, or the tab draws its refusal.
 */
export type CashLane = {
  /** How many receipts are waiting, **before any filter**. `null` = not known, drawn
   *  as an em-dash by every renderer — never `0`, which reads as *all collected*. */
  count: number | null
  /** Measured against `CASH_LANE_LIMIT` — 500, the rare-event cap, and NOT the entry
   *  lane's 2,000. See `cap.ts`. */
  capReached: boolean
  view: OpenLaneView<SettlementUncollectedRow>
}

export type CashLaneInput = {
  /** The one `Settlement/Uncollected` answer. */
  rows: readonly SettlementUncollectedRow[] | null | undefined
  /** ⚠️ Its OWN failure — the entry tabs are unaffected, and vice versa. */
  failed: boolean
  mineOnly: boolean
}

/** How big the third job is. Split out for the same reason `tallyOpenLane` is: the tab
 *  strip needs the number whichever tab is being drawn. */
export function tallyCashLane({
  rows,
  failed,
}: Pick<CashLaneInput, 'rows' | 'failed'>): Pick<CashLane, 'count' | 'capReached'> {
  if (failed) return { count: null, capReached: false }
  const answer = rows ?? []
  return { count: answer.length, capReached: isCapReached(answer.length, CASH_LANE_LIMIT) }
}

/**
 * The cash waiting tab, arranged exactly as the other two are.
 *
 * 🚩 **The same `arrange` and therefore the same five states** — yours above everyone
 * else's, the signpost claimed only when true, *empty ≠ emptied-by-filter ≠ failed*.
 * 286 substitutes three things and nothing else (the age says *prepared*, the money is
 * the receipt's whole amount, the name is the **collector**), and all three are the
 * columns' business rather than the arrangement's.
 *
 * ⚠️ **Nothing deduplicates against the Owing tab, deliberately.** A partly-consumed
 * entry belongs on both: *"the branch still owes 40"* and *"a receipt for 60 is
 * prepared and nobody has been to fetch it"* are two true sentences about the same
 * money, and they are two different phone calls — one to the branch manager, one to
 * the collector. The two lanes never even meet in this module.
 */
export function buildCashLane({ rows, failed, mineOnly }: CashLaneInput): CashLane {
  const tally = tallyCashLane({ rows, failed })
  if (failed) return { ...tally, view: { kind: 'failed' } }

  // Every row of this door carries `isMine`, so the arrangement is always the ranked
  // one — there is no §6-shaped absence to degrade around here.
  return { ...tally, view: arrange((rows ?? []).slice(), mineOnly, true) }
}

/* ── the arrangement, shared by all three tabs ────────────────────────────────── */

/** What the wire actually said about these rows — the three flags a renderer needs to
 *  know what it may and may not claim. See `OpenLane`'s own fields for what each
 *  absence costs. */
function whatTheWireSaid(answer: readonly OpenLaneRowFacts[]): Pick<
  OpenLane,
  'ranked' | 'named' | 'aged'
> {
  return {
    ranked: answer.some((r) => r.isMine !== undefined),
    named: answer.some((r) => r.servedBy !== undefined),
    aged: answer.some((r) => r.ageDays !== undefined),
  }
}

/**
 * One tab's rows, sectioned — *Yours* above *Everyone else's*, or one list when the
 * wire said nothing about who serves a branch.
 *
 * 🚩 **Generic over the row, and that is the point of it.** The entry lane and the
 * cash lane hold different things and are arranged identically; two copies of this
 * would be two chances for one of them to start hiding the estate.
 */
function arrange<Row extends OpenLaneRowFacts>(
  laneRows: Row[],
  mineOnly: boolean,
  ranked: boolean,
): OpenLaneView<Row> {
  if (laneRows.length === 0) return { kind: 'empty' }

  // 🚩 `=== true` and nothing looser: `undefined` is *not said*, and a filter that
  // treated it as a denial would be indistinguishable from one that treated it as a
  // claim.
  //
  // ⚠️ **And a tab the wire did not rank ignores the chip rather than emptying** — the
  // filter is one piece of state across three tabs, but *whether it can be offered* is
  // a per-tab fact: the receipts door always sends `isMine` while the entry tabs wait
  // on §6 for it. Without this, a reader could press the chip on Cash waiting, switch
  // to Owing against a door that sends no ranking, and read *"nothing matches these
  // filters"* with no chip on screen to clear. A filter over a field nobody sent is
  // not a filter.
  const kept = mineOnly && ranked ? laneRows.filter((r) => r.isMine === true) : laneRows

  // ⚠️ **Before the sections, and it is not the same answer as `empty`.** The reader
  // narrowed this themselves and the way out is the chip they pressed.
  if (kept.length === 0) return { kind: 'filtered' }

  if (!ranked) return { kind: 'rows', sections: [section('all', kept, { kind: 'silent' })] }

  const mine = kept.filter((r) => r.isMine === true)
  const theirs = kept.filter((r) => r.isMine !== true)

  const sections: OpenLaneSection<Row>[] = []
  // An empty section is drawn as nothing at all rather than as a header over a void —
  // *"Yours · 0"* above the estate's list is a sentence about the reader that the
  // estate's own list already tells.
  if (mine.length) sections.push(section('mine', mine, { kind: 'silent' }))
  if (theirs.length) sections.push(section('theirs', theirs, signpost(mine, theirs)))

  return { kind: 'rows', sections }
}

function section<Row extends OpenLaneRowFacts>(
  which: OpenLaneSectionWhich,
  rows: Row[],
  signpost: OpenLaneSignpost,
): OpenLaneSection<Row> {
  return { which, rows, oldestAgeDays: rows[0]?.ageDays ?? null, signpost }
}

/**
 * What the second section's header says about what is inside it.
 *
 * 🔑 **Two sentences, and only the second one is a comparison.** Story 18 asks the
 * header to *tell me its oldest entry* — which is true of the section whether or not
 * the reader has one of their own — and only the *"older than anything of yours"*
 * clause depends on there being something to compare against. Collapsing the two
 * would mean an accountant assigned no branches reads the estate's entire list under
 * a header that says nothing at all about it.
 *
 * ⚠️ **Strictly greater than**, so a tie drops the clause: an entry of the estate's
 * that is exactly as old as your worst one is not *older than anything of yours*, and
 * a comparison that rounded in its own favour is the kind a reader stops trusting.
 */
function signpost(
  mine: readonly OpenLaneRowFacts[],
  theirs: readonly OpenLaneRowFacts[],
): OpenLaneSignpost {
  const oldest = theirs[0]?.ageDays
  // No age on the wire — there is no fact to state and none is invented.
  if (oldest === undefined) return { kind: 'silent' }

  const yours = mine[0]?.ageDays
  // ⚠️ `mine` empty means there is nothing to compare against, NOT that there is
  // nothing to say: the section's own oldest is still stated.
  return yours !== undefined && oldest > yours
    ? { kind: 'olderThanYours', oldestAgeDays: oldest, yoursOldestAgeDays: yours }
    : { kind: 'oldest', oldestAgeDays: oldest }
}
