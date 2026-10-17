import type { RuleBudgetPeriod, RuleMemberBudget, Says } from '@/core/models/rule-campaign'
import { budgetFigure, budgetUsage } from '@/core/rules/budget'
import { formatCount } from '@/core/util/bidi'

// A member's budgets used (ticket 519, ADR 0091): each profile-scope budget's counter for the member
// against its limit, in the budget's own figures — a count, or money in the campaign's currency.
// Pure: no React, no i18n; the period's words are the page's.

/** One budget the member has used, ready to draw. */
export interface ProfileBudgetRow {
  key: string
  campaignId: string
  campaignCode: string
  campaignName: Says
  name: string
  /** The counter's period: it is the member's count in the current one (lifetime: ever). */
  period: RuleBudgetPeriod
  /** `used / limit` as one string, isolated once where it is drawn: `1 / 2`, `SAR 40.00 / SAR 100.00`. */
  usedOfLimit: string
  /** At or past the limit: the campaign gives this member nothing more this period. */
  usedUp: boolean
  /** How far past the limit, in the same figure; null while not past (at the limit is not over). */
  overshoot: string | null
  /** The bar's fill, 0–1. */
  share: number
}

/** The member's budgets as rows, in HQ's order. */
export function profileBudgetRows(budgets: readonly RuleMemberBudget[]): ProfileBudgetRow[] {
  return budgets.map((b) => {
    const usage = budgetUsage(b.used, b.value)
    const figure = (n: number) => budgetFigure(b.limit, n, b.currency)
    return {
      key: `${b.campaignId}/${b.budgetId}`,
      campaignId: b.campaignId,
      campaignCode: b.campaignCode,
      campaignName: b.campaignName,
      name: b.name,
      period: b.period,
      usedOfLimit: formatCount(figure(b.used), figure(b.value)),
      usedUp: usage.usedUp,
      overshoot: usage.overshoot == null ? null : figure(usage.overshoot),
      share: usage.share,
    }
  })
}
