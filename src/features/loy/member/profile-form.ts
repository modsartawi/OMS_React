/**
 * The **profile form** module (ticket 304, spec 301) — the pure half of the
 * profile **member command**: which fields an analyst has actually changed,
 * whether the edits are writable, what the request body looks like, and whether
 * the form on screen has gone stale.
 *
 * Pure by construction: no React, no `t`, no network. It returns **keys**, never
 * sentences ([i18n-zero-literal](../../../../.claude/rules/i18n-zero-literal.md)).
 *
 * 🚩 **This module exists to hold ONE ruling: a blank stays blank.** The till's
 * existing profile validator makes gender and preferred language **mandatory**
 * (its e-commerce sibling explicitly permits blank; that one deliberately does
 * not) and constructs itself inside the handler, so it cannot be swapped from
 * outside — which is why spec 301 ruled a NEW admin-side handler rather than
 * delegation. Members are frequently sparse, and an analyst opening a member
 * with no recorded gender to fix a misspelt name must not be forced to invent a
 * fact about the customer. A regression to the mandatory rule is invisible in
 * the type system, invisible at build, and surfaces only as an analyst who
 * cannot fix a name — so it is pinned here, under vitest, rather than left in
 * JSX where nothing can reach it while React Testing Library is unbootstrapped.
 */
import { apiErrorCode } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'
import { isBlankDate, toIsoDate } from '@/core/util/date-format'

/**
 * The nine fields the profile command writes, as the controls carry them —
 * every one a plain string, blank meaning *not recorded*.
 *
 * 🚩 The mobile is **not** here. It is the programme's login credential and one
 * of only two ways a member can be found, so it changes through its own command
 * (305) and never as a side effect of fixing a name (spec 301).
 */
export interface ProfileDraft {
  fullName: string
  email: string
  birthDate: string
  gender: string
  nationality: string
  nationalId: string
  cityCode: string
  preferredLanguage: string
  insuranceCompany: string
}

export type ProfileField = keyof ProfileDraft

/**
 * The nine fields **as data**, in the order the form lays them out, each with
 * the i18n key its label reads from.
 *
 * 🚩 It is a list rather than a pair of JSX blocks because the Profile tab draws
 * the same nine fields twice — read-only for a *may look* session, as controls
 * for an editor — and a divergence is how a read-only view starts showing a
 * field the editable one dropped (spec 301). A field defined once, as data,
 * cannot drift; the two renderings both map this.
 *
 * `mono` marks a field whose value is a **code** with no lookup on this screen:
 * it is labelled as a code (229 clause 5) and set in the mono face, because a
 * label promising a name it does not have is the thing that turns `0021` into a
 * wrong city.
 */
export const PROFILE_FIELDS: ReadonlyArray<{
  key: ProfileField
  labelKey: string
  mono?: boolean
}> = [
  { key: 'fullName', labelKey: 'profile.field.fullName' },
  { key: 'email', labelKey: 'profile.field.email' },
  { key: 'birthDate', labelKey: 'profile.field.birthDate' },
  { key: 'gender', labelKey: 'profile.field.genderCode', mono: true },
  { key: 'nationality', labelKey: 'profile.field.nationalityCode', mono: true },
  { key: 'nationalId', labelKey: 'profile.field.nationalId' },
  { key: 'cityCode', labelKey: 'profile.field.cityCode', mono: true },
  { key: 'preferredLanguage', labelKey: 'profile.field.preferredLanguage', mono: true },
  { key: 'insuranceCompany', labelKey: 'profile.field.insuranceCompany' },
]

/**
 * A member's birth date as a control carries it — `yyyy-MM-dd`, or blank for the
 * `0001-01-01` sentinel an unset one arrives as.
 *
 * 🚩 The wire form, deliberately **not** the display date the read-only twin
 * shows: a control holds the value that will be SENT. The blank guard is
 * `isBlankDate`'s, the same one `formatShortDate` applies, rather than a second
 * spelling of "unset" — a sentinel date is not a fact about the customer.
 */
export function draftBirthDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) || isBlankDate(date) ? '' : toIsoDate(date)
}

/**
 * The member as the form opens on them — the baseline every later comparison is
 * made against.
 *
 * Every null becomes a blank string, because a control cannot hold `null` and
 * because the two mean the same thing here: nothing was recorded.
 */
export function profileDraftOf(member: LoyMember): ProfileDraft {
  return {
    fullName: member.fullName ?? '',
    email: member.email ?? '',
    birthDate: draftBirthDate(member.birthDate),
    gender: member.gender ?? '',
    nationality: member.nationality ?? '',
    nationalId: member.nationalId ?? '',
    cityCode: member.cityCode ?? '',
    preferredLanguage: member.preferredLanguage ?? '',
    insuranceCompany: member.insuranceCompany ?? '',
  }
}

/**
 * The fields the analyst has actually changed, in the form's own order.
 *
 * 🚩 **Compared trimmed**, so a stray space typed into a field nobody meant to
 * touch is not a change — it is exactly the keystroke a Save-that-records-no-
 * change would write a **member update snapshot** for. A field returned to its
 * original value is likewise not dirty: the set is the truth about the form
 * right now, never a log of what was touched.
 */
export function dirtyProfileFields(seed: ProfileDraft, draft: ProfileDraft): ProfileField[] {
  return PROFILE_FIELDS.map((field) => field.key).filter(
    (key) => draft[key].trim() !== seed[key].trim(),
  )
}

/** One field the form refuses to send, and the wording it earns. Never a
 *  form-level complaint: an analyst fixes a field, not a form (spec 301 #17). */
export interface ProfileFieldProblem {
  field: ProfileField
  key: string
}

/**
 * What the form refuses to send, named per field — and **only among the fields
 * the analyst actually changed**.
 *
 * 🚩 **A value the analyst did not type is not theirs to answer for.** The
 * shape checks run over `dirty` and nothing else, because a member whose
 * **stored** email is `user@localhost` or `n/a` would otherwise be unsaveable
 * outright: the draft is seeded from the member, the check fires on the first
 * render, and Save short-circuits before the write. An analyst who only wanted
 * to fix a misspelt name would have to edit or **blank** a contact detail
 * first — losing a way of reaching the customer to correct something else
 * entirely. That is this module's own blank-tolerance ruling reintroduced
 * through the one field that has a shape rule, and it is the defect
 * `/code-review` found on ticket 305's pass.
 *
 * An untouched value still goes on the wire — all nine always do, because the
 * command is a snapshot — so a stored value the door dislikes comes back as a
 * **named refusal** from the door, which is the honest place for it. The
 * client's job is to catch the typo it just watched being made.
 *
 * 🚩 **Blank is valid on every one of the nine.** Not only on gender and
 * preferred language — the two the till makes mandatory and this screen must
 * not — but everywhere: a sparse member is the ordinary case, and a rule that
 * demanded a value would be this module inventing one. Blanking an email
 * through the profile command is explicitly permitted (spec 301: an email can
 * also be blanked through an ordinary profile edit); *removing* it is a
 * different command with a different recording rule (306).
 *
 * 🚩 **Only SHAPE is checked, and only on a value that is there.** No length
 * caps and no format rules for the four codes: the column widths and the
 * nationality / city value sets live in the database and not in this repo, so a
 * cap invented here would refuse an edit the server would have accepted. An
 * invalid nationality or city comes back as a **named refusal** from the door
 * instead (`profileRefusedField`), which is the honest place for it.
 */
export function profileProblems(
  draft: ProfileDraft,
  dirty: readonly ProfileField[],
): ProfileFieldProblem[] {
  const problems: ProfileFieldProblem[] = []
  const typed = (field: ProfileField): boolean => dirty.includes(field)

  const email = typed('email') ? draft.email.trim() : ''
  // Deliberately loose — `something@something.tld` and nothing cleverer. The
  // server's validator is the authority; this only catches the typo that would
  // otherwise cost a round trip.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    problems.push({ field: 'email', key: 'profile.invalid.email' })

  const birthDate = typed('birthDate') ? draft.birthDate.trim() : ''
  if (birthDate && !isWritableBirthDate(birthDate))
    problems.push({ field: 'birthDate', key: 'profile.invalid.birthDate' })

  return problems
}

/**
 * A birth date the form can honestly send: `yyyy-MM-dd`, and a real calendar
 * day.
 *
 * The round-trip check (`toIsoDate` of the parsed date equals the typed string)
 * is what rejects `2026-02-31` — `new Date` rolls it forward to March rather
 * than refusing, so parsing alone would silently write a **different day than
 * the analyst typed**, which is the only reason this check exists at all.
 *
 * 🚩 **A shape, never a value.** There is deliberately no "not in the future"
 * rule and no earliest year: those are judgements about the customer, and spec
 * 301 puts value rules on the door, where a refusal can be named. This module
 * checks only that what leaves the browser says what was typed.
 */
function isWritableBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value
}

/**
 * The profile command's request body (design intent — the backend half of spec
 * 301 is unwritten and unnumbered).
 *
 * 🚩 **Every field is nullable, and a blank one is sent as `null` rather than
 * `""`.** This is the ticket's explicit handling of the live empty-string
 * question (spec 301 → Further Notes #2): the shared email validator's
 * behaviour on `""` is unconfirmed — null passes, empty probably does not — so
 * the client states *not recorded* in the one spelling the column and the
 * validator both already agree about, instead of reasoning about the other.
 */
export interface ProfileUpdateRequest {
  fullName: string | null
  email: string | null
  birthDate: string | null
  gender: string | null
  nationality: string | null
  nationalId: string | null
  cityCode: string | null
  preferredLanguage: string | null
  insuranceCompany: string | null
  /**
   * 🚩 The **stale-write echo** — the member's last-update stamp exactly as the
   * form was opened on it, and the server refuses if the member has moved on.
   * This command writes nine fields at once, so two analysts with the screen
   * open would otherwise silently clobber each other (spec 301, "Writing
   * safely"). The narrow commands carry no such token: they write one dimension
   * and the server reads the member fresh.
   */
  lastUpdate: string
}

/**
 * The body the profile command sends: every field trimmed, every blank `null`,
 * and the last-update echo the stale guard is built on.
 *
 * 🚩 **All nine go every time, not just the dirty ones.** The command is a
 * snapshot of the member's profile, and a partial body would leave the server
 * guessing whether an absent field means *unchanged* or *cleared* — the one
 * ambiguity that could silently blank a customer's record.
 */
/**
 * 🚩 **Changing the email clears that address's verified mark — server-side.**
 * The new handler does it, and only when the address actually changes; the
 * existing till handler changes the address and leaves the mark set, making the
 * record assert we verified an address the customer never confirmed. The screen
 * cannot contradict it today because `LoyMemberModel` carries **no verified
 * field at all**, so nothing here draws one — and this note is what a later
 * ticket that wants to draw one has to read first.
 */
export function profileUpdateRequest(
  draft: ProfileDraft,
  lastUpdate: string,
): ProfileUpdateRequest {
  const value = (field: ProfileField): string | null => draft[field].trim() || null
  return {
    fullName: value('fullName'),
    email: value('email'),
    birthDate: value('birthDate'),
    gender: value('gender'),
    nationality: value('nationality'),
    nationalId: value('nationalId'),
    cityCode: value('cityCode'),
    preferredLanguage: value('preferredLanguage'),
    insuranceCompany: value('insuranceCompany'),
    lastUpdate,
  }
}

/**
 * Whether the form on screen was opened on a member who has since moved on —
 * the clash this screen can see **for itself**, with no round trip.
 *
 * 🚩 It is not only two analysts racing. The Profile tab's draft is seeded once
 * at mount and never re-synced (ticket 302), so a background re-read of the SAME
 * member — a block, an unblock, a refetch — leaves the controls holding what
 * they were opened with while the facts beside them move. That is right for an
 * analyst mid-edit, and it is exactly why this comparison exists.
 *
 * 🚩 **An unknown stamp is not a clash.** A blank on either side means the
 * screen cannot tell, and the screen never invents a warning: the server's own
 * refusal is the authority, and this is the courtesy that arrives earlier.
 * Compared as the wire spells them — the same stamp round-tripped through the
 * same read is the same string; a stamp that differs only in formatting is a
 * door that has changed its projection, and warning then is the safe error.
 */
export function profileFormIsStale(
  openedOn: string | null | undefined,
  current: string | null | undefined,
): boolean {
  const a = openedOn?.trim()
  const b = current?.trim()
  if (!a || !b) return false
  return a !== b
}

/**
 * What a moved stamp MEANS for this form: nothing, a stamp to adopt quietly, or
 * news the analyst has to see.
 *
 * 🚩 **A moved stamp is not by itself a clash**, and treating it as one is what
 * made the screen cry wolf. The form owns NINE fields and no others: the mobile
 * belongs to its own command, and so do the block, the unblock and both contact
 * removals. Every one of those writes bumps the member's `UpdatedAt` server-side
 * (`SetMemberUpdatedFields`), so an analyst who changed a mobile and then looked
 * at the profile form was told *the member changed while you had this open*
 * — about **their own command**, worded as a colleague's edit, on the tab where
 * story 22 promised the two are separate.
 *
 * 🔑 So the question is not *did the stamp move* but *did anything this form
 * stands on move with it*. Comparing the seeded nine against the stored nine
 * answers it exactly, and answers it for the case no mutation-watching could:
 * a DIFFERENT analyst who changed only the mobile is equally harmless to a
 * name correction, and equally deserves no banner.
 *
 * - `unmoved` — the stamp is where the form left it.
 * - `adopt` — it moved and none of the nine did. The caller takes the new stamp
 *   silently and **keeps the draft**: nothing the analyst typed conflicts with
 *   what happened, and without the adoption their next Save would carry the
 *   superseded stamp and meet `LOY-00103` for no reason.
 * - `stale` — it moved and so did at least one of the nine. The draft may be
 *   standing on values somebody replaced, so the banner and its reload stand.
 *
 * ⚠ `adopt` is deliberately NOT conditioned on the draft being clean. The
 * analyst's typing is preserved either way — only the stamp is replaced — and
 * discarding edits because a colleague blocked the member would be the same
 * false alarm arriving by a different door.
 */
export type ProfileStampVerdict = 'unmoved' | 'adopt' | 'stale'

export function profileStampVerdict(
  openedOn: string | null | undefined,
  current: string | null | undefined,
  seedValues: ProfileDraft,
  stored: ProfileDraft,
): ProfileStampVerdict {
  if (!profileFormIsStale(openedOn, current)) return 'unmoved'
  return dirtyProfileFields(seedValues, stored).length === 0 ? 'adopt' : 'stale'
}

/**
 * The refusal codes the profile command recognises **by name**, and the field
 * each one belongs against.
 *
 * 🚩 **RECONCILED AGAINST THE SHIPPED DOOR** — these were the guessed
 * `LOY-00106` / `LOY-00107`, and both were wrong. The door reuses the module's
 * EXISTING lookup refusals rather than minting new ones
 * (`GetAndValidateCountryCode` and `GetAndValidateCityCode`), which is the whole
 * reason the profile command added no code for either. This map and
 * `REFUSAL_KEYS` in `member-commands.ts` were the two lines to reconcile; they
 * are reconciled together.
 *
 * A wrong code stays cheap by construction: an unrecognised refusal still
 * surfaces the **server's own sentence** (`.claude/rules/api-envelope.md`), so
 * the only thing at stake is which control is marked, never whether the analyst
 * is told what happened.
 */
const REFUSED_FIELDS: Record<string, ProfileField> = {
  'LOY-00003': 'nationality',
  'LOY-00005': 'cityCode',
}

/**
 * The field a refusal belongs against, or null for one that belongs against no
 * single field. Spec 301 #17: an analyst fixes the field that caused it rather
 * than guessing at the form — and a server refusal names a field just as a
 * client-side check does, so the two mark the control the same way.
 */
export function profileRefusedField(err: unknown): ProfileField | null {
  const code = apiErrorCode(err) ?? ''
  // `Object.hasOwn` rather than a bare index: a server `errorCode` of
  // `constructor` would otherwise reach through to `Object.prototype`.
  return Object.hasOwn(REFUSED_FIELDS, code) ? REFUSED_FIELDS[code] : null
}

/** The code the door answers when the member has moved on since the form was
 *  opened: `LoyaltyErrorCodes.MemberChangedSinceLoaded`, thrown by
 *  `LoyMemberAdminService.GuardAgainstStaleWrite` and the ONE code BackOffice
 *  spec 1397 mints in its whole effort. Was guessed as `LOY-00108`. */
export const MEMBER_CHANGED_CODE = 'LOY-00103'

/**
 * Whether a refusal is the **stale-write** one.
 *
 * 🚩 It is not an error and must not read as one: it says the member changed
 * underneath you, and it is the one refusal that offers a **reload** rather than
 * a retry — pressing the same Save again would either be refused identically or,
 * worse, succeed against a member the analyst has not seen.
 */
export const isStaleProfileRefusal = (err: unknown): boolean =>
  apiErrorCode(err) === MEMBER_CHANGED_CODE
