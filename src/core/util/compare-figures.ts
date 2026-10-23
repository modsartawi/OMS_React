/**
 * A figure column's comparator, numeric, with an absent figure LAST in both directions.
 *
 * Born in the delivery-statistics store table (ticket 487) and graduated here at ticket 543, when the
 * dispatch scorecard became its second consumer — a feature may not import a feature.
 *
 * AG Grid negates the comparator's answer for a descending sort, so a `null` has to answer by
 * direction: after every number ascending, and "before" (negated: after) descending.
 */
export function compareFigures(a: number | null, b: number | null, isDescending: boolean): number {
  if (a === null || b === null) {
    if (a === b) return 0
    const absentLast = a === null ? 1 : -1
    return isDescending ? -absentLast : absentLast
  }
  return a - b
}
