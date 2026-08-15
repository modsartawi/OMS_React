import type { SettlementScope } from '@/core/models/settlement'
import { DEFAULT_SCOPE, SCOPE_PARAM } from './scope'

/**
 * **This screen's URL grammar, spelled once** (ticket 270, re-cut by 283).
 *
 * The settlement account is **four screens under one prefix** — the Overview door
 * (which is also where a branch's account lands, `?store=`, 269's idiom), the open
 * settlements lane, the cross-estate ledger and the bulk upload — and every link
 * between them is a question of *what to keep and what to drop*.
 *
 * 🔑 **The dividing rule** (spec 282 D3): **a path segment names which screen; a
 * parameter names what that screen is looking at.** Which is why `?store=` and
 * `?entry=` stayed parameters when `?view=` became a path — a branch's account is
 * where you *land* from a hit, a row or a phone call, not a nav destination — and
 * why every 269-era address keeps working with no redirect at all.
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
 * 🚩 Pure — it takes a pathname and `URLSearchParams` and returns a `path?search`
 * string, so the rules are testable without a router.
 */

/* ── the four screens ─────────────────────────────────────────────────────────
 * 🚩 Spelled here rather than in `router.tsx`, because this module's claim is that
 * the screen's URL grammar is spelled ONCE — and after 283 it spells paths as well
 * as parameters. `ledger.ts` reads `LEDGER_PATH` for the same reason it reads the
 * criteria keys from here: the dependency runs one way, so the two never cycle. */

/** The Overview — the door (search, triage, scope) and, with `?store=`, one branch's
 *  account. Also the prefix the other three hang off. */
export const SETTLEMENT_PATH = '/collection/settlement'
/** Open settlements — the ageing lane, three tabs (ticket 285). */
export const OPEN_PATH = `${SETTLEMENT_PATH}/open`
/** The cross-estate lookup. Its six criteria stay parameters — they are a *question*,
 *  which is what a query string is for. */
export const LEDGER_PATH = `${SETTLEMENT_PATH}/ledger`
/** The month's audit, uploaded — and, with `?batch=`, one batch's withdrawal. */
export const UPLOAD_PATH = `${SETTLEMENT_PATH}/upload`

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
/**
 * Which uploaded batch a view is about — the ledger's `batch` criterion
 * (`ledger.ts` owns that key) **and** the id the withdrawal reads on the upload path.
 *
 * 🚩 **The withdrawal is an address like every other** — `/collection/settlement/
 * upload?batch=<id>` — rather than state inside the upload dialog. *"Finance sent
 * the wrong file"* is a discovery made an hour and a reload later, so a withdrawal
 * reachable only from the dialog that committed would be a repair you had to keep a
 * tab open for.
 *
 * ⚠️ **The PATH is what tells the two apart, not the key** (283; until then it was
 * `?view=`). `/ledger?batch=…` is a *lookup filtered to a batch*; `/upload?batch=…`
 * is the *withdrawal* of one. Reusing the key is deliberate — one word for one
 * thing — and after 283 nothing but the path may decide which screen draws, which is
 * why a bare `?batch=` on the Overview is now simply a parameter no view reads.
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
 * two: a parameter a later slice adds (271's posting form, 273's upload, 285's tab)
 * belongs to a *view* by default, and a drop-list would carry it into the next
 * screen until somebody remembered to add it. The `LEDGER_PARAMS`, `?store=` and
 * `?q=` are all dropped by simply not being here — and 283 changed nothing about
 * this list, because moving the views to paths did not move the reader's own state.
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

/**
 * One address — the screen, then what it is looking at.
 *
 * ⚠️ **Absolute, and that is the change 283 made.** Until the views were paths every
 * builder returned a bare `?search` and relied on the reader already standing on the
 * one address this screen had; a relative link out of `/collection/settlement/ledger`
 * would now land back on the ledger. The path is named every time, by every builder.
 *
 * A path with nothing to say carries **no query string at all** rather than a bare
 * `?` for the reader to wonder about.
 */
export function settlementAddress(path: string, params: URLSearchParams): string {
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

/** The same, under the name the builders below read best with. */
const at = settlementAddress

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
  // 🚩 The OVERVIEW path, from wherever the reader was — a ledger row and a lane row
  // both land on the account, and neither is a nav destination of its own.
  return at(SETTLEMENT_PATH, next)
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
  return at(SETTLEMENT_PATH, keepOnly(params))
}

/**
 * The open settlements lane (spec 282), keeping the scope like every address here.
 *
 * The lane's own `?tab=owing|owed|cash` is 285's and is *not* spelled yet — a tab is
 * what the screen is looking at, so it will arrive as a parameter on this path.
 */
export function openSearch(params: URLSearchParams): string {
  return at(OPEN_PATH, keepOnly(params))
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
export function scopeSearch(
  params: URLSearchParams,
  scope: SettlementScope,
  pathname: string,
): string {
  const next = new URLSearchParams(params)
  if (scope === DEFAULT_SCOPE) next.delete(SCOPE_PARAM)
  else next.set(SCOPE_PARAM, scope)
  // ⚠️ **The SAME screen** — the pathname is passed in rather than assumed, because
  // this is the one builder whose answer is *where you already are*.
  return at(pathname, next)
}

/**
 * The bulk upload (273) — keeping the scope and dropping everything that led here,
 * like every other address on this screen.
 *
 * With a `batchId` it is one committed batch's **withdrawal**; without one it is the
 * upload itself. One path, because they are one screen: *"finance sent the wrong
 * file"* is answered on the screen the file was sent from.
 */
export function uploadSearch(params: URLSearchParams, batchId?: string): string {
  const next = keepOnly(params)
  if (batchId) next.set(BATCH_PARAM, batchId)
  return at(UPLOAD_PATH, next)
}

/**
 * The batch the URL names, or `''`. Trimmed, like `readStore`.
 *
 * ⚠️ **283 dissolved the both-halves rule that stood here.** `?view=batch` used to be
 * required beside the id, because the view parameter was the only thing that could
 * decide which screen drew and a bare `?batch=` left over from a ledger filter must
 * not open a withdrawal. The path decides now, so a leftover `?batch=` on the
 * Overview or the ledger is read by nobody — there is no rule left to enforce.
 */
export function readBatch(params: URLSearchParams): string {
  return (params.get(BATCH_PARAM) ?? '').trim()
}

/**
 * Is this the Overview — the one screen with two faces (the door, and a branch's
 * account under `?store=`)?
 *
 * ⚠️ **A trailing slash is the same address.** React-router matches
 * `/collection/settlement/` to the index route either way, so a comparison that did
 * not say so would draw the door under the *away* chrome — no scope control, and a
 * *back to the door* link pointing at the screen the reader is already on.
 */
export function isOverviewPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === SETTLEMENT_PATH
}

/* ── compatibility shim: the pre-283 `?view=` addresses ───────────────────────── */

/** The parameter that named the view until 2026-08-15. Not exported, and not part of
 *  this screen's grammar any more — it is read in one place, below, and nowhere else. */
const LEGACY_VIEW_PARAM = 'view'

/**
 * ⚠️ **A COMPATIBILITY SHIM, added 2026-08-15 with ticket 283 — not live grammar.**
 *
 * Until that date the settlement screen's four views were one address and a `?view=`
 * parameter, and 273 deliberately made a batch withdrawal *"reachable an hour and a
 * reload later"*. So those addresses are in tickets, in incident notes and in
 * mailboxes. This maps the two that meant anything onto their new paths:
 *
 * ```
 * ?view=ledger        → /collection/settlement/ledger    (every other parameter carried through)
 * ?view=batch&batch=… → /collection/settlement/upload?batch=…
 * ```
 *
 * 🚩 **Kept indefinitely, with no sunset**, and the asymmetry is the whole argument:
 * this is a dozen lines and a table of tests, while the other side of the ledger is
 * an accountant reading *page not found* off a link they pasted into an incident,
 * with a branch on the phone. Nothing is simplified by removing it later, so nothing
 * schedules its removal.
 *
 * Returns the address to `replace` with — `replace`, so Back does not bounce — or
 * `null` when there is nothing legacy about the address. Only the Overview path is
 * examined: it is the only address the old grammar could produce, and a stray
 * `?view=` typed onto one of the three new paths is a parameter no view reads.
 */
export function legacyViewRedirect(pathname: string, params: URLSearchParams): string | null {
  if (!isOverviewPath(pathname)) return null

  const view = (params.get(LEGACY_VIEW_PARAM) ?? '').trim().toLowerCase()
  const target =
    view === 'ledger'
      ? LEDGER_PATH
      : // 🚩 **`?view=batch` needs its batch, and this is the one piece of the old
        // both-halves rule the shim keeps** — for the reader rather than for the
        // grammar. A truncated withdrawal link used to land on the door; sending it
        // to `/upload` instead would hand somebody who pasted half a *withdrawal*
        // address a form for POSTING a month of entries, which is the opposite act.
        // The rule is dead everywhere else: a live `?batch=` needs nothing vouching
        // for it, because the path says which screen reads it.
        view === 'batch' && readBatch(params)
        ? UPLOAD_PATH
        : null
  // ⚠️ An unrecognised `?view=` is NOT a redirect either. It never named a view, so it
  // never named a screen — the reader stays on the Overview, where they already are.
  if (!target) return null

  const next = new URLSearchParams(params)
  next.delete(LEGACY_VIEW_PARAM)
  // 🚩 Everything else is carried through UNTOUCHED — the ledger's six criteria and
  // the batch id are the reader's question, and a redirect that dropped them would
  // land them on the right screen asking nothing.
  return at(target, next)
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
