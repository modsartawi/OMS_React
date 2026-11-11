// The Settlement Account's Excel export: each grid writes a real `.xlsx` through the app's
// one grid writer, `@/core/util/grid-xlsx`. As on the inquiry screens, the file is the grid
// as shown: the rows left after the filter row, in the sort on screen, under the columns on
// screen.

import { useCallback } from 'react'
import type { GridApi } from 'ag-grid-community'
import { useTranslation } from 'react-i18next'

import { notify } from '@/core/services/notify'
import { useGridXlsxExport } from '@/core/ui/use-grid-xlsx-export'
import { gridSheet, writeWorkbook, type XlsxSheet } from '@/core/util/grid-xlsx'

/**
 * The columns written as numbers, so the accountant can total them. Everything else is the
 * text the cell shows: an entry number is an identity, and a store code keeps its zeros.
 */
const NUMERIC_COLUMNS: ReadonlySet<string> = new Set([
  'amount',
  'remainingAmount',
  'today',
  'dayVariance',
  'ageDays',
  'journalCount',
])

/** The Decision column holds buttons and no value. */
const ACTIONS_COLUMN = 'decide'

export function settlementSheet<Row>(
  api: GridApi<Row>,
  name: string,
): XlsxSheet & { rows: Row[]; count: number } {
  return gridSheet(api, name, {
    skip: (colId) => colId === ACTIONS_COLUMN,
    asText: (colId) => !NUMERIC_COLUMNS.has(colId),
  })
}

/** A worksheet name Excel accepts: none of `\ / ? * [ ] :` and at most 31 characters. */
export function settlementSheetName(title: string): string {
  return title
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31)
}

/** `settlement-{slug}-{YYYY-MM-DD}.xlsx`. The slug is a machine token, not a label. */
export function settlementFileName(slug: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `settlement-${slug}-${day}.xlsx`
}

/** The export for one settlement grid: `slug` names the file, `title` its sheet. */
export function useSettlementExport<Row>(slug: string, title: string) {
  const { t } = useTranslation('settlement')
  const write = useCallback(
    (api: GridApi<Row>) =>
      writeWorkbook(
        [settlementSheet(api, settlementSheetName(title))],
        settlementFileName(slug, new Date()),
      ),
    [slug, title],
  )
  const onFailure = useCallback(
    (error: unknown) => {
      console.error('settlement export failed', error)
      notify.error(t('export.failed'), t('export.failedDetail'))
    },
    [t],
  )
  return useGridXlsxExport<Row>(write, onFailure)
}
