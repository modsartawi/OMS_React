import type { SettlementScope } from '@/core/models/settlement'
import { DEFAULT_SCOPE, SCOPE_PARAM } from './scope'

/**
 * **This screen's URL grammar, spelled once** (ticket 270).
 *
 * The settlement account is three views on one address — the door, a branch's
 * account (`?store=`, 269's idiom) and the cross-estate ledger (`?view=ledger`) —
 * and every link between them is a question of *what to keep and what to drop*.
 *
 * 🚩 **The scope is kept by every one of them, and that is the rule this module
 * exists for.** A hand-written `?store=0142` replaces the whole query string, so an
 * accountant who deliberately widened to the estate, opened a branch and came back
 * would find the ageing count had fallen from 140 to 47 with nothing on screen to
 * explain it. Widening is a decision the reader made; walking through a branch must
 * not quietly undo it.
 *
 * …and everything else is dropped, deliberately: a search that took you to a branch
 * has done its job, and carrying `?q=` into an account would leave the box holding a
 * query about a screen the reader has left.
 *
 * 🚩 Pure — it takes `URLSearchParams` and returns a search string, so the rules are
 * testable without a router.
 */

/** The branch account's address — 269's, and the one every hit and row links to. */
export const STORE_PARAM = 'store'
/**
 * Which entry the account should land on.
 *
 * 🔑 Spec 267 story 3 asks for more than the branch: *"a phone call quoting 'entry
 * 143' lands me on the right entry whichever branch it is on"*. The account's grid
 * selects its own first displayed row (269), which after a sort is not the entry the
 * accountant was quoted — so the door names the entry it sent them for, and the grid
 * opens on it with its journal underneath.
 */
export const ENTRY_PARAM = 'entry'
/** Which view the door is showing. Only `ledger` means anything. */
export const VIEW_PARAM = 'view'
/**
 * Which uploaded batch a view is about — the ledger's `batch` criterion
 * (`ledger.ts` owns that key) **and** the id the withdrawal view reads.
 *
 * 🚩 **The withdrawal is a view, addressed like every other** — `?view=batch&
 * batch=<id>` — rather than state inside the upload dialog. *"Finance sent the
 * wrong file"* is a discovery made an hour and a reload later, so a withdrawal
 * reachable only from the dialog that committed would be a repair you had to keep a
 * tab open for.
 *
 * ⚠️ **`view=` is what tells the two apart, not the key.** `?view=ledger&batch=…`
 * is a *lookup filtered to a batch*; `?view=batch&batch=…` is the *withdrawal* of
 * one. Reusing the key is deliberate — one word for one thing — and the view
 * parameter is the only thing that may decide which screen draws.
 */
export const BATCH_PARAM = 'batch'
/** The search box's query. */
export const QUERY_PARAM = 'q'

/* ── the ledger's own criteria keys ───────────────────────────────────────────
 * ⚠️ Named here because this module's claim is that the screen's URL grammar is
 * spelled ONCE — but READ and written by `ledger.ts`, which owns what they mean and
 * which values are legal. The dependency runs one way (`ledger.ts` → here) so the
 * two never cycle.
 *
 * 🚩 The ledger reuses `?store=` and `?entry=` rather than minting `lstore=` /
 * `lentry=`, on the ruling `BATCH_PARAM` already states: **one word for one thing,
 * and `view=` is the only thing that may decide which screen draws.** `?store=0142`
 * is *that branch* on both views; what differs is which view is reading it. Which is
 * why `SettlementBody` consults the view BEFORE the branch — see the comment there. */

/** SHORTAGE | SURPLUS. */
export const KIND_PARAM = 'kind'
/** OPEN | CONSUMED | CANCELLED | CLOSED_OUT. */
export const STATUS_PARAM = 'status'
/** `YYYY-MM-DD`, inclusive. */
export const FROM_PARAM = 'from'
/** `YYYY-MM-DD`. ⚠️ The whole of that day — the server compares against the next
 *  midnight, exclusively. */
export const TO_PARAM = 'to'

/**
 * The reader's own state — carried by every link.
 *
 * 🚩 Stated as a **keep-list rather than a drop-list**, and that is the safer of the
 * two: a parameter a later slice adds (271's posting form, 273's upload) belongs to
 * a *view* by default, and a drop-list would carry it into the next screen until
 * somebody remembered to add it. The `LEDGER_PARAMS`, `?store=`, `?view=` and `?q=`
 * are all dropped by simply not being here.
 */
const KEPT = [SCOPE_PARAM]

function keepOnly(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams()
  for (const key of KEPT) {
    const value = params.get(key)
    if (value) next.set(key, value)
  }
  return next
}

const render = (params: URLSearchParams): string => {
  const search = params.toString()
  // `.` rather than `?` — an empty query string on a `<Link to>` still navigates,
  // but it leaves a bare `?` in the address bar for the reader to wonder about.
  return search ? `?${search}` : '.'
}

/**
 * One branch's account, keeping the scope and dropping the view that led here.
 *
 * `entryNumber` is the entry the reader was sent for — a ledger row, or the *"entry
 * 143"* they typed. Omitted when the reader asked for the branch itself, in which
 * case the account lands where 269 lands it.
 */
export function branchSearch(
  params: URLSearchParams,
  storeId: string,
  entryNumber?: number,
): string {
  const next = keepOnly(params)
  next.set(STORE_PARAM, storeId)
  if (entryNumber !== undefined) next.set(ENTRY_PARAM, String(entryNumber))
  return render(next)
}

/** The entry the URL asks the account to open on, or `null`. An unreadable one is
 *  `null` rather than an error: a hand-edited address should land on the branch, not
 *  on a broken screen. */
export function readEntryNumber(params: URLSearchParams): number | null {
  const raw = (params.get(ENTRY_PARAM) ?? '').trim()
  return /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null
}

/** Back to the door — the worklist, at the scope the reader chose. */
export function doorSearch(params: URLSearchParams): string {
  return render(keepOnly(params))
}

/* ⚠️ **`ledgerSearch` stood here until ticket 274, and it now lives in `ledger.ts`**
 * — beside the criteria it writes, rather than split from them.
 *
 * 274 deleted it because there was no `Settlement/Ledger` door
 * (`.afk/FINDINGS-274.md` §B1), which was the right call at the time: an address for
 * a view with no server behind it. BackOffice 1199 §3 built the door, so the view
 * came back — and the ageing lane that also used to point here did **not**, because
 * its reason was different and still holds (spec 1173 rules entry staleness fog,
 * §B3). Two things pointed at each other; only one of them had an answer available.
 */

/**
 * The same view at another scope - what the scope control navigates to.
 *
 * The **default is the absence of the parameter**, so the plain route and *my
 * branches* are one address rather than two spellings of one. It lives here rather
 * than in the Page because this module's claim is that the screen's URL grammar is
 * spelled once.
 */
export function scopeSearch(params: URLSearchParams, scope: SettlementScope): string {
  const next = new URLSearchParams(params)
  if (scope === DEFAULT_SCOPE) next.delete(SCOPE_PARAM)
  else next.set(SCOPE_PARAM, scope)
  return render(next)
}

/**
 * The withdrawal view for one uploaded batch (273) — keeping the scope and
 * dropping everything that led here, like every other address on this screen.
 */
export function batchSearch(params: URLSearchParams, batchId: string): string {
  const next = keepOnly(params)
  next.set(VIEW_PARAM, 'batch')
  next.set(BATCH_PARAM, batchId)
  return render(next)
}

/**
 * The batch the URL is asking to withdraw, or `''`.
 *
 * ⚠️ **Both halves are required.** A bare `?batch=…` left over from a ledger filter
 * must not open the withdrawal screen — the view parameter is what decides which
 * screen draws, and a hand-edited address missing it lands on the door rather than
 * on an act.
 */
export function readBatchView(params: URLSearchParams): string {
  if (params.get(VIEW_PARAM) !== 'batch') return ''
  return (params.get(BATCH_PARAM) ?? '').trim()
}

/** The branch the URL names, or `''`. Trimmed, so `?store=` with nothing after it —
 *  a hand-edited address — reads as *no branch* rather than as the branch whose code
 *  is the empty string (269's `readAcrScope` rule, one screen over). */
export function readStore(params: URLSearchParams): string {
  return (params.get(STORE_PARAM) ?? '').trim()
}

/** The search box's query, as typed. */
export function readQuery(params: URLSearchParams): string {
  return params.get(QUERY_PARAM) ?? ''
}

/** The same URL with a new query in it — `''` removes the parameter rather than
 *  leaving `?q=` behind. */
export function writeQuery(params: URLSearchParams, query: string): URLSearchParams {
  const next = new URLSearchParams(params)
  if (query) next.set(QUERY_PARAM, query)
  else next.delete(QUERY_PARAM)
  return next
}
