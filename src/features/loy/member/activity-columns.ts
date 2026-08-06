import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { LoyActivityRow } from '@/core/models/loy'
import { formatDateTime, formatShortDate } from '@/core/util/date-format'
import { activityStatusKey } from './codes'

/**
 * The Activities tab's six columns (ticket 236, settled by 226 §2).
 *
 * The row's headline is **Points**, and everything about how it draws is a
 * decision rather than a style:
 *
 * - 🚩 **Signed, and never coloured.** The Activity column already names the
 *   direction in the server's own English, so the sign is a *second* reading of a
 *   fact already stated in text. Colour would be the only reading for an agent
 *   who cannot see it, and it would buy a sighted agent nothing.
 * - **Exactly two decimals, always.** `accrualFactor` is `0.285714286`, so
 *   fractional points are routine; trimming zeros would ragged the column and
 *   imply points are integers.
 * - 🚩 **No total row, ever.** The server rounds each row to 2 dp away-from-zero,
 *   so a sum of the rounded rows will not equal the header's `pointsBalance`
 *   (223 §2). The one number an agent may trust is the one in the header.
 *
 * **Sort and filter are on**, unlike the Nphies lists: the entire 100-row window
 * is already in the browser and the caption above the grid says which window it
 * is, so sorting it reorders the result and not a page. That line is 226 §7's and
 * it is what makes Actions' `sortable: false` principled rather than inconsistent.
 *
 * 🚩 **No column links anywhere.** No route accepts an `ActivityId` or a
 * reference number, and `oms/document/:documentNo` is a different identifier
 * space that would 404 on every row (226 §9).
 */
export const ACTIVITY_DEFAULT_COL_DEF: ColDef<LoyActivityRow> = {
  sortable: true,
  filter: true,
  resizable: true,
  cellDataType: false,
}

export function buildActivityColumns(t: TFunction): ColDef<LoyActivityRow>[] {
  return [
    {
      headerName: t('tabs.activities.columns.date'),
      field: 'activityDateTime',
      width: 150,
      valueFormatter: (p: ValueFormatterParams<LoyActivityRow, string>) => formatDateTime(p.value),
    },
    {
      // Server-supplied English, joined from `LoyActivityType.Description`. It is
      // data, not a literal, so it passes through untranslated — and it is what
      // makes the unsigned reading of the Points column unnecessary.
      headerName: t('tabs.activities.columns.activity'),
      field: 'description',
      flex: 1,
      minWidth: 180,
    },
    {
      headerName: t('tabs.activities.columns.points'),
      field: 'points',
      width: 120,
      type: 'numericColumn',
      // `text-end` + tabular numerals so signs and decimal points align into one
      // scannable column. The class is the cell's, not the value's, because the
      // value stays a number and therefore sorts numerically.
      cellClass: 'text-end tabular-nums font-medium',
      valueFormatter: (p: ValueFormatterParams<LoyActivityRow, number>) => formatPoints(p.value),
    },
    {
      headerName: t('tabs.activities.columns.status'),
      colId: 'status',
      width: 110,
      // 🚩 The decode degrades: an unseeded status renders as its bare code, never
      // as a raw `loy:activityStatus.X` (229). The guard lives in `codes.ts`,
      // which is why this call site is one `??`.
      valueGetter: (p) => {
        const code = p.data?.activityStatus
        if (!code) return ''
        const key = activityStatusKey(code)
        return key ? t(key) : code
      },
    },
    {
      headerName: t('tabs.activities.columns.expires'),
      colId: 'expires',
      width: 130,
      // Two blanking rules, both the server's own: expiry is meaningless on a
      // debit (`LastActivityModel.ExpiryDateString` returns empty when
      // `Points <= 0`), and an unset date arrives as the `0001-01-01` sentinel,
      // which `formatShortDate` already blanks through `isBlankDate`.
      //
      // 🚩 The getter yields the **ISO value**, never the display string: this
      // column sorts and filters, and `"01 Jan 2028"` sorts before
      // `"02 Aug 2027"` lexically. Formatting belongs in the formatter, exactly
      // as the Date column above does it.
      valueGetter: (p) => (!p.data || p.data.points <= 0 ? null : p.data.expiryDate),
      valueFormatter: (p: ValueFormatterParams<LoyActivityRow, string | null>) =>
        p.value ? formatShortDate(p.value) : '',
    },
    {
      // The till receipt / source document, as plain selectable text — see the
      // no-links note above.
      headerName: t('tabs.activities.columns.reference'),
      field: 'referenceNumber',
      width: 160,
      cellClass: 'font-mono text-[12px]',
    },
  ]
}

/**
 * A points figure as the column draws it: grouped, **exactly two decimals**, and
 * explicitly signed so a credit reads `+240.00` against a debit's `-450.00`.
 * Zero carries no sign — there is no direction to state.
 */
export function formatPoints(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  })
}
