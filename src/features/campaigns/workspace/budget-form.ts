import type { RuleBudgetLimit, RuleBudgetPeriod, RuleBudgetScope, RuleCampaignBudget } from '@/core/models/rule-campaign'
import { currencyDecimals } from '@/core/money'

// Settings ▸ Budgets' drawer, its pure part (ticket 510): the form, what it refuses, and the list
// a Save sends.

/** The drawer's fields. The figure is kept as typed, so a half-typed `12.` is not rewritten. */
export interface BudgetForm {
  scope: RuleBudgetScope
  limit: RuleBudgetLimit
  value: string
  period: RuleBudgetPeriod
  /** The name in both languages (`name { en, ar }` on the wire). */
  nameEn: string
  nameAr: string
}

/** Why the figure cannot be saved yet, keyed to its locale message. */
export type BudgetProblem = 'valueRequired' | 'notAboveZero' | 'notWhole' | 'tooManyDecimals'

/** A new budget of a scope, as the prototype starts one: a member or a code counts uses, once; the
 *  others count discount money. Lifetime; no name. */
export function newBudgetForm(scope: RuleBudgetScope): BudgetForm {
  const perHead = scope === 'profile' || scope === 'coupon'
  return { scope, limit: perHead ? 'uses' : 'money', value: perHead ? '1' : '10000', period: 'lifetime', nameEn: '', nameAr: '' }
}

export function budgetForm(b: RuleCampaignBudget): BudgetForm {
  return { scope: b.scope, limit: b.limit, value: String(b.value), period: b.period, nameEn: b.name?.en ?? '', nameAr: b.name?.ar ?? '' }
}

/**
 * What is wrong with the figure: it is required and above zero; uses are whole; money and points
 * take no more decimals than the campaign's currency has (BHD three, SAR two — three when the
 * currency is not known, the scale money is held at).
 */
export function budgetProblem(form: Pick<BudgetForm, 'limit' | 'value'>, currency: string | null): BudgetProblem | null {
  const text = form.value.trim()
  // A plain figure only: `Number` would also read `2.5e-1` or `0x10`, slipping past the decimals.
  const figure = /^-?(\d+)(?:\.(\d*))?$|^-?\.(\d+)$/.exec(text)
  if (!figure) return 'valueRequired'
  if (Number(text) <= 0) return 'notAboveZero'
  const decimals = (figure[2] ?? figure[3] ?? '').replace(/0+$/, '').length
  if (form.limit === 'uses') return decimals > 0 ? 'notWhole' : null
  return decimals > (currency ? currencyDecimals(currency) : 3) ? 'tooManyDecimals' : null
}

/** The budget the form makes, under `id`: the figure read, the names trimmed. */
export function toBudget(form: BudgetForm, id: string): RuleCampaignBudget {
  return { id, name: { en: form.nameEn.trim(), ar: form.nameAr.trim() }, scope: form.scope, limit: form.limit, value: Number(form.value.trim()), period: form.period }
}

/** Whether the form says what `initial` said — the figure read as a number, the name trimmed. */
export function sameBudget(form: BudgetForm, initial: BudgetForm): boolean {
  return (
    form.scope === initial.scope &&
    form.limit === initial.limit &&
    form.period === initial.period &&
    form.nameEn.trim() === initial.nameEn.trim() &&
    form.nameAr.trim() === initial.nameAr.trim() &&
    Number(form.value.trim()) === Number(initial.value.trim())
  )
}

/** The campaign's budgets with `b` in place of the one with its id, or added at the end. */
export function budgetsWith(budgets: readonly RuleCampaignBudget[], b: RuleCampaignBudget): RuleCampaignBudget[] {
  return budgets.some((x) => x.id === b.id) ? budgets.map((x) => (x.id === b.id ? b : x)) : [...budgets, b]
}

export const budgetsWithout = (budgets: readonly RuleCampaignBudget[], id: string): RuleCampaignBudget[] => budgets.filter((x) => x.id !== id)
