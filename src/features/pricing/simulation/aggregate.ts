import type { SimulationResultCondition } from '@/core/models/simulation'

// Client-side condition aggregation — a faithful port of the WPF
// PosSimulationController's `SelectedResultItem` setter (BackOffice 486 decision:
// aggregation stays client-side; the endpoint returns raw `conditions` rows).
// This is the seam ticket 014 builds the condition cards on; keep it pure so it
// is the obvious first unit if a client test tier is later stood up (spec 503).

/** The origin-derived badge shown on a card. `null` = no badge (plain pricing).
 *  Rendered/localised in the view; kept as a machine token here (i18n rule). */
export type ConditionBadge = 'promotion' | 'manual' | 'header'

/** The origin-derived category label token. Every card has one. */
export type ConditionCategory = 'promotion' | 'manual' | 'header' | 'pricing'

/** Origin → badge. P|B (promotion/bonus-buy) and M (manual) and H (header) badge;
 *  anything else (base pricing steps) is unbadged. Mirrors `GetBadgeText`. */
export function conditionBadge(origin: string): ConditionBadge | null {
  switch (origin) {
    case 'P':
    case 'B':
      return 'promotion'
    case 'M':
      return 'manual'
    case 'H':
      return 'header'
    default:
      return null
  }
}

/** Origin → category token. Same switch as the badge but with a fallthrough
 *  `pricing` bucket for unbadged rows. Mirrors `GetCategoryLabel`. */
export function conditionCategory(origin: string): ConditionCategory {
  switch (origin) {
    case 'P':
    case 'B':
      return 'promotion'
    case 'M':
      return 'manual'
    case 'H':
      return 'header'
    default:
      return 'pricing'
  }
}

/** One aggregated group of raw condition rows sharing (type, rate, unit, origin). */
export interface AggregatedCondition {
  /** 1-based display index: non-statistical groups numbered first, then statistical. */
  index: number
  conditionType: string
  description: string
  /** Σ of the group's `conditionBaseValue`. */
  conditionBaseValue: number
  conditionRate: number
  conditionRateUnit: string
  /** Σ of the group's `conditionValue` — the card's headline amount. */
  conditionValue: number
  isStatistics: boolean
  isBonusBuy: boolean
  /** Distinct non-empty bonus-buy numbers across the group's rows. */
  bbyNumbers: string[]
  /** Number of raw rows folded into this group; a card expands only when > 1. */
  count: number
  conditionOrigin: string
  badge: ConditionBadge | null
  category: ConditionCategory
  /** The raw rows themselves — revealed as sub-records when `count > 1`. */
  subs: SimulationResultCondition[]
}

/**
 * Group a line's raw `conditions` rows by (conditionType, conditionRate,
 * conditionRateUnit, conditionOrigin), summing base + value, then number the
 * non-statistical groups first and the statistical ones after — the exact order
 * of the WPF controller's `GroupBy(...).Select(...)` + two-pass index assignment.
 * Groups keep first-appearance order (LINQ-to-objects `GroupBy` semantics).
 */
export function aggregateConditions(
  conditions: SimulationResultCondition[] | null | undefined,
): AggregatedCondition[] {
  const groups = new Map<string, AggregatedCondition>()

  for (const c of conditions ?? []) {
    const origin = c.conditionOrigin ?? ''
    // Composite grouping key = the WPF's anonymous-type equality. Join on the
    // ASCII unit-separator (0x1f), which can't occur in a condition field, so two
    // distinct tuples (e.g. a type/unit containing a space) never collide.
    const key = [c.conditionType, c.conditionRate, c.conditionRateUnit, origin].join('\u001f')
    const existing = groups.get(key)
    if (existing) {
      existing.conditionBaseValue += c.conditionBaseValue
      existing.conditionValue += c.conditionValue
      existing.isBonusBuy = existing.isBonusBuy || c.isBonusBuy
      existing.count += 1
      if (c.bbyNumber && !existing.bbyNumbers.includes(c.bbyNumber)) {
        existing.bbyNumbers.push(c.bbyNumber)
      }
      existing.subs.push(c)
    } else {
      groups.set(key, {
        index: 0,
        conditionType: c.conditionType,
        description: c.description,
        conditionBaseValue: c.conditionBaseValue,
        conditionRate: c.conditionRate,
        conditionRateUnit: c.conditionRateUnit,
        conditionValue: c.conditionValue,
        isStatistics: c.isStatistics,
        isBonusBuy: c.isBonusBuy,
        bbyNumbers: c.bbyNumber ? [c.bbyNumber] : [],
        count: 1,
        conditionOrigin: origin,
        badge: conditionBadge(origin),
        category: conditionCategory(origin),
        subs: [c],
      })
    }
  }

  const list = [...groups.values()]
  let idx = 1
  for (const g of list) if (!g.isStatistics) g.index = idx++
  for (const g of list) if (g.isStatistics) g.index = idx++
  return list
}

/** Count of statistical groups — the "(N hidden)" the toggle reports. */
export function countStatistical(groups: AggregatedCondition[]): number {
  return groups.filter((g) => g.isStatistics).length
}
