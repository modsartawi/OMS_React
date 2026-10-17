import type { RuleBudgetLimit, RuleBudgetPeriod, RuleBudgetScope, RuleCampaignBudget } from '@/core/models/rule-campaign'
import { roundMoney } from '@/core/money'
import { formatNumber } from '@/core/util/number-format'
import { moneyText, type Sentence, type SentenceValue } from './sentence'

// A budget read as a sentence, and a live budget's used / limit (ticket 510, ADR 0091). Pure: the
// sentence is a locale KEY and its typed values (`@/core/rules/sentence`'s shape, rendered by the
// same view); the wording lives in `campaign-workspace.json` under `budgets.sentence.*`. It sits in
// `core/` because a member's budgets used (519) read the same sentence.

/** The scopes, in the Budgets page's order (the prototype's): the whole campaign, then per key. */
export const BUDGET_SCOPES: readonly RuleBudgetScope[] = ['campaign', 'profile', 'coupon', 'store', 'session']
export const BUDGET_LIMITS: readonly RuleBudgetLimit[] = ['money', 'uses', 'pointsGiven', 'pointsTaken']
export const BUDGET_PERIODS: readonly RuleBudgetPeriod[] = ['lifetime', 'day', 'week', 'month', 'year']

const phrase = (key: string): SentenceValue => ({ kind: 'phrase', sentence: { key, values: {} } })

/** A limit's figure: money and points (their worth) in the campaign's currency, uses a count. */
export function budgetAmount(limit: RuleBudgetLimit, value: number, currency: string | null): SentenceValue {
  return limit === 'uses' ? { kind: 'number', n: value } : { kind: 'money', amount: value, currency }
}

/** A limit's figure as one string (a used / limit count, an overshoot): `SAR 50,000.00`, `2`. */
export function budgetFigure(limit: RuleBudgetLimit, value: number, currency: string | null): string {
  return limit === 'uses' ? formatNumber(value) : moneyText({ amount: value, currency })
}

/**
 * "Limit the <limit> to <value> per <scope>[ per <period>]". A lifetime budget names no period.
 * `currency` is the campaign's (`campaignCurrency`), or null when it is not known — the figure then
 * shows its own decimals with no code.
 */
export function budgetSentence(
  b: Pick<RuleCampaignBudget, 'scope' | 'limit' | 'value' | 'period'>,
  currency: string | null,
): Sentence {
  const values: Record<string, SentenceValue> = {
    limit: phrase(`budgets.limit.${b.limit}`),
    value: budgetAmount(b.limit, b.value, currency),
    scope: phrase(`budgets.scope.${b.scope}`),
  }
  if (b.period === 'lifetime') return { key: 'budgets.sentence.lifetime', values }
  return { key: 'budgets.sentence.periodic', values: { ...values, period: phrase(`budgets.period.${b.period}`) } }
}

/** A live budget's counter against its limit. */
export interface BudgetUsage {
  used: number
  limit: number
  /** How far the counter went past the limit; null while it has not (at the limit is used up, not over). */
  overshoot: number | null
  /** At or past the limit (at three decimals, as the figures read): nothing more is given. */
  usedUp: boolean
  /** The bar's fill, 0–1: full once used up or past. */
  share: number
}

/**
 * Used / limit and the overshoot. A counter may pass its limit (a hold that expired, a lowered
 * limit, a reused result — ADR 0091); the overshoot is shown, never clamped away. Figures are held
 * at three decimals (`roundMoney`), so a money overshoot carries no float noise.
 */
export function budgetUsage(used: number, limit: number): BudgetUsage {
  const over = roundMoney(used - limit)
  return {
    used,
    limit,
    overshoot: over > 0 ? over : null,
    usedUp: over >= 0,
    share: limit > 0 ? Math.min(1, Math.max(0, used / limit)) : used > 0 ? 1 : 0,
  }
}
