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
  /**
   * The landing scope (BackOffice 1165) — a person's **own** branches *plus* their
   * one-level reports', on both sides of the pairing.
   *
   * ⚠️ **Not `SUPERVISOR`.** That Kind deliberately excludes self ("whose team is
   * this" is a different question from "whose branches are these"), so landing a
   * supervisor who also serves branches on it would silently drop their own.
   *
   * 🚩 It takes an id like every other Kind. Whose "mine" is being asked about is
   * the user's choice, not the cookie's — which is exactly what keeps the landing
   * scope a **default** rather than a boundary.
   */
  mine: 'MINE',
} as const

export type ServedByKind = (typeof SERVED_BY_KINDS)[keyof typeof SERVED_BY_KINDS]

/**
 * What a person does **for branches**, as `PosCollectionStaff.Role` spells it.
 *
 * ⚠️ **A Role is not a Kind**, even where the two strings coincide: a Kind is a
 * question the caller asks, a Role is a fact about a person. The server keeps them
 * as separate constants for exactly this reason (`CollectionRoles` beside
 * `ServedByKinds`), and comparing a Role against a Kind constant here would read as
 * though they were interchangeable — which they are not.
 *
 * 🚩 **Blank is a legitimate Role** — the *pure supervisor*, who supervises people
 * and serves no branch at all. There is deliberately no `SUPERVISOR` value: you are
 * a supervisor iff somebody names you in `SupervisorId` (spec D2), not by holding a
 * role that says so.
 */
export const COLLECTION_ROLES = {
  accountant: 'ACCOUNTANT',
  collector: 'COLLECTOR',
} as const

/** A pickable person, as `CollectionWeb/AssignmentOptions` returns them. */
export interface AssignmentPerson {
  staffId: string
  displayName: string
}

/**
 * The caller's own landing scope, as the endpoint resolves it from the finance
 * roster — or `null` for the ~7,600 users with no roster row, who open on the
 * estate exactly as they do today.
 *
 * 🚩 **It is a default SELECTION, not a filter the server applied.** The screen
 * lands the control on it and then sends the ordinary `ServedByKind`/`ServedById`
 * pair like any other pick, so the toolbar always shows the scope the query
 * actually carries — and widening away from it is one click the server never
 * refuses. It is emphatically **not** an authorization boundary (spec D9).
 */
export interface ServedByDefaultScope {
  kind: ServedByKind
  staffId: string
  /**
   * The caller's own Role on the finance roster — `'ACCOUNTANT'`, `'COLLECTOR'`,
   * or **blank** for the pure supervisor (and for somebody who is only *named* as
   * a supervisor, with no roster row of their own).
   *
   * 🔑 **It is what decides whether a collected-by screen lands scoped at all**
   * (BackOffice 1167). ACRs and Deposits record who *collected*, and an accountant
   * never collects — landing them on their own scope there would open an EMPTY
   * grid under a control claiming to show their work. They open on the estate
   * instead, which is spec D9's "no referent ⇒ unfiltered".
   *
   * Optional so an older payload (or a fixture written before 1167) simply lands
   * everybody, which is the behaviour those screens had.
   */
  role?: string
  /** The roster's own `DisplayName` — the only place these people's names live. */
  displayName: string
}

/** The endpoint's whole payload: three groups, always all three, plus the caller's
 *  own landing scope (`null` when they are on no roster row). */
export interface AssignmentOptions {
  accountants: AssignmentPerson[]
  collectors: AssignmentPerson[]
  supervisors: AssignmentPerson[]
  defaultScope?: ServedByDefaultScope | null
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
 * The Kinds the **server can resolve today**, on the `assignment` reading.
 *
 * ⚠️ **All four, since BackOffice 1164.** The tracer (1163) shipped `ACCOUNTANT`
 * alone and this list existed so that turning the rest on would be editing ONE array
 * rather than hunting through a control four screens bind to — which is exactly what
 * 1164 did. The invariant it protects is unchanged and still load-bearing: the picker
 * must never offer a Kind whose pick the resolver refuses, which would be a filter
 * that errors when used.
 *
 * 🚩 **It is keyed by READING, not global**, because the two readings are built on
 * different tickets: the collected-by arms (`COLLECTOR`, `SUPERVISOR`, `UNASSIGNED`
 * against the document's own column) are 1167's and 1168's, and the server answers
 * them with a 500 until then. A single flat array would let mounting this picker on
 * the ACRs toolbar silently offer three picks that error — the exact failure the list
 * exists to prevent, arriving by a route the tracer could not see.
 */
export const RESOLVED_KINDS_BY_READING: Record<ServedByReading, ServedByKind[]> = {
  assignment: [
    SERVED_BY_KINDS.accountant,
    SERVED_BY_KINDS.collector,
    SERVED_BY_KINDS.supervisor,
    SERVED_BY_KINDS.unassigned,
    // 1165's landing scope. It is in this list for the same reason as the rest — a
    // screen may only offer, or LAND ON, a Kind its reading can answer — which is
    // what makes `defaultSelection` fall back to the estate on the two collected-by
    // screens rather than landing them on a pick the server still 500s.
    SERVED_BY_KINDS.mine,
  ],
  // ⚠️ ACCOUNTANT is absent here permanently, not pending: a document records who
  // COLLECTED and an accountant never collects, so the server refuses it by design
  // (spec D10) — offering it would be offering a filter that errors when used.
  //
  // The other four arrived with BackOffice 1167, which built them against the ACR's
  // own `CollectorOperatorId` and joined nothing at all. 1168 mounts the very same
  // list on Deposits, which is why this is data and not a branch.
  collector: [
    SERVED_BY_KINDS.collector,
    SERVED_BY_KINDS.supervisor,
    SERVED_BY_KINDS.unassigned,
    SERVED_BY_KINDS.mine,
  ],
}

/** The Kinds a given screen may offer — its reading's list, spelled once. */
export function resolvedKinds(screen: ServedByScreen): ServedByKind[] {
  return RESOLVED_KINDS_BY_READING[SERVED_BY_SCREENS[screen].reading]
}

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
 * **Default-to-mine** (BackOffice 1165): the selection a screen should OPEN on.
 *
 * A finance user opens Cash Collections and the grid is already scoped to them,
 * with the control showing why and one click away from widening. The scope itself
 * is the server's union — the caller's own branches plus their one-level reports'
 * — which is the only reading where a **pure supervisor** (serving nothing,
 * supervising three) does not open an unfiltered 1394-row screen.
 *
 * Three ways it comes back as "nothing picked", all of them the estate and none of
 * them an error:
 *
 * - the caller is on **no roster row** (the ~7,600 case — the roster covers 16
 *   people out of finance, and everyone else must see the estate exactly as they
 *   do today);
 * - the payload has not arrived yet, or the sink was unreachable — an unscoped
 *   landing is the safe failure here, because a scope the user cannot see is worse
 *   than none;
 * - the screen's **reading cannot answer the Kind** — a pick the server refuses
 *   would break the screen on mount;
 * - 🚩 the caller's **role has no referent on this screen's reading** — an
 *   accountant on ACRs or Deposits (BackOffice 1167). They never collect, so their
 *   own scope over a collected-by document is provably empty, and an empty grid
 *   under a control claiming their work is worse than the estate under a control
 *   claiming nothing.
 */
export function defaultSelection(
  screen: ServedByScreen,
  options: Partial<AssignmentOptions> | undefined,
): ServedBySelection {
  const scope = options?.defaultScope
  if (!scope) return NO_SERVED_BY

  const kind = (scope.kind ?? '') as ServedByKind
  const id = (scope.staffId ?? '').trim()
  if (id === '' || !resolvedKinds(screen).includes(kind)) return NO_SERVED_BY
  if (!hasReferent(scope.role, SERVED_BY_SCREENS[screen].reading)) return NO_SERVED_BY

  return { kind, id }
}

/**
 * Does a caller with this roster Role have anything to land on, on this reading?
 *
 * Spec D8 gives the two collected-by screens default-to-mine "only for
 * collector/supervisor callers", and this is that sentence. A **blank** role
 * passes — that is the pure supervisor, and the person merely named as somebody's
 * supervisor, both of whom have reports whose collections are real rows.
 *
 * ⚠️ Read as *"is not an accountant"* rather than as *"is a collector"*, so a role
 * this client has never heard of lands rather than silently opening on the estate.
 * The only role with a provably empty answer here is the one the server also
 * refuses outright.
 *
 * ⚠️ It compares against `COLLECTION_ROLES`, never `SERVED_BY_KINDS`: the two
 * strings coincide today, but a Role and a Kind are different things and the server
 * keeps them as separate constants too.
 */
export function hasReferent(role: string | undefined, reading: ServedByReading): boolean {
  if (reading === 'assignment') return true
  return (role ?? '').trim().toUpperCase() !== COLLECTION_ROLES.accountant
}

/**
 * One line of the **combobox** the two collected-by screens carry (BackOffice
 * 1167) — a pickable thing with the exact pair it stands for.
 *
 * The assignment screens use a strict `<select>` whose option values already carry
 * the pair. A combobox cannot: its control is a text box, so the only thing that
 * comes back out of it is a *string*. These entries are what that string is matched
 * against, and `label` is therefore the datalist's own value rather than a caption
 * beside it.
 *
 * `name` is the raw `displayName`, kept separate so the component can compose the
 * label (and translate the two group suffixes) without this module importing i18n.
 */
export interface ServedByEntry {
  kind: ServedByKind
  id: string
  name: string
  label: string
}

/**
 * The pickable entries for a screen, in the order they should be offered: the
 * caller's own scope first, then collectors, then supervisors, then *Unassigned*.
 *
 * `labelFor` composes the visible text — the component passes a translator in, so
 * this stays the pure module `acr-criteria.test.ts`'s seam expects.
 *
 * ⚠️ A person who both collects and supervises appears **twice**, exactly as in the
 * strict picker: two Kinds are two different questions, and only the entry the user
 * actually clicked says which one they asked.
 */
export function servedByEntries(
  screen: ServedByScreen,
  options: Partial<AssignmentOptions> | undefined,
  labelFor: (entry: Omit<ServedByEntry, 'label'>) => string,
): ServedByEntry[] {
  const resolved = resolvedKinds(screen)
  const entries: Array<Omit<ServedByEntry, 'label'>> = []

  const mine = defaultSelection(screen, options)
  if (mine.kind !== '') {
    entries.push({
      kind: mine.kind,
      id: mine.id,
      name: (options?.defaultScope?.displayName ?? '').trim(),
    })
  }

  for (const group of servedByGroups(screen, options)) {
    if (!resolved.includes(group.kind)) continue
    for (const person of group.people) {
      entries.push({ kind: group.kind, id: person.staffId, name: person.displayName })
    }
  }

  // Names nobody, so it carries no id — and it sits last, because it is a question
  // about the documents rather than a person to pick.
  if (resolved.includes(SERVED_BY_KINDS.unassigned)) {
    entries.push({ kind: SERVED_BY_KINDS.unassigned, id: '', name: '' })
  }

  return entries.map((entry) => ({ ...entry, label: labelFor(entry) }))
}

/**
 * Turn what the user actually typed (or clicked) into a selection.
 *
 * 🔑 **A typed id that matches NOTHING still works, and travels as `COLLECTOR`.**
 * This is the reason the control on these two screens is a combobox rather than the
 * strict picker its siblings use: the roster holds 8 collectors while a shipped ACR
 * carries *whoever collected*, so a strict picker would make an id plainly visible
 * in the grid **un-typeable in the filter**. The predicate `COLLECTOR` builds is
 * byte-identical to the equality the free-text box has always sent, so nothing about
 * the answer changes — only where the user types it.
 *
 * ⚠️ On a screen whose contract says `freeText: false`, unmatched text is **dropped**
 * rather than guessed at: those screens read *assigned to*, where an id off the
 * roster is by definition assigned to nobody and would return a confidently empty
 * grid.
 *
 * Empty text is "nothing picked" — the estate.
 */
export function parseServedByText(
  screen: ServedByScreen,
  text: string,
  entries: ServedByEntry[],
): ServedBySelection {
  const raw = (text ?? '').trim()
  if (raw === '') return NO_SERVED_BY

  // A label first — that is what clicking a datalist suggestion puts in the box, and
  // the label is the only thing that says WHICH question was asked of a person who
  // appears twice.
  const clicked = entries.find((entry) => entry.label === raw)
  if (clicked) return { kind: clicked.kind, id: clicked.id }

  // 🚩 **A BARE ID IS ALWAYS `COLLECTOR` HERE — even a roster member's, even the
  // caller's own.** The ticket's promise is that a typed id is *byte-identical to
  // today's predicate*, and today's free-text box only ever asked
  // `CollectorOperatorId = <what you typed>`. Resolving a typed id against the entry
  // list instead would silently answer a DIFFERENT question for two people: the
  // caller's own id would match the `MINE` entry at the head of the list and return
  // their rounds *plus every report's*, and a pure supervisor's id would match the
  // supervisor entry, whose predicate **excludes that very person** — so an id
  // plainly visible in the grid would come back with its own rows missing.
  if (SERVED_BY_SCREENS[screen].freeText) return { kind: SERVED_BY_KINDS.collector, id: raw }

  // The strict screens never reach this function from their `<select>`; if text does
  // arrive, only a known person is honoured, because an id off the roster is by
  // definition assigned to nobody and guessing would return a confidently empty grid.
  const known = entries.find((entry) => entry.id !== '' && entry.id === raw)
  return known ? { kind: known.kind, id: known.id } : NO_SERVED_BY
}

/**
 * The text the box should show for a selection — the inverse of the parse, so the
 * control redisplays what the user chose rather than a second rendering of it.
 *
 * An off-roster typed id has no entry and shows as itself, which is exactly what
 * was typed.
 */
export function servedByText(selection: ServedBySelection, entries: ServedByEntry[]): string {
  if (selection.kind === '') return ''
  const matched = entries.find(
    (entry) => entry.kind === selection.kind && entry.id === selection.id,
  )
  return matched ? matched.label : selection.id
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
