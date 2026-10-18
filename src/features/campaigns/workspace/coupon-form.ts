import type { RuleCampaignBudget, RuleCouponBatchCreate, RuleCouponBatchKind, RuleCouponBatchSummary } from '@/core/models/rule-campaign'
import { cleanCode } from '@/core/rules/coupon'

/**
 * Create coupons (tickets 515, 526; the prototype's `CouponCreate`): one batch of random, universal
 * or personal codes under the campaign's coupon template (`Rules/Authoring/CouponBatches/Create`),
 * with a validity in local days. The form holds what the marketer typed, as typed;
 * `couponCreateProblems` says what holds Create back, at its field; `couponCreateBody` is what is
 * sent. HQ mints the codes and the batch id, shaped by the template — the client never draws one.
 *
 * The codes carry NO redemption limit (ADR 0094). The dialog's "each code once" and "once per
 * customer" boxes are sent as `eachCodeOnce` / `oncePerCustomer`; HQ answers them as a coupon and a
 * profile uses budget, which the page adds to the draft (`budgetsToAdd`).
 */
export type CouponKind = Exclude<RuleCouponBatchKind, 'import'>
export const COUPON_KINDS: readonly CouponKind[] = ['random', 'universal', 'personal']

export interface CouponCreateForm {
  kind: CouponKind
  /** The campaign's SIS.Coupons template, as typed. */
  templateId: string
  /** random: how many codes, as typed. */
  count: string
  /** universal: the one code; blank = HQ generates it with the template's prefix. */
  code: string
  /** personal: the member ids, as pasted (a column, a comma list…). */
  members: string
  /** Local `yyyy-MM-dd` from the date inputs; '' = the template's own. */
  from: string
  until: string
  /** The dialog's two limits, which become budgets (ADR 0094). */
  eachCodeOnce: boolean
  oncePerCustomer: boolean
}

/** HQ's bounds (BackOffice `RuleCouponBatchService`): codes in one batch, and the column widths. */
export const MAX_BATCH = 10000
export const MAX_CODE = 64
export const MAX_MEMBER = 26
export const MAX_TEMPLATE = 26

/** What HQ takes as a code or a customer id: letters, digits and - _ . only, starting with a letter
 *  or a digit (so it never splits a CSV line or opens as a spreadsheet formula). */
const SAFE_VALUE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

export const isCodeOk = (code: string): boolean => code.length <= MAX_CODE && SAFE_VALUE.test(code)
export const isMemberOk = (id: string): boolean => id.length <= MAX_MEMBER && SAFE_VALUE.test(id)

/** A fresh form: random codes, under the template the campaign's newest batch used (if any). */
export function emptyCouponForm(templateId: string): CouponCreateForm {
  return { kind: 'random', templateId, count: '100', code: '', members: '', from: '', until: '', eachCodeOnce: false, oncePerCustomer: false }
}

/** The template a new batch starts from: the newest batch's (List answers newest first), else none.
 *  HQ names no door for a campaign's coupon template (logged as a BO ask), so the author types it
 *  the first time. */
export const suggestedTemplate = (batches: readonly RuleCouponBatchSummary[] | undefined): string => batches?.[0]?.templateId ?? ''

/** The member ids a paste holds, each once in any case (HQ counts `M-1` and `m-1` as one member),
 *  in the order first seen and as first typed: an id's case is HQ's to read, never the client's to
 *  change. */
export function memberIds(pasted: string): { ids: string[]; repeated: number } {
  const all = pasted
    .split(/[,;| \r\n\t]/)
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
  const seen = new Set<string>()
  const ids = all.filter((m) => !seen.has(m.toUpperCase()) && !!seen.add(m.toUpperCase()))
  return { ids, repeated: all.length - ids.length }
}

const whole = (value: string): number | null => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null)

export type CouponField = 'templateId' | 'count' | 'code' | 'members' | 'until' | 'from'
export type CouponProblem =
  | 'templateRequired'
  | 'templateLong'
  | 'countRange'
  | 'codeShape'
  | 'membersEmpty'
  | 'membersRange'
  | 'membersShape'
  | 'dayShape'
  | 'untilBeforeFrom'

/** The template's problem, if any: required, at most `MAX_TEMPLATE` characters. */
export function templateProblem(templateId: string): CouponProblem | undefined {
  const id = templateId.trim()
  if (!id) return 'templateRequired'
  if (id.length > MAX_TEMPLATE) return 'templateLong'
  return undefined
}

/** What holds Create back, one problem per field, for the form's kind only. */
export function couponCreateProblems(form: CouponCreateForm): Partial<Record<CouponField, CouponProblem>> {
  const out: Partial<Record<CouponField, CouponProblem>> = {}
  const template = templateProblem(form.templateId)
  if (template) out.templateId = template
  if (form.kind === 'random') {
    const howMany = whole(form.count)
    if (howMany === null || howMany < 1 || howMany > MAX_BATCH) out.count = 'countRange'
  } else if (form.kind === 'universal') {
    const code = cleanCode(form.code)
    if (code && !isCodeOk(code)) out.code = 'codeShape'
  } else {
    const { ids } = memberIds(form.members)
    if (!ids.length) out.members = 'membersEmpty'
    else if (ids.length > MAX_BATCH) out.members = 'membersRange'
    else if (!ids.every(isMemberOk)) out.members = 'membersShape'
  }
  if (form.from && !DAY.test(form.from)) out.from = 'dayShape'
  if (form.until && !DAY.test(form.until)) out.until = 'dayShape'
  else if (form.from && form.until && !out.from && form.until < form.from) out.until = 'untilBeforeFrom'
  return out
}

/** The dialog's limits a budget of the campaign already does: a coupon-scope budget of ONE use for
 *  the lifetime is "each code once", a profile-scope one "once per customer" — what HQ answers for
 *  the boxes. A looser budget (100 uses, once a month) does not: the box stays the author's. A
 *  covered box shows ticked and is not sent again. */
export function limitsCovered(budgets: readonly RuleCampaignBudget[] | undefined): { eachCodeOnce: boolean; oncePerCustomer: boolean } {
  const once = (b: RuleCampaignBudget, scope: RuleCampaignBudget['scope']) => b.scope === scope && b.limit === 'uses' && b.value === 1 && b.period === 'lifetime'
  const list = budgets ?? []
  return { eachCodeOnce: list.some((b) => once(b, 'coupon')), oncePerCustomer: list.some((b) => once(b, 'profile')) }
}

/**
 * The body Create sends, or null while a problem holds it back. Only the kind's own field goes, the
 * days as typed (never a `Z`), and a limit only when its box is ticked and no budget does it yet. A
 * universal code is used as often as the budgets allow, so it never sends "each code once".
 */
export function couponCreateBody(form: CouponCreateForm, covered = limitsCovered([])): RuleCouponBatchCreate | null {
  if (Object.keys(couponCreateProblems(form)).length) return null
  const body: RuleCouponBatchCreate = {
    templateId: form.templateId.trim(),
    kind: form.kind,
    eachCodeOnce: form.kind !== 'universal' && form.eachCodeOnce && !covered.eachCodeOnce,
    oncePerCustomer: form.oncePerCustomer && !covered.oncePerCustomer,
  }
  if (form.kind === 'random') body.count = Number(form.count.trim())
  else if (form.kind === 'universal') {
    const code = cleanCode(form.code)
    if (code) body.code = code
  } else body.members = memberIds(form.members).ids
  if (form.from) body.validFrom = form.from
  if (form.until) body.validTo = form.until
  return body
}

/** An import's body: the same door, `kind: import`, the rows as `code[,customerId]` lines. An import
 *  ticks no limit box: its budgets are set under Settings ▸ Budgets. */
export function couponImportBody(templateId: string, csv: string): RuleCouponBatchCreate {
  return { templateId: templateId.trim(), kind: 'import', csv, eachCodeOnce: false, oncePerCustomer: false }
}

/** The budgets a create answered that the campaign does not have yet (by id), in HQ's order: what
 *  the page adds to the draft (ADR 0094). */
export function budgetsToAdd(have: readonly RuleCampaignBudget[] | undefined, answered: readonly RuleCampaignBudget[]): RuleCampaignBudget[] {
  const ids = new Set((have ?? []).map((b) => b.id))
  return answered.filter((b) => !ids.has(b.id))
}

// ── The batch list ──

/** The batches shown: the search matches part of the batch id or the template, any case. */
export function visibleBatches(batches: readonly RuleCouponBatchSummary[], q: string): RuleCouponBatchSummary[] {
  const needle = q.trim().toUpperCase()
  return needle ? batches.filter((b) => b.batchId.toUpperCase().includes(needle) || b.templateId.toUpperCase().includes(needle)) : [...batches]
}

/** The campaign's totals over its batches. */
export function batchTotals(batches: readonly RuleCouponBatchSummary[]): { batches: number; codes: number; used: number; disabled: number } {
  return batches.reduce((t, b) => ({ batches: t.batches + 1, codes: t.codes + b.codes, used: t.used + b.used, disabled: t.disabled + b.disabled }), { batches: 0, codes: 0, used: 0, disabled: 0 })
}

/** How many of a batch's codes nobody used — what Delete unused may delete (HQ also keeps a code a
 *  paying sale holds, so its answer can be fewer). */
export const unusedOf = (b: Pick<RuleCouponBatchSummary, 'codes' | 'used'>): number => Math.max(0, b.codes - b.used)
