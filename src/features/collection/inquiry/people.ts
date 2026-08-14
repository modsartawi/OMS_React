/**
 * The Collection Assignment screen's **roster** — the People tab's pure half, and
 * the home of the Role rules BOTH tabs read. BackOffice
 * spec 1162 D2/D11, ticket
 * [1170](C:\Work\DMSCO\BackOffice\.issues\1170-a-new-person-is-assignable-the-same-afternoon.md).
 *
 * 🔑 **The roster is a full roster, and it is add-person-first.** It is not a
 * by-product of who happens to appear on an assignment row: measured in BackOffice
 * issue 1157, NONE of the 8 accountants exists in `Staff`, `UaEmployee` or `UaUser`
 * — they are `Customer` rows with no `Staff` row, and the Ua seed is
 * `Customer INNER JOIN Staff` — so `PosCollectionStaff` is **the only place a
 * person's name lives**. A new hire must be creatable here before they can be
 * assigned anywhere, which is the whole reason People is a tab rather than a pane.
 *
 * Two rules sit side by side in this file, deliberately, because the easiest way
 * to break either is to "tidy" them into one:
 *
 * - 🚩 **The supervisor field filters by NOTHING** (`supervisorOptions`). Anyone on
 *   the roster may supervise anyone, because supervising is not a role.
 * - 🚩 **The two assignment slots DO filter by `Role`** (`slotPeople`). That is
 *   ticket 1169's rule and this ticket does not loosen it: a collector filed as an
 *   accountant is a branch whose "accountant" sees it on no screen.
 *
 * Pure — no React, no i18n, no network, no `new Date()` — the seam
 * `assignment.ts` and `served-by.ts` beside it already use.
 */
import { COLLECTION_ROLES, type AssignmentPerson } from './served-by'

/**
 * One row of the People tab, as `GET CollectionWeb/Assignment/People` returns it
 * (`AssignmentRosterPersonModel`, camel-cased by the serializer).
 *
 * ⚠️ **Richer than `AssignmentPerson`, and deliberately a different type.** That one
 * is the *picker's* shape — `{ staffId, displayName }` and nothing else — cached
 * across four inquiry screens that need nothing else. This is the maintenance
 * shape, behind the maintenance grant.
 */
export interface RosterPerson {
  /** IS the `UaUser.UserId` by estate convention — the bridge *show me my branches*
   *  crosses. Typed by the administrator, never generated. */
  staffId: string
  /** Arabic, and the only statement of this person's name anywhere in the estate. */
  displayName: string
  /**
   * What the person does **for branches**: `'ACCOUNTANT' | 'COLLECTOR' | ''`.
   *
   * 🔑 **Blank is legitimate** — the *pure manager*, recorded so that "ضحى's
   * supervisor is Mr X" can be stated when Mr X serves no branches at all. There is
   * no `SUPERVISOR` value, because a supervisor is not a role.
   */
  role: string
  /** Who supervises them — `''` for nobody. One level, direct reports only. */
  supervisorId: string
  /** ⚠️ Written and displayed but **inert**: nothing filters on it, by ruling. */
  isActive: boolean
  updatedBy: string
  updatedAt: string
}

/** The body of one person save — `POST CollectionWeb/Assignment/SetPerson`.
 *
 *  🔑 **It carries no actor.** Attribution is stamped server-side from the cookie
 *  session, exactly as on the pairing save, so the browser cannot say who created
 *  or renamed a person.
 *
 *  ⚠️ **Every field is sent every time.** Unlike the pairing's two slots — where an
 *  absent field means "leave it alone", because two administrators may be filling
 *  opposite slots of one branch — a person is edited as one form by one person, and
 *  a per-field omission there would make *clear this person's supervisor*
 *  indistinguishable from *I did not touch that field*. */
export interface SavePersonBody {
  staffId: string
  displayName: string
  role: string
  supervisorId: string
  isActive: boolean
}

/** A blank new-person form. `isActive` starts true: a person is added to be used. */
export function blankPerson(): SavePersonBody {
  return { staffId: '', displayName: '', role: '', supervisorId: '', isActive: true }
}

export function personToBody(person: RosterPerson): SavePersonBody {
  return {
    staffId: person.staffId,
    displayName: person.displayName,
    role: person.role ?? '',
    supervisorId: person.supervisorId ?? '',
    isActive: person.isActive,
  }
}

/** The two assignment slots, spelled as the branch row spells them. */
export type Slot = 'accountantId' | 'collectorId'

/** The `Role` a slot demands. Written once so the two dropdowns cannot drift apart
 *  from each other or from the server, which refuses a mismatch outright
 *  (`AssignmentPersonWrongRole`). */
export const SLOT_ROLE: Record<Slot, string> = {
  accountantId: COLLECTION_ROLES.accountant,
  collectorId: COLLECTION_ROLES.collector,
}

/**
 * 🚩 **The Branches tab's rule, and 1170 does not loosen it.** Each assignment slot
 * offers only people filed under **its own** `Role` — so a collector cannot be
 * filed as an accountant, and the *pure manager* (blank `Role`) is offered for
 * neither slot, because somebody who does nothing for branches must not be
 * assignable to one.
 *
 * The server enforces the same thing independently rather than trusting these two
 * dropdowns: a typo'd staff id in master data is inert, invisible and permanent.
 */
export function slotPeople(people: readonly RosterPerson[], slot: Slot): AssignmentPerson[] {
  return people
    .filter((person) => (person.role ?? '').trim().toUpperCase() === SLOT_ROLE[slot])
    .map(toPickable)
}

/**
 * 🚩 **The supervisor field offers the WHOLE roster, unfiltered by `Role`.**
 *
 * Anyone may supervise anyone, because **supervising is not a role**: you are a
 * supervisor iff somebody names you in `supervisorId`, and `Role` says something
 * else entirely — what a person does *for branches*. A collector supervising an
 * accountant is legitimate, so is the reverse, and so is a *pure manager* (blank
 * `Role`) supervising both.
 *
 * ⚠️ Contrast `slotPeople` immediately above. The two rules look alike and are
 * opposite; filtering this field by `Role` would silently make half the roster
 * unnameable, with nothing failing to say so.
 *
 * **Self is the one exclusion**, and it is not a cycle check: A↔B is deliberately
 * harmless because scope is one level. Self is dropped because every reader
 * excludes self from a supervisor's reports, so the entry would be pickable on four
 * screens and resolve to nothing — the server refuses it too
 * (`PersonSupervisorIsSelf`).
 */
export function supervisorOptions(
  people: readonly RosterPerson[],
  forStaffId: string,
): AssignmentPerson[] {
  const self = (forStaffId ?? '').trim().toLowerCase()
  // A brand-new person has no id yet, so there is nothing to exclude.
  if (self === '') return people.map(toPickable)

  return people
    .filter((person) => (person.staffId ?? '').trim().toLowerCase() !== self)
    .map(toPickable)
}

/**
 * Who is a supervisor, as the *Served by* control's Supervisors group computes it:
 * **`DISTINCT supervisorId`**, never a `Role` filter.
 *
 * 🔑 **This is what makes the group appear.** Naming somebody here is the whole
 * mechanism — the group is hidden until it has a member (finance's extract has
 * blank supervisor columns, so it is empty on day one) and fills the moment one
 * person is named, on four screens, with no deploy. A person who both serves
 * branches and supervises appears in **two** groups, correctly: those are two
 * different questions.
 */
export function supervisorIds(people: readonly RosterPerson[]): Set<string> {
  const ids = new Set<string>()
  for (const person of people) {
    const id = (person.supervisorId ?? '').trim()
    if (id !== '') ids.add(id)
  }
  return ids
}

/** Resolves a staff id to the roster's name — the ONE name source on this screen,
 *  both tabs. An id with no row echoes itself rather than rendering blank. */
export function rosterNameOf(people: readonly RosterPerson[]): (staffId: string) => string {
  const names = new Map<string, string>()
  for (const person of people) names.set(person.staffId, person.displayName || person.staffId)
  return (staffId: string) => names.get(staffId) ?? staffId
}

/** Free-text over id, name and the supervisor's name — the same house style as the
 *  Branches tab's box beside it. */
export function matchesPersonSearch(
  person: RosterPerson,
  search: string,
  nameOf: (staffId: string) => string,
): boolean {
  const needle = (search ?? '').trim().toLowerCase()
  if (needle === '') return true

  const haystack = [
    person.staffId,
    person.displayName,
    person.supervisorId,
    person.supervisorId ? nameOf(person.supervisorId) : '',
  ]
  return haystack.some((value) => (value ?? '').toLowerCase().includes(needle))
}

/** Is this form good enough to send? The server refuses each of these too — this is
 *  only so the button is honest about it before the round trip. */
export function personFormError(body: SavePersonBody): 'staffId' | 'displayName' | null {
  if ((body.staffId ?? '').trim() === '') return 'staffId'
  // 🔑 A nameless person is refused, because this row is the only place the name
  // lives. Everywhere else in the family falls back to echoing the bare id, but
  // that fallback is for data that already exists, not a licence to mint more.
  if ((body.displayName ?? '').trim() === '') return 'displayName'
  return null
}

/**
 * The i18n key naming a `Role`, so the People tab's `<select>` and its table cell
 * spell the two codes ONCE between them.
 *
 * ⚠️ `''` is not a missing value here — it is the *pure manager*, and it gets a
 * caption of its own rather than an empty cell, because "supervises only" is a
 * statement about the person and a blank looks like an unfinished row.
 */
export function roleLabelKey(role: string): string {
  const normalized = (role ?? '').trim().toUpperCase()
  if (normalized === COLLECTION_ROLES.accountant) return 'assignment.columns.accountant'
  if (normalized === COLLECTION_ROLES.collector) return 'assignment.columns.collector'
  return 'assignment.people.roleNone'
}

/** The two Roles a person may be filed under, in the order the form offers them.
 *  Drawn from the same constants the slot filter uses, so a dropdown cannot offer
 *  a value the filter would then drop. */
export const PICKABLE_ROLES: string[] = [COLLECTION_ROLES.accountant, COLLECTION_ROLES.collector]

function toPickable(person: RosterPerson): AssignmentPerson {
  return { staffId: person.staffId, displayName: person.displayName || person.staffId }
}
