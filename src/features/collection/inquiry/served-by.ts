/**
 * The shared **Served by** control's pure half (BackOffice spec 1162, tracer 1163).
 *
 * One control lands on four screens — Cash Collections, ACRs, Deposits and the
 * settlement account's worklist — and they read it two different ways. This module
 * owns *which groups a screen offers* and *what a selection puts on the wire*; the
 * combobox itself is untested render glue over it.
 *
 * 🔑 **Why the ruling lives here and not on the server.** The endpoint returns all
 * three groups once, with no `?screen=` hint, so ONE response is cacheable across
 * all four screens — and the whole per-screen contract stays readable as one table
 * in one file instead of four server branches nobody reads together. A shared
 * component binding differently per screen **is** the drift this design exists to
 * stop.
 *
 * Pure — no React, no i18n, no network, no `new Date()` — the seam
 * `acr-criteria.test.ts` already uses.
 *
 * ⚠️ **Copied conventions, not imported ones.** PascalCase keys because the C#
 * options bind via `[AsParameters]`; an empty selection is **dropped**, never sent
 * as `''`. Both match `collections-criteria.ts` beside it.
 */

/**
 * The wire vocabulary, spelled once. It is a **pair** — a Kind and an id — rather
 * than one overloaded scalar, because the same staff id can be asked about two
 * different ways: a person who serves branches *and* supervises appears in the
 * picker twice, and only the Kind tells those two picks apart.
 */
export const SERVED_BY_KINDS = {
  accountant: 'ACCOUNTANT',
  collector: 'COLLECTOR',
  supervisor: 'SUPERVISOR',
  unassigned: 'UNASSIGNED',
} as const

export type ServedByKind = (typeof SERVED_BY_KINDS)[keyof typeof SERVED_BY_KINDS]

/** A pickable person, as `CollectionWeb/AssignmentOptions` returns them. */
export interface AssignmentPerson {
  staffId: string
  displayName: string
}

/** The endpoint's whole payload: three groups, always all three. */
export interface AssignmentOptions {
  accountants: AssignmentPerson[]
  collectors: AssignmentPerson[]
  supervisors: AssignmentPerson[]
}

/**
 * A selection. `kind: ''` is "nothing picked" — the estate.
 *
 * `id` is blank for `UNASSIGNED`, which is the one Kind that names nobody.
 */
export interface ServedBySelection {
  kind: ServedByKind | ''
  id: string
}

/** Nothing picked. The state every screen opens on in this slice. */
export const NO_SERVED_BY: ServedBySelection = { kind: '', id: '' }

/**
 * Which screens read the control which way.
 *
 * - `assignment` — *who is ASSIGNED to this branch*, answered against the pairing
 *   table by the row's store.
 * - `collector` — *who ACTUALLY COLLECTED this document*, answered against the
 *   document's own collector column.
 *
 * The two are genuinely different questions and a stand-in covering somebody's
 * route is exactly when they diverge.
 */
export type ServedByReading = 'assignment' | 'collector'

export type ServedByScreen = 'collections' | 'acrs' | 'deposits' | 'settlement'

/**
 * The per-screen contract — spec 1162 D8, as one readable table.
 *
 * ⚠️ **`accountants` is FALSE on the two collected-by screens, and that is not
 * tidiness.** Those screens read the document's own collector column, and an
 * accountant never collects — there is no column to compare, so the server refuses
 * the combination outright. Offering the group would be offering a filter the
 * document cannot answer.
 *
 * ⚠️ **`freeText` is TRUE on exactly those two screens**, for the mirror-image
 * reason: the roster holds 8 collectors while a document carries *whoever
 * collected*, so a strict picker would make an id visible in the grid un-typeable
 * in the filter. A typed id travels as `COLLECTOR` and the predicate is identical
 * to the equality those screens have always used.
 */
export interface ServedByScreenContract {
  reading: ServedByReading
  /** Is the Accountants group offered here? */
  accountants: boolean
  /** May the user type an id that is on no roster row? */
  freeText: boolean
}

export const SERVED_BY_SCREENS: Record<ServedByScreen, ServedByScreenContract> = {
  collections: { reading: 'assignment', accountants: true, freeText: false },
  acrs: { reading: 'collector', accountants: false, freeText: true },
  deposits: { reading: 'collector', accountants: false, freeText: true },
  settlement: { reading: 'assignment', accountants: true, freeText: false },
}

/**
 * The groups a given screen renders, in order, from one payload.
 *
 * 🚩 **A group with no members is omitted, not rendered empty.** Supervisors is
 * empty for everybody on day one — the finance extract's supervisor columns are
 * entirely blank — and an empty heading in a picker reads as a broken screen. It
 * appears by itself the moment somebody is named a supervisor; no deploy is
 * involved.
 */
export interface ServedByGroup {
  kind: ServedByKind
  people: AssignmentPerson[]
}

/**
 * The Kinds the **server can resolve today**.
 *
 * ⚠️ The tracer (BackOffice 1163) ships the `ACCOUNTANT` arm only; 1164 fills the
 * other three in and this list becomes all four. It exists so that flipping them on
 * is editing ONE array rather than hunting through a control four screens bind to —
 * and so that until then the picker cannot offer a Kind whose pick the resolver
 * refuses, which would be a filter that errors when used.
 */
export const RESOLVED_KINDS: ServedByKind[] = [SERVED_BY_KINDS.accountant]

export function servedByGroups(
  screen: ServedByScreen,
  options: Partial<AssignmentOptions> | undefined,
): ServedByGroup[] {
  const contract = SERVED_BY_SCREENS[screen]
  const groups: ServedByGroup[] = []

  if (contract.accountants) {
    groups.push({ kind: SERVED_BY_KINDS.accountant, people: options?.accountants ?? [] })
  }
  groups.push({ kind: SERVED_BY_KINDS.collector, people: options?.collectors ?? [] })
  groups.push({ kind: SERVED_BY_KINDS.supervisor, people: options?.supervisors ?? [] })

  return groups.filter((group) => group.people.length > 0)
}

/**
 * The selection a screen puts on the wire.
 *
 * 🚩 **An empty selection sends NEITHER key, rather than sending them blank.** That
 * is the whole reason a screen can adopt this control with no feature flag: with
 * nothing picked the query is byte-for-byte the one the screen sent before the
 * control existed. `ServedByKind=` on the wire would read to anyone debugging the
 * door as "the Kind whose name is the empty string".
 *
 * 🚩 **`UNASSIGNED` sends the Kind and no id.** It names nobody by design — on this
 * screen it means a branch with an empty slot, on the two collected-by screens it
 * means collected by somebody finance never enrolled. Sending a blank id alongside
 * it would be the one case the server has to refuse.
 *
 * A Kind with a blank id in any other case sends **nothing**: the server answers
 * that combination with a 400, and a toolbar should not construct a request it
 * knows will be refused.
 */
export function buildServedByParams(
  selection: ServedBySelection | undefined,
): Record<string, unknown> {
  const kind = (selection?.kind ?? '').trim()
  const id = (selection?.id ?? '').trim()

  if (kind === '') return {}
  if (kind === SERVED_BY_KINDS.unassigned) return { ServedByKind: kind }
  if (id === '') return {}

  return { ServedByKind: kind, ServedById: id }
}

/**
 * Parse the pair back out of an applied query — so the chip that says the grid is
 * filtered, and the control's own displayed value, read from the same place the
 * request did rather than from a second copy that can drift.
 */
export function readServedBySelection(
  params: Record<string, unknown> | undefined,
): ServedBySelection {
  const kind = typeof params?.ServedByKind === 'string' ? params.ServedByKind : ''
  const id = typeof params?.ServedById === 'string' ? params.ServedById : ''
  return kind === '' ? NO_SERVED_BY : { kind: kind as ServedByKind, id }
}
