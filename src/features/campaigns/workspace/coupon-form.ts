import type { RuleCampaignCoupon, RuleCouponBatchCreate, RuleCouponCharset, RuleCouponShape, RuleCouponStatus, RuleCouponValidity } from '@/core/models/rule-campaign'
import { cleanCode } from '@/core/rules/coupon'

/**
 * Create coupons (ticket 515; the prototype's `CouponCreate`): one batch of random, universal or
 * personal codes, with a validity in local days. The form holds what the marketer typed, as typed;
 * `couponCreateProblems` says what holds Create back, at its field; `couponCreateBody` is what is
 * sent. HQ mints the codes and the batch id — the client never draws a code.
 *
 * There are NO redemption-limit fields (ADR 0094): "each code once" and "once per customer" are the
 * campaign's coupon and profile budgets, under Settings ▸ Budgets. Nothing here can carry one.
 */
export type CouponKind = RuleCouponBatchCreate['kind']
export const COUPON_KINDS: readonly CouponKind[] = ['random', 'universal', 'personal']
export const COUPON_CHARSETS: readonly RuleCouponCharset[] = ['lettersAndDigits', 'letters', 'digits']

export interface CouponCreateForm {
  kind: CouponKind
  /** random: how many codes, as typed. */
  count: string
  /** random and personal: the code's shape. */
  prefix: string
  suffix: string
  length: string
  charset: RuleCouponCharset
  /** universal: the one code. */
  code: string
  /** personal: the member ids, as pasted (a column, a comma list…). */
  members: string
  /** Local `yyyy-MM-dd` from the date inputs; '' = at once / no end of its own. */
  from: string
  until: string
}

/** One batch's bounds (the prototype's: up to 5,000 codes in one batch). */
export const MAX_BATCH = 5000
/** The shortest random part: 10^4 digit codes hold twice `MAX_BATCH`, so any shape fits a batch. */
export const MIN_LENGTH = 4
export const MAX_LENGTH = 16
/** A prefix or a suffix: up to 8 letters or digits. */
export const MAX_AFFIX = 8

/** A fresh form: random codes, prefixed with the campaign code's first part, as the prototype. */
export function emptyCouponForm(campaignCode: string): CouponCreateForm {
  return {
    kind: 'random',
    count: '100',
    prefix: cleanAffix(campaignCode.split('-')[0] ?? ''),
    suffix: '',
    length: '6',
    charset: 'lettersAndDigits',
    code: '',
    members: '',
    from: '',
    until: '',
  }
}

/** A prefix or suffix as it is kept: upper-case letters and digits only, at most `MAX_AFFIX`. */
export const cleanAffix = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_AFFIX)

const UNIVERSAL = /^[A-Z0-9][A-Z0-9-]{2,31}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The member ids a paste holds, each once, in the order first seen — as typed: an id's case is
 *  HQ's to read, never the client's to change. */
export function memberIds(pasted: string): { ids: string[]; repeated: number } {
  const all = pasted
    .split(/[,;| \r\n\t]/)
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
  const ids = [...new Set(all)]
  return { ids, repeated: all.length - ids.length }
}

const whole = (value: string): number | null => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null)

export type CouponField = 'count' | 'length' | 'code' | 'members' | 'until' | 'from'
export type CouponProblem =
  | 'countRange'
  | 'lengthRange'
  | 'codeShape'
  | 'codeTaken'
  | 'membersEmpty'
  | 'membersRange'
  | 'dayShape'
  | 'untilBeforeFrom'

/**
 * What holds Create back, one problem per field, for the form's kind only. `taken` is the codes the
 * campaign already has (a universal code may not repeat one; HQ refuses it too).
 */
export function couponCreateProblems(form: CouponCreateForm, taken: readonly string[] = []): Partial<Record<CouponField, CouponProblem>> {
  const out: Partial<Record<CouponField, CouponProblem>> = {}
  if (form.kind !== 'universal') {
    const length = whole(form.length)
    if (length === null || length < MIN_LENGTH || length > MAX_LENGTH) out.length = 'lengthRange'
    const howMany = form.kind === 'random' ? whole(form.count) : memberIds(form.members).ids.length
    if (form.kind === 'random' && (howMany === null || howMany < 1 || howMany > MAX_BATCH)) out.count = 'countRange'
    if (form.kind === 'personal') {
      if (!howMany) out.members = 'membersEmpty'
      else if (howMany > MAX_BATCH) out.members = 'membersRange'
    }
    // No shape is too small for ONE batch: ten digits at the shortest length (10^4) hold twice the
    // largest. Codes the campaign's earlier batches took from the same shape are HQ's to count: a
    // shape it has run out of is refused on the envelope.
  } else {
    const code = cleanCode(form.code)
    if (!UNIVERSAL.test(code)) out.code = 'codeShape'
    else if (taken.includes(code)) out.code = 'codeTaken'
  }
  if (form.from && !DAY.test(form.from)) out.from = 'dayShape'
  if (form.until && !DAY.test(form.until)) out.until = 'dayShape'
  else if (form.from && form.until && !out.from && form.until < form.from) out.until = 'untilBeforeFrom'
  return out
}

/** The body Create sends, or null while a problem holds it back. Only the kind's own fields go. */
export function couponCreateBody(form: CouponCreateForm, taken: readonly string[] = []): RuleCouponBatchCreate | null {
  if (Object.keys(couponCreateProblems(form, taken)).length) return null
  const validity: RuleCouponValidity = { from: form.from || null, until: form.until || null }
  const shape: RuleCouponShape = {
    prefix: cleanAffix(form.prefix),
    suffix: cleanAffix(form.suffix),
    length: Number(form.length.trim()),
    charset: form.charset,
  }
  if (form.kind === 'random') return { kind: 'random', count: Number(form.count.trim()), ...shape, ...validity }
  if (form.kind === 'universal') return { kind: 'universal', code: cleanCode(form.code), ...validity }
  return { kind: 'personal', members: memberIds(form.members).ids, ...shape, ...validity }
}

/** A sample of each charset's characters, so "Looks like" is the same on every render. */
const SAMPLE: Record<RuleCouponCharset, string> = {
  lettersAndDigits: 'K7Q2M9X4TR3W8PZ5',
  letters: 'KQMXTRWPZHJNVBCD',
  digits: '4827361950482736',
}

/** What a code of this shape looks like — an example, not a code HQ will mint. */
export function codeExample(form: Pick<CouponCreateForm, 'prefix' | 'suffix' | 'length' | 'charset'>): string {
  const length = Math.min(Math.max(whole(form.length) ?? MIN_LENGTH, 1), MAX_LENGTH)
  return [cleanAffix(form.prefix), SAMPLE[form.charset].slice(0, length), cleanAffix(form.suffix)].filter(Boolean).join('-')
}

// ── The list's filters ──

export type CouponStatusFilter = 'all' | RuleCouponStatus
export const COUPON_STATUSES: readonly RuleCouponStatus[] = ['unused', 'used', 'disabled', 'expired']

export const statusFromParam = (value: string | null): CouponStatusFilter =>
  COUPON_STATUSES.includes(value as RuleCouponStatus) ? (value as CouponStatusFilter) : 'all'

/** The codes shown: the search matches part of the code, any case; status and batch match exactly. */
export function visibleCoupons(
  codes: readonly RuleCampaignCoupon[],
  { q, status, batch }: { q: string; status: CouponStatusFilter; batch: string },
): RuleCampaignCoupon[] {
  const needle = q.trim().toUpperCase()
  return codes.filter(
    (k) => (!needle || k.code.toUpperCase().includes(needle)) && (status === 'all' || k.status === status) && (!batch || k.batch === batch),
  )
}

/** How many codes in each status. */
export function couponCounts(codes: readonly RuleCampaignCoupon[]): Record<RuleCouponStatus, number> {
  const out = Object.fromEntries(COUPON_STATUSES.map((s) => [s, 0])) as Record<RuleCouponStatus, number>
  for (const k of codes) out[k.status]++
  return out
}
