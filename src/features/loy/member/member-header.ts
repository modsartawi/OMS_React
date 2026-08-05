/**
 * What the member header says, decided away from how it looks (ticket 235).
 *
 * Two derivations live here because both are rules an agent could describe and
 * neither is a rendering concern: **which chips a member carries**, and **which
 * of the member's dates is a fact rather than a sentinel**. The component below
 * them is a thin renderer, which is the posture spec 083 set for this repo and
 * spec 231 kept: the pure module is where regression would otherwise be silent.
 */
import type { LoyMember } from '@/core/models/loy'
import type { Severity } from '@/core/ui/severity'
import { formatShortDate } from '@/core/util/date-format'
import { blockedReasonKey, memberTypeKey, tierKey } from './codes'

/**
 * One chip. `labelKey` is a translation key when the code's set is closed and
 * `null` when it is not — in which case the renderer draws `code` bare, never a
 * raw `loy:tier.X` (229 clause 4). `code` is carried on every chip so the
 * fallback needs no second lookup at the call site.
 */
export interface MemberChip {
  /** Which fact this is — also the React key, since a member has at most one of each. */
  kind: 'tier' | 'type' | 'blocked'
  code: string
  labelKey: string | null
  sev: Severity
}

/**
 * The chips a member carries, in the order they are drawn.
 *
 * 🚩 **Additive and independent, with no precedence rule** (230). Two orthogonal
 * facts are shown orthogonally, so an archived-and-blocked member never has one
 * hidden behind the other, and there is no precedence to write or get wrong.
 *
 * 🚩 **An ordinary member gets no status chip** — only the tier. Silence is the
 * Active state, so a status chip always means *read me*. That is why there is no
 * "Active" chip here: it was drawn in the first cut and cut on review.
 *
 * The two absent-value guards are not defensive noise. `tier` is nullable like
 * every other string on the model, and `memberType` arrives only because the
 * `LoyWeb` projection maps it through (230's first amendment) — a door that
 * ships without that line would otherwise draw a chip with nothing in it, which
 * reads as a fact rather than as a missing field.
 */
export function memberChips(member: LoyMember): MemberChip[] {
  const chips: MemberChip[] = []

  // Tier — always, when there is one to state.
  if (member.tier) {
    chips.push({ kind: 'tier', code: member.tier, labelKey: tierKey(member.tier), sev: 'warn' })
  }

  // Member type — whenever the member is not an ordinary `M`.
  if (member.memberType && member.memberType !== ORDINARY_MEMBER) {
    chips.push({
      kind: 'type',
      code: member.memberType,
      labelKey: memberTypeKey(member.memberType),
      sev: 'mute',
    })
  }

  // Blocked — whenever there is a reason code. Empty ⇒ not blocked, which is
  // `LoyMemberExtensions.IsBlocked` exactly.
  if (member.blockedReasonCode) {
    chips.push({
      kind: 'blocked',
      code: member.blockedReasonCode,
      labelKey: blockedReasonKey(member.blockedReasonCode),
      sev: 'bad',
    })
  }

  return chips
}

/** `LoyMemberTypeConstants.Membership` — the one type that earns no chip. */
const ORDINARY_MEMBER = 'M'

/**
 * The birth date as the disclosure shows it, or `null` when the member has none.
 *
 * 🚩 **An unset birth date arrives as the `0001-01-01` sentinel, not as null**,
 * and presenting that as a fact about the customer is the failure this exists to
 * stop. The guard is `isBlankDate`'s, reached through `formatShortDate` which
 * already applies it — reuse, not a second spelling of "unset".
 */
export function memberBirthDate(value: string | null | undefined): string | null {
  return formatShortDate(value) || null
}
