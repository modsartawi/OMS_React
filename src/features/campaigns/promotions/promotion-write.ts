import type { RulePromotionAssignment, RulePromotionBody } from '@/core/models/rule-promotion'

/**
 * What a hand-made promotion's dialogs make of their fields and of HQ's answers (ticket 536;
 * BackOffice brief 2848 D3): pure, no React, no i18n — the dialogs render these through their own keys.
 *
 * The decided rules it serves: a promotion code never changes after Create; Assign and Unassign are
 * all or none, at most 2,000 campaigns a call; a refusal is shown in the dialog that made the call,
 * the promotion left as it was.
 */

// ── the promotion code ──

/** HQ's longest promotion code (the upload's `PromotionCode` rule). */
export const PROMOTION_CODE_MAX = 38

/** HQ clamps a name at 200 characters; the field stops there instead. */
export const PROMOTION_NAME_MAX = 200

export type PromotionCodeProblem = 'required' | 'tooLong' | 'characters'

/** Letters, digits, `.`, `_` and `-`. */
const CODE_CHARACTERS = /^[A-Za-z0-9._-]+$/

/** What is wrong with a promotion code as typed (HQ trims it), or null when HQ would take it. */
export function promotionCodeError(code: string): PromotionCodeProblem | null {
  const trimmed = code.trim()
  if (trimmed === '') return 'required'
  if (trimmed.length > PROMOTION_CODE_MAX) return 'tooLong'
  if (!CODE_CHARACTERS.test(trimmed)) return 'characters'
  return null
}

// ── New promotion and Rename ──

/** The dialog's fields; Rename shows the code and never sends another. */
export interface PromotionForm {
  promotionCode: string
  nameEn: string
  nameAr: string
  note: string
}

export const EMPTY_PROMOTION_FORM: PromotionForm = { promotionCode: '', nameEn: '', nameAr: '', note: '' }

export type PromotionFormProblem = `code.${PromotionCodeProblem}` | 'nameEnRequired'

/** The form's problems, the code's first (Rename's code is HQ's and is not checked). */
export function promotionFormProblems(form: PromotionForm, { renaming = false } = {}): PromotionFormProblem[] {
  const problems: PromotionFormProblem[] = []
  const code = renaming ? null : promotionCodeError(form.promotionCode)
  if (code) problems.push(`code.${code}`)
  if (form.nameEn.trim() === '') problems.push('nameEnRequired')
  return problems
}

/**
 * The body of Create and Update: every field as the dialog shows it, trimmed. The Arabic name and the
 * note are always sent (an empty one empties it): a null would keep HQ's, which the dialog never means.
 */
export const toPromotionBody = (form: PromotionForm): RulePromotionBody => ({
  promotionCode: form.promotionCode.trim(),
  nameEn: form.nameEn.trim(),
  nameAr: form.nameAr.trim(),
  note: form.note.trim(),
})

// ── Assign and Unassign ──

/** The most campaigns one Assign or Unassign names (HQ's cap, an upload's own). */
export const ASSIGN_MAX = 2000

/** A pick of campaigns HQ would take in one call: at least one, at most 2,000. */
export const sendable = (count: number): boolean => count > 0 && count <= ASSIGN_MAX

/** The ids picked, toggled one at a time; the order picked is the order sent. */
export const togglePick = (picked: readonly string[], id: string): string[] => (picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])

/** One promotion campaigns were taken from, and how many. */
export interface MovedFrom {
  from: string
  count: number
}

export interface AssignmentSummary {
  /** The campaigns now in the promotion. */
  assigned: number
  /** Those taken from another promotion, grouped by it, in the order HQ named them. */
  moved: MovedFrom[]
}

/** What an Assign did: "3 assigned, 1 moved from X". */
export function assignmentSummary(reply: Pick<RulePromotionAssignment, 'changed' | 'moved'>): AssignmentSummary {
  const moved: MovedFrom[] = []
  for (const m of reply.moved) {
    const group = moved.find((g) => g.from === m.from)
    if (group) group.count++
    else moved.push({ from: m.from, count: 1 })
  }
  return { assigned: reply.changed.length, moved }
}

/** The success line's parts in order, each a key of the namespace and its values; the page isolates every value
 *  and joins the parts with the locale's `assign.joiner`. */
export type AssignmentLinePart = { key: 'assign.done'; count: number } | { key: 'assign.movedFrom'; count: number; from: string }

export const assignmentLine = (summary: AssignmentSummary): AssignmentLinePart[] => [
  { key: 'assign.done', count: summary.assigned },
  ...summary.moved.map((m) => ({ key: 'assign.movedFrom' as const, count: m.count, from: m.from })),
]

// ── Delete ──

/**
 * Whether a promotion holds campaigns, for Delete (offered only when empty): `held` once the list
 * counts one or the unfiltered table holds a row (a pending upload's rows are not counted); `empty`
 * when both say none; `unknown` while the table's total is not read (loading, or its read failed).
 */
export type PromotionEmptiness = 'empty' | 'held' | 'unknown'

export function promotionEmptiness(campaignCount: number, unfilteredTotal: number | undefined): PromotionEmptiness {
  if (campaignCount > 0) return 'held'
  if (unfilteredTotal === undefined) return 'unknown'
  return unfilteredTotal === 0 ? 'empty' : 'held'
}

// ── a refused write ──

/** HQ's refusals of the promotion doors that the dialogs say in their own words (BackOffice 2847). */
export type PromotionRefusalReason = 'denied' | 'exists' | 'owned' | 'notEmpty' | 'campaignNotFound' | 'notFound' | 'bad'

export const PROMOTION_REFUSAL_REASONS: readonly PromotionRefusalReason[] = ['denied', 'exists', 'owned', 'notEmpty', 'campaignNotFound', 'notFound', 'bad']

export interface PromotionRefusalView {
  /** Null for a code the dialogs have no words for: HQ's message is shown as it is. */
  reason: PromotionRefusalReason | null
  /** HQ's detail lines (one per campaign an upload owns, say), one line each. */
  details: string[]
}

/** The namespace key that says a reason: the bare 403 shares the screens' own "no access" line. */
export const refusalKey = (reason: PromotionRefusalReason): string => (reason === 'denied' ? 'denied' : `refusal.${reason}`)

const REASON_BY_CODE: Record<string, PromotionRefusalReason> = {
  RULES_PROMOTION_EXISTS: 'exists',
  RULES_PROMOTION_OWNED: 'owned',
  RULES_PROMOTION_NOT_EMPTY: 'notEmpty',
  RULES_PROMOTION_CAMPAIGN_NOT_FOUND: 'campaignNotFound',
  RULES_PROMOTION_NOT_FOUND: 'notFound',
  RULES_PROMOTION_BAD: 'bad',
}

/**
 * What a refused write means, by HQ's code:
 *
 * - a bare 403 (no code): the session lacks the author's grant (02);
 * - 409 `RULES_PROMOTION_EXISTS` (Create): the code is taken, overlaps another's, or starts a campaign id;
 * - 409 `RULES_PROMOTION_OWNED`: an upload owns a campaign named (Assign / Unassign), or the promotion (Delete);
 * - 409 `RULES_PROMOTION_NOT_EMPTY` (Delete): it still has campaigns;
 * - 404 `RULES_PROMOTION_CAMPAIGN_NOT_FOUND`: a campaign never published;
 * - 404 `RULES_PROMOTION_NOT_FOUND`: no such promotion;
 * - 400 `RULES_PROMOTION_BAD`: a bad code, no English name, no campaign or more than 2,000.
 */
export function promotionRefusalView(refusal: { code: string | null; bareDenial: boolean; details: string[] }): PromotionRefusalView {
  if (refusal.bareDenial) return { reason: 'denied', details: refusal.details }
  return { reason: refusal.code ? (REASON_BY_CODE[refusal.code] ?? null) : null, details: refusal.details }
}
