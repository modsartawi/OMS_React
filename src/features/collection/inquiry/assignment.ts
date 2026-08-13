/**
 * The **Collection Assignment** screen's pure half — BackOffice spec 1162 D11,
 * ticket [1169](C:\Work\DMSCO\BackOffice\.issues\1169-fill-a-branch-gap-and-it-survives-the-filter.md).
 *
 * The screen maintains *who serves this branch*: an accountant who handles its
 * money at HQ and a collector who visits it to take the cash. It lists **all 1394
 * open branches**, not the 139 finance's spreadsheet covers, because the gap IS
 * the work — ~1255 branches have nobody, and a screen listing the assignment table
 * could not reach the majority of its own subject.
 *
 * 🔑 **The rule this module exists for: the filter that makes the screen usable is
 * the one that loses work.** Filter to *With a gap*, fill a row in, and the row
 * stops matching — it vanishes mid-edit, taking the unsaved edit with it. So a
 * **touched row stays visible until it is saved**, whatever the filter says. That
 * was found by building the prototype at the real scale, and it is the single most
 * important behaviour on this screen.
 *
 * Pure — no React, no i18n, no network, no `new Date()` — the seam
 * `acr-criteria.test.ts` and `served-by.ts` already use. The grid and its two
 * dropdowns are untested render glue over this.
 */

/**
 * One row of the Branches tab, as `GET CollectionWeb/Assignment/Branches` returns
 * it (`AssignmentBranchModel`, camel-cased by the serializer).
 *
 * ⚠️ **The two people are ids and there are no name columns.** The names come from
 * the dropdowns themselves — the client already holds the whole roster from
 * `CollectionWeb/AssignmentOptions` — so the screen has ONE name source rather than
 * two that can disagree. That is why every function here that needs a name takes a
 * `nameOf` resolver instead of reading a field.
 *
 * `''` means *nobody*, never `null`: blank is how this whole family spells an empty
 * slot, all the way down to the `NOT NULL DEFAULT ''` column.
 */
export interface AssignmentBranch {
  storeCode: string
  storeName: string
  city: string
  area: string
  accountantId: string
  collectorId: string
  updatedBy: string
  updatedAt: string
}

/**
 * What a branch's pairing is missing, as the status column says it.
 *
 * 🚩 **`noAccountant` and `noCollector` are named SEPARATELY, from day one.**
 * *Half assigned* is 0 today only because the seed fills both slots together — but
 * this screen writes each slot on its own, so the state is reachable the first
 * afternoon somebody uses it. Retrofitting the distinction later would mean the
 * first half-filled branch reading as fully assigned until somebody noticed.
 */
export type AssignmentStatus = 'assigned' | 'noAccountant' | 'noCollector' | 'nobody'

export function branchStatus(branch: AssignmentBranch): AssignmentStatus {
  const hasAccountant = (branch.accountantId ?? '').trim() !== ''
  const hasCollector = (branch.collectorId ?? '').trim() !== ''

  if (hasAccountant && hasCollector) return 'assigned'
  if (hasAccountant) return 'noCollector'
  if (hasCollector) return 'noAccountant'
  return 'nobody'
}

/** Is this branch missing somebody — either slot, not both? The *With a gap*
 *  filter, and the same reading the inquiry screens' *Unassigned* pick uses. */
export function hasGap(branch: AssignmentBranch): boolean {
  return branchStatus(branch) !== 'assigned'
}

/**
 * The status filter's choices. `gap` is the one finance actually works from — it
 * is how the 1255 get closed — and therefore the one the headline rule below is
 * about.
 */
export type AssignmentStatusFilter = AssignmentStatus | 'all' | 'gap'

export interface AssignmentFilter {
  status: AssignmentStatusFilter
  /** One free-text box over five things — see `matchesSearch`. */
  search: string
}

export const NO_ASSIGNMENT_FILTER: AssignmentFilter = { status: 'all', search: '' }

/**
 * ⚠️ The screen opens on **everything, unfiltered** — deliberately NOT
 * default-to-mine like the four inquiry screens beside it. This is the one screen
 * in the family whose user maintains the estate rather than finding their own
 * work, so scoping it to their own branches would hide exactly the rows they came
 * to fill in.
 */
export const ASSIGNMENT_LANDING: AssignmentFilter = NO_ASSIGNMENT_FILTER

export function matchesStatus(branch: AssignmentBranch, status: AssignmentStatusFilter): boolean {
  if (status === 'all') return true
  if (status === 'gap') return hasGap(branch)
  return branchStatus(branch) === status
}

/** Resolves a staff id to the roster's `displayName`. The screen passes the same
 *  lookup its two dropdowns are built from; an unknown id resolves to itself. */
export type NameOf = (staffId: string) => string

/**
 * 🚩 **Store search spans code, Arabic name, city, area AND the two assigned
 * people's names.** At 1394 branches a code-only box is not enough: finance says
 * "الخبر" (74 branches) or a street far more often than "P075", and *"what is فهد
 * carrying?"* is a question this screen has to answer without a second view.
 *
 * The people are matched by NAME, through the same resolver the dropdowns use —
 * an id typed into the box matches too, since a row's raw ids are searched as
 * well.
 *
 * Case-insensitive substring, and nothing cleverer: `toLowerCase` is a no-op for
 * Arabic and does the right thing for the Latin store codes.
 */
export function matchesSearch(branch: AssignmentBranch, search: string, nameOf: NameOf): boolean {
  const needle = (search ?? '').trim().toLowerCase()
  if (needle === '') return true

  const haystack = [
    branch.storeCode,
    branch.storeName,
    branch.city,
    branch.area,
    branch.accountantId,
    branch.collectorId,
    nameOf(branch.accountantId ?? ''),
    nameOf(branch.collectorId ?? ''),
  ]

  return haystack.some((value) => (value ?? '').toLowerCase().includes(needle))
}

export function matchesFilter(
  branch: AssignmentBranch,
  filter: AssignmentFilter,
  nameOf: NameOf,
): boolean {
  return matchesStatus(branch, filter.status) && matchesSearch(branch, filter.search, nameOf)
}

/**
 * The rows the grid shows: everything matching the filter, **plus every touched
 * row**, in the list's own order.
 *
 * 🔑 **THE HEADLINE.** `touched` is the set of store codes the user has edited and
 * not yet saved. Under *With a gap* — the filter finance actually works from —
 * filling a branch's missing collector makes it stop matching the moment the
 * dropdown closes: the row would vanish out from under the cursor with the edit
 * still unsaved, and the work would be silently lost. Keeping it means a row
 * leaves the filter only once the server has it.
 *
 * ⚠️ It is deliberately about a row being **unsaved**, not about it having been
 * looked at. A saved row DOES leave a filter it no longer matches — that is the
 * screen reporting progress on the gap, and the edit is safe by then.
 *
 * The touched rows are not hoisted to the top: a row jumping position while being
 * edited is the same disorientation in a smaller dose. It stays where it is.
 */
export function visibleBranches(
  branches: readonly AssignmentBranch[],
  filter: AssignmentFilter,
  nameOf: NameOf,
  touched: ReadonlySet<string> = new Set(),
): AssignmentBranch[] {
  return branches.filter(
    (branch) => touched.has(branch.storeCode) || matchesFilter(branch, filter, nameOf),
  )
}

/** How many branches are in each state — the counts the screen's header states,
 *  so the size of the gap is visible before anything is filtered. */
export interface AssignmentCounts {
  total: number
  assigned: number
  /** Half assigned: one slot filled, one empty — either way round. */
  half: number
  nobody: number
}

export function assignmentCounts(branches: readonly AssignmentBranch[]): AssignmentCounts {
  let assigned = 0
  let half = 0
  let nobody = 0

  for (const branch of branches) {
    const status = branchStatus(branch)
    if (status === 'assigned') assigned += 1
    else if (status === 'nobody') nobody += 1
    else half += 1
  }

  return { total: branches.length, assigned, half, nobody }
}

/**
 * What one save settled, as `POST CollectionWeb/Assignment/SetStore` answers it.
 *
 * ⚠️ **The pairing, not a branches-list row.** A save moves the two slots and the
 * stamp; the branch's name, city and area are the `Store` master's and cannot change
 * here, so the server does not restate them with nothing in them and the screen keeps
 * them from the row it already has.
 */
export interface AssignmentPairing {
  storeCode: string
  accountantId: string
  collectorId: string
  updatedBy: string
  updatedAt: string
}

/**
 * The body of one per-row save — `POST CollectionWeb/Assignment/SetStore`.
 *
 * 🔑 **It carries no actor.** Attribution is stamped server-side from the cookie
 * session, so the browser cannot say who made a change to master data.
 *
 * ⚠️ **A slot is sent only when it differs from what the SERVER holds.** An absent
 * slot means "leave it alone" and a blank one means "clear it" (the dropdown's
 * *nobody*, which has to stay sayable) — so sending both every time would let
 * filling a missing collector silently re-write an accountant somebody else set
 * between the page load and the save.
 *
 * 🚩 The baseline is the **server's** row rather than the last thing the user
 * touched, and that is the right one after a REFUSED save: the rejected slot is
 * still an unsaved intent of theirs, so the next save carries it again instead of
 * stranding it on screen forever. Nothing is ever re-sent that the server already
 * agrees with.
 */
export interface SaveAssignmentBody {
  storeCode: string
  accountantId?: string
  collectorId?: string
}

export function buildSaveBody(
  original: AssignmentBranch,
  edited: AssignmentBranch,
): SaveAssignmentBody {
  const body: SaveAssignmentBody = { storeCode: edited.storeCode }

  if ((edited.accountantId ?? '') !== (original.accountantId ?? '')) {
    body.accountantId = edited.accountantId ?? ''
  }
  if ((edited.collectorId ?? '') !== (original.collectorId ?? '')) {
    body.collectorId = edited.collectorId ?? ''
  }

  return body
}

/** Has this row actually changed? A save with neither slot changed is refused by
 *  the server (it would only re-stamp who touched the branch last), so the screen
 *  does not send one. */
export function isDirty(original: AssignmentBranch, edited: AssignmentBranch): boolean {
  const body = buildSaveBody(original, edited)
  return body.accountantId !== undefined || body.collectorId !== undefined
}
