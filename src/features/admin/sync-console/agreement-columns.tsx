import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { AgreementGap } from '@/core/models/sync-console'
import { formatMoney3 } from '@/core/util/number-format'
import { MONO } from './console-columns'
import CodeBadgeView from './CodeBadgeView'
import { gapKindLabel } from './store-helpers'

/**
 * The Agreement tab's gap list (spec 2563, ticket 459): one receipt the two rails
 * disagree on per row. As on every console grid, nothing sorts or filters on the client —
 * the door orders and pages the list, and its one filter is the tab's picked day.
 */

/** A rail's total, to 3 decimals as the door sends money; `null` (that rail has no receipt) is blank. */
const formatTotal = (p: ValueFormatterParams) => formatMoney3(p.value as number | null)

export function buildGapColumns(t: TFunction): ColDef<AgreementGap>[] {
  return [
    { headerName: t('agreementTab.gaps.columns.businessDay'), field: 'businessDay', width: 130, cellClass: MONO },
    { headerName: t('agreementTab.gaps.columns.receiptNumber'), field: 'receiptNumber', flex: 1, minWidth: 200, cellClass: MONO },
    {
      // The kind's word and token; a kind this bundle does not know shows its raw code.
      headerName: t('agreementTab.gaps.columns.kind'),
      field: 'kind',
      width: 220,
      cellRenderer: (p: ICellRendererParams<AgreementGap>) =>
        p.data ? (
          <span data-gap-kind={p.data.kind}>
            <CodeBadgeView badge={gapKindLabel(p.data.kind)} code={p.data.kind} />
          </span>
        ) : null,
    },
    { headerName: t('agreementTab.gaps.columns.mirrorTotal'), field: 'mirrorTotal', width: 150, type: 'rightAligned', valueFormatter: formatTotal },
    { headerName: t('agreementTab.gaps.columns.counterTotal'), field: 'counterTotal', width: 150, type: 'rightAligned', valueFormatter: formatTotal },
  ]
}
