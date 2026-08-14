/**
 * The Collection Assignment screen's **three bulk flows**, and the one confirmation
 * that makes them safe — BackOffice spec 1162 D11, ticket
 * [1171](C:\Work\DMSCO\BackOffice\.issues\1171-reassign-a-city-in-one-action.md).
 *
 * Assigning 1255 unserved branches one row at a time is not a screen, it is a week.
 * **All three flows ship**, because each answers a different way finance arrives at
 * a set:
 *
 * 1. **Filter-then-apply** — narrow to a city or to *no collector*, then assign
 *    everything matching.
 * 2. **Tick rows** — select-page and select-all-matching, for a partial set.
 * 3. **Paste a list** — store codes arriving by email, pasted in and assigned
 *    together.
 *
 * 🔑 **The three are three ways of arriving at a LIST OF STORE CODES and nothing
 * more.** That is the whole architecture of this file: each flow is one small
 * function producing a `BulkSelection`, and everything downstream — the body, the
 * confirmation, the settling of the grid — is shared. Three flows with three
 * confirmations would be three dialogs that drift, and the dialog is the guard.
 *
 * 🚩 **The already-served count is NOT computed here.** It comes back from
 * `CollectionWeb/Assignment/BulkPreview`, measured server-side over the actual
 * target set: what this client holds is a page-load snapshot on the tick-rows flow,
 * and on the paste flow a set the grid may never have shown at all. This module
 * carries the number to the dialog; it never invents it.
 *
 * Pure — no React, no i18n, no network, no `new Date()` — the seam `assignment.ts`
 * and `people.ts` beside it already use.
 */
import {
  matchesFilter,
  type AssignmentBranch,
  type AssignmentFilter,
  type NameOf,
} from './assignment'
import type { Slot } from './people'

/** Which gesture produced this selection. Carried only so the dialog can say what
 *  the user is confirming — it changes nothing about the request or the write. */
export type BulkFlow = 'filter' | 'ticked' | 'pasted'

export interface BulkSelection {
  flow: BulkFlow
  /** The target set, in the order the user arrived at it. Cleaned of blanks and
   *  duplicates; codes are otherwise left exactly as typed, because an unknown one
   *  has to come back recognisable. */
  storeCodes: string[]
}

/** Blanks out, duplicates out (case-insensitively, first spelling wins), order kept. */
function tidy(codes: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of codes) {
    const code = (raw ?? '').trim()
    if (code === '') continue
    const key = code.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(code)
  }

  return out
}

/**
 * **Filter-then-apply.** Everything currently matching the filter — a city, or *no
 * collector*, or a search for a person's name.
 *
 * ⚠️ It is built from the filter over the WHOLE payload, not from the rows the grid
 * has drawn: the screen holds all ~1394 branches and pages over them client-side, so
 * "everything matching" must mean the 1255 and not the 50 on the page. Taking the
 * page would silently assign a fiftieth of what the button says it does.
 */
export function selectionFromFilter(
  branches: readonly AssignmentBranch[],
  filter: AssignmentFilter,
  nameOf: NameOf,
): BulkSelection {
  return {
    flow: 'filter',
    storeCodes: tidy(
      branches.filter((branch) => matchesFilter(branch, filter, nameOf)).map((b) => b.storeCode),
    ),
  }
}

/**
 * **Tick rows.** Select-page and select-all-matching are the same thing by the time
 * they get here — a set of store codes the user ticked — so there is one flow rather
 * than two.
 */
export function selectionFromTicks(ticked: Iterable<string>): BulkSelection {
  return { flow: 'ticked', storeCodes: tidy([...ticked]) }
}

/** The store codes on one page of the grid — what *tick this page* ticks. Here rather
 *  than in the Page for the same reason as everything else in this file: the paging
 *  arithmetic that decides which 50 rows a gesture means belongs beside the other two
 *  flows, where it can be read against them. */
export function pageCodes(
  visible: readonly AssignmentBranch[],
  pageIndex: number,
  pageSize: number,
): string[] {
  const start = Math.max(0, pageIndex) * pageSize
  return visible.slice(start, start + pageSize).map((branch) => branch.storeCode)
}

/**
 * **Paste a list.** Store codes arriving by email: one per line, or comma-separated,
 * or tab-separated out of a spreadsheet cell — all three, because the administrator
 * pastes whatever the sender sent and re-formatting it by hand is the retyping this
 * flow exists to remove.
 *
 * ⚠️ Nothing is validated here. A code that matches no branch is the SERVER's answer
 * (`unknownStoreCodes`), reported back and named — dropping it client-side would be
 * exactly the silent loss the ticket forbids, and this module could not tell a typo
 * from a branch it has not heard of anyway.
 */
export function parsePastedCodes(text: string): string[] {
  return tidy((text ?? '').split(/[\s,;]+/))
}

export function selectionFromPaste(text: string): BulkSelection {
  return { flow: 'pasted', storeCodes: parsePastedCodes(text) }
}

/**
 * The body of `POST CollectionWeb/Assignment/BulkPreview` and of
 * `…/BulkSetStores` — the SAME body, sent to both, which is what stops the number
 * in the dialog and the number the write is about from being two different
 * questions.
 *
 * 🔑 **No actor.** Attribution is stamped server-side from the cookie session,
 * exactly as on the per-row save. A bulk reassignment is the change most likely to
 * be surprising six months later, so it is the one that most needs a name on it.
 *
 * ⚠️ **Exactly one slot is sent.** Applying to a slot leaves the other untouched —
 * over a city just as over a row — so a bulk collector hand-over must not carry an
 * `accountantId` at all, not even the one the rows happen to have.
 */
export interface BulkAssignmentBody {
  storeCodes: string[]
  accountantId?: string
  collectorId?: string
}

export function buildBulkBody(
  selection: BulkSelection,
  slot: Slot,
  staffId: string,
): BulkAssignmentBody {
  return { storeCodes: [...selection.storeCodes], [slot]: staffId ?? '' }
}

/** What `BulkPreview` answers — both numbers, and the codes that matched nothing. */
export interface BulkPreview {
  targeted: number
  alreadyServed: number
  unknownStoreCodes: string[]
}

/** What `BulkSetStores` answers. `appliedStoreCodes` is load-bearing, not
 *  decorative: it is how the grid settles on what the SERVER wrote, and it is the
 *  set the pin below keeps on screen. */
export interface BulkResult {
  appliedStoreCodes: string[]
  applied: number
  alreadyServed: number
  unknownStoreCodes: string[]
  updatedBy: string
  updatedAt: string
}

/**
 * 🔑 **THE ONE CONFIRMATION ALL THREE FLOWS END AT.** Whichever gesture produced the
 * selection, this is the object the dialog renders — and it always carries **both**
 * numbers.
 *
 * `targeted` alone is the sentence an administrator agrees to without reading. Over
 * an unfiltered estate the same button that fills 300 gaps would otherwise rewrite
 * the 139 pairings finance already decided, silently, and nothing on screen would
 * have said so. `alreadyServed` is the whole guard.
 */
export interface BulkConfirmation {
  flow: BulkFlow
  slot: Slot
  staffId: string
  /** How many branches the apply would write. */
  targeted: number
  /** How many of the `targeted` already have somebody **in the slot being written**
   *  — server-measured, per slot, so a collector apply does not warn about
   *  accountants it is not going to touch. */
  alreadyServed: number
  /** Pasted codes that matched no open branch, named rather than dropped. */
  unknown: string[]
}

export function buildConfirmation(
  selection: BulkSelection,
  slot: Slot,
  staffId: string,
  preview: BulkPreview,
): BulkConfirmation {
  return {
    flow: selection.flow,
    slot,
    staffId: staffId ?? '',
    targeted: preview.targeted,
    alreadyServed: preview.alreadyServed,
    unknown: [...(preview.unknownStoreCodes ?? [])],
  }
}

/** Is there anything to confirm? A selection that resolved to nothing — every pasted
 *  code a typo, or a filter matching no branch — must not open a dialog offering to
 *  apply to nobody. */
export function isApplicable(confirmation: BulkConfirmation): boolean {
  return confirmation.targeted > 0
}

/**
 * The grid's rows after a bulk apply — the server's answer folded into the payload
 * the screen already holds.
 *
 * ⚠️ **Only the applied slot moves**, and only on the applied branches: the whole
 * point of applying to one slot is that the other is left exactly as finance set it,
 * and a client-side settle that copied both would draw a lie until the next refetch.
 */
export function applyBulkResult(
  rows: readonly AssignmentBranch[],
  result: BulkResult,
  slot: Slot,
  staffId: string,
): AssignmentBranch[] {
  const applied = new Set((result.appliedStoreCodes ?? []).map((code) => code.toUpperCase()))
  if (applied.size === 0) return [...rows]

  return rows.map((row) =>
    applied.has(row.storeCode.toUpperCase())
      ? {
          ...row,
          [slot]: staffId ?? '',
          updatedBy: result.updatedBy,
          updatedAt: result.updatedAt,
        }
      : row,
  )
}

/**
 * 🔑 **THE TOUCHED-ROW RULE AT SET SCALE** — ticket 1169's headline, extended here
 * because a bulk apply breaks it 300 times at once.
 *
 * Filter to *With a gap*, assign a collector to the whole city, and every row you
 * just filled stops matching the filter that selected it: the grid empties in one
 * frame, and the only evidence the work happened is a number in a toast. Rows
 * changed by a bulk apply therefore **stay visible** until the user moves on.
 *
 * ⚠️ It is a DIFFERENT set from `edits`, and deliberately so. 1169's touched set
 * means *unsaved* — a row is dropped from it on success, which is how a filled row
 * finally leaves *With a gap* and the screen reports progress. These rows ARE saved;
 * they are pinned so that a set-sized change is legible, and the pin is cleared by
 * the next gesture rather than by the server.
 */
export function bulkPins(result: BulkResult): Set<string> {
  return new Set(result.appliedStoreCodes ?? [])
}

/** Every store code that must stay on screen whatever the filter says — the unsaved
 *  edits and the bulk pins together, since `visibleBranches` takes one set. */
export function keepVisible(...sets: readonly Iterable<string>[]): Set<string> {
  const all = new Set<string>()
  for (const set of sets) for (const code of set) all.add(code)
  return all
}
