/**
 * The loyalty-group picker's value (oms ticket 636; BackOffice 3179). The wire carries a bonus-buy's
 * groups as ONE comma-separated upper-case code string (`loyGroups`); the picker reads it into chosen
 * codes and writes the same shape back, so the save body never changes shape.
 *
 * Read as the engine list is (`normaliseCodeList`, upper-cased: any separator, trimmed, order kept),
 * plus one rule a multi-select needs: a code is held once.
 *
 * Decision D2: a code that is not a defined group (authored before the picker) is KEPT and named
 * `unknown`, never dropped — the server's refusal names it on save.
 */
import { normaliseCodeList } from '@/core/util/code-list'
import type { LoyGroup } from '@/core/models/loy-groups'

export interface LoyGroupSelection {
  /** The chosen codes, upper-case, in the order they were written. */
  codes: string[]
  /** Chosen codes the groups list does not define. */
  unknown: string[]
  /** Chosen codes whose group is defined but inactive (the server warns and still saves). */
  inactive: string[]
}

/**
 * The chosen codes in `value`, judged against `groups`. Without the list (`undefined`: not loaded,
 * failed, or no view grant) nothing is judged — the codes are only shown.
 */
export function readLoyGroupSelection(
  value: string | null | undefined,
  groups: readonly Pick<LoyGroup, 'code' | 'isActive'>[] | undefined,
): LoyGroupSelection {
  const codes = [...new Set(splitCodes(value))]
  if (!groups) return { codes, unknown: [], inactive: [] }
  const byCode = new Map(groups.map((g) => [g.code.toUpperCase(), g]))
  return {
    codes,
    unknown: codes.filter((c) => !byCode.has(c)),
    inactive: codes.filter((c) => byCode.get(c)?.isActive === false),
  }
}

/** The wire string for the chosen codes: comma-joined, upper-case; `''` for none. */
export function writeLoyGroupSelection(codes: readonly string[]): string {
  return normaliseCodeList(codes.join(','), { upper: true })
}

function splitCodes(value: string | null | undefined): string[] {
  const list = normaliseCodeList(value, { upper: true })
  return list === '' ? [] : list.split(',')
}
